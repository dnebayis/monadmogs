import { NextResponse, type NextRequest } from "next/server";
import { createPublicClient, getAddress, http, isAddress } from "viem";
import { MONAD_MOGS_ABI, MONAD_MOGS_ADDRESS } from "@/lib/contract";
import {
  ERC8004_IDENTITY_REGISTRY_ADDRESS,
  ERC8004_REPUTATION_REGISTRY_ADDRESS,
} from "@/lib/erc8004";
import { getMogMetadata, MAX_SUPPLY, parseTokenId } from "@/lib/mogs";
import { MONAD_CHAIN, MONAD_RPC_URL } from "@/lib/network";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { apiUrl, siteUrl } from "@/lib/urls";
const client = createPublicClient({
  chain: MONAD_CHAIN,
  transport: http(MONAD_RPC_URL),
});

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
  const rl = await rateLimit(`agent-uri:${ip}`, 20, 60);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
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
  const agentRegistry = `eip155:${MONAD_CHAIN.id}:${ERC8004_IDENTITY_REGISTRY_ADDRESS}`;

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

    // --- Optional spec fields ---
    services,
    x402Support: false,
    active: true,
    registrations: [
      {
        agentId: null,
        agentRegistry,
      },
    ],
    supportedTrust: ["reputation", "self-signed", "erc-8004-identity"],

    // --- Extended Monad Mogs fields ---
    version: "1.0.0",
    external_url: detail,
    owner,
    capabilities,
    strategy,
    context: siteUrl("/llms.txt"),
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
    nft: {
      name: mog.name,
      tokenId,
      contract: MONAD_MOGS_ADDRESS,
      chainId: MONAD_CHAIN.id,
      image,
      metadata,
      traits,
      verifiedOwner: verifiedMogOwner,
    },
  };

  return NextResponse.json(agentURI, {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
