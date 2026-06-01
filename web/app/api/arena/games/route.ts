import { NextResponse, type NextRequest } from "next/server";
import {
  createOpenGame,
  linkGameToMatch,
  joinGame,
  leaveWaitingGame,
  submitMove,
  getGame,
  type Game,
  type GameType,
  type GameMove,
  type GamePlayer,
  GAME_TYPES,
  isValidMoveForGame,
  supportsSpecialMove,
  type SpecialMoveRequest,
} from "@/lib/arena";
import { validateAuthHeader } from "@/lib/arena-auth";
import { resolveOnchainMatch, resolveOnchainDraw, getOnchainMatch, giveReputationFeedback } from "@/lib/arena-pool";
import { validateAndReserveSpecialMoveBurn } from "@/lib/mogs-burn";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { getMogRarity, type RarityTier } from "@/lib/rarity";
import { MOGS_ARENA_ADDRESS } from "@/lib/arena-pool";

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
      const specialMove = await validateSpecialMove(body.specialMove, existingGame, session, move);
      if (!specialMove.ok) {
        return NextResponse.json({ error: specialMove.error }, { status: specialMove.status });
      }

      const onchainCheck = await validateOnchainParticipant(gameId, session.address);
      if (!onchainCheck.ok) {
        return NextResponse.json({ error: onchainCheck.error }, { status: 403 });
      }

      const game = await joinGame(gameId, player, move, specialMove.specialMove);
      if (!game) {
        return NextResponse.json({ error: "Cannot join this game." }, { status: 400 });
      }

      // If game finished, resolve pool + reputation
      if (game.status === "finished") {
        await tryResolveOnchain(gameId, game.winner);
        tryReputationFeedback(game).catch(() => {});
      }

      return NextResponse.json({ game });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return NextResponse.json(
        {
          error: "Failed to join game.",
          detail: message,
          arenaAddress: MOGS_ARENA_ADDRESS,
          hint: "Confirm the agent joined the same arenaAddress returned by /api/arena?view=open and that the wallet has no other active onchain match.",
        },
        { status: 500 },
      );
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
      const specialMove = await validateSpecialMove(body.specialMove, existingGame, session, move);
      if (!specialMove.ok) {
        return NextResponse.json({ error: specialMove.error }, { status: specialMove.status });
      }

      const game = await submitMove(gameId, session.address, move, commentary, specialMove.specialMove);
      if (!game) {
        return NextResponse.json({ error: "Cannot submit move." }, { status: 400 });
      }

      // If game finished, resolve pool + reputation
      if (game.status === "finished") {
        await tryResolveOnchain(gameId, game.winner);
        tryReputationFeedback(game).catch(() => {});
      }

      return NextResponse.json({ game });
    } catch {
      return NextResponse.json({ error: "Failed to submit move." }, { status: 500 });
    }
  }

  /* ---- LEAVE WAITING GAME ---- */
  if (action === "leave") {
    const gameId = body.gameId as string;
    if (!gameId) {
      return NextResponse.json({ error: "gameId is required." }, { status: 400 });
    }

    try {
      const existingGame = await getGame(gameId);
      if (!existingGame) {
        return NextResponse.json({ error: "Game not found." }, { status: 404 });
      }
      if (existingGame.status !== "waiting") {
        return NextResponse.json(
          { error: "Only waiting games can be left. Full matches must be played or resolved." },
          { status: 400 },
        );
      }
      const player = existingGame.players.find((p) => p.address.toLowerCase() === session.address.toLowerCase());
      if (!player) {
        return NextResponse.json({ error: "This wallet is not in the game." }, { status: 400 });
      }

      const { kv } = await import("@vercel/kv");
      const matchId = await kv.get<number>(`arena:game-match:${gameId}`);
      if (matchId) {
        const match = await getOnchainMatch(matchId);
        if (
          match.status === "open" &&
          [match.player1, match.player2].some((addr) => addr.toLowerCase() === session.address.toLowerCase())
        ) {
          return NextResponse.json(
            {
              error: "Onchain leave required first.",
              nextAction: "call_leaveMatch_then_leave_api",
              arenaAddress: MOGS_ARENA_ADDRESS,
              matchId,
              function: "leaveMatch(uint256 matchId)",
              reason: "The API cannot refund onchain entry fees because it does not hold the agent wallet private key.",
            },
            { status: 409 },
          );
        }
      }

      const game = await leaveWaitingGame(gameId, session.address);
      if (!game) {
        return NextResponse.json({ error: "Cannot leave this game." }, { status: 400 });
      }
      return NextResponse.json({ game });
    } catch (err) {
      return NextResponse.json(
        { error: "Failed to leave game.", detail: err instanceof Error ? err.message : "Unknown error" },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ error: "Invalid action. Use: create, join, move, leave." }, { status: 400 });
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
        players: game.players.map((p) => ({
          ...p,
          move: undefined,
          commentary: undefined,
          pendingSpecialMove: undefined,
        })),
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

type AgentSession = NonNullable<Awaited<ReturnType<typeof validateAuthHeader>>>;

type SpecialMoveValidation =
  | { ok: true; specialMove?: SpecialMoveRequest }
  | { ok: false; status: number; error: string };

const RARE_PLUS_TIERS: RarityTier[] = ["rare", "epic", "legendary"];

async function validateSpecialMove(
  input: unknown,
  game: Game,
  session: AgentSession,
  move?: GameMove
): Promise<SpecialMoveValidation> {
  if (input === undefined || input === null) return { ok: true };
  if (!move) {
    return { ok: false, status: 400, error: "Special Move must be submitted with a move." };
  }
  if (!supportsSpecialMove(game.type)) {
    return { ok: false, status: 400, error: "Special Move is only supported in Dice Duel and Higher or Lower." };
  }
  if (typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, status: 400, error: "specialMove must be an object." };
  }

  const specialMove = input as Record<string, unknown>;
  if (specialMove.use !== true) {
    return { ok: false, status: 400, error: "specialMove.use must be true." };
  }
  const source = specialMove.source;
  if (source !== "rarity" && source !== "burn") {
    return { ok: false, status: 400, error: "specialMove.source must be rarity or burn." };
  }

  const existingPlayer = game.players.find((p) => p.address.toLowerCase() === session.address.toLowerCase());
  if (existingPlayer?.specialMoveUsed) {
    return { ok: false, status: 400, error: "This Mog already used its Special Move in this match." };
  }

  const rarity = getMogRarity(session.mogId);
  if (!rarity) {
    return { ok: false, status: 400, error: "Mog rarity could not be verified." };
  }

  if (source === "rarity") {
    if (!RARE_PLUS_TIERS.includes(rarity.tier)) {
      return { ok: false, status: 400, error: "Only rare, epic, or legendary Mogs can use a free Special Move." };
    }
    return { ok: true, specialMove: { use: true, source } };
  }

  if (rarity.tier !== "common" && rarity.tier !== "uncommon") {
    return { ok: false, status: 400, error: "Rare, epic, and legendary Mogs cannot stack a burn Special Move." };
  }

  const burnTxHash = typeof specialMove.burnTxHash === "string" ? specialMove.burnTxHash : "";
  if (!burnTxHash) {
    return { ok: false, status: 400, error: "burnTxHash is required for a burn Special Move." };
  }

  const burn = await validateAndReserveSpecialMoveBurn({
    txHash: burnTxHash,
    agentAddress: session.address,
    gameId: game.id,
    mogId: session.mogId,
    gameCreatedAt: game.createdAt,
  });
  if (!burn.ok) {
    return { ok: false, status: 400, error: burn.error };
  }

  return { ok: true, specialMove: { use: true, source, burnTxHash } };
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
