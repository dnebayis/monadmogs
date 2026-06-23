import { createPublicClient, getAddress, http, type Address } from "viem";
import { kv } from "@vercel/kv";
import {
  getGamesForPlayer,
  getPlayerStats,
  gameScoreline,
  sanitizeGameForPublic,
  VALID_MOVES,
  TIER_PERKS,
  type Game,
  type GameType,
  type GameResolution,
  ArenaStateUnavailableError,
} from "@/lib/arena";
import { ARENA_RECOVERY_REASON_CODES } from "@monad-mogs/core/src/arena";
import { getMogRarity } from "@/lib/rarity";
import { getOnchainMatch } from "@/lib/arena-pool";
import type { AgentSession } from "@/lib/arena-auth";
import { MONAD_CHAIN, MONAD_RPC_URL } from "@/lib/network";
import { MONAD_MOGS_ADDRESS } from "@/lib/contract";
import {
  MOGS_AGENT_BINDINGS_ADDRESS,
} from "@/lib/erc8004";
import { kvKeys } from "@/lib/kv-keys";
import { resolveAgentBinding, AGENT_BINDING_METADATA_KEY } from "@/lib/agent-binding";

const client = createPublicClient({
  chain: MONAD_CHAIN,
  transport: http(MONAD_RPC_URL),
});

const PLAYER_RECOVERY_SCAN_LIMIT = 1000;

type LinkedMatchInfo = {
  matchId: number;
  status?: string;
  entryFee?: string;
  totalPrize?: string;
  tokenPrize?: { token: string; amount: string };
  error?: string;
};

type RecoveryState =
  | { status: "ok"; games: Game[]; activeGames: Game[]; reasonCode: null }
  | { status: "degraded"; games: []; activeGames: []; reason: string; reasonCode: string; retryable: true }
  | { status: "conflict"; games: Game[]; activeGames: Game[]; reason: string; reasonCode: string };

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

export async function getLinkedMatchInfo(gameId: string): Promise<LinkedMatchInfo | null> {
  const matchId = await kv.get<number>(kvKeys.arena.games.matchByGame(gameId));
  if (!matchId) return null;

  try {
    const match = await getOnchainMatch(matchId);
    return {
      matchId,
      status: match.status,
      entryFee: match.entryFee,
      totalPrize: match.totalPrize,
      tokenPrize: match.tokenPrize,
    };
  } catch (caught) {
    return {
      matchId,
      error: caught instanceof Error ? caught.message : "Could not read linked onchain match.",
    };
  }
}

export async function getBindingStatus(session: AgentSession) {
  try {
    const { discovery, binding } = await resolveAgentBinding(BigInt(session.agentId));
    const bound = binding as { tokenContract: string; tokenId: bigint };
    const verified =
      getAddress(bound.tokenContract as Address) === getAddress(MONAD_MOGS_ADDRESS) &&
      Number(bound.tokenId) === session.mogId;

    return {
      verified,
      contract: discovery.contract,
      discovery: {
        metadataKey: AGENT_BINDING_METADATA_KEY,
        metadataPresent: discovery.metadataPresent,
        source: discovery.source,
        fallbackContract: MOGS_AGENT_BINDINGS_ADDRESS,
      },
      tokenContract: bound.tokenContract,
      tokenId: Number(bound.tokenId),
    };
  } catch (caught) {
    return {
      verified: false,
      contract: MOGS_AGENT_BINDINGS_ADDRESS,
      error: caught instanceof Error ? caught.message : "Could not verify ERC-8217 binding.",
    };
  }
}

export async function getRecoveryState(address: string): Promise<RecoveryState> {
  try {
    const games = await getGamesForPlayer(address, PLAYER_RECOVERY_SCAN_LIMIT, { strict: true });
    const activeGames = games.filter((game) => game.status !== "finished");

    if (activeGames.length > 1) {
      return {
        status: "conflict",
        games,
        activeGames,
        reason: "Multiple active games detected for this wallet. Automatic recovery is paused until only one active game remains.",
        reasonCode: ARENA_RECOVERY_REASON_CODES.legacyMultiActiveConflict,
      };
    }

    return { status: "ok", games, activeGames, reasonCode: null };
  } catch (caught) {
    if (caught instanceof ArenaStateUnavailableError) {
      return {
        status: "degraded",
        games: [],
        activeGames: [],
        reason: "Arena recovery state is temporarily unavailable. Retry pending-actions or agent/status before taking a new action.",
        reasonCode: ARENA_RECOVERY_REASON_CODES.recoveryStateUnavailable,
        retryable: true,
      };
    }
    throw caught;
  }
}

export async function buildPendingAction(session: AgentSession) {
  const recovery = await getRecoveryState(session.address);

  if (recovery.status === "degraded") {
    return {
      degraded: true,
      recovery: recovery.status,
      hasPendingAction: false,
      nextAction: "retry_later",
      reason: recovery.reason,
      reasonCode: recovery.reasonCode,
      retryable: recovery.retryable,
      games: [],
    };
  }

  if (recovery.status === "conflict") {
    return {
      degraded: true,
      recovery: recovery.status,
      hasPendingAction: false,
      nextAction: "resolve_recovery_conflict",
      reason: recovery.reason,
      reasonCode: recovery.reasonCode,
      activeGameIds: recovery.activeGames.map((game) => game.id),
      games: recovery.activeGames.map((game) => sanitizeGameForPublic(game, session.address)),
    };
  }

  const game = recovery.activeGames[0] || null;

  if (!game) {
    return {
      degraded: false,
      recovery: recovery.status,
      hasPendingAction: false,
      nextAction: "check_open_games",
      reason: "No waiting or active game for this agent wallet.",
      reasonCode: ARENA_RECOVERY_REASON_CODES.noActiveGame,
      games: [],
    };
  }

  const player = game.players.find((p) => p.address.toLowerCase() === session.address.toLowerCase()) || null;
  const linkedMatch = await getLinkedMatchInfo(game.id);
  const resolve = await getResolveStatus(game.id);

  if (game.status === "waiting") {
    return {
      degraded: false,
      recovery: recovery.status,
      hasPendingAction: false,
      nextAction: "wait_for_opponent",
      reason: "Agent is already seated in a waiting game.",
      reasonCode: ARENA_RECOVERY_REASON_CODES.waitingForOpponent,
      game: sanitizeGameForPublic(game, session.address),
      linkedMatch,
      resolve,
      scoreline: gameScoreline(game),
    };
  }

  if (!player) {
    return {
      degraded: true,
      recovery: "conflict",
      hasPendingAction: false,
      nextAction: "resolve_recovery_conflict",
      reason: "No player entry for this wallet in the active game.",
      reasonCode: ARENA_RECOVERY_REASON_CODES.playerMissingFromRecoveredGame,
      game: sanitizeGameForPublic(game, session.address),
      linkedMatch,
      resolve,
      scoreline: gameScoreline(game),
    };
  }

  const moveSubmitted = player.move !== undefined;
  const rarity = getMogRarity(session.mogId);
  const perks = TIER_PERKS[rarity?.tier || "common"];
  const usedCount = player.specialMoveUsedCount || 0;

  return {
    degraded: false,
    recovery: recovery.status,
    hasPendingAction: !moveSubmitted,
    nextAction: moveSubmitted ? "wait_for_opponent" : "submit_move",
    reason: moveSubmitted ? "Move already submitted for the current round." : "Agent must submit a move for the current round.",
    reasonCode: moveSubmitted ? ARENA_RECOVERY_REASON_CODES.waitingForOpponent : ARENA_RECOVERY_REASON_CODES.moveRequired,
    game: sanitizeGameForPublic(game, session.address),
    linkedMatch,
    resolve,
    scoreline: gameScoreline(game),
    pending: {
      gameId: game.id,
      type: game.type as GameType,
      round: game.round,
      validMoves: VALID_MOVES[game.type],
      currentNumber: game.type === "higher-lower" ? player.currentNumber ?? null : null,
      moveSubmitted,
      specialMove: {
        supported: game.type === "dice-duel" || game.type === "higher-lower",
        availableCount: Math.max(0, perks.specialMovesPerMatch - usedCount),
        source: perks.freeSpecialMove ? "rarity" : "burn",
        tier: rarity?.tier || "common",
      },
    },
  };
}

export async function buildAgentStatus(session: AgentSession) {
  const recovery = await getRecoveryState(session.address);

  const [stats, binding, pendingAction] = await Promise.all([
    getPlayerStats(session.address),
    getBindingStatus(session),
    buildPendingAction(session),
  ]);

  const rarity = getMogRarity(session.mogId);
  const games = recovery.status === "degraded" ? [] : recovery.games;
  const activeGames = recovery.status === "degraded" ? [] : recovery.activeGames;

  return {
    session: {
      address: session.address,
      agentId: session.agentId,
      mogId: session.mogId,
      mogName: session.mogName,
      expiresAt: session.expiresAt,
      verified: session.verified,
    },
    identity: {
      erc8004Registered: session.agentId > 0,
      erc8217Binding: binding,
      rarity: rarity
        ? {
            rank: rarity.rank,
            tier: rarity.tier,
            score: rarity.score,
            percentile: rarity.percentile,
          }
        : null,
    },
    arena: {
      recovery: {
        status: recovery.status,
        reason: recovery.status === "ok" ? null : recovery.reason,
        reasonCode: recovery.reasonCode,
        activeGameIds: activeGames.map((game) => game.id),
      },
      activeGame: recovery.status === "ok" && activeGames[0]
        ? sanitizeGameForPublic(activeGames[0], session.address)
        : null,
      activeGames: activeGames.map((game) => sanitizeGameForPublic(game, session.address)),
      pendingAction,
      stats,
      recentGames: games.slice(0, 10).map((game: Game) => ({
        id: game.id,
        type: game.type,
        status: game.status,
        round: game.round,
        winner: game.winner || null,
        scoreline: gameScoreline(game),
        createdAt: game.createdAt,
        finishedAt: game.finishedAt || null,
      })),
    },
  };
}
