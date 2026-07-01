import { createPublicClient, getAddress, http, type Address } from "viem";
import { kv } from "@vercel/kv";
import { MONAD_MOGS_ABI, MONAD_MOGS_ADDRESS } from "@/lib/contract";
import {
  ERC8004_IDENTITY_REGISTRY_ABI,
  ERC8004_IDENTITY_REGISTRY_ADDRESS,
  MOGS_8004_ADAPTER_ABI,
  MOGS_8004_ADAPTER_ADDRESS,
  MOGS_AGENT_BINDINGS_ABI,
  MOGS_AGENT_BINDINGS_ADDRESS,
} from "@/lib/erc8004";
import { kvKeys } from "@/lib/kv-keys";
import { MONAD_CHAIN, MONAD_RPC_URL } from "@/lib/network";
import { MAX_SUPPLY } from "@/lib/mogs";
import { getMogRarity } from "@/lib/rarity";
import { apiUrl } from "@/lib/urls";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const TOKEN_STANDARD = ["ERC721", "ERC1155", "ERC6909"] as const;

const client = createPublicClient({ chain: MONAD_CHAIN, transport: http(MONAD_RPC_URL) });

export type AwakenedAgentRecord = {
  agentId: string;
  tokenId: string;
  name: string;
  type: "Mog";
  registeredBy?: string;
  registeredAt?: string;
  txHash?: string;
  bindingContract: string;
  source: "adapter" | "legacy";
};

export function isAdapterConfigured() {
  return getAddress(MOGS_8004_ADAPTER_ADDRESS) !== getAddress(ZERO_ADDRESS);
}

export async function getAwakenedIndex() {
  const items = (await kv.get<AwakenedAgentRecord[]>(kvKeys.agents.awakened.list)) || [];
  return items;
}

export async function getAwakenedCount() {
  const count = await kv.get<number>(kvKeys.agents.awakened.count);
  if (typeof count === "number") return count;
  return (await getAwakenedIndex()).length;
}

export async function getCurrentMogOwner(mogId: number) {
  return client.readContract({
    address: MONAD_MOGS_ADDRESS,
    abi: MONAD_MOGS_ABI,
    functionName: "ownerOf",
    args: [BigInt(mogId)],
  });
}

async function readAgentBase(agentId: bigint) {
  const [agentURI, owner, agentWallet] = await Promise.all([
    client.readContract({
      address: ERC8004_IDENTITY_REGISTRY_ADDRESS,
      abi: ERC8004_IDENTITY_REGISTRY_ABI,
      functionName: "tokenURI",
      args: [agentId],
    }),
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
  return { agentURI, owner, agentWallet };
}

export async function getAgentByMog(mogId: number) {
  if (mogId < 1 || mogId > MAX_SUPPLY) return null;

  const sources: Array<{ source: "adapter" | "legacy"; address: Address; abi: typeof MOGS_8004_ADAPTER_ABI | typeof MOGS_AGENT_BINDINGS_ABI }> = [];
  if (isAdapterConfigured()) sources.push({ source: "adapter", address: MOGS_8004_ADAPTER_ADDRESS, abi: MOGS_8004_ADAPTER_ABI });
  sources.push({ source: "legacy", address: MOGS_AGENT_BINDINGS_ADDRESS, abi: MOGS_AGENT_BINDINGS_ABI });

  for (const source of sources) {
    const agentId = await client.readContract({
      address: source.address,
      abi: source.abi,
      functionName: "agentOf",
      args: [BigInt(mogId)],
    }).catch(() => 0n) as bigint;
    if (agentId === 0n) continue;

    const [{ agentURI, owner, agentWallet }, currentOwner] = await Promise.all([
      readAgentBase(agentId),
      getCurrentMogOwner(mogId).catch(() => null),
    ]);
    const rarity = getMogRarity(mogId);

    return {
      mogId,
      bound: true,
      source: source.source,
      bindingContract: source.address,
      agent: {
        agentId: Number(agentId),
        agentURI,
        owner,
        agentWallet,
        controller: currentOwner,
        registry: ERC8004_IDENTITY_REGISTRY_ADDRESS,
        chainId: MONAD_CHAIN.id,
      },
      mog: {
        tokenId: mogId,
        contract: MONAD_MOGS_ADDRESS,
        owner: currentOwner,
        render: apiUrl(`/api/v0/mogs/${mogId}/render`),
        rarity: rarity ? { rank: rarity.rank, tier: rarity.tier, score: rarity.score, percentile: rarity.percentile } : null,
      },
    };
  }

  return null;
}

export async function getMogBindingByAgent(agentId: bigint) {
  const sources: Array<{ source: "adapter" | "legacy"; address: Address; abi: typeof MOGS_8004_ADAPTER_ABI | typeof MOGS_AGENT_BINDINGS_ABI }> = [];
  if (isAdapterConfigured()) sources.push({ source: "adapter", address: MOGS_8004_ADAPTER_ADDRESS, abi: MOGS_8004_ADAPTER_ABI });
  sources.push({ source: "legacy", address: MOGS_AGENT_BINDINGS_ADDRESS, abi: MOGS_AGENT_BINDINGS_ABI });

  for (const source of sources) {
    const binding = await client.readContract({
      address: source.address,
      abi: source.abi,
      functionName: "bindingOf",
      args: [agentId],
    }).catch(() => null) as { standard: number; tokenContract: string; tokenId: bigint } | null;
    if (!binding || getAddress(binding.tokenContract) === getAddress(ZERO_ADDRESS)) continue;

    return {
      source: source.source,
      bindingContract: source.address,
      binding: {
        spec: "ERC-8217",
        standard: TOKEN_STANDARD[binding.standard] ?? "ERC721",
        tokenContract: binding.tokenContract,
        tokenId: Number(binding.tokenId),
        chainId: MONAD_CHAIN.id,
      },
    };
  }
  return null;
}
