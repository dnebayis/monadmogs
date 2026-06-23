import { kv } from "@vercel/kv";
import { getGame, getRecentGames, type GameResolution } from "@/lib/arena";
import { getMatchCount, getOnchainMatch, MOGS_ARENA_ADDRESS } from "@/lib/arena-pool";
import { getResolveStatus } from "@/lib/arena-game-service";
import { kvKeys } from "@/lib/kv-keys";
import { sanitizeOperationalError } from "@/lib/arena-observability";
import { inspectRecoveryConflict } from "@/lib/arena-repair";

export type ArenaHealthIssue = {
  type:
    | "failed_resolve"
    | "failed_reputation_feedback"
    | "unresolved_prize_match"
    | "orphaned_game_match"
    | "linked_match_mismatch"
    | "expired_unresolved_match"
    | "recovery_conflict";
  severity: "low" | "medium" | "high";
  gameId?: string;
  matchId?: number;
  status?: string | null;
  txHash?: string;
  error?: string;
  timestamp?: string;
  playerAddress?: string;
  activeGameIds?: string[];
  retryable?: boolean;
  retryMeta?: Record<string, unknown>;
  repair?: {
    strategy: "clear_waiting_games" | "manual_review_required";
    keepGameId: string | null;
    removableGameIds: string[];
    blockedGameIds: string[];
    requiresExplicitConfirmation: true;
  };
  suggestedNextAction: string;
};

type ReputationFailure = {
  status?: string;
  gameId?: string;
  agentIds?: number[];
  error?: string;
  failedAt?: string;
  retryable?: boolean;
  suggestedNextAction?: string;
};

function resolveTimestamp(resolve: GameResolution): string | undefined {
  return resolve.resolvedAt || resolve.failedAt;
}

function pushUnique(issues: ArenaHealthIssue[], issue: ArenaHealthIssue) {
  const key = `${issue.type}:${issue.playerAddress || ""}:${issue.gameId || ""}:${issue.matchId || ""}`;
  if (!issues.some((existing) => `${existing.type}:${existing.playerAddress || ""}:${existing.gameId || ""}:${existing.matchId || ""}` === key)) {
    issues.push(issue);
  }
}

export async function buildArenaHealth(options: { recentLimit?: number; matchLimit?: number } = {}) {
  const recentLimit = Math.min(Math.max(Number(options.recentLimit || 50), 1), 100);
  const matchLimit = Math.min(Math.max(Number(options.matchLimit || 20), 1), 100);
  const checkedAt = new Date().toISOString();
  const issues: ArenaHealthIssue[] = [];

  const recentGames = await getRecentGames(recentLimit);
  for (const game of recentGames) {
    const resolve = await getResolveStatus(game.id);
    const matchId = resolve.matchId ?? (await kv.get<number>(kvKeys.arena.games.matchByGame(game.id))) ?? undefined;

    if (resolve.status === "failed") {
      pushUnique(issues, {
        type: "failed_resolve",
        severity: "high",
        gameId: game.id,
        matchId,
        status: resolve.status,
        error: resolve.error ? sanitizeOperationalError(resolve.error) : undefined,
        timestamp: resolveTimestamp(resolve),
        retryable: resolve.retryable,
        retryMeta: resolve.retryable
          ? {
              matchId,
              winnerAddress: resolve.winnerAddress || null,
            }
          : undefined,
        suggestedNextAction: "retry_resolve_or_cancel_match",
      });
    }

    if (game.status === "finished" && matchId && !resolve.status) {
      pushUnique(issues, {
        type: "unresolved_prize_match",
        severity: "medium",
        gameId: game.id,
        matchId,
        status: resolve.status,
        timestamp: game.finishedAt,
        suggestedNextAction: game.winner ? "resolve_match" : "resolve_draw",
      });
    }

    const reputationFailure = await kv.get<ReputationFailure>(
      kvKeys.arena.leaderboard.reputationFeedbackFailure(game.id),
    );
    if (reputationFailure?.status === "failed") {
      pushUnique(issues, {
        type: "failed_reputation_feedback",
        severity: "medium",
        gameId: game.id,
        matchId,
        status: reputationFailure.status,
        error: reputationFailure.error ? sanitizeOperationalError(reputationFailure.error) : undefined,
        timestamp: reputationFailure.failedAt,
        retryable: reputationFailure.retryable,
        retryMeta: reputationFailure.retryable
          ? {
              gameId: game.id,
              agentIds: reputationFailure.agentIds || [],
            }
          : undefined,
        suggestedNextAction: reputationFailure.suggestedNextAction || "retry_reputation_feedback",
      });
    }
  }

  const conflictAddresses = new Set<string>();
  for (const game of recentGames) {
    if (game.status === "finished") continue;
    for (const player of game.players) {
      conflictAddresses.add(player.address.toLowerCase());
    }
  }

  for (const address of conflictAddresses) {
    const inspection = await inspectRecoveryConflict(address);
    if (!inspection.ok || inspection.activeGames.length < 2) continue;

    pushUnique(issues, {
      type: "recovery_conflict",
      severity: inspection.repair.strategy === "clear_waiting_games" ? "medium" : "high",
      playerAddress: inspection.address,
      gameId: inspection.keepGameId || inspection.activeGames[0]?.id,
      activeGameIds: inspection.activeGames.map((game) => game.id),
      repair: {
        strategy: inspection.repair.strategy,
        keepGameId: inspection.keepGameId,
        removableGameIds: inspection.repair.removableGameIds,
        blockedGameIds: inspection.repair.blockedGameIds,
        requiresExplicitConfirmation: true,
      },
      suggestedNextAction:
        inspection.repair.strategy === "clear_waiting_games"
          ? "repair_recovery_conflict"
          : "manual_recovery_conflict_review",
    });
  }

  let matchCount = 0;
  try {
    matchCount = await getMatchCount();
    for (let id = matchCount; id >= 1 && matchCount - id < matchLimit; id--) {
      try {
        const match = await getOnchainMatch(id);
        const linkedGameId = await kv.get<string>(kvKeys.arena.games.gameByMatch(id));
        const linkedGame = linkedGameId ? await getGame(linkedGameId) : null;
        const isExpired = match.deadline > 0 && Date.now() / 1000 > match.deadline;

        if (!linkedGameId && (match.status === "open" || match.status === "full")) {
          pushUnique(issues, {
            type: "orphaned_game_match",
            severity: match.status === "full" ? "high" : "medium",
            matchId: id,
            status: match.status,
            timestamp: match.createdAt ? new Date(match.createdAt * 1000).toISOString() : undefined,
            suggestedNextAction: match.status === "full" ? "link_game_or_cancel_match" : "link_game_or_expire_match",
          });
        }

        if (linkedGameId && !linkedGame) {
          pushUnique(issues, {
            type: "linked_match_mismatch",
            severity: "high",
            gameId: linkedGameId,
            matchId: id,
            status: match.status,
            suggestedNextAction: "recover_game_or_cancel_match",
          });
        }

        if (isExpired && (match.status === "open" || match.status === "full")) {
          pushUnique(issues, {
            type: "expired_unresolved_match",
            severity: "medium",
            gameId: linkedGameId || undefined,
            matchId: id,
            status: match.status,
            timestamp: new Date(match.deadline * 1000).toISOString(),
            suggestedNextAction: "expire_match",
          });
        }
      } catch {
        continue;
      }
    }
  } catch {
    matchCount = 0;
  }

  const counts = issues.reduce(
    (acc, issue) => {
      acc.total++;
      acc[issue.severity]++;
      return acc;
    },
    { total: 0, high: 0, medium: 0, low: 0 },
  );

  return {
    checkedAt,
    arenaAddress: MOGS_ARENA_ADDRESS,
    scanned: { recentGames: recentGames.length, recentLimit, matchCount, matchLimit },
    counts,
    issues,
    suggestedNextAction:
      counts.high > 0 ? "review_high_severity_issues" : counts.total > 0 ? "review_medium_low_issues" : "no_action",
  };
}
