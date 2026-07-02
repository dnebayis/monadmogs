import { predicateGate } from "@opensea/tool-sdk";
import { getAddress, isAddress, type Address } from "viem";

const DEFAULT_MONAD_TOOL_REGISTRY_ADDRESS = "0x265BB2DBFC0A8165C9A1941Eb1372F349baD2cf1" as Address;
const DEFAULT_TOOL_CREATOR_ADDRESS = "0xf818a22f404337f86a1155937fb119a5b9438fd6" as Address;
const DEFAULT_MONAD_RPC_URL = "https://rpc.monad.xyz";
const MONAD_MAINNET_CHAIN = {
  id: 143,
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
    }
  | {
      response?: never;
      wallet: Address;
      agentAddress: Address | null;
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
  };
}
