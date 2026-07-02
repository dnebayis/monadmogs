import { createEip3009UsageReporter, predicateGate, type InvocationEvent } from "@opensea/tool-sdk";
import { getAddress, isAddress, type Address } from "viem";

const DEFAULT_MONAD_TOOL_REGISTRY_ADDRESS = "0x265BB2DBFC0A8165C9A1941Eb1372F349baD2cf1" as Address;
const DEFAULT_TOOL_CREATOR_ADDRESS = "0xf818a22f404337f86a1155937fb119a5b9438fd6" as Address;
const DEFAULT_MONAD_RPC_URL = "https://rpc.monad.xyz";
const MONAD_CHAIN_ID = 143;
const MONAD_MAINNET_CHAIN = {
  id: MONAD_CHAIN_ID,
  name: "Monad",
  nativeCurrency: {
    decimals: 18,
    name: "Monad",
    symbol: "MON",
  },
  rpcUrls: {
    default: {
      http: [DEFAULT_MONAD_RPC_URL],
    },
  },
} as NonNullable<Parameters<typeof predicateGate>[0]["chain"]>;

export const HOLDER_TOOL_IDS = {
  portfolio: BigInt(process.env.NEXT_PUBLIC_MOGS_HOLDER_PORTFOLIO_TOOL_ID || "4"),
  missionBrief: BigInt(process.env.NEXT_PUBLIC_MOGS_HOLDER_MISSION_BRIEF_TOOL_ID || "5"),
  marketRadar: BigInt(process.env.NEXT_PUBLIC_MOGS_MARKET_RADAR_TOOL_ID || "6"),
} as const;

type GateContext = Parameters<ReturnType<typeof predicateGate>["check"]>[1] & {
  callerAddress?: Address;
  agentAddress?: Address;
};

type HolderToolAccess =
  | {
      response: Response;
      wallet?: never;
      agentAddress?: never;
      callerAuthorization?: never;
    }
  | {
      response?: never;
      wallet: Address;
      agentAddress: Address | null;
      callerAuthorization: InvocationEvent["callerAuthorization"];
    };

function configuredAddress(value: string | undefined, fallback: Address) {
  if (!value) return fallback;
  return isAddress(value) ? getAddress(value) : null;
}

export async function requireHolderToolAccess(request: Request, toolId: bigint): Promise<HolderToolAccess> {
  const registryAddress = configuredAddress(
    process.env.NEXT_PUBLIC_MONAD_TOOL_REGISTRY_ADDRESS,
    DEFAULT_MONAD_TOOL_REGISTRY_ADDRESS,
  );
  const operatorAddress = configuredAddress(
    process.env.TOOL_CREATOR_ADDRESS || process.env.NEXT_PUBLIC_TOOL_CREATOR_ADDRESS,
    DEFAULT_TOOL_CREATOR_ADDRESS,
  );

  if (!registryAddress) {
    return { response: Response.json({ error: "MONAD_TOOL_REGISTRY_ADDRESS is not a valid address." }, { status: 500 }) };
  }
  if (!operatorAddress) {
    return { response: Response.json({ error: "TOOL_CREATOR_ADDRESS is not a valid address." }, { status: 500 }) };
  }

  const gate = predicateGate({
    toolId,
    chain: MONAD_MAINNET_CHAIN,
    rpcUrl: process.env.NEXT_PUBLIC_MONAD_RPC_URL || DEFAULT_MONAD_RPC_URL,
    registryAddress,
    operatorAddress,
  });
  const ctx = { gates: {} } as GateContext;
  const response = await gate.check(request, ctx);

  if (response) return { response };
  if (!ctx.callerAddress || !isAddress(ctx.callerAddress)) {
    return { response: Response.json({ error: "Predicate gate did not resolve caller address." }, { status: 401 }) };
  }

  return {
    wallet: getAddress(ctx.callerAddress),
    agentAddress: ctx.agentAddress ? getAddress(ctx.agentAddress) : null,
    callerAuthorization: ctx.callerAuthorization,
  };
}

type UsageReportInput = {
  access: Extract<HolderToolAccess, { wallet: Address }>;
  toolId: bigint;
  toolName: string;
  latencyMs: number;
};

export async function reportHolderToolUsage({ access, toolId, toolName, latencyMs }: UsageReportInput) {
  const apiKey = process.env.OPENSEA_API_KEY;
  if (!apiKey || !access.callerAuthorization) return;

  const reporter = createEip3009UsageReporter({
    apiKey,
    chainId: MONAD_CHAIN_ID,
    toolChainId: MONAD_CHAIN_ID,
    toolRegistryAddress: process.env.NEXT_PUBLIC_MONAD_TOOL_REGISTRY_ADDRESS || DEFAULT_MONAD_TOOL_REGISTRY_ADDRESS,
    toolOnchainId: toolId.toString(),
    timeoutMs: 2_000,
  });
  await reporter({
    callerAddress: access.wallet,
    agentAddress: access.agentAddress || undefined,
    callerAuthorization: access.callerAuthorization,
    paid: false,
    toolName,
    latencyMs,
    timestamp: Date.now(),
  }).catch((error) => {
    console.error("[tool-runtime-gate] OpenSea usage reporting failed:", error);
  });
}
