import { getAddress, isAddress } from "viem";
import { getAgentByMog, getAwakenedCount, getCurrentMogOwner, searchAwakenedAgents } from "@/lib/agent-registry";
import { buildMogPersona } from "@/lib/agent-persona";
import { MAX_SUPPLY, getMogMetadata, parseTokenId } from "@/lib/mogs";
import { getMogRarity } from "@/lib/rarity";
import { apiUrl } from "@/lib/urls";

const MAX_MOG_IDS = 25;

export function parseWallet(value: unknown) {
  if (typeof value !== "string" || !isAddress(value)) return null;
  return getAddress(value);
}

export function parseMogIdInput(value: unknown) {
  if (typeof value === "number") return parseTokenId(String(value));
  if (typeof value === "string") return parseTokenId(value);
  return null;
}

export function parseMogIdsInput(value: unknown) {
  if (!Array.isArray(value)) return [];
  const ids = value
    .map(parseMogIdInput)
    .filter((id): id is number => Boolean(id))
    .filter((id, index, items) => items.indexOf(id) === index)
    .slice(0, MAX_MOG_IDS);
  return ids;
}

export async function getHolderVerifiedMog(mogId: number, wallet: `0x${string}`) {
  const owner = await getCurrentMogOwner(mogId).catch(() => null);
  const holderVerified = owner ? getAddress(owner) === wallet : false;
  const [metadata, rarity, agent] = await Promise.all([
    getMogMetadata(mogId),
    Promise.resolve(getMogRarity(mogId)),
    getAgentByMog(mogId).catch(() => null),
  ]);

  return {
    mogId,
    holderVerified,
    owner,
    name: metadata.name,
    image: apiUrl(`/api/v0/mogs/${mogId}/render`),
    rarity: rarity
      ? {
          rank: rarity.rank,
          tier: rarity.tier,
          score: rarity.score,
          percentile: rarity.percentile,
        }
      : null,
    traits: metadata.attributes,
    agent: agent
      ? {
          awakened: true,
          agentId: agent.agent.agentId,
          agentURI: agent.agent.agentURI,
          controller: agent.agent.controller,
          bindingContract: agent.bindingContract,
        }
      : {
          awakened: false,
        },
    links: {
      metadata: apiUrl(`/api/v0/mogs/${mogId}`),
      agent: apiUrl(`/api/agents/identity/${mogId}`),
      opensea: `https://opensea.io/assets/monad/0x1414f3BAF22404C42fD656af4aFAab4934045137/${mogId}`,
    },
  };
}

export async function buildHolderPortfolio(wallet: `0x${string}`, mogIds: number[]) {
  const discoveredAwakened = await searchAwakenedAgents({ q: wallet, limit: MAX_MOG_IDS, offset: 0, awake: true }).catch(() => ({
    agents: [],
  }));
  const discoveredIds = discoveredAwakened.agents.map((agent) => agent.mogId);
  const ids = [...new Set([...mogIds, ...discoveredIds])].slice(0, MAX_MOG_IDS);
  const holdings = await Promise.all(ids.map((mogId) => getHolderVerifiedMog(mogId, wallet)));
  const verifiedHoldings = holdings.filter((holding) => holding.holderVerified);
  const tiers = verifiedHoldings.reduce<Record<string, number>>((acc, holding) => {
    const tier = holding.rarity?.tier || "unknown";
    acc[tier] = (acc[tier] || 0) + 1;
    return acc;
  }, {});

  return {
    wallet,
    gate: {
      required: "Hold at least one Monad Mogs NFT.",
      checkedOn: "monad",
      mode: "server-ownerOf-check",
      verified: verifiedHoldings.length > 0,
      note: "Current endpoint verifies supplied or awakened Mog IDs. Full wallet inventory requires a holder indexer.",
    },
    portfolio: {
      verifiedCount: verifiedHoldings.length,
      scannedCount: holdings.length,
      awakenedCount: verifiedHoldings.filter((holding) => holding.agent.awakened).length,
      tiers,
      holdings: verifiedHoldings,
      rejected: holdings
        .filter((holding) => !holding.holderVerified)
        .map((holding) => ({ mogId: holding.mogId, owner: holding.owner })),
    },
  };
}

export async function buildMissionBrief(mogId: number, wallet: `0x${string}`) {
  const [holding, persona, awakenedCount] = await Promise.all([
    getHolderVerifiedMog(mogId, wallet),
    buildMogPersona(mogId),
    getAwakenedCount().catch(() => null),
  ]);
  const rarityTier = holding.rarity?.tier || "common";
  const priorities = [
    holding.agent.awakened ? "Keep AgentURI, RESTAP, and A2A metadata reachable." : "Awaken this Mog through ERC-8004 adapter registration.",
    "Use ERC-8217 binding for ownership-to-agent attribution.",
    "Avoid claiming transaction execution unless an agent wallet receipt exists.",
    rarityTier === "legendary" || rarityTier === "epic"
      ? "Lead with rarity context in holder-facing agent experiences."
      : "Lead with traits and controller status rather than rarity-only positioning.",
  ];

  return {
    mogId,
    wallet,
    gate: {
      required: "Wallet must own the requested Monad Mog.",
      checkedOn: "monad",
      mode: "server-ownerOf-check",
      verified: holding.holderVerified,
    },
    mission: {
      title: `${persona.name} mission brief`,
      status: holding.agent.awakened ? "awakened" : "not-awakened",
      tagline: persona.tagline,
      communicationStyle: persona.communicationStyle,
      rarity: holding.rarity,
      agent: holding.agent,
      priorities,
      safetyRails: persona.safetyRails,
      links: holding.links,
    },
  };
}

export async function buildMarketRadar(wallet: `0x${string}`, mogIds: number[]) {
  const portfolio = await buildHolderPortfolio(wallet, mogIds);
  const awakened = await getAwakenedCount().catch(() => null);
  const verifiedHoldings = portfolio.portfolio.holdings;
  const bestRank = verifiedHoldings.reduce<number | null>((best, holding) => {
    if (!holding.rarity?.rank) return best;
    return best === null ? holding.rarity.rank : Math.min(best, holding.rarity.rank);
  }, null);

  return {
    wallet,
    gate: portfolio.gate,
    radar: {
      collectionSupply: MAX_SUPPLY,
      awakenedCount: awakened,
      holderVerifiedCount: portfolio.portfolio.verifiedCount,
      holderAwakenedCount: portfolio.portfolio.awakenedCount,
      bestRank,
      tierBreakdown: portfolio.portfolio.tiers,
      signals: [
        awakened === null ? "Awakened count unavailable from KV fallback." : `${awakened} Mogs are currently indexed as awakened agents.`,
        bestRank ? `Best verified holder rarity rank in this request is #${bestRank}.` : "No verified holder rarity rank in this request.",
        "Market radar v1 uses internal rarity and agent discovery only; listing, floor, and offer data are not claimed.",
      ],
      actions: [
        "Check whether each held Mog is awakened before agent-native campaigns.",
        "Use rarity tier and traits for segmentation.",
        "Treat OpenSea market data as an external input until an API key-backed market indexer is added.",
      ],
    },
  };
}
