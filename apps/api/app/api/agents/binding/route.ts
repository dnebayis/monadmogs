import { NextResponse, type NextRequest } from "next/server";
import { createPublicClient, getAddress, http } from "viem";
import { MONAD_CHAIN, MONAD_RPC_URL } from "@/lib/network";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import {
  ERC8004_IDENTITY_REGISTRY_ADDRESS,
  ERC8004_IDENTITY_REGISTRY_ABI,
  MOGS_AGENT_BINDINGS_ADDRESS,
} from "@/lib/erc8004";
import { MONAD_MOGS_ADDRESS } from "@/lib/contract";
import { getMogRarity } from "@/lib/rarity";
import { apiUrl } from "@/lib/urls";
import {
  AGENT_BINDING_METADATA_KEY,
  isZeroBindingAddress,
  resolveAgentBinding,
} from "@/lib/agent-binding";
import { classifyContractReadError } from "@/lib/chain-read-errors";

const client = createPublicClient({ chain: MONAD_CHAIN, transport: http(MONAD_RPC_URL) });

const TOKEN_STANDARD = ["ERC721", "ERC1155", "ERC6909"] as const;

/**
 * GET /api/agents/binding?agentId={id}
 *
 * Resolves the ERC-8217 binding for an ERC-8004 agent.
 * Returns: agentId, bound Mog (tokenId, contract, standard), owner, agentWallet,
 *          rarity, and verification status.
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
      }
    );
  }

  const { searchParams } = new URL(request.url);
  const agentIdRaw = searchParams.get("agentId");

  if (!agentIdRaw || !/^[1-9]\d*$/.test(agentIdRaw)) {
    return NextResponse.json({ error: "agentId must be a positive integer." }, { status: 400 });
  }

  const agentId = BigInt(agentIdRaw);

  if (!MOGS_AGENT_BINDINGS_ADDRESS) {
    return NextResponse.json(
      {
        error: "Binding contract not yet deployed.",
        spec: "ERC-8217",
        note: "Deploy MogsAgentBindings.sol and update MOGS_AGENT_BINDINGS_ADDRESS.",
        agentId: Number(agentId),
      },
      { status: 503 }
    );
  }

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

    const { discovery, binding } = await resolveAgentBinding(agentId);

    const b = binding as { standard: number; tokenContract: string; tokenId: bigint };
    const isBound = !isZeroBindingAddress(b.tokenContract);
    const isMonadMog = isBound && getAddress(b.tokenContract) === getAddress(MONAD_MOGS_ADDRESS);

    if (!isBound) {
      return NextResponse.json({
        agentId: Number(agentId),
        bound: false,
        owner,
        agentWallet,
        bindingContract: discovery.contract,
        spec: "ERC-8217",
        discovery: {
          metadataKey: AGENT_BINDING_METADATA_KEY,
          metadataPresent: discovery.metadataPresent,
          source: discovery.source,
          bindingContract: discovery.contract,
          fallbackContract: MOGS_AGENT_BINDINGS_ADDRESS,
        },
        hint: "This agent has not yet called bind(agentId, mogId) on the binding contract.",
      });
    }

    if (!isMonadMog) {
      return NextResponse.json(
        {
          agentId: Number(agentId),
          bound: true,
          verified: false,
          error: "Agent binding does not point to the Monad Mogs NFT contract.",
          binding: {
            spec: "ERC-8217",
            standard: TOKEN_STANDARD[b.standard] ?? "ERC721",
            tokenContract: b.tokenContract,
            tokenId: Number(b.tokenId),
            chainId: MONAD_CHAIN.id,
          },
          bindingContract: discovery.contract,
          discovery: {
            metadataKey: AGENT_BINDING_METADATA_KEY,
            metadataPresent: discovery.metadataPresent,
            source: discovery.source,
            bindingContract: discovery.contract,
            fallbackContract: MOGS_AGENT_BINDINGS_ADDRESS,
          },
        },
        { status: 422 }
      );
    }

    const mogId = Number(b.tokenId);
    const rarity = getMogRarity(mogId);

    return NextResponse.json(
      {
        agentId: Number(agentId),
        bound: true,
        owner,
        agentWallet,
        binding: {
          spec: "ERC-8217",
          standard: TOKEN_STANDARD[b.standard] ?? "ERC721",
          tokenContract: b.tokenContract,
          tokenId: mogId,
          chainId: MONAD_CHAIN.id,
        },
        mog: {
          tokenId: mogId,
          contract: MONAD_MOGS_ADDRESS,
          render: apiUrl(`/api/v0/mogs/${mogId}/render`),
          rarity: rarity ? {
            rank: rarity.rank,
            tier: rarity.tier,
            score: rarity.score,
            percentile: rarity.percentile,
          } : null,
        },
        bindingContract: discovery.contract,
        discovery: {
          metadataKey: AGENT_BINDING_METADATA_KEY,
          metadataPresent: discovery.metadataPresent,
          source: discovery.source,
          bindingContract: discovery.contract,
          fallbackContract: MOGS_AGENT_BINDINGS_ADDRESS,
        },
        registries: {
          identity: ERC8004_IDENTITY_REGISTRY_ADDRESS,
          binding: discovery.contract,
          chainId: MONAD_CHAIN.id,
        },
      },
      { headers: { "Cache-Control": "public, max-age=60" } }
    );
  } catch (error) {
    const classified = classifyContractReadError(error);
    return NextResponse.json(
      {
        error: classified.kind === "not_found" ? "Agent not found." : "Agent binding read failed.",
        code: classified.code,
        agentId: Number(agentId),
      },
      { status: classified.status }
    );
  }
}
