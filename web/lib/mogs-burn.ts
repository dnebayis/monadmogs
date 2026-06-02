import { kv } from "@vercel/kv";
import { createPublicClient, decodeEventLog, getAddress, http, type Hex } from "viem";
import { MONAD_CHAIN, MONAD_RPC_URL } from "@/lib/network";
import { MOGS_TOKEN_ADDRESS } from "@/lib/arena-pool";

export const MOGS_BURN_ADDRESS = "0x000000000000000000000000000000000000dEaD";
export const SPECIAL_MOVE_BURN_TOKENS = "1000";

const USED_BURN_TX_KEY = (txHash: string) => `arena:special-move-burn:${txHash.toLowerCase()}`;

const erc20Abi = [
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { type: "address", name: "from", indexed: true },
      { type: "address", name: "to", indexed: true },
      { type: "uint256", name: "value", indexed: false },
    ],
  },
] as const;

const publicClient = createPublicClient({
  chain: MONAD_CHAIN,
  transport: http(MONAD_RPC_URL),
});

function exactBurnAmount(decimals: number): bigint {
  return BigInt(SPECIAL_MOVE_BURN_TOKENS) * 10n ** BigInt(decimals);
}

export async function validateAndReserveSpecialMoveBurn(params: {
  txHash: string;
  agentAddress: string;
  gameId: string;
  mogId: number;
  gameCreatedAt: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const txHash = params.txHash.toLowerCase();
  if (!/^0x[0-9a-f]{64}$/.test(txHash)) {
    return { ok: false, error: "Invalid burnTxHash." };
  }

  const usedKey = USED_BURN_TX_KEY(txHash);
  const existing = await kv.get<{ gameId: string; consumed: boolean }>(usedKey);
  if (existing) {
    // Allow re-declaration within the same game if not yet consumed
    if (existing.gameId === params.gameId && !existing.consumed) {
      return { ok: true };
    }
    return { ok: false, error: "This burn transaction has already been used." };
  }

  const receipt = await publicClient.getTransactionReceipt({ hash: txHash as Hex }).catch(() => null);
  if (!receipt) {
    return { ok: false, error: "Burn transaction was not found on Monad." };
  }
  if (receipt.status !== "success") {
    return { ok: false, error: "Burn transaction did not succeed." };
  }

  const block = await publicClient.getBlock({ blockNumber: receipt.blockNumber }).catch(() => null);
  if (!block) {
    return { ok: false, error: "Burn transaction block could not be verified." };
  }

  const gameCreatedAt = Date.parse(params.gameCreatedAt);
  const blockTimeMs = Number(block.timestamp) * 1000;
  if (Number.isFinite(gameCreatedAt) && blockTimeMs + 60_000 < gameCreatedAt) {
    return { ok: false, error: "Burn transaction must happen after the game is created." };
  }

  const decimals = await publicClient.readContract({
    address: MOGS_TOKEN_ADDRESS,
    abi: erc20Abi,
    functionName: "decimals",
  }).catch(() => null);
  if (decimals === null) {
    return { ok: false, error: "$MOGS decimals could not be verified." };
  }

  const expectedFrom = getAddress(params.agentAddress);
  const expectedTo = getAddress(MOGS_BURN_ADDRESS);
  const expectedToken = getAddress(MOGS_TOKEN_ADDRESS);
  const expectedAmount = exactBurnAmount(Number(decimals));

  const hasExactBurn = receipt.logs.some((log) => {
    if (getAddress(log.address) !== expectedToken) return false;
    try {
      const decoded = decodeEventLog({
        abi: erc20Abi,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName !== "Transfer") return false;
      const args = decoded.args as { from: string; to: string; value: bigint };
      return (
        getAddress(args.from) === expectedFrom &&
        getAddress(args.to) === expectedTo &&
        args.value === expectedAmount
      );
    } catch {
      return false;
    }
  });

  if (!hasExactBurn) {
    return { ok: false, error: "Burn transaction must transfer exactly 1,000 $MOGS from the agent wallet to the dead address." };
  }

  const reserved = await kv.set(
    usedKey,
    {
      gameId: params.gameId,
      mogId: params.mogId,
      agentAddress: expectedFrom,
      consumed: false,
      reservedAt: new Date().toISOString(),
    },
    { ex: 60 * 60 * 24 * 90, nx: true },
  );
  if (!reserved) {
    return { ok: false, error: "This burn transaction has already been reserved." };
  }

  return { ok: true };
}

export async function markBurnTxConsumed(txHash: string): Promise<void> {
  const key = USED_BURN_TX_KEY(txHash.toLowerCase());
  const existing = await kv.get<{ gameId: string; mogId: number; agentAddress: string; consumed: boolean; reservedAt: string }>(key);
  if (!existing) return;
  await kv.set(key, { ...existing, consumed: true }, { ex: 60 * 60 * 24 * 90 });
}
