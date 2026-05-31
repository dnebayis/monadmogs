import { NextResponse, type NextRequest } from "next/server";
import {
  createOpenGame,
  linkGameToMatch,
  joinGame,
  submitMove,
  getGame,
  type Game,
  type GameType,
  type GameMove,
  type GamePlayer,
  GAME_TYPES,
  isValidMoveForGame,
} from "@/lib/arena";
import { validateAuthHeader } from "@/lib/arena-auth";
import { resolveOnchainMatch, resolveOnchainDraw, getOnchainMatch, giveReputationFeedback } from "@/lib/arena-pool";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/* POST /api/arena/games — create (admin), join, or move (agent auth) */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const action = body.action as string;

  /* ---- CREATE (admin only — no agent auth needed) ---- */
  if (action === "create") {
    const adminSecret = request.headers.get("x-admin-secret");
    if (!process.env.ARENA_ADMIN_SECRET || adminSecret !== process.env.ARENA_ADMIN_SECRET) {
      return NextResponse.json({ error: "Only the arena admin can create games." }, { status: 403 });
    }

    const type = body.type as GameType;
    if (!type || !GAME_TYPES[type]) {
      return NextResponse.json({ error: "Invalid game type." }, { status: 400 });
    }

    const matchId = typeof body.matchId === "number" ? body.matchId : undefined;

    try {
      const game = await createOpenGame(type);
      if (matchId) {
        await linkGameToMatch(game.id, matchId);
      }
      return NextResponse.json({ game }, { status: 201 });
    } catch {
      return NextResponse.json({ error: "Failed to create game." }, { status: 500 });
    }
  }

  /* ---- Agent auth required for join and move ---- */
  const session = await validateAuthHeader(request.headers.get("authorization"));
  if (!session) {
    return NextResponse.json(
      { error: "Authentication required. Use POST /api/arena/auth to get a session token." },
      { status: 401 }
    );
  }

  const rl = await rateLimit(`arena-game:${session.address}`, 30, 60);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  /* ---- JOIN ---- */
  if (action === "join") {
    const gameId = body.gameId as string;
    if (!gameId) {
      return NextResponse.json({ error: "gameId is required." }, { status: 400 });
    }

    const move = body.move as GameMove | undefined;
    const commentary = typeof body.commentary === "string" ? body.commentary.slice(0, 200) : undefined;

    const player: GamePlayer = {
      address: session.address,
      mogId: session.mogId,
      mogName: session.mogName,
      agentId: session.agentId,
      score: 0,
      commentary,
    };

    try {
      const existingGame = await getGame(gameId);
      if (!existingGame) {
        return NextResponse.json({ error: "Game not found." }, { status: 404 });
      }
      if (move && !isValidMoveForGame(existingGame.type, move)) {
        return NextResponse.json(
          { error: `Invalid move '${move}' for ${existingGame.type}.` },
          { status: 400 }
        );
      }

      const onchainCheck = await validateOnchainParticipant(gameId, session.address);
      if (!onchainCheck.ok) {
        return NextResponse.json({ error: onchainCheck.error }, { status: 403 });
      }

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
    const commentary = typeof body.commentary === "string" ? body.commentary.slice(0, 200) : undefined;

    if (!gameId || !move) {
      return NextResponse.json({ error: "gameId and move are required." }, { status: 400 });
    }

    try {
      const existingGame = await getGame(gameId);
      if (!existingGame) {
        return NextResponse.json({ error: "Game not found." }, { status: 404 });
      }
      if (!isValidMoveForGame(existingGame.type, move)) {
        return NextResponse.json(
          { error: `Invalid move '${move}' for ${existingGame.type}.` },
          { status: 400 }
        );
      }

      const game = await submitMove(gameId, session.address, move, commentary);
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
      const { kv } = await import("@vercel/kv");
      const resolve = await kv.get(`arena:game-resolve:${id}`);
      const sanitized = {
        ...game,
        players: game.players.map((p) => ({ ...p, move: undefined })),
      };
      return NextResponse.json({ game: sanitized, resolve });
    }

    const { kv } = await import("@vercel/kv");
    const resolve = await kv.get(`arena:game-resolve:${id}`);
    return NextResponse.json({ game, resolve });
  } catch {
    return NextResponse.json({ error: "Failed to fetch game." }, { status: 500 });
  }
}

/* ---- Helper: ensure offchain players match onchain entrants ---- */
async function validateOnchainParticipant(gameId: string, address: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { kv } = await import("@vercel/kv");
  const matchId = await kv.get<number>(`arena:game-match:${gameId}`);
  if (!matchId) return { ok: true };

  const match = await getOnchainMatch(matchId);
  const participants = [match.player1, match.player2]
    .filter((player) => player && player !== ZERO_ADDRESS)
    .map((player) => player.toLowerCase());

  if (!participants.includes(address.toLowerCase())) {
    return {
      ok: false,
      error: "This wallet has not joined the linked onchain match.",
    };
  }

  return { ok: true };
}

/* ---- Helper: resolve onchain match ---- */
async function tryResolveOnchain(gameId: string, winnerAddress: string | undefined) {
  try {
    const { kv } = await import("@vercel/kv");
    const matchId = await kv.get<number>(`arena:game-match:${gameId}`);
    if (!matchId) return;

    const match = await getOnchainMatch(matchId);
    if (match.status !== "full") return;

    let result;
    if (winnerAddress) {
      result = await resolveOnchainMatch(matchId, winnerAddress);
    } else {
      result = await resolveOnchainDraw(matchId);
    }

    await kv.set(`arena:game-resolve:${gameId}`, {
      status: "resolved",
      matchId,
      winnerAddress: winnerAddress || null,
      txHash: result.txHash,
      resolvedAt: new Date().toISOString(),
    }, { ex: 86400 * 7 });
  } catch (err) {
    try {
      const { kv } = await import("@vercel/kv");
      await kv.set(`arena:game-resolve:${gameId}`, {
        status: "failed",
        winnerAddress: winnerAddress || null,
        error: err instanceof Error ? err.message : "Unknown resolve error",
        failedAt: new Date().toISOString(),
      }, { ex: 86400 * 7 });
    } catch {
      // best-effort visibility
    }
    console.error("Failed to resolve onchain match:", err);
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
