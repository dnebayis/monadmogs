import { NextResponse, type NextRequest } from "next/server";
import {
  createGame,
  joinGame,
  submitMove,
  getGame,
  resolveGame,
  type GameType,
  type GameMove,
  type GamePlayer,
  GAME_TYPES,
} from "@/lib/arena";
import { validateAuthHeader } from "@/lib/arena-auth";
import { resolvePoolOnchain, getOnchainPool } from "@/lib/arena-pool";

/* POST /api/arena/games — create, join, or move (auth required) */
export async function POST(request: NextRequest) {
  // Validate auth
  const session = await validateAuthHeader(request.headers.get("authorization"));
  if (!session) {
    return NextResponse.json(
      { error: "Authentication required. Use POST /api/arena/auth to get a session token." },
      { status: 401 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const action = body.action as string;

  /* ---- CREATE ---- */
  if (action === "create") {
    const type = body.type as GameType;
    if (!type || !GAME_TYPES[type]) {
      return NextResponse.json({ error: "Invalid game type." }, { status: 400 });
    }

    const poolId = typeof body.poolId === "number" ? body.poolId : undefined;
    const move = body.move as GameMove | undefined;

    const player: GamePlayer = {
      address: session.address,
      mogId: session.mogId,
      mogName: session.mogName,
    };

    try {
      const game = await createGame(type, player, move);
      // Store poolId association if provided
      if (poolId) {
        const { kv } = await import("@vercel/kv");
        await kv.set(`arena:game-pool:${game.id}`, poolId, { ex: 86400 });
      }
      return NextResponse.json({ game }, { status: 201 });
    } catch {
      return NextResponse.json({ error: "Failed to create game." }, { status: 500 });
    }
  }

  /* ---- JOIN ---- */
  if (action === "join") {
    const gameId = body.gameId as string;
    if (!gameId) {
      return NextResponse.json({ error: "gameId is required." }, { status: 400 });
    }

    const move = body.move as GameMove | undefined;

    const player: GamePlayer = {
      address: session.address,
      mogId: session.mogId,
      mogName: session.mogName,
    };

    try {
      const game = await joinGame(gameId, player, move);
      if (!game) {
        return NextResponse.json({ error: "Cannot join this game." }, { status: 400 });
      }

      // If game finished, try to resolve onchain pool
      if (game.status === "finished" && game.winner) {
        await tryResolveOnchain(gameId, game.winner);
      }

      return NextResponse.json({ game });
    } catch {
      return NextResponse.json({ error: "Failed to join game." }, { status: 500 });
    }
  }

  /* ---- MOVE ---- */
  if (action === "move") {
    const gameId = body.gameId as string;
    const move = body.move as GameMove;

    if (!gameId || !move) {
      return NextResponse.json({ error: "gameId and move are required." }, { status: 400 });
    }

    try {
      const game = await submitMove(gameId, session.address, move);
      if (!game) {
        return NextResponse.json({ error: "Cannot submit move." }, { status: 400 });
      }

      // If game finished, try to resolve onchain pool
      if (game.status === "finished" && game.winner) {
        await tryResolveOnchain(gameId, game.winner);
      }

      return NextResponse.json({ game });
    } catch {
      return NextResponse.json({ error: "Failed to submit move." }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Invalid action. Use: create, join, move." }, { status: 400 });
}

/* GET /api/arena/games?id={gameId} — get single game (no auth required) */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Game id is required." }, { status: 400 });
  }

  try {
    const game = await getGame(id);
    if (!game) {
      return NextResponse.json({ error: "Game not found." }, { status: 404 });
    }

    // Hide opponent moves for active games
    if (game.status !== "finished") {
      const sanitized = {
        ...game,
        players: game.players.map((p) => ({ ...p, move: undefined })),
      };
      return NextResponse.json({ game: sanitized });
    }

    return NextResponse.json({ game });
  } catch {
    return NextResponse.json({ error: "Failed to fetch game." }, { status: 500 });
  }
}

/* ---- Helper: resolve onchain prize pool ---- */
async function tryResolveOnchain(gameId: string, winnerAddress: string) {
  try {
    const { kv } = await import("@vercel/kv");
    const poolId = await kv.get<number>(`arena:game-pool:${gameId}`);
    if (!poolId) return; // no onchain pool linked

    const pool = await getOnchainPool(poolId);
    if (pool.status !== "full") return; // pool not ready

    const result = await resolvePoolOnchain(poolId, winnerAddress);
    // Store resolution tx
    await kv.set(`arena:game-resolve:${gameId}`, {
      poolId,
      winnerAddress,
      txHash: result.txHash,
      resolvedAt: new Date().toISOString(),
    }, { ex: 86400 * 7 }); // keep for 7 days
  } catch (err) {
    console.error("Failed to resolve onchain pool:", err);
    // Game result is still valid even if onchain resolution fails
  }
}
