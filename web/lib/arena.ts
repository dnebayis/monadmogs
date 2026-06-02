import { kv } from "@vercel/kv";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

export type GameType = "coin-flip" | "rock-paper-scissors" | "dice-duel" | "higher-lower";

export type GameStatus = "waiting" | "active" | "finished";

export type GameMove = "rock" | "paper" | "scissors" | "heads" | "tails" | "roll" | "higher" | "lower";

export type SpecialMoveSource = "rarity" | "burn";

export type SpecialMoveRequest = {
  use: true;
  source: SpecialMoveSource;
  burnTxHash?: string;
};

export type RoundSpecialMoveResult = {
  player: string;
  source?: SpecialMoveSource;
  burnTxHash?: string;
  declared: boolean;
  triggered: boolean;
  consumed: boolean;
  effect?: "dice-reroll" | "higher-lower-second-chance";
  before?: number;
  after?: number;
};

export type RoundResult = {
  round: number;
  p1Move: GameMove;
  p2Move: GameMove;
  p1Result: number;
  p2Result: number;
  roundWinner: string | null;
  commentary: { p1: string; p2: string };
  coinResult?: "heads" | "tails";
  specialMoves?: RoundSpecialMoveResult[];
};

export type GamePlayer = {
  address: string;
  mogId: number;
  mogName: string;
  agentId: number;
  score: number;
  move?: GameMove;
  commentary?: string;
  result?: number;
  specialMoveAvailable?: boolean;
  specialMoveUsed?: boolean;
  specialMoveSource?: SpecialMoveSource;
  burnTxHash?: string;
  pendingSpecialMove?: boolean;
};

export type Game = {
  id: string;
  type: GameType;
  status: GameStatus;
  players: GamePlayer[];
  maxPlayers: 2;
  bestOf: number;
  round: number;
  rounds: RoundResult[];
  winner?: string;
  createdAt: string;
  finishedAt?: string;
};

export type GameSummary = {
  id: string;
  type: GameType;
  status: GameStatus;
  bestOf: number;
  round: number;
  playerCount: number;
  maxPlayers: number;
  createdAt: string;
  matchId?: number;
  entryFee?: string;
  totalPrize?: string;
  tokenPrize?: { token: string; amount: string };
  onchainStatus?: string;
  restriction?: "one_active_match_per_wallet";
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

export const GAME_TYPES: Record<GameType, { label: string; description: string; bestOf: number }> = {
  "coin-flip": {
    label: "Coin Flip",
    description: "Call heads or tails. Best of 9. Pure luck.",
    bestOf: 9,
  },
  "rock-paper-scissors": {
    label: "Rock Paper Scissors",
    description: "Classic RPS. Best of 9. Strategy meets reads.",
    bestOf: 9,
  },
  "dice-duel": {
    label: "Dice Duel",
    description: "Both players roll. Best of 9. Highest number wins each round.",
    bestOf: 9,
  },
  "higher-lower": {
    label: "Higher or Lower",
    description: "Guess if the next number is higher or lower. Best of 9.",
    bestOf: 9,
  },
};

export const VALID_MOVES: Record<GameType, GameMove[]> = {
  "coin-flip": ["heads", "tails"],
  "rock-paper-scissors": ["rock", "paper", "scissors"],
  "dice-duel": ["roll"],
  "higher-lower": ["higher", "lower"],
};

export const SPECIAL_MOVE_TERM = "Special Move";
export const SPECIAL_MOVE_SUPPORTED_GAMES: GameType[] = ["dice-duel", "higher-lower"];
export const SPECIAL_MOVE_BURN_AMOUNT = "1000";
export const SPECIAL_MOVE_MAX_PER_MATCH = 1;

export function isValidMoveForGame(type: GameType, move: GameMove): boolean {
  return VALID_MOVES[type].includes(move);
}

export function supportsSpecialMove(type: GameType): boolean {
  return SPECIAL_MOVE_SUPPORTED_GAMES.includes(type);
}

/* ------------------------------------------------------------------ */
/*  KV Keys                                                             */
/* ------------------------------------------------------------------ */

const GAMES_KEY = "arena:games";
const GAME_KEY = (id: string) => `arena:game:${id}`;
const LEADERBOARD_KEY = "arena:leaderboard";
const PLAYER_STATS_KEY = (address: string) => `arena:stats:${address.toLowerCase()}`;

/* ------------------------------------------------------------------ */
/*  Round Resolution                                                    */
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

function seededUnit(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

function roundSeed(game: Game, label: string) {
  const [p1, p2] = game.players;
  return [
    game.id,
    game.createdAt,
    game.type,
    game.round,
    label,
    p1?.address || "",
    p1?.move || "",
    p2?.address || "",
    p2?.move || "",
  ].join(":");
}

function deterministicInt(seed: string, max: number): number {
  return Math.floor(seededUnit(seed) * max) + 1;
}

function declaredSpecialMove(player: GamePlayer): boolean {
  return Boolean(player.pendingSpecialMove && player.specialMoveAvailable && !player.specialMoveUsed);
}

function consumeSpecialMove(
  player: GamePlayer,
  effect: RoundSpecialMoveResult["effect"],
  before: number,
  after: number
): RoundSpecialMoveResult {
  player.specialMoveUsed = true;
  player.pendingSpecialMove = false;
  return {
    player: player.address,
    source: player.specialMoveSource,
    burnTxHash: player.burnTxHash,
    declared: true,
    triggered: true,
    consumed: true,
    effect,
    before,
    after,
  };
}

function untriggeredSpecialMove(player: GamePlayer): RoundSpecialMoveResult {
  return {
    player: player.address,
    source: player.specialMoveSource,
    burnTxHash: player.burnTxHash,
    declared: true,
    triggered: false,
    consumed: false,
  };
}

function resolveRound(game: Game): RoundResult | null {
  const [p1, p2] = game.players;
  if (!p1?.move || !p2?.move) return null;

  let p1Result = 0;
  let p2Result = 0;
  let roundWinner: string | null = null;
  const specialMoves: RoundSpecialMoveResult[] = [];
  let coinResult: "heads" | "tails" | undefined;

  switch (game.type) {
    case "coin-flip": {
      const flip = seededUnit(roundSeed(game, "coin-flip")) < 0.5 ? "heads" : "tails";
      coinResult = flip;
      const p1Won = p1.move === flip;
      const p2Won = p2.move === flip;
      p1Result = p1Won ? 1 : 0;
      p2Result = p2Won ? 1 : 0;
      if (p1Won && !p2Won) roundWinner = p1.address;
      else if (p2Won && !p1Won) roundWinner = p2.address;
      break;
    }
    case "rock-paper-scissors": {
      const result = resolveRPS(p1.move, p2.move);
      p1Result = result === "a" ? 1 : result === "draw" ? 0 : -1;
      p2Result = result === "b" ? 1 : result === "draw" ? 0 : -1;
      if (result === "a") roundWinner = p1.address;
      else if (result === "b") roundWinner = p2.address;
      break;
    }
    case "dice-duel": {
      p1Result = deterministicInt(roundSeed(game, "p1-dice"), 6);
      p2Result = deterministicInt(roundSeed(game, "p2-dice"), 6);

      if (p1Result < p2Result && declaredSpecialMove(p1)) {
        const before = p1Result;
        p1Result = deterministicInt(roundSeed(game, "p1-dice-special"), 6);
        specialMoves.push(consumeSpecialMove(p1, "dice-reroll", before, p1Result));
      } else if (p2Result < p1Result && declaredSpecialMove(p2)) {
        const before = p2Result;
        p2Result = deterministicInt(roundSeed(game, "p2-dice-special"), 6);
        specialMoves.push(consumeSpecialMove(p2, "dice-reroll", before, p2Result));
      }

      if (declaredSpecialMove(p1)) specialMoves.push(untriggeredSpecialMove(p1));
      if (declaredSpecialMove(p2)) specialMoves.push(untriggeredSpecialMove(p2));

      if (p1Result > p2Result) roundWinner = p1.address;
      else if (p2Result > p1Result) roundWinner = p2.address;
      break;
    }
    case "higher-lower": {
      const p1Current = deterministicInt(roundSeed(game, "p1-current"), 100);
      const p1Next = deterministicInt(roundSeed(game, "p1-next"), 100);
      const p2Current = deterministicInt(roundSeed(game, "p2-current"), 100);
      const p2Next = deterministicInt(roundSeed(game, "p2-next"), 100);

      let p1Correct = p1Next !== p1Current && (
        (p1.move === "higher" && p1Next > p1Current) ||
        (p1.move === "lower" && p1Next < p1Current)
      );
      let p2Correct = p2Next !== p2Current && (
        (p2.move === "higher" && p2Next > p2Current) ||
        (p2.move === "lower" && p2Next < p2Current)
      );
      p1Result = p1Correct ? 1 : 0;
      p2Result = p2Correct ? 1 : 0;

      if (!p1Correct && declaredSpecialMove(p1)) {
        const secondNext = deterministicInt(roundSeed(game, "p1-second-chance"), 100);
        p1Correct = secondNext !== p1Current && (
          (p1.move === "higher" && secondNext > p1Current) ||
          (p1.move === "lower" && secondNext < p1Current)
        );
        p1Result = p1Correct ? 1 : 0;
        specialMoves.push(consumeSpecialMove(p1, "higher-lower-second-chance", p1Next, secondNext));
      }
      if (!p2Correct && declaredSpecialMove(p2)) {
        const secondNext = deterministicInt(roundSeed(game, "p2-second-chance"), 100);
        p2Correct = secondNext !== p2Current && (
          (p2.move === "higher" && secondNext > p2Current) ||
          (p2.move === "lower" && secondNext < p2Current)
        );
        p2Result = p2Correct ? 1 : 0;
        specialMoves.push(consumeSpecialMove(p2, "higher-lower-second-chance", p2Next, secondNext));
      }

      if (declaredSpecialMove(p1)) specialMoves.push(untriggeredSpecialMove(p1));
      if (declaredSpecialMove(p2)) specialMoves.push(untriggeredSpecialMove(p2));

      if (p1Correct && !p2Correct) roundWinner = p1.address;
      else if (p2Correct && !p1Correct) roundWinner = p2.address;
      break;
    }
  }

  return {
    round: game.round,
    p1Move: p1.move,
    p2Move: p2.move,
    p1Result,
    p2Result,
    roundWinner,
    commentary: {
      p1: p1.commentary || "",
      p2: p2.commentary || "",
    },
    ...(coinResult ? { coinResult } : {}),
    ...(specialMoves.length ? { specialMoves } : {}),
  };
}

function winsNeeded(bestOf: number): number {
  return Math.ceil(bestOf / 2);
}

function specialMoveFields(specialMove?: SpecialMoveRequest): Partial<GamePlayer> {
  if (!specialMove?.use) return {};
  return {
    specialMoveAvailable: true,
    specialMoveSource: specialMove.source,
    burnTxHash: specialMove.burnTxHash,
    pendingSpecialMove: true,
  };
}

/* ------------------------------------------------------------------ */
/*  Storage                                                             */
/* ------------------------------------------------------------------ */

export async function createOpenGame(type: GameType, id = crypto.randomUUID()): Promise<Game> {
  const bestOf = GAME_TYPES[type].bestOf;
  const game: Game = {
    id,
    type,
    status: "waiting",
    players: [],
    maxPlayers: 2,
    bestOf,
    round: 1,
    rounds: [],
    createdAt: new Date().toISOString(),
  };

  await kv.set(GAME_KEY(game.id), game, { ex: 86400 * 7 });
  await kv.lpush(GAMES_KEY, game.id);
  return game;
}

export async function linkGameToMatch(gameId: string, matchId: number): Promise<void> {
  await kv.set(`arena:game-match:${gameId}`, matchId, { ex: 86400 * 7 });
}

export async function getGame(id: string): Promise<Game | null> {
  return kv.get<Game>(GAME_KEY(id));
}

export async function joinGame(
  id: string,
  player: GamePlayer,
  move?: GameMove,
  specialMove?: SpecialMoveRequest
): Promise<Game | null> {
  const game = await getGame(id);
  if (!game || game.status !== "waiting" || game.players.length >= 2) return null;

  // Prevent same player joining twice
  if (game.players.some((p) => p.address.toLowerCase() === player.address.toLowerCase())) return null;

  game.players.push({ ...player, score: 0, move, ...specialMoveFields(specialMove) });

  // Two players = game is active
  if (game.players.length < 2) {
    await kv.set(GAME_KEY(id), game, { ex: 86400 * 7 });
    return game;
  }

  game.status = "active";

  // If both have moves, resolve the first round
  if (game.players[0].move && game.players[1].move) {
    return advanceRound(game);
  }

  await kv.set(GAME_KEY(id), game, { ex: 86400 * 7 });
  return game;
}

export async function leaveWaitingGame(id: string, address: string): Promise<Game | null> {
  const game = await getGame(id);
  if (!game || game.status !== "waiting") return null;

  const before = game.players.length;
  game.players = game.players.filter((p) => p.address.toLowerCase() !== address.toLowerCase());
  if (game.players.length === before) return null;

  await kv.set(GAME_KEY(id), game, { ex: 86400 * 7 });
  return game;
}

export async function submitMove(
  id: string,
  address: string,
  move: GameMove,
  commentary?: string,
  specialMove?: SpecialMoveRequest
): Promise<Game | null> {
  const lockKey = `arena:lock:${id}`;

  // Simple lock to prevent race conditions
  const locked = await kv.set(lockKey, "1", { ex: 10, nx: true });
  if (!locked) return null; // another move is being processed

  try {
    const game = await getGame(id);
    if (!game || game.status === "finished") return null;
    if (game.status === "waiting") return null;

    const playerIndex = game.players.findIndex(
      (p) => p.address.toLowerCase() === address.toLowerCase()
    );
    if (playerIndex === -1) return null;
    if (game.players[playerIndex].move) return game; // already moved this round

    game.players[playerIndex].move = move;
    if (commentary) game.players[playerIndex].commentary = commentary;
    Object.assign(game.players[playerIndex], specialMoveFields(specialMove));

    if (game.players.every((p) => p.move)) {
      return advanceRound(game);
    }

    await kv.set(GAME_KEY(id), game, { ex: 86400 * 7 });
    return game;
  } finally {
    await kv.del(lockKey);
  }
}

async function advanceRound(game: Game): Promise<Game> {
  const roundResult = resolveRound(game);
  if (!roundResult) {
    await kv.set(GAME_KEY(game.id), game, { ex: 86400 * 7 });
    return game;
  }

  game.rounds.push(roundResult);

  // Update scores
  if (roundResult.roundWinner === game.players[0].address) {
    game.players[0].score++;
  } else if (roundResult.roundWinner === game.players[1].address) {
    game.players[1].score++;
  }

  const needed = winsNeeded(game.bestOf);

  // Check if someone won the match
  if (game.players[0].score >= needed) {
    game.status = "finished";
    game.winner = game.players[0].address;
    game.finishedAt = new Date().toISOString();
  } else if (game.players[1].score >= needed) {
    game.status = "finished";
    game.winner = game.players[1].address;
    game.finishedAt = new Date().toISOString();
  } else {
    // Next round — clear moves and commentary
    game.round++;
    game.players[0].move = undefined;
    game.players[0].result = undefined;
    game.players[0].commentary = undefined;
    game.players[0].pendingSpecialMove = undefined;
    game.players[1].move = undefined;
    game.players[1].result = undefined;
    game.players[1].commentary = undefined;
    game.players[1].pendingSpecialMove = undefined;
  }

  // Store round results on players for the current/last round
  game.players[0].result = roundResult.p1Result;
  game.players[1].result = roundResult.p2Result;

  await kv.set(GAME_KEY(game.id), game, { ex: 86400 * 7 });

  if (game.status === "finished") {
    await updateStats(game);
  }

  return game;
}

/* ------------------------------------------------------------------ */
/*  Queries                                                             */
/* ------------------------------------------------------------------ */

export async function getOpenGames(type?: GameType): Promise<GameSummary[]> {
  try {
    const ids = await kv.lrange<string>(GAMES_KEY, 0, 49);
    if (!ids.length) return [];

    const games = await Promise.all(ids.map((id) => getGame(id)));
    const waitingGames = games
      .filter((g): g is Game => g !== null && g.status === "waiting")
      .filter((g) => !type || g.type === type);

    return Promise.all(waitingGames.map(async (g) => {
      const summary: GameSummary = {
        id: g.id,
        type: g.type,
        status: g.status,
        bestOf: g.bestOf,
        round: g.round,
        playerCount: g.players.length,
        maxPlayers: g.maxPlayers,
        createdAt: g.createdAt,
      };

      const matchId = await kv.get<number>(`arena:game-match:${g.id}`);
      if (!matchId) return summary;

      summary.matchId = matchId;
      try {
        const { getOnchainMatch } = await import("@/lib/arena-pool");
        const match = await getOnchainMatch(matchId);
        summary.entryFee = match.entryFee;
        summary.totalPrize = match.totalPrize;
        summary.tokenPrize = match.tokenPrize;
        summary.onchainStatus = match.status;
      } catch {
        // Keep the offchain game visible even if the read RPC is temporarily unavailable.
      }
      summary.restriction = "one_active_match_per_wallet";

      return summary;
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
    } else {
      stats.losses++;
    }

    stats.reputation = Math.max(0, stats.wins * 10 - stats.losses * 3);

    await kv.set(key, stats);
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
/*  Admin                                                               */
/* ------------------------------------------------------------------ */

export async function resetLeaderboard(): Promise<void> {
  try {
    const addresses = await kv.zrange<string[]>(LEADERBOARD_KEY, 0, -1);
    for (const addr of addresses) {
      await kv.del(PLAYER_STATS_KEY(addr));
    }
    await kv.del(LEADERBOARD_KEY);

    const gameIds = await kv.lrange<string>(GAMES_KEY, 0, -1);
    for (const id of gameIds) {
      await kv.del(GAME_KEY(id));
    }
    await kv.del(GAMES_KEY);
  } catch {
    // best-effort
  }
}
