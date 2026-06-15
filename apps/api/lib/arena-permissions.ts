import { GAME_TYPES, type GameType } from "@/lib/arena";

export type AgentPermissionProfile = {
  allowedGames?: GameType[];
  maxEntryFeeWei?: string | null;
  maxGamesPerDay?: number | null;
  allowPrizeGames?: boolean;
  allowBurnSpecialMove?: boolean;
};

export type ArenaPermissionInput = {
  gameType: GameType;
  entryFeeWei?: string | number | bigint | null;
  isPrizeGame?: boolean;
  wantsBurnSpecialMove?: boolean;
  gamesPlayedToday?: number;
};

export type NormalizedAgentPermissionProfile = {
  allowedGames: GameType[];
  maxEntryFeeWei: string | null;
  maxGamesPerDay: number | null;
  allowPrizeGames: boolean;
  allowBurnSpecialMove: boolean;
};

const ALL_GAMES = Object.keys(GAME_TYPES) as GameType[];

function toSafeBigInt(value: string | number | bigint | null | undefined): bigint | null {
  if (value === null || value === undefined || value === "") return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

export function normalizePermissionProfile(profile?: AgentPermissionProfile | null): NormalizedAgentPermissionProfile {
  const allowed = Array.isArray(profile?.allowedGames)
    ? profile.allowedGames.filter((type): type is GameType => ALL_GAMES.includes(type))
    : ALL_GAMES;

  return {
    allowedGames: allowed.length ? Array.from(new Set(allowed)) : ALL_GAMES,
    maxEntryFeeWei: profile?.maxEntryFeeWei || null,
    maxGamesPerDay: Number.isFinite(profile?.maxGamesPerDay)
      ? Math.max(0, Math.floor(Number(profile?.maxGamesPerDay)))
      : null,
    allowPrizeGames: profile?.allowPrizeGames === true,
    allowBurnSpecialMove: profile?.allowBurnSpecialMove === true,
  };
}

export function evaluateArenaPermissions(profile: AgentPermissionProfile | null | undefined, input: ArenaPermissionInput) {
  const normalized = normalizePermissionProfile(profile);
  const reasons: string[] = [];

  if (!normalized.allowedGames.includes(input.gameType)) {
    reasons.push(`Game type ${input.gameType} is not allowed by the permission profile.`);
  }

  if (input.isPrizeGame && !normalized.allowPrizeGames) {
    reasons.push("Prize games are not allowed by the permission profile.");
  }

  const entryFee = toSafeBigInt(input.entryFeeWei);
  const maxEntryFee = toSafeBigInt(normalized.maxEntryFeeWei);
  if (entryFee !== null && maxEntryFee !== null && entryFee > maxEntryFee) {
    reasons.push("Entry fee exceeds the permission profile maxEntryFeeWei.");
  }

  if (
    normalized.maxGamesPerDay !== null &&
    typeof input.gamesPlayedToday === "number" &&
    input.gamesPlayedToday >= normalized.maxGamesPerDay
  ) {
    reasons.push("Daily game limit reached for this permission profile.");
  }

  if (input.wantsBurnSpecialMove && !normalized.allowBurnSpecialMove) {
    reasons.push("Burn Special Move is not allowed by the permission profile.");
  }

  return {
    ok: reasons.length === 0,
    reasons,
    profile: normalized,
  };
}
