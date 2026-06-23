import { getOnchainMatch } from "@/lib/arena-pool";
import {
  getGamesForPlayer,
  leaveWaitingGame,
  rebuildPlayerGameIndex,
  type Game,
  type GameStatus,
  ArenaStateUnavailableError,
} from "@/lib/arena";
import { kv } from "@vercel/kv";
import { kvKeys } from "@/lib/kv-keys";

type RepairStrategy = "clear_waiting_games" | "manual_review_required";

export type RecoveryConflictInspection = {
  ok: true;
  address: string;
  activeGames: Array<{
    id: string;
    status: GameStatus;
    type: string;
    round: number;
    createdAt: string;
    matchId: number | null;
  }>;
  keepGameId: string | null;
  repair: {
    strategy: RepairStrategy;
    removableGameIds: string[];
    blockedGameIds: string[];
    requiresExplicitConfirmation: true;
  };
} | {
  ok: false;
  address: string;
  status: 404 | 409 | 503;
  error: string;
  reasonCode: string;
};

function sortActiveGames(games: Game[]) {
  return [...games].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

async function canSafelyRemoveWaitingGame(address: string, game: Game) {
  if (game.status !== "waiting") return false;

  const matchId = await kv.get<number>(kvKeys.arena.games.matchByGame(game.id));
  if (!matchId) return true;

  try {
    const match = await getOnchainMatch(matchId);
    const participants = [match.player1, match.player2]
      .filter(Boolean)
      .map((player) => player.toLowerCase());
    return !participants.includes(address.toLowerCase());
  } catch {
    return false;
  }
}

export async function inspectRecoveryConflict(address: string): Promise<RecoveryConflictInspection> {
  try {
    const games = await getGamesForPlayer(address, 1000, { strict: true });
    const activeGames = sortActiveGames(games.filter((game) => game.status !== "finished"));

    if (activeGames.length === 0) {
      return {
        ok: false,
        address,
        status: 404,
        error: "No active games found for this wallet.",
        reasonCode: "no_active_game",
      };
    }

    if (activeGames.length < 2) {
      return {
        ok: false,
        address,
        status: 409,
        error: "This wallet does not currently have a multi-active-game conflict.",
        reasonCode: "no_recovery_conflict",
      };
    }

    const keepGame = activeGames.find((game) => game.status !== "waiting") || activeGames[0];
    const removableGameIds: string[] = [];
    const blockedGameIds: string[] = [];

    for (const game of activeGames) {
      if (game.id === keepGame.id) continue;
      if (await canSafelyRemoveWaitingGame(address, game)) {
        removableGameIds.push(game.id);
      } else {
        blockedGameIds.push(game.id);
      }
    }

    return {
      ok: true,
      address,
      activeGames: await Promise.all(activeGames.map(async (game) => ({
        id: game.id,
        status: game.status,
        type: game.type,
        round: game.round,
        createdAt: game.createdAt,
        matchId: (await kv.get<number>(kvKeys.arena.games.matchByGame(game.id))) || null,
      }))),
      keepGameId: keepGame.id,
      repair: {
        strategy: blockedGameIds.length === 0 && removableGameIds.length > 0
          ? "clear_waiting_games"
          : "manual_review_required",
        removableGameIds,
        blockedGameIds,
        requiresExplicitConfirmation: true,
      },
    };
  } catch (caught) {
    if (caught instanceof ArenaStateUnavailableError) {
      return {
        ok: false,
        address,
        status: 503,
        error: "Arena recovery state is temporarily unavailable.",
        reasonCode: "recovery_state_unavailable",
      };
    }
    throw caught;
  }
}

export async function repairRecoveryConflict(input: {
  address: string;
  keepGameId: string;
  removeFromGameIds: string[];
}) {
  const before = await inspectRecoveryConflict(input.address);
  if (!before.ok) return before;

  if (before.repair.strategy !== "clear_waiting_games") {
    return {
      ok: false as const,
      address: input.address,
      status: 409 as const,
      error: "This conflict requires manual review and cannot be auto-repaired safely.",
      reasonCode: "manual_review_required",
    };
  }

  if (before.keepGameId !== input.keepGameId) {
    return {
      ok: false as const,
      address: input.address,
      status: 409 as const,
      error: "keepGameId no longer matches the current recommended recovery target.",
      reasonCode: "stale_repair_plan",
    };
  }

  const removable = new Set(before.repair.removableGameIds);
  const requested = Array.from(new Set(input.removeFromGameIds));
  if (requested.length === 0 || requested.some((gameId) => !removable.has(gameId))) {
    return {
      ok: false as const,
      address: input.address,
      status: 400 as const,
      error: "removeFromGameIds must be a non-empty subset of the currently removable conflict games.",
      reasonCode: "invalid_repair_selection",
    };
  }

  const repairedGames: string[] = [];
  for (const gameId of requested) {
    const updated = await leaveWaitingGame(gameId, input.address);
    if (!updated) {
      return {
        ok: false as const,
        address: input.address,
        status: 409 as const,
        error: `Could not safely remove this wallet from waiting game ${gameId}.`,
        reasonCode: "repair_mutation_failed",
      };
    }
    repairedGames.push(gameId);
  }

  const indexedGames = await rebuildPlayerGameIndex(input.address, 1000);
  const after = await inspectRecoveryConflict(input.address);

  return {
    ok: true as const,
    address: input.address,
    keepGameId: input.keepGameId,
    repairedGames,
    indexedGames,
    before,
    after,
  };
}
