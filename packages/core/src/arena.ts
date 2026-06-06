/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

export type GameType = "coin-flip" | "rock-paper-scissors" | "dice-duel" | "higher-lower";

export type GameStatus = "waiting" | "active" | "finished";

export type GameMove = "rock" | "paper" | "scissors" | "heads" | "tails" | "roll" | "roll-safe" | "roll-risky" | "higher" | "lower";

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
  /** Higher-Lower: the current numbers each player saw before choosing */
  p1CurrentNumber?: number;
  p2CurrentNumber?: number;
  /** Higher-Lower: the resolved next numbers used to score the round */
  p1NextNumber?: number;
  p2NextNumber?: number;
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
  specialMoveUsedCount?: number;
  specialMoveSource?: SpecialMoveSource;
  burnTxHash?: string;
  pendingSpecialMove?: boolean;
  moveSubmitted?: boolean; // set in sanitized GET response so agents know if they already moved
  /** Higher-Lower: the current number the player sees before choosing higher or lower */
  currentNumber?: number;
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
    description: "Call heads or tails. First to 5 wins, hard cap at 9 rounds. Pure luck.",
    bestOf: 9,
  },
  "rock-paper-scissors": {
    label: "Rock Paper Scissors",
    description: "Classic RPS. First to 5 wins, hard cap at 9 rounds. Strategy meets reads.",
    bestOf: 9,
  },
  "dice-duel": {
    label: "Dice Duel",
    description: "Choose safe (d6: 1-6) or risky (d8: 1-8, but 1-2 = 0). Highest number wins. First to 5, hard cap 9 rounds.",
    bestOf: 9,
  },
  "higher-lower": {
    label: "Higher or Lower",
    description: "See your current number (1-100), guess if the next is higher or lower. First to 5, hard cap 9 rounds.",
    bestOf: 9,
  },
};

export const VALID_MOVES: Record<GameType, GameMove[]> = {
  "coin-flip": ["heads", "tails"],
  "rock-paper-scissors": ["rock", "paper", "scissors"],
  "dice-duel": ["roll-safe", "roll-risky"],
  "higher-lower": ["higher", "lower"],
};

export const SPECIAL_MOVE_TERM = "Special Move";
export const SPECIAL_MOVE_SUPPORTED_GAMES: GameType[] = ["dice-duel", "higher-lower"];
export const SPECIAL_MOVE_BURN_AMOUNT = "1000";

export type TierPerks = {
  freeSpecialMove: boolean;
  specialMovesPerMatch: number;
  reputationMultiplier: number;
  description: string;
};

export const TIER_PERKS: Record<string, TierPerks> = {
  legendary: {
    freeSpecialMove: true,
    specialMovesPerMatch: 2,
    reputationMultiplier: 1.5,
    description: "2 free Special Moves per match, 1.5x reputation gains",
  },
  epic: {
    freeSpecialMove: true,
    specialMovesPerMatch: 1,
    reputationMultiplier: 1.25,
    description: "1 free Special Move per match, 1.25x reputation gains",
  },
  rare: {
    freeSpecialMove: true,
    specialMovesPerMatch: 1,
    reputationMultiplier: 1.0,
    description: "1 free Special Move per match",
  },
  uncommon: {
    freeSpecialMove: false,
    specialMovesPerMatch: 1,
    reputationMultiplier: 1.0,
    description: "Special Move available via 1,000 $MOGS burn",
  },
  common: {
    freeSpecialMove: false,
    specialMovesPerMatch: 1,
    reputationMultiplier: 1.0,
    description: "Special Move available via 1,000 $MOGS burn",
  },
};

export function isValidMoveForGame(type: GameType, move: GameMove): boolean {
  return VALID_MOVES[type].includes(move);
}

export function supportsSpecialMove(type: GameType): boolean {
  return SPECIAL_MOVE_SUPPORTED_GAMES.includes(type);
}
