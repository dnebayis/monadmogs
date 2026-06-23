import { createPublicClient, getAddress, http, type Address } from "viem";
import { MONAD_CHAIN, MONAD_RPC_URL } from "@/lib/network";
import { MONAD_MOGS_ADDRESS } from "@/lib/contract";
import {
  ERC8004_IDENTITY_REGISTRY_ABI,
  ERC8004_IDENTITY_REGISTRY_ADDRESS,
  MOGS_AGENT_BINDINGS_ABI,
  MOGS_AGENT_BINDINGS_ADDRESS,
} from "@/lib/erc8004";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
export const AGENT_BINDING_METADATA_KEY = "agent-binding";

const client = createPublicClient({
  chain: MONAD_CHAIN,
  transport: http(MONAD_RPC_URL),
});

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

export async function discoverBindingContract(agentId: bigint) {
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

export async function readBinding(agentId: bigint, bindingContract: Address) {
  return client.readContract({
    address: bindingContract,
    abi: MOGS_AGENT_BINDINGS_ABI,
    functionName: "bindingOf",
    args: [agentId],
  });
}

export async function isExpectedMogsBindingContract(bindingContract: Address) {
  try {
    const [nftContract, identityRegistry] = await Promise.all([
      client.readContract({
        address: bindingContract,
        abi: MOGS_AGENT_BINDINGS_ABI,
        functionName: "NFT_CONTRACT",
      }),
      client.readContract({
        address: bindingContract,
        abi: MOGS_AGENT_BINDINGS_ABI,
        functionName: "IDENTITY_REGISTRY",
      }),
    ]);
    return (
      getAddress(nftContract as string) === getAddress(MONAD_MOGS_ADDRESS) &&
      getAddress(identityRegistry as string) === getAddress(ERC8004_IDENTITY_REGISTRY_ADDRESS)
    );
  } catch {
    return false;
  }
}

export async function resolveBindingContract(agentId: bigint) {
  let discovery = await discoverBindingContract(agentId);
  if (
    discovery.contract !== MOGS_AGENT_BINDINGS_ADDRESS &&
    !(await isExpectedMogsBindingContract(discovery.contract))
  ) {
    discovery = {
      contract: MOGS_AGENT_BINDINGS_ADDRESS,
      metadataPresent: discovery.metadataPresent,
      source: "monad-mogs-default" as const,
    };
  }

  return discovery;
}

export async function resolveAgentBinding(agentId: bigint) {
  let discovery = await resolveBindingContract(agentId);

  try {
    const binding = await readBinding(agentId, discovery.contract);
    return { discovery, binding };
  } catch {
    if (discovery.contract === MOGS_AGENT_BINDINGS_ADDRESS) {
      throw new Error("Binding call failed.");
    }

    discovery = {
      contract: MOGS_AGENT_BINDINGS_ADDRESS,
      metadataPresent: discovery.metadataPresent,
      source: "monad-mogs-default" as const,
    };
    const binding = await readBinding(agentId, discovery.contract);
    return { discovery, binding };
  }
}

export function isZeroBindingAddress(address: string) {
  return address === ZERO_ADDRESS;
}
