import { NextResponse, type NextRequest } from "next/server";
import { createPublicClient, http } from "viem";
import { MONAD_CHAIN, MONAD_RPC_URL } from "@/lib/network";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import {
  ERC8004_IDENTITY_REGISTRY_ADDRESS,
  ERC8004_IDENTITY_REGISTRY_ABI,
  MOGS_AGENT_BINDINGS_ADDRESS,
  MOGS_AGENT_BINDINGS_ABI,
} from "@/lib/erc8004";
import { getMogRarity } from "@/lib/rarity";
import { parseTokenId, MAX_SUPPLY } from "@/lib/mogs";
import { apiUrl } from "@/lib/urls";

const client = createPublicClient({ chain: MONAD_CHAIN, transport: http(MONAD_RPC_URL) });

/**
 * GET /api/agents/by-mog?mogId={id}
 *
 * Reverse ERC-8217 lookup: given a Mog token ID, returns the bound ERC-8004 agent.
 */
export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`agent-by-mog:${ip}`, 60, 60);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  const { searchParams } = new URL(request.url);
  const mogId = parseTokenId(searchParams.get("mogId") || "");

  if (!mogId || mogId < 1 || mogId > MAX_SUPPLY) {
    return NextResponse.json(
      { error: "mogId must be between 1 and 5000." },
      { status: 400 }
    );
  }

  if (!MOGS_AGENT_BINDINGS_ADDRESS) {
    return NextResponse.json(
      {
        error: "Binding contract not yet deployed.",
        spec: "ERC-8217",
        mogId,
      },
      { status: 503 }
    );
  }

  try {
    const agentIdBig = await client.readContract({
      address: MOGS_AGENT_BINDINGS_ADDRESS,
      abi: MOGS_AGENT_BINDINGS_ABI,
      functionName: "agentOf",
      args: [BigInt(mogId)],
    }) as bigint;

    const agentId = Number(agentIdBig);
    const rarity = getMogRarity(mogId);

    if (agentId === 0) {
      return NextResponse.json({
        mogId,
        bound: false,
        spec: "ERC-8217",
        rarity: rarity ? { rank: rarity.rank, tier: rarity.tier } : null,
        render: apiUrl(`/api/v0/mogs/${mogId}/render`),
        hint: "This Mog has not been bound to an ERC-8004 agent yet.",
      });
    }

    const [agentURI, owner, agentWallet] = await Promise.all([
      client.readContract({
        address: ERC8004_IDENTITY_REGISTRY_ADDRESS,
        abi: ERC8004_IDENTITY_REGISTRY_ABI,
        functionName: "tokenURI",
        args: [agentIdBig],
      }),
      client.readContract({
        address: ERC8004_IDENTITY_REGISTRY_ADDRESS,
        abi: ERC8004_IDENTITY_REGISTRY_ABI,
        functionName: "ownerOf",
        args: [agentIdBig],
      }),
      client.readContract({
        address: ERC8004_IDENTITY_REGISTRY_ADDRESS,
        abi: ERC8004_IDENTITY_REGISTRY_ABI,
        functionName: "getAgentWallet",
        args: [agentIdBig],
      }),
    ]);

    return NextResponse.json(
      {
        mogId,
        bound: true,
        spec: "ERC-8217",
        agent: {
          agentId,
          agentURI,
          owner,
          agentWallet,
          registry: ERC8004_IDENTITY_REGISTRY_ADDRESS,
          chainId: MONAD_CHAIN.id,
        },
        mog: {
          tokenId: mogId,
          render: apiUrl(`/api/v0/mogs/${mogId}/render`),
          rarity: rarity ? {
            rank: rarity.rank,
            tier: rarity.tier,
            score: rarity.score,
            percentile: rarity.percentile,
          } : null,
        },
        bindingContract: MOGS_AGENT_BINDINGS_ADDRESS,
      },
      { headers: { "Cache-Control": "public, max-age=60" } }
    );
  } catch {
    return NextResponse.json(
      { error: "Contract call failed.", mogId },
      { status: 500 }
    );
  }
}
