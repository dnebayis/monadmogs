import { createPublicClient, getAddress, http, parseAbiItem, type Address } from "viem";
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
const DEFAULT_ADAPTER_DEPLOY_BLOCK = 84911423n;
const ONCHAIN_FALLBACK_CHUNK_SIZE = 100n;
const ONCHAIN_FALLBACK_CONCURRENCY = 4;
const AGENT_BOUND_EVENT = parseAbiItem(
  "event AgentBound(uint256 indexed agentId,uint8 indexed standard,address indexed tokenContract,uint256 tokenId,address registeredBy)",
);

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

function adapterDeployBlock() {
  const configured = process.env.MOGS_8004_ADAPTER_DEPLOY_BLOCK;
  return configured && /^\d+$/.test(configured) ? BigInt(configured) : DEFAULT_ADAPTER_DEPLOY_BLOCK;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readAdapterLogs(fromBlock: bigint, toBlock: bigint) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await client.getLogs({
        address: MOGS_8004_ADAPTER_ADDRESS,
        event: AGENT_BOUND_EVENT,
        fromBlock,
        toBlock,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("429") && !message.includes("Too Many Requests")) throw error;
      await sleep(350 * (attempt + 1));
    }
  }
  return client.getLogs({
    address: MOGS_8004_ADAPTER_ADDRESS,
    event: AGENT_BOUND_EVENT,
    fromBlock,
    toBlock,
  });
}

function recordFromAgentBoundLog(
  log: {
    address: Address;
    transactionHash: `0x${string}`;
    blockNumber: bigint;
    args: {
      agentId?: bigint;
      tokenId?: bigint;
      registeredBy?: Address;
    };
  },
  timestamp?: bigint,
): AwakenedAgentRecord | null {
  if (!log.args.agentId || !log.args.tokenId) return null;
  const tokenId = log.args.tokenId.toString();
  return {
    agentId: log.args.agentId.toString(),
    tokenId,
    name: `Mog #${tokenId}`,
    type: "Mog",
    registeredBy: log.args.registeredBy,
    registeredAt: timestamp ? new Date(Number(timestamp) * 1000).toISOString() : undefined,
    txHash: log.transactionHash,
    bindingContract: log.address,
    source: "adapter",
  };
}

async function rebuildAwakenedIndexFromAdapter(existing: AwakenedAgentRecord[] = []) {
  if (!isAdapterConfigured()) return existing;

  const latest = await client.getBlockNumber();
  const recordsByMog = new Map(existing.map((record) => [String(record.tokenId), record]));
  const blockTimestamps = new Map<bigint, bigint>();
  const ranges: Array<{ fromBlock: bigint; toBlock: bigint }> = [];
  for (let cursor = adapterDeployBlock(); cursor <= latest; cursor += ONCHAIN_FALLBACK_CHUNK_SIZE) {
    const toBlock = cursor + ONCHAIN_FALLBACK_CHUNK_SIZE - 1n > latest ? latest : cursor + ONCHAIN_FALLBACK_CHUNK_SIZE - 1n;
    ranges.push({ fromBlock: cursor, toBlock });
  }

  let nextRange = 0;
  const logs = (
    await Promise.all(
      Array.from({ length: Math.min(ONCHAIN_FALLBACK_CONCURRENCY, ranges.length) }, async () => {
        const workerLogs: Array<Parameters<typeof recordFromAgentBoundLog>[0]> = [];
        for (;;) {
          const index = nextRange++;
          const range = ranges[index];
          if (!range) break;
          workerLogs.push(...(await readAdapterLogs(range.fromBlock, range.toBlock)));
        }
        return workerLogs;
      }),
    )
  ).flat();

  for (const log of logs) {
    if (!blockTimestamps.has(log.blockNumber)) {
      const block = await client.getBlock({ blockNumber: log.blockNumber });
      blockTimestamps.set(log.blockNumber, block.timestamp);
    }
    const record = recordFromAgentBoundLog(log, blockTimestamps.get(log.blockNumber));
    if (!record) continue;
    recordsByMog.set(record.tokenId, record);
    await kv.set(kvKeys.agents.awakened.item(record.tokenId), record);
  }
  await kv.set(kvKeys.agents.awakened.lastIndexedBlock, latest.toString());

  const list = [...recordsByMog.values()].sort((a, b) => Number(a.tokenId) - Number(b.tokenId));
  await Promise.all([
    kv.set(kvKeys.agents.awakened.list, list),
    kv.set(kvKeys.agents.awakened.count, list.length),
  ]);
  return list;
}

export async function getAwakenedIndex() {
  const items = (await kv.get<AwakenedAgentRecord[]>(kvKeys.agents.awakened.list)) || [];
  if (items.length === 0) {
    return rebuildAwakenedIndexFromAdapter(items).catch(() => items);
  }
  return items;
}

export async function getAwakenedCount() {
  const count = await kv.get<number>(kvKeys.agents.awakened.count);
  if (typeof count === "number" && count > 0) return count;
  return (await getAwakenedIndex()).length;
}

export async function getCachedAwakenedRecord(mogId: number) {
  return kv.get<AwakenedAgentRecord>(kvKeys.agents.awakened.item(mogId)).catch(() => null);
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
    const registration = await getCachedAwakenedRecord(mogId);

    return {
      mogId,
      bound: true,
      source: source.source,
      bindingContract: source.address,
      registration,
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

export async function getAgentByAgentId(agentId: bigint) {
  const resolved = await getMogBindingByAgent(agentId);
  if (!resolved) return null;

  const mogAgent = await getAgentByMog(resolved.binding.tokenId);
  if (!mogAgent) return null;

  return {
    ...mogAgent,
    binding: resolved.binding,
  };
}

export async function searchAwakenedAgents(options: {
  q?: string | null;
  limit?: number;
  offset?: number;
  awake?: boolean | null;
}) {
  const q = (options.q || "").trim().toLowerCase();
  const limit = Math.min(Math.max(options.limit || 50, 1), 500);
  const offset = Math.max(options.offset || 0, 0);
  const awake = options.awake;
  const index = await getAwakenedIndex();
  const records = awake === false ? [] : index;
  const filtered = q
    ? records.filter((record) => {
        const rarity = getMogRarity(Number(record.tokenId));
        return [
          record.agentId,
          record.tokenId,
          record.name,
          record.registeredBy,
          rarity?.tier,
          rarity?.rank ? String(rarity.rank) : null,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q));
      })
    : records;
  const items = await Promise.all(
    filtered.slice(offset, offset + limit).map(async (record) => {
      const mogId = Number(record.tokenId);
      const rarity = getMogRarity(mogId);
      const controller = await getCurrentMogOwner(mogId).catch(() => null);
      return {
        ...record,
        mogId,
        bound: true,
        controller,
        rarity: rarity
          ? {
              rank: rarity.rank,
              tier: rarity.tier,
              score: rarity.score,
              percentile: rarity.percentile,
            }
          : null,
        links: {
          binding: apiUrl(`/api/agents/binding/${mogId}`),
          info: apiUrl(`/api/agents/info/${mogId}`),
          metadata: apiUrl(`/api/agents/metadata/${mogId}`),
        },
      };
    }),
  );

  return {
    count: filtered.length,
    offset,
    limit,
    agents: items,
    hasMore: offset + limit < filtered.length,
  };
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
