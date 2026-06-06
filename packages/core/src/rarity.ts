import raritySnapshot from "../data/rarity.json";
import { MAX_SUPPLY, type MogAttribute } from "./mogs";

export type RarityTier = "common" | "uncommon" | "rare" | "epic" | "legendary";

export type RarityAttribute = MogAttribute & {
  frequency: number;
  percentage: number;
  score: number;
};

export type MogRarity = {
  tokenId: number;
  name: string;
  rank: number;
  tier: RarityTier;
  percentile: number;
  score: number;
  attributes: RarityAttribute[];
};

type RaritySnapshot = {
  generatedAt: string;
  source: {
    chainId: number;
    contract: string;
    method: string;
    maxSupply: number;
  };
  methodology: {
    traitScore: string;
    totalScore: string;
    ranking: string;
    tiers: Record<RarityTier, string>;
  };
  traitFrequencies: Record<string, Record<string, number>>;
  tokens: Record<string, MogRarity>;
};

export const RARITY_SNAPSHOT = raritySnapshot as RaritySnapshot;

export function getMogRarity(tokenId: number): MogRarity | null {
  if (!Number.isInteger(tokenId) || tokenId < 1 || tokenId > MAX_SUPPLY) return null;
  return RARITY_SNAPSHOT.tokens[String(tokenId)] || null;
}

export function getRaritySummary() {
  return {
    generatedAt: RARITY_SNAPSHOT.generatedAt,
    source: RARITY_SNAPSHOT.source,
    methodology: RARITY_SNAPSHOT.methodology,
    maxSupply: MAX_SUPPLY,
    tiers: RARITY_SNAPSHOT.methodology.tiers,
  };
}

export function getTierLabel(tier: RarityTier) {
  if (tier === "legendary") return "Legendary";
  if (tier === "epic") return "Epic";
  if (tier === "rare") return "Rare";
  if (tier === "uncommon") return "Uncommon";
  return "Common";
}
