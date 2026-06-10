/*
 * Central KV key registry.
 *
 * These keys intentionally keep the current production/legacy names. Do not
 * rename them directly in app code, because that would orphan existing games,
 * leaderboard rows, sessions, resolve records, burn reservations, and reports.
 *
 * Clean namespace used when KV_NAMESPACE=v1:
 *   arena:v1:games:list
 *   arena:v1:games:{gameId}
 *   arena:v1:matches:byGame:{gameId}
 *   arena:v1:matches:byMatch:{matchId}
 *   arena:v1:resolves:{gameId}
 *   arena:v1:players:stats:{address}
 *   arena:v1:leaderboard
 *   arena:v1:auth:sessions:{token}
 *   arena:v1:auth:challenges:{address}
 *   arena:v1:locks:{scope}
 *   arena:v1:burns:{txHash}
 *   arena:v1:reports:list
 *   arena:v1:reports:{id}
 */

const lower = (value: string) => value.toLowerCase();

export const KV_TTL = {
  challenge: 300,
  session: 3600,
  game: 86400 * 7,
  resolve: 86400 * 7,
  reputationFeedback: 86400 * 7,
  burnReservation: 86400 * 90,
  bugReport: 86400 * 30,
  lock: 10,
} as const;

export const kvKeysLegacy = {
  rateLimit: (key: string) => `rl:${key}`,

  studio: {
    projects: "studio:projects",
  },

  arena: {
    games: {
      list: "arena:games",
      item: (gameId: string) => `arena:game:${gameId}`,
      matchByGame: (gameId: string) => `arena:game-match:${gameId}`,
      gameByMatch: (matchId: number | string) => `arena:match-game:${matchId}`,
      resolve: (gameId: string) => `arena:game-resolve:${gameId}`,
    },

    locks: {
      join: (gameId: string) => `arena:lock:${gameId}:join`,
      move: (gameId: string) => `arena:lock:${gameId}`,
    },

    leaderboard: {
      sortedSet: "arena:leaderboard",
      playerStats: (address: string) => `arena:stats:${lower(address)}`,
      reputationFeedback: (gameId: string) => `arena:reputation:${gameId}`,
    },

    auth: {
      challenge: (address: string) => `arena:challenge:${lower(address)}`,
      session: (token: string) => `arena:session:${token}`,
    },

    specialMove: {
      burnTx: (txHash: string) => `arena:special-move-burn:${lower(txHash)}`,
    },

    reports: {
      list: "arena:bug-reports",
      item: (id: string) => `arena:bug-report:${id}`,
    },
  },
} as const;

export const kvKeysV1 = {
  rateLimit: (key: string) => `rl:v1:${key}`,

  studio: {
    projects: "studio:v1:projects",
  },

  arena: {
    games: {
      list: "arena:v1:games:list",
      item: (gameId: string) => `arena:v1:games:${gameId}`,
      matchByGame: (gameId: string) => `arena:v1:matches:byGame:${gameId}`,
      gameByMatch: (matchId: number | string) => `arena:v1:matches:byMatch:${matchId}`,
      resolve: (gameId: string) => `arena:v1:resolves:${gameId}`,
    },

    leaderboard: {
      sortedSet: "arena:v1:leaderboard",
      playerStats: (address: string) => `arena:v1:players:stats:${lower(address)}`,
      reputationFeedback: (gameId: string) => `arena:v1:reputation:${gameId}`,
    },

    auth: {
      challenge: (address: string) => `arena:v1:auth:challenges:${lower(address)}`,
      session: (token: string) => `arena:v1:auth:sessions:${token}`,
    },

    locks: {
      join: (gameId: string) => `arena:v1:locks:${gameId}:join`,
      move: (gameId: string) => `arena:v1:locks:${gameId}`,
    },

    specialMove: {
      burnTx: (txHash: string) => `arena:v1:burns:${lower(txHash)}`,
    },

    reports: {
      list: "arena:v1:reports:list",
      item: (id: string) => `arena:v1:reports:${id}`,
    },
  },
} as const;

export const KV_NAMESPACE = process.env.KV_NAMESPACE === "v1" ? "v1" : "legacy";

export const kvKeys = KV_NAMESPACE === "v1" ? kvKeysV1 : kvKeysLegacy;

export const KV_NAMESPACE_PLAN = {
  current: KV_NAMESPACE,
  next: "arena:v1",
  migration:
    "copy legacy keys to v1, verify, set KV_NAMESPACE=v1, then cleanup legacy keys after production is stable",
} as const;
