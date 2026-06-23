import { kv } from "@vercel/kv";
import {
  createOpenGame,
  linkGameToMatch,
  joinGame,
  leaveWaitingGame,
  submitMove,
  getGame,
  sanitizeGameForPublic,
  gameScoreline,
  type GameResolution,
  type Game,
  type GameType,
  type GameMove,
  type GamePlayer,
  GAME_TYPES,
  TIER_PERKS,
  isValidMoveForGame,
  supportsSpecialMove,
  type SpecialMoveRequest,
  getGamesForPlayer,
  ArenaStateUnavailableError,
} from "@/lib/arena";
import { ARENA_RECOVERY_REASON_CODES } from "@monad-mogs/core/src/arena";
import type { AgentSession } from "@/lib/arena-auth";
import {
  resolveOnchainMatch,
  resolveOnchainDraw,
  getOnchainMatch,
  giveReputationFeedback,
  MOGS_ARENA_ADDRESS,
} from "@/lib/arena-pool";
import { validateAndReserveSpecialMoveBurn } from "@/lib/mogs-burn";
import { getMogRarity, type RarityTier } from "@/lib/rarity";
import { KV_TTL, kvKeys } from "@/lib/kv-keys";
import { sanitizeOperationalError } from "@/lib/arena-observability";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const RARE_PLUS_TIERS: RarityTier[] = ["rare", "epic", "legendary"];

export type ArenaServiceResult = {
  status: number;
  body: Record<string, unknown>;
  headers?: Record<string, string>;
};

type SpecialMoveValidation =
  | { ok: true; specialMove?: SpecialMoveRequest }
  | { ok: false; status: number; error: string };

export async function createArenaGameAction(body: Record<string, unknown>): Promise<ArenaServiceResult> {
  const type = body.type as GameType;
  if (!type || !GAME_TYPES[type]) {
    return { status: 400, body: { error: "Invalid game type." } };
  }

  const matchId = typeof body.matchId === "number" ? body.matchId : undefined;

  try {
    const game = await createOpenGame(type);
    if (matchId) {
      await linkGameToMatch(game.id, matchId);
    }
    return { status: 201, body: { game } };
  } catch {
    return { status: 500, body: { error: "Failed to create game." } };
  }
}

export async function joinArenaGameAction(
  body: Record<string, unknown>,
  session: AgentSession,
): Promise<ArenaServiceResult> {
  const gameId = body.gameId as string;
  if (!gameId) {
    return { status: 400, body: { error: "gameId is required." } };
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
      return { status: 404, body: { error: "Game not found." } };
    }
    if (existingGame.type === "higher-lower" && move) {
      return {
        status: 400,
        body: {
          error: "Higher or Lower join must not include an opening move.",
          nextAction: "join_without_move_then_read_current_number",
        },
      };
    }
    if (move && !isValidMoveForGame(existingGame.type, move)) {
      return { status: 400, body: { error: `Invalid move '${move}' for ${existingGame.type}.` } };
    }

    const recoveryGate = await validateSingleActiveGame(session.address, gameId);
    if (!recoveryGate.ok) {
      return { status: recoveryGate.status, body: recoveryGate.body };
    }

    const specialMove = await validateSpecialMove(body.specialMove, existingGame, session, move);
    if (!specialMove.ok) {
      return { status: specialMove.status, body: { error: specialMove.error } };
    }

    const onchainCheck = await validateOnchainParticipant(gameId, session.address);
    if (!onchainCheck.ok) {
      return { status: 403, body: { error: onchainCheck.error } };
    }

    const game = await joinGame(gameId, player, move, specialMove.specialMove);
    if (!game) {
      return { status: 400, body: { error: "Cannot join this game." } };
    }

    await handleFinishedGame(gameId, game);
    return {
      status: 200,
      body: {
        game: game.status === "finished" ? game : sanitizeGameForPublic(game, session.address),
        meta: gameResponseMeta(existingGame, game),
        resolve: game.status === "finished" ? await getResolveStatus(gameId) : null,
      },
    };
  } catch (err) {
    return {
      status: 500,
      body: {
        error: "Failed to join game.",
        detail: err instanceof Error ? err.message : "Unknown error",
        arenaAddress: MOGS_ARENA_ADDRESS,
        hint: "Confirm the agent joined the same arenaAddress returned by /api/arena?view=open and that the wallet has no other active onchain match.",
      },
    };
  }
}

async function validateSingleActiveGame(address: string, joiningGameId: string) {
  try {
    const games = await getGamesForPlayer(address, 1000, { strict: true });
    const activeGames = games.filter((game) => game.status !== "finished");

    if (activeGames.length > 1) {
      return {
        ok: false as const,
        status: 409,
        body: {
          error: "Multiple active games detected for this wallet.",
          reasonCode: ARENA_RECOVERY_REASON_CODES.legacyMultiActiveConflict,
          nextAction: "resolve_recovery_conflict",
          activeGameIds: activeGames.map((game) => game.id),
        },
      };
    }

    const existingActive = activeGames.find((game) => game.id !== joiningGameId);
    if (existingActive) {
      return {
        ok: false as const,
        status: 409,
        body: {
          error: "This wallet already has an active game.",
          reasonCode: ARENA_RECOVERY_REASON_CODES.existingActiveGame,
          nextAction: "recover_existing_game",
          activeGameId: existingActive.id,
        },
      };
    }

    return { ok: true as const };
  } catch (caught) {
    if (caught instanceof ArenaStateUnavailableError) {
      return {
        ok: false as const,
        status: 503,
        body: {
          error: "Arena recovery state unavailable.",
          degraded: true,
          reasonCode: ARENA_RECOVERY_REASON_CODES.recoveryStateUnavailable,
          nextAction: "retry_later",
        },
      };
    }
    throw caught;
  }
}

export async function submitArenaMoveAction(
  body: Record<string, unknown>,
  session: AgentSession,
): Promise<ArenaServiceResult> {
  const gameId = body.gameId as string;
  const move = body.move as GameMove;
  const commentary = typeof body.commentary === "string" ? body.commentary.slice(0, 200) : undefined;

  if (!gameId || !move) {
    return { status: 400, body: { error: "gameId and move are required." } };
  }

  try {
    const existingGame = await getGame(gameId);
    if (!existingGame) {
      return { status: 404, body: { error: "Game not found." } };
    }
    if (!isValidMoveForGame(existingGame.type, move)) {
      return { status: 400, body: { error: `Invalid move '${move}' for ${existingGame.type}.` } };
    }

    const existingPlayer = existingGame.players.find(
      (p) => p.address.toLowerCase() === session.address.toLowerCase(),
    );
    if (existingPlayer?.move) {
      return { status: 409, body: { error: "Move already submitted for this round.", round: existingGame.round } };
    }

    const specialMove = await validateSpecialMove(body.specialMove, existingGame, session, move);
    if (!specialMove.ok) {
      return { status: specialMove.status, body: { error: specialMove.error } };
    }

    const game = await submitMove(gameId, session.address, move, commentary, specialMove.specialMove);
    if (!game) {
      const latestGame = await getGame(gameId);
      const latestPlayer = latestGame?.players.find(
        (p) => p.address.toLowerCase() === session.address.toLowerCase(),
      );
      if (latestPlayer?.move) {
        return { status: 409, body: { error: "Move already submitted for this round.", round: latestGame?.round } };
      }
      return { status: 400, body: { error: "Cannot submit move." } };
    }

    await handleFinishedGame(gameId, game);
    return {
      status: 200,
      body: {
        game: game.status === "finished" ? game : sanitizeGameForPublic(game, session.address),
        meta: gameResponseMeta(existingGame, game),
        resolve: game.status === "finished" ? await getResolveStatus(gameId) : null,
      },
    };
  } catch {
    return { status: 500, body: { error: "Failed to submit move." } };
  }
}

export async function leaveArenaGameAction(
  body: Record<string, unknown>,
  session: AgentSession,
): Promise<ArenaServiceResult> {
  const gameId = body.gameId as string;
  if (!gameId) {
    return { status: 400, body: { error: "gameId is required." } };
  }

  try {
    const existingGame = await getGame(gameId);
    if (!existingGame) {
      return { status: 404, body: { error: "Game not found." } };
    }
    if (existingGame.status !== "waiting") {
      return { status: 400, body: { error: "Only waiting games can be left. Full matches must be played or resolved." } };
    }
    const player = existingGame.players.find((p) => p.address.toLowerCase() === session.address.toLowerCase());
    if (!player) {
      return { status: 400, body: { error: "This wallet is not in the game." } };
    }

    const matchId = await kv.get<number>(kvKeys.arena.games.matchByGame(gameId));
    if (matchId) {
      const match = await getOnchainMatch(matchId);
      if (
        match.status === "open" &&
        [match.player1, match.player2].some((addr) => addr.toLowerCase() === session.address.toLowerCase())
      ) {
        return {
          status: 409,
          body: {
            error: "Onchain leave required first.",
            nextAction: "call_leaveMatch_then_leave_api",
            arenaAddress: MOGS_ARENA_ADDRESS,
            matchId,
            function: "leaveMatch(uint256 matchId)",
            reason: "The API cannot refund onchain entry fees because it does not hold the agent wallet private key.",
          },
        };
      }
    }

    const game = await leaveWaitingGame(gameId, session.address);
    if (!game) {
      return { status: 400, body: { error: "Cannot leave this game." } };
    }
    return { status: 200, body: { game, resolve: null } };
  } catch (err) {
    return {
      status: 500,
      body: { error: "Failed to leave game.", detail: err instanceof Error ? err.message : "Unknown error" },
    };
  }
}

export async function getArenaGameView(gameId: string, viewerAddress?: string): Promise<ArenaServiceResult> {
  if (!gameId) {
    return { status: 400, body: { error: "Game id is required." } };
  }

  try {
    const game = await getGame(gameId);
    if (!game) {
      return { status: 404, body: { error: "Game not found." } };
    }

    const resolve = await getResolveStatus(gameId);
    return {
      status: 200,
      body: {
        game: game.status === "finished" ? game : sanitizeGameForPublic(game, viewerAddress),
        resolve,
        scoreline: gameScoreline(game),
      },
    };
  } catch {
    return { status: 500, body: { error: "Failed to fetch game." } };
  }
}

export function gameResponseMeta(before: Game, after: Game) {
  const previousRoundResolved = after.rounds.length > before.rounds.length;
  return {
    previousRoundResolved,
    resolvedRound: previousRoundResolved ? after.rounds.at(-1)?.round ?? null : null,
    currentRound: after.round,
    status: after.status,
    scoreline: gameScoreline(after),
    note: previousRoundResolved
      ? "Both players had submitted moves, so the previous round resolved immediately in this response."
      : null,
  };
}

export async function getResolveStatus(gameId: string): Promise<GameResolution> {
  const resolve = await kv.get<GameResolution>(kvKeys.arena.games.resolve(gameId));
  if (resolve) return resolve;

  const matchId = await kv.get<number>(kvKeys.arena.games.matchByGame(gameId));
  if (!matchId) {
    return { status: null, reason: "offchain-only game" };
  }

  return {
    status: null,
    matchId,
    reason: "linked prize match exists, but no settlement record has been written yet",
  };
}

export async function validateOnchainParticipant(
  gameId: string,
  address: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const matchId = await kv.get<number>(kvKeys.arena.games.matchByGame(gameId));
  if (!matchId) return { ok: true };

  const match = await getOnchainMatch(matchId);
  if (match.status !== "open" && match.status !== "full") {
    return {
      ok: false,
      error: `Linked onchain match is ${match.status}. Join a current open match from /api/arena?view=open.`,
    };
  }

  const participants = [match.player1, match.player2]
    .filter((player) => player && player !== ZERO_ADDRESS)
    .map((player) => player.toLowerCase());

  if (!participants.includes(address.toLowerCase())) {
    return { ok: false, error: "This wallet has not joined the linked onchain match." };
  }

  return { ok: true };
}

export async function validateSpecialMove(
  input: unknown,
  game: Game,
  session: AgentSession,
  move?: GameMove,
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

  const rarity = getMogRarity(session.mogId);
  if (!rarity) {
    return { ok: false, status: 400, error: "Mog rarity could not be verified." };
  }

  const perks = TIER_PERKS[rarity.tier];
  const existingPlayer = game.players.find((p) => p.address.toLowerCase() === session.address.toLowerCase());
  const usedCount = existingPlayer?.specialMoveUsedCount || 0;
  if (usedCount >= perks.specialMovesPerMatch) {
    return {
      ok: false,
      status: 400,
      error: `This Mog has used all ${perks.specialMovesPerMatch} Special Move(s) for this match.`,
    };
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

async function handleFinishedGame(gameId: string, game: Game) {
  if (game.status !== "finished") return;
  await tryResolveOnchain(gameId, game.winner);
  tryReputationFeedback(game).catch(() => {});
}

export async function tryResolveOnchain(gameId: string, winnerAddress: string | undefined) {
  try {
    const matchId = await kv.get<number>(kvKeys.arena.games.matchByGame(gameId));
    if (!matchId) return;

    const match = await getOnchainMatch(matchId);
    if (match.status !== "full") return;

    const result = winnerAddress
      ? await resolveOnchainMatch(matchId, winnerAddress)
      : await resolveOnchainDraw(matchId);

    await kv.set(kvKeys.arena.games.resolve(gameId), {
      status: "resolved",
      matchId,
      winnerAddress: winnerAddress || null,
      txHash: result.txHash,
      resolvedAt: new Date().toISOString(),
    }, { ex: KV_TTL.resolve });
  } catch (err) {
    try {
    await kv.set(kvKeys.arena.games.resolve(gameId), {
      status: "failed",
      winnerAddress: winnerAddress || null,
      matchId: await kv.get<number>(kvKeys.arena.games.matchByGame(gameId)) || undefined,
      error: sanitizeOperationalError(err),
      failedAt: new Date().toISOString(),
      retryable: true,
      suggestedNextAction: "retry_resolve_or_cancel_match",
    }, { ex: KV_TTL.resolve });
    } catch {
      // best-effort visibility
    }
    console.error("Failed to resolve onchain match:", err);
  }
}

export async function tryReputationFeedback(game: Game) {
  if (game.status !== "finished" || game.players.length !== 2) return;

  const feedbackKey = kvKeys.arena.leaderboard.reputationFeedback(game.id);
  const already = await kv.get(feedbackKey);
  if (already) return;

  const pendingSet = await kv.set(feedbackKey, "pending", { ex: KV_TTL.reputationFeedback, nx: true });
  if (!pendingSet) return;

  try {
    for (const player of game.players) {
      if (!player.agentId) continue;

      const value = !game.winner ? 0 : game.winner === player.address ? 10 : -3;
      const result = await giveReputationFeedback(player.agentId, value, game.type, game.id);
      if (!result) throw new Error(`Reputation feedback skipped for agent #${player.agentId}.`);
    }
    await kv.set(feedbackKey, "sent", { ex: KV_TTL.reputationFeedback });
  } catch (err) {
    await kv.set(kvKeys.arena.leaderboard.reputationFeedbackFailure(game.id), {
      status: "failed",
      gameId: game.id,
      agentIds: game.players.map((player) => player.agentId).filter(Boolean),
      error: sanitizeOperationalError(err),
      failedAt: new Date().toISOString(),
      retryable: true,
      suggestedNextAction: "retry_reputation_feedback",
    }, { ex: KV_TTL.reputationFeedback });
    await kv.del(feedbackKey);
    throw err;
  }
}
