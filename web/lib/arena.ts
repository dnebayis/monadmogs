import { kv } from "@vercel/kv";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

export type GameType = "coin-flip" | "rock-paper-scissors" | "dice-duel" | "higher-lower";

export type GameStatus = "waiting" | "active" | "finished";

export type GameMove = "rock" | "paper" | "scissors" | "heads" | "tails" | "roll" | "higher" | "lower";

export type GamePlayer = {
  address: string;
  mogId: number;
  mogName: string;
  move?: GameMove;
  result?: number; // dice value, card value, etc.
};

export type Game = {
  id: string;
  type: GameType;
  status: GameStatus;
  players: GamePlayer[];
  maxPlayers: 2;
  winner?: string; // address
  createdAt: string;
  finishedAt?: string;
  round: number;
};

export type GameSummary = {
  id: string;
  type: GameType;
  status: GameStatus;
  playerCount: number;
  maxPlayers: number;
  createdAt: string;
};

export type LeaderboardEntry = {
  address: string;
  mogId: number;
  mogName: string;
  wins: number;
  losses: number;
  draws: number;
  games: number;
  reputation: number;
};

/* ------------------------------------------------------------------ */
/*  Constants                                                           */
/* ------------------------------------------------------------------ */

export const GAME_TYPES: Record<GameType, { label: string; description: string; icon: string }> = {
  "coin-flip": {
    label: "Coin Flip",
    description: "Call heads or tails. 50/50 chance. Pure luck.",
    icon: "coin",
  },
  "rock-paper-scissors": {
    label: "Rock Paper Scissors",
    description: "Classic RPS. Best of one. Strategy meets reads.",
    icon: "rps",
  },
  "dice-duel": {
    label: "Dice Duel",
    description: "Both players roll. Highest number wins.",
    icon: "dice",
  },
  "higher-lower": {
    label: "Higher or Lower",
    description: "A random number is drawn. Guess if the next one is higher or lower.",
    icon: "card",
  },
};

/* ------------------------------------------------------------------ */
/*  KV Keys                                                             */
/* ------------------------------------------------------------------ */

const GAMES_KEY = "arena:games";
const GAME_KEY = (id: string) => `arena:game:${id}`;
const LEADERBOARD_KEY = "arena:leaderboard";
const PLAYER_STATS_KEY = (address: string) => `arena:stats:${address.toLowerCase()}`;

/* ------------------------------------------------------------------ */
/*  Game Logic                                                          */
/* ------------------------------------------------------------------ */

function resolveRPS(a: GameMove, b: GameMove): "a" | "b" | "draw" {
  if (a === b) return "draw";
  if (
    (a === "rock" && b === "scissors") ||
    (a === "scissors" && b === "paper") ||
    (a === "paper" && b === "rock")
  )
    return "a";
  return "b";
}

function resolveCoinFlip(call: GameMove, flipResult: "heads" | "tails"): boolean {
  return call === flipResult;
}

function rollDice(): number {
  return Math.floor(Math.random() * 6) + 1;
}

function drawNumber(): number {
  return Math.floor(Math.random() * 100) + 1;
}

export function resolveGame(game: Game): Game {
  const [p1, p2] = game.players;
  if (!p1 || !p2) return game;

  const resolved: Game = { ...game, status: "finished", finishedAt: new Date().toISOString() };

  switch (game.type) {
    case "coin-flip": {
      const flip = Math.random() < 0.5 ? "heads" : "tails";
      const p1Won = resolveCoinFlip(p1.move!, flip as "heads" | "tails");
      const p2Won = resolveCoinFlip(p2.move!, flip as "heads" | "tails");
      resolved.players = [
        { ...p1, result: p1Won ? 1 : 0 },
        { ...p2, result: p2Won ? 1 : 0 },
      ];
      if (p1Won && !p2Won) resolved.winner = p1.address;
      else if (p2Won && !p1Won) resolved.winner = p2.address;
      // both same call = draw (no winner)
      break;
    }

    case "rock-paper-scissors": {
      if (!p1.move || !p2.move) return game;
      const result = resolveRPS(p1.move, p2.move);
      resolved.players = [
        { ...p1, result: result === "a" ? 1 : result === "draw" ? 0 : -1 },
        { ...p2, result: result === "b" ? 1 : result === "draw" ? 0 : -1 },
      ];
      if (result === "a") resolved.winner = p1.address;
      else if (result === "b") resolved.winner = p2.address;
      break;
    }

    case "dice-duel": {
      const r1 = rollDice();
      const r2 = rollDice();
      resolved.players = [
        { ...p1, result: r1 },
        { ...p2, result: r2 },
      ];
      if (r1 > r2) resolved.winner = p1.address;
      else if (r2 > r1) resolved.winner = p2.address;
      break;
    }

    case "higher-lower": {
      const first = drawNumber();
      const second = drawNumber();
      const isHigher = second > first;
      resolved.players = [
        { ...p1, result: first },
        { ...p2, result: second },
      ];
      // p1 is the guesser
      const p1Correct =
        (p1.move === "higher" && isHigher) || (p1.move === "lower" && !isHigher);
      if (first === second) {
        // draw
      } else if (p1Correct) {
        resolved.winner = p1.address;
      } else {
        resolved.winner = p2.address;
      }
      break;
    }
  }

  return resolved;
}

/* ------------------------------------------------------------------ */
/*  Storage                                                             */
/* ------------------------------------------------------------------ */

export async function createGame(
  type: GameType,
  player: GamePlayer,
  move?: GameMove
): Promise<Game> {
  const game: Game = {
    id: crypto.randomUUID(),
    type,
    status: "waiting",
    players: [{ ...player, move }],
    maxPlayers: 2,
    createdAt: new Date().toISOString(),
    round: 1,
  };

  await kv.set(GAME_KEY(game.id), game, { ex: 86400 }); // 24h TTL
  await kv.lpush(GAMES_KEY, game.id);
  return game;
}

export async function getGame(id: string): Promise<Game | null> {
  return kv.get<Game>(GAME_KEY(id));
}

export async function joinGame(
  id: string,
  player: GamePlayer,
  move?: GameMove
): Promise<Game | null> {
  const game = await getGame(id);
  if (!game || game.status !== "waiting" || game.players.length >= 2) return null;
  if (game.players[0].address.toLowerCase() === player.address.toLowerCase()) return null;

  game.players.push({ ...player, move });
  game.status = "active";

  // For games where both moves are submitted at join time, resolve immediately
  if (game.type === "coin-flip" || game.type === "dice-duel") {
    const resolved = resolveGame(game);
    await kv.set(GAME_KEY(id), resolved, { ex: 86400 });
    await updateStats(resolved);
    return resolved;
  }

  // RPS / higher-lower: both players need moves
  if (game.players[0].move && game.players[1].move) {
    const resolved = resolveGame(game);
    await kv.set(GAME_KEY(id), resolved, { ex: 86400 });
    await updateStats(resolved);
    return resolved;
  }

  await kv.set(GAME_KEY(id), game, { ex: 86400 });
  return game;
}

export async function submitMove(
  id: string,
  address: string,
  move: GameMove
): Promise<Game | null> {
  const game = await getGame(id);
  if (!game || game.status === "finished") return null;

  const playerIndex = game.players.findIndex(
    (p) => p.address.toLowerCase() === address.toLowerCase()
  );
  if (playerIndex === -1) return null;

  game.players[playerIndex].move = move;

  // Check if all moves are in
  if (game.players.length === 2 && game.players.every((p) => p.move)) {
    const resolved = resolveGame(game);
    await kv.set(GAME_KEY(id), resolved, { ex: 86400 });
    await updateStats(resolved);
    return resolved;
  }

  await kv.set(GAME_KEY(id), game, { ex: 86400 });
  return game;
}

export async function getOpenGames(type?: GameType): Promise<GameSummary[]> {
  try {
    const ids = await kv.lrange<string>(GAMES_KEY, 0, 49);
    if (!ids.length) return [];

    const games = await Promise.all(ids.map((id) => getGame(id)));
    return games
      .filter((g): g is Game => g !== null && g.status === "waiting")
      .filter((g) => !type || g.type === type)
      .map((g) => ({
        id: g.id,
        type: g.type,
        status: g.status,
        playerCount: g.players.length,
        maxPlayers: g.maxPlayers,
        createdAt: g.createdAt,
      }));
  } catch {
    return [];
  }
}

export async function getRecentGames(limit = 20): Promise<Game[]> {
  try {
    const ids = await kv.lrange<string>(GAMES_KEY, 0, limit - 1);
    if (!ids.length) return [];

    const games = await Promise.all(ids.map((id) => getGame(id)));
    return games
      .filter((g): g is Game => g !== null)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  Stats                                                               */
/* ------------------------------------------------------------------ */

async function updateStats(game: Game): Promise<void> {
  if (game.status !== "finished") return;

  for (const player of game.players) {
    const key = PLAYER_STATS_KEY(player.address);
    const stats = (await kv.get<LeaderboardEntry>(key)) || {
      address: player.address,
      mogId: player.mogId,
      mogName: player.mogName,
      wins: 0,
      losses: 0,
      draws: 0,
      games: 0,
      reputation: 0,
    };

    stats.games++;
    stats.mogId = player.mogId;
    stats.mogName = player.mogName;

    if (!game.winner) {
      stats.draws++;
    } else if (game.winner === player.address) {
      stats.wins++;
      stats.reputation += 10; // +10 rep per win
    } else {
      stats.losses++;
      stats.reputation = Math.max(0, stats.reputation - 3); // -3 rep per loss, min 0
    }

    await kv.set(key, stats);
    // Sort leaderboard by reputation (not just wins)
    await kv.zadd(LEADERBOARD_KEY, { score: stats.reputation, member: player.address.toLowerCase() });
  }
}

export async function getLeaderboard(limit = 20): Promise<LeaderboardEntry[]> {
  try {
    const addresses = await kv.zrange<string[]>(LEADERBOARD_KEY, 0, limit - 1, { rev: true });
    if (!addresses.length) return [];

    const entries = await Promise.all(
      addresses.map((addr) => kv.get<LeaderboardEntry>(PLAYER_STATS_KEY(addr)))
    );
    return entries.filter((e): e is LeaderboardEntry => e !== null);
  } catch {
    return [];
  }
}

export async function getPlayerStats(address: string): Promise<LeaderboardEntry | null> {
  try {
    return kv.get<LeaderboardEntry>(PLAYER_STATS_KEY(address));
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Admin: Reset Leaderboard                                            */
/* ------------------------------------------------------------------ */

export async function resetLeaderboard(): Promise<void> {
  try {
    // Get all addresses from sorted set
    const addresses = await kv.zrange<string[]>(LEADERBOARD_KEY, 0, -1);

    // Delete each player's stats
    for (const addr of addresses) {
      await kv.del(PLAYER_STATS_KEY(addr));
    }

    // Delete the sorted set
    await kv.del(LEADERBOARD_KEY);

    // Delete all game keys
    const gameIds = await kv.lrange<string>(GAMES_KEY, 0, -1);
    for (const id of gameIds) {
      await kv.del(GAME_KEY(id));
    }
    await kv.del(GAMES_KEY);
  } catch {
    // best-effort
  }
}
