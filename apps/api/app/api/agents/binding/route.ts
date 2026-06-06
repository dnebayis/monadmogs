import { NextResponse, type NextRequest } from "next/server";
import { createPublicClient, getAddress, http, type Address } from "viem";
import { MONAD_CHAIN, MONAD_RPC_URL } from "@/lib/network";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import {
  ERC8004_IDENTITY_REGISTRY_ADDRESS,
  ERC8004_IDENTITY_REGISTRY_ABI,
  MOGS_AGENT_BINDINGS_ADDRESS,
  MOGS_AGENT_BINDINGS_ABI,
} from "@/lib/erc8004";
import { MONAD_MOGS_ADDRESS } from "@/lib/contract";
import { getMogRarity } from "@/lib/rarity";
import { apiUrl } from "@/lib/urls";

const client = createPublicClient({ chain: MONAD_CHAIN, transport: http(MONAD_RPC_URL) });

const TOKEN_STANDARD = ["ERC721", "ERC1155", "ERC6909"] as const;
const ZERO = "0x0000000000000000000000000000000000000000";
const AGENT_BINDING_METADATA_KEY = "agent-binding";

function parseBindingMetadata(value: unknown): Address | null {
  if (typeof value !== "string" || value === "0x") return null;
  const hex = value.toLowerCase();

  try {
    if (/^0x[0-9a-f]{40}$/.test(hex)) return getAddress(hex);
    if (/^0x[0-9a-f]{64}$/.test(hex)) return getAddress(`0x${hex.slice(-40)}`);
  } catch {
    return null;
  }

  return null;
}

async function discoverBindingContract(agentId: bigint) {
  try {
    const metadataValue = await client.readContract({
      address: ERC8004_IDENTITY_REGISTRY_ADDRESS,
      abi: ERC8004_IDENTITY_REGISTRY_ABI,
      functionName: "getMetadata",
      args: [agentId, AGENT_BINDING_METADATA_KEY],
    });
    const discovered = parseBindingMetadata(metadataValue);
    if (discovered) {
      return {
        contract: discovered,
        metadataPresent: true,
        source: "erc8004-metadata" as const,
      };
    }
    return {
      contract: MOGS_AGENT_BINDINGS_ADDRESS,
      metadataPresent: Boolean(metadataValue && metadataValue !== "0x"),
      source: "monad-mogs-default" as const,
    };
  } catch {
    return {
      contract: MOGS_AGENT_BINDINGS_ADDRESS,
      metadataPresent: false,
      source: "monad-mogs-default" as const,
    };
  }
}

async function readBinding(agentId: bigint, bindingContract: Address) {
  return client.readContract({
    address: bindingContract,
    abi: MOGS_AGENT_BINDINGS_ABI,
    functionName: "bindingOf",
    args: [agentId],
  });
}

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
      { error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  const { searchParams } = new URL(request.url);
  const agentIdRaw = searchParams.get("agentId");

  if (!agentIdRaw || isNaN(Number(agentIdRaw)) || Number(agentIdRaw) < 1) {
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
    let discovery = await discoverBindingContract(agentId);
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

    let binding: Awaited<ReturnType<typeof readBinding>>;
    try {
      binding = await readBinding(agentId, discovery.contract);
    } catch {
      if (discovery.contract === MOGS_AGENT_BINDINGS_ADDRESS) throw new Error("Binding call failed.");
      discovery = {
        contract: MOGS_AGENT_BINDINGS_ADDRESS,
        metadataPresent: discovery.metadataPresent,
        source: "monad-mogs-default",
      };
      binding = await readBinding(agentId, discovery.contract);
    }

    const b = binding as { standard: number; tokenContract: string; tokenId: bigint };
    const isBound = b.tokenContract !== ZERO;

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
  } catch {
    return NextResponse.json(
      { error: "Agent not found or contract call failed.", agentId: Number(agentId) },
      { status: 404 }
    );
  }
}
