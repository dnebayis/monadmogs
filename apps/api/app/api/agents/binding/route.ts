import { NextResponse, type NextRequest } from "next/server";
import { createPublicClient, http } from "viem";
import { getMogBindingByAgent } from "@/lib/agent-registry";
import { classifyContractReadError } from "@/lib/chain-read-errors";
import {
  ERC8004_IDENTITY_REGISTRY_ABI,
  ERC8004_IDENTITY_REGISTRY_ADDRESS,
  MOGS_AGENT_BINDINGS_ADDRESS,
} from "@/lib/erc8004";
import { MONAD_MOGS_ADDRESS } from "@/lib/contract";
import { getMogRarity } from "@/lib/rarity";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { apiUrl } from "@/lib/urls";
import { MONAD_CHAIN, MONAD_RPC_URL } from "@/lib/network";

const client = createPublicClient({ chain: MONAD_CHAIN, transport: http(MONAD_RPC_URL) });

/**
 * GET /api/agents/binding?agentId={id}
 *
 * Legacy query endpoint kept for existing integrations.
 * Resolution is adapter-first, then legacy MogsAgentBindings fallback.
 */
export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`agent-binding:${ip}`, 60, 60);
  if (!rl.ok) {
    return NextResponse.json(
      { error: rl.message, degraded: rl.status === 503 ? true : undefined },
      {
        status: rl.status,
        headers: rl.status === 429 ? { "Retry-After": String(rl.retryAfter) } : undefined,
      },
    );
  }

  const { searchParams } = new URL(request.url);
  const agentIdRaw = searchParams.get("agentId");

  if (!agentIdRaw || !/^[1-9]\d*$/.test(agentIdRaw)) {
    return NextResponse.json({ error: "agentId must be a positive integer." }, { status: 400 });
  }

  const agentId = BigInt(agentIdRaw);

  try {
    const [owner, agentWallet] = await Promise.all([
      client.readContract({
        address: ERC8004_IDENTITY_REGISTRY_ADDRESS,
        abi: ERC8004_IDENTITY_REGISTRY_ABI,
        functionName: "ownerOf",
        args: [agentId],
      }),
      client.readContract({
        address: ERC8004_IDENTITY_REGISTRY_ADDRESS,
        abi: ERC8004_IDENTITY_REGISTRY_ABI,
        functionName: "getAgentWallet",
        args: [agentId],
      }),
    ]);
    const resolved = await getMogBindingByAgent(agentId);

    if (!resolved) {
      return NextResponse.json({
        agentId: Number(agentId),
        bound: false,
        owner,
        agentWallet,
        bindingContract: null,
        spec: "ERC-8217",
        discovery: {
          metadataKey: "agent-binding",
          source: "adapter-first",
          fallbackContract: MOGS_AGENT_BINDINGS_ADDRESS,
        },
      });
    }

    const mogId = resolved.binding.tokenId;
    const rarity = getMogRarity(mogId);

    return NextResponse.json(
      {
        agentId: Number(agentId),
        bound: true,
        owner,
        agentWallet,
        binding: resolved.binding,
        mog: {
          tokenId: mogId,
          contract: MONAD_MOGS_ADDRESS,
          render: apiUrl(`/api/v0/mogs/${mogId}/render`),
          rarity: rarity
            ? {
                rank: rarity.rank,
                tier: rarity.tier,
                score: rarity.score,
                percentile: rarity.percentile,
              }
            : null,
        },
        bindingContract: resolved.bindingContract,
        discovery: {
          metadataKey: "agent-binding",
          source: resolved.source,
          bindingContract: resolved.bindingContract,
          fallbackContract: MOGS_AGENT_BINDINGS_ADDRESS,
        },
        registries: {
          identity: ERC8004_IDENTITY_REGISTRY_ADDRESS,
          binding: resolved.bindingContract,
          chainId: MONAD_CHAIN.id,
        },
      },
      { headers: { "Cache-Control": "public, max-age=60" } },
    );
  } catch (error) {
    const classified = classifyContractReadError(error);
    return NextResponse.json(
      {
        error: classified.kind === "not_found" ? "Agent not found." : "Agent binding read failed.",
        code: classified.code,
        agentId: Number(agentId),
      },
      { status: classified.status },
    );
  }
}
