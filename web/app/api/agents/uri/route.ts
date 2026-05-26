import { NextResponse, type NextRequest } from "next/server";
import { createPublicClient, getAddress, http, isAddress } from "viem";
import { MONAD_MOGS_ABI, MONAD_MOGS_ADDRESS } from "@/lib/contract";
import { ERC8004_IDENTITY_REGISTRY_ADDRESS } from "@/lib/erc8004";
import { getMogMetadata, MAX_SUPPLY, parseTokenId } from "@/lib/mogs";
import { MONAD_CHAIN, MONAD_RPC_URL } from "@/lib/network";

const SITE_URL = "https://monadmogs.vercel.app";
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

export async function GET(request: NextRequest) {
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
  const strategy = cleanText(searchParams.get("strategy"), "Plays from Monad Mogs traits and returns transparent JSON decisions.");
  const image = `${SITE_URL}/api/v0/mogs/${tokenId}/render`;
  const detail = `${SITE_URL}/mogs/${tokenId}`;
  const metadata = `${SITE_URL}/api/v0/mogs/${tokenId}`;
  const render = `${SITE_URL}/api/v0/mogs/${tokenId}/render`;
  const traits = `${SITE_URL}/api/v0/mogs/${tokenId}/traits`;
  const agentRegistry = `eip155:${MONAD_CHAIN.id}:${ERC8004_IDENTITY_REGISTRY_ADDRESS}`;
  const agentWallet = `eip155:${MONAD_CHAIN.id}:${getAddress(owner)}`;
  const endpoints = [
    {
      name: "web",
      endpoint: detail,
      version: "1.0.0",
      capabilities: ["profile", "render", "traits", "collection"],
    },
    {
      name: "metadata",
      endpoint: metadata,
      version: "1.0.0",
      capabilities: ["erc721-metadata", "onchain-traits"],
    },
    {
      name: "render",
      endpoint: render,
      version: "1.0.0",
      capabilities: ["svg-render", "avatar"],
    },
    {
      name: "traits",
      endpoint: traits,
      version: "1.0.0",
      capabilities: ["trait-read"],
    },
    {
      name: "agentWallet",
      endpoint: agentWallet,
    },
    {
      name: "OASF",
      endpoint: "https://github.com/agntcy/oasf/",
      version: "0.8.0",
      skills: [
        "tool_interaction/api_schema_understanding",
        "natural_language_processing/natural_language_generation",
        "multi_modal/image_processing",
      ],
      domains: ["technology/blockchain", "media_and_entertainment/content_creation"],
    },
  ];

  return NextResponse.json(
    {
      type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
      version: "1.0.0",
      name,
      description: `${name} is a Monad Mogs agent identity bound to ${mog.name}. It uses the Mog's onchain traits as strategy context for future games, tools, and agent workflows.`,
      image,
      image_url: image,
      imageUrl: image,
      avatar: image,
      thumbnail_url: image,
      external_url: detail,
      active: true,
      x402Support: false,
      updatedAt: Math.floor(Date.now() / 1000),
      project: "Monad Mogs",
      category: "onchain-collectible-agent",
      owner,
      agentWallet,
      hosted: false,
      services: endpoints,
      endpoints,
      capabilities,
      strategy,
      controls: {
        collection: "Monad Mogs",
        tokenId,
        detail,
        metadata,
        render,
        traits,
      },
      context: `${SITE_URL}/llms.txt`,
      reservedEndpoint: `${SITE_URL}/api/agents/{agentId}`,
      registrations: [
        {
          agentId: null,
          agentRegistry,
        },
      ],
      supportedTrust: ["self-signed", "erc-8004-identity"],
      attributes: mog.attributes,
      tags: ["monad", "monad-mogs", "erc-8004", "onchain", "pixel", "hamster"],
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
      properties: {
        mogName: mog.name,
        mogTokenId: tokenId,
        mogImage: image,
        mogMetadata: metadata,
        mogTraits: traits,
        verifiedMogOwner,
      },
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300",
      },
    },
  );
}
