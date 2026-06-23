import { NextResponse, type NextRequest } from "next/server";
import { createPublicClient, getAddress, http, isAddress } from "viem";
import { MONAD_MOGS_ABI, MONAD_MOGS_ADDRESS } from "@/lib/contract";
import {
  ERC8004_IDENTITY_REGISTRY_ABI,
  ERC8004_IDENTITY_REGISTRY_ADDRESS,
  ERC8004_REPUTATION_REGISTRY_ADDRESS,
  MOGS_AGENT_BINDINGS_ADDRESS,
} from "@/lib/erc8004";
import { getMogMetadata, MAX_SUPPLY, parseTokenId } from "@/lib/mogs";
import { MONAD_CHAIN, MONAD_RPC_URL } from "@/lib/network";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { getMogRarity } from "@/lib/rarity";
import { apiUrl, siteUrl } from "@/lib/urls";
const client = createPublicClient({
  chain: MONAD_CHAIN,
  transport: http(MONAD_RPC_URL),
});

/**
 * Resolve the ERC-8004 agentId for an owner address.
 *
 * The identity registry is a plain ERC-721 (no Enumerable extension), so
 * there is no `tokenOfOwnerByIndex`.  We first check `balanceOf(owner)`;
 * if zero we bail immediately.  Otherwise we do a descending scan from the
 * latest known agentId (found via binary search) and return the first match.
 * A batch of 200 parallel `ownerOf` calls keeps latency low – the total
 * supply is small and new registrations always get the highest IDs.
 */
async function resolveAgentId(ownerAddress: string): Promise<number | null> {
  try {
    const balance = await client.readContract({
      address: ERC8004_IDENTITY_REGISTRY_ADDRESS,
      abi: ERC8004_IDENTITY_REGISTRY_ABI,
      functionName: "balanceOf",
      args: [ownerAddress as `0x${string}`],
    });
    if (balance === 0n) return null;

    // Binary-search for the highest minted agentId
    let lo = 1n;
    let hi = 100_000n;
    while (lo < hi) {
      const mid = (lo + hi + 1n) / 2n;
      try {
        await client.readContract({
          address: ERC8004_IDENTITY_REGISTRY_ADDRESS,
          abi: ERC8004_IDENTITY_REGISTRY_ABI,
          functionName: "ownerOf",
          args: [mid],
        });
        lo = mid;
      } catch {
        hi = mid - 1n;
      }
    }
    const maxId = lo;

    // Descending scan in batches of 200
    const normalized = getAddress(ownerAddress);
    const BATCH = 200n;
    for (let start = maxId; start >= 1n; start -= BATCH) {
      const end = start - BATCH + 1n < 1n ? 1n : start - BATCH + 1n;
      const calls: bigint[] = [];
      for (let id = start; id >= end; id--) calls.push(id);

      const results = await Promise.allSettled(
        calls.map((id) =>
          client.readContract({
            address: ERC8004_IDENTITY_REGISTRY_ADDRESS,
            abi: ERC8004_IDENTITY_REGISTRY_ABI,
            functionName: "ownerOf",
            args: [id],
          }).then((addr) => ({ id, addr }))
        )
      );

      for (const r of results) {
        if (r.status === "fulfilled" && getAddress(r.value.addr) === normalized) {
          return Number(r.value.id);
        }
      }
    }
  } catch {
    // Silently fall back to null – the URI still works without agentId
  }
  return null;
}

function cleanText(value: string | null, fallback: string) {
  return (value || fallback).trim().slice(0, 80);
}

function cleanCaps(value: string | null) {
  return (value || "")
    .split(",")
    .map((capability) => capability.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 12);
}

/**
 * GET /api/agents/uri?owner=0x...&mogId=1&name=...&caps=...&strategy=...
 *
 * Returns a spec-compliant ERC-8004 AgentURI JSON document.
 * Required fields per spec: type, name, description, image
 * Optional fields: services[], x402Support, active, registrations[], supportedTrust[]
 */
export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`agent-uri:${ip}`, 300, 60);
  if (!rl.ok) {
    return NextResponse.json(
      { error: rl.message, degraded: rl.status === 503 ? true : undefined },
      {
        status: rl.status,
        headers: rl.status === 429 ? { "Retry-After": String(rl.retryAfter) } : undefined,
      }
    );
  }

  const { searchParams } = new URL(request.url);
  const owner = searchParams.get("owner") || "";
  const tokenId = parseTokenId(searchParams.get("mogId") || "");

  if (!isAddress(owner)) {
    return NextResponse.json({ error: "owner must be a valid wallet address." }, { status: 400 });
  }

  if (!tokenId || tokenId < 1 || tokenId > MAX_SUPPLY) {
    return NextResponse.json({ error: "mogId must be between 1 and 5000." }, { status: 400 });
  }

  let verifiedMogOwner = false;
  try {
    const onchainOwner = await client.readContract({
      address: MONAD_MOGS_ADDRESS,
      abi: MONAD_MOGS_ABI,
      functionName: "ownerOf",
      args: [BigInt(tokenId)],
    });
    verifiedMogOwner = getAddress(onchainOwner) === getAddress(owner);
  } catch {
    verifiedMogOwner = false;
  }

  const mog = await getMogMetadata(tokenId);
  const name = cleanText(searchParams.get("name"), `Mog Pilot #${tokenId}`);
  const capabilities = cleanCaps(searchParams.get("caps"));
  const strategy = cleanText(
    searchParams.get("strategy"),
    "Plays from Monad Mogs traits and returns transparent JSON decisions.",
  );
  const image = apiUrl(`/api/v0/mogs/${tokenId}/render`);
  const detail = siteUrl(`/mogs/${tokenId}`);
  const metadata = apiUrl(`/api/v0/mogs/${tokenId}`);
  const render = apiUrl(`/api/v0/mogs/${tokenId}/render`);
  const traits = apiUrl(`/api/v0/mogs/${tokenId}/traits`);
  const rarityUrl = apiUrl(`/api/v0/mogs/${tokenId}/rarity`);
  const rarity = getMogRarity(tokenId);
  const isRarePlus = rarity ? ["rare", "epic", "legendary"].includes(rarity.tier) : false;
  const agentId = await resolveAgentId(owner);
  const agentRegistry = `eip155:${MONAD_CHAIN.id}:${ERC8004_IDENTITY_REGISTRY_ADDRESS}`;
  const agentWallet = `eip155:${MONAD_CHAIN.id}:${getAddress(owner)}`;

  /* ---------------------------------------------------------------- */
  /*  ERC-8004 spec-compliant services array                          */
  /* ---------------------------------------------------------------- */
  const services = [
    {
      name: "web",
      endpoint: detail,
      version: "1.0.0",
      skills: ["profile", "render", "traits", "collection"],
      domains: ["technology/blockchain", "media_and_entertainment/content_creation"],
    },
    {
      name: "metadata",
      endpoint: metadata,
      version: "1.0.0",
      skills: ["erc721-metadata", "onchain-traits"],
    },
    {
      name: "render",
      endpoint: render,
      version: "1.0.0",
      skills: ["svg-render", "avatar"],
    },
    {
      name: "traits",
      endpoint: traits,
      version: "1.0.0",
      skills: ["trait-read"],
    },
    {
      name: "rarity",
      endpoint: rarityUrl,
      version: "1.0.0",
      skills: ["rarity-read", "tier-check"],
    },
    {
      name: "agentWallet",
      endpoint: agentWallet,
    },
  ];

  /* ---------------------------------------------------------------- */
  /*  Spec-compliant AgentURI JSON                                     */
  /*  Required: type, name, description, image                         */
  /*  Optional: services, x402Support, active, registrations,          */
  /*            supportedTrust                                          */
  /* ---------------------------------------------------------------- */
  const agentURI = {
    // --- Required fields (ERC-8004 spec) ---
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name,
    description: `${name} is a Monad Mogs agent identity bound to ${mog.name}. It uses the Mog's onchain traits as strategy context for future games, tools, and agent workflows.`,
    image,
    image_url: image,
    imageUrl: image,
    avatar: image,
    thumbnail_url: image,

    // --- Optional spec fields ---
    services,
    endpoints: services,
    x402Support: false,
    active: true,
    registrations: [
      {
        agentId,
        agentRegistry,
      },
    ],
    supportedTrust: ["reputation", "self-signed", "erc-8004-identity"],

    // --- Extended Monad Mogs fields ---
    version: "1.0.0",
    external_url: detail,
    owner,
    agentWallet,
    capabilities,
    strategy,
    rarity: rarity
      ? {
          rank: rarity.rank,
          tier: rarity.tier,
          score: rarity.score,
          percentile: rarity.percentile,
          isRarePlus,
          endpoint: rarityUrl,
        }
      : null,
    context: apiUrl("/llms.txt"),
    attributes: mog.attributes,
    tags: ["monad", "monad-mogs", "erc-8004", "onchain", "pixel", "hamster"],

    // --- Registries ---
    registries: {
      identity: ERC8004_IDENTITY_REGISTRY_ADDRESS,
      reputation: ERC8004_REPUTATION_REGISTRY_ADDRESS,
      validation: null,
      chainId: MONAD_CHAIN.id,
    },

    // --- NFT binding ---
    agentBinding: {
      spec: "ERC-8217",
      contract: MOGS_AGENT_BINDINGS_ADDRESS,
      metadataKey: "agent-binding",
      resolver: apiUrl(`/api/agents/binding?agentId=${agentId || "{agentId}"}`),
      reverseResolver: apiUrl(`/api/agents/by-mog?mogId=${tokenId}`),
      status: agentId ? "resolvable" : "pending-agent-registration",
      note: "New registrations write the ERC-8217 binding contract to ERC-8004 metadata key agent-binding. Existing agents still resolve through the Monad Mogs fallback contract, so re-registration is not required.",
    },
    nft: {
      name: mog.name,
      tokenId,
      contract: MONAD_MOGS_ADDRESS,
      chainId: MONAD_CHAIN.id,
      image,
      metadata,
      traits,
      rarity: rarityUrl,
      rarityTier: rarity?.tier || null,
      rarityRank: rarity?.rank || null,
      isRarePlus,
      verifiedOwner: verifiedMogOwner,
    },
  };

  return NextResponse.json(agentURI, {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
