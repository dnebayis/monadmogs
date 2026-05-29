import { NextResponse, type NextRequest } from "next/server";
import {
  createGame,
  joinGame,
  submitMove,
  getGame,
  type Game,
  type GameType,
  type GameMove,
  type GamePlayer,
  GAME_TYPES,
} from "@/lib/arena";
import { validateAuthHeader } from "@/lib/arena-auth";
import { resolvePoolOnchain, getOnchainPool, giveReputationFeedback } from "@/lib/arena-pool";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

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

  // Rate limit: 30 game actions per minute per agent
  const rl = await rateLimit(`arena-game:${session.address}`, 30, 60);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
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
      agentId: session.agentId,
      score: 0,
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
      agentId: session.agentId,
      score: 0,
    };

    try {
      const game = await joinGame(gameId, player, move);
      if (!game) {
        return NextResponse.json({ error: "Cannot join this game." }, { status: 400 });
      }

      // If game finished, resolve pool + reputation
      if (game.status === "finished") {
        if (game.winner) await tryResolveOnchain(gameId, game.winner);
        tryReputationFeedback(game).catch(() => {});
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

      // If game finished, resolve pool + reputation
      if (game.status === "finished") {
        if (game.winner) await tryResolveOnchain(gameId, game.winner);
        tryReputationFeedback(game).catch(() => {});
      }

      return NextResponse.json({ game });
    } catch {
      return NextResponse.json({ error: "Failed to submit move." }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Invalid action. Use: create, join, move." }, { status: 400 });
}

/* GET /api/arena/games?id={gameId} — get single game (rate limited) */
export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`arena-read:${ip}`, 60, 60);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

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
    if (!poolId) return;

    const pool = await getOnchainPool(poolId);
    if (pool.status !== "full") return;

    const result = await resolvePoolOnchain(poolId, winnerAddress);
    await kv.set(`arena:game-resolve:${gameId}`, {
      poolId,
      winnerAddress,
      txHash: result.txHash,
      resolvedAt: new Date().toISOString(),
    }, { ex: 86400 * 7 });
  } catch (err) {
    console.error("Failed to resolve onchain pool:", err);
  }
}

/* ---- Helper: send reputation feedback for finished game ---- */
async function tryReputationFeedback(game: Game) {
  if (game.status !== "finished" || game.players.length !== 2) return;

  const { kv } = await import("@vercel/kv");
  // Prevent duplicate feedback
  const feedbackKey = `arena:reputation:${game.id}`;
  const already = await kv.get(feedbackKey);
  if (already) return;

  await kv.set(feedbackKey, true, { ex: 86400 * 7 });

  for (const player of game.players) {
    if (!player.agentId) continue;

    const isWinner = game.winner === player.address;
    const value = isWinner ? 10 : -3;

    giveReputationFeedback(player.agentId, value, game.type, game.id).catch(() => {});
  }
}
