import { createPublicClient, createWalletClient, http, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ERC8004_REPUTATION_REGISTRY_ABI, ERC8004_REPUTATION_REGISTRY_ADDRESS } from "@/lib/erc8004";
import { MONAD_CHAIN, MONAD_RPC_URL } from "@/lib/network";

/* ------------------------------------------------------------------ */
/*  MogsArena Contract                                                  */
/* ------------------------------------------------------------------ */

// Testnet deployment — update to mainnet address after migration
export const MOGS_ARENA_ADDRESS = (process.env.MOGS_ARENA_ADDRESS ||
  "0xa2c39E325e298653045C43bEB544737D655fbFa5") as Address;

export const MOGS_ARENA_ABI = [
  {
    type: "function",
    name: "createPool",
    stateMutability: "payable",
    inputs: [{ name: "entryFee", type: "uint256" }],
    outputs: [{ name: "poolId", type: "uint256" }],
  },
  {
    type: "function",
    name: "joinPool",
    stateMutability: "payable",
    inputs: [{ name: "poolId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "resolvePool",
    stateMutability: "nonpayable",
    inputs: [
      { name: "poolId", type: "uint256" },
      { name: "winner", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "cancelPool",
    stateMutability: "nonpayable",
    inputs: [{ name: "poolId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "getPool",
    stateMutability: "view",
    inputs: [{ name: "poolId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "id", type: "uint256" },
          { name: "sponsorPrize", type: "uint256" },
          { name: "entryFee", type: "uint256" },
          { name: "player1", type: "address" },
          { name: "player2", type: "address" },
          { name: "winner", type: "address" },
          { name: "status", type: "uint8" },
          { name: "createdAt", type: "uint64" },
          { name: "resolvedAt", type: "uint64" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "getTotalPrize",
    stateMutability: "view",
    inputs: [{ name: "poolId", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "poolCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "admin",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "event",
    name: "PoolCreated",
    inputs: [
      { name: "poolId", type: "uint256", indexed: true },
      { name: "sponsorPrize", type: "uint256", indexed: false },
      { name: "entryFee", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PlayerJoined",
    inputs: [
      { name: "poolId", type: "uint256", indexed: true },
      { name: "player", type: "address", indexed: true },
      { name: "slot", type: "uint8", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PoolResolved",
    inputs: [
      { name: "poolId", type: "uint256", indexed: true },
      { name: "winner", type: "address", indexed: true },
      { name: "prize", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PoolCancelled",
    inputs: [{ name: "poolId", type: "uint256", indexed: true }],
  },
] as const;

/* ------------------------------------------------------------------ */
/*  Clients                                                             */
/* ------------------------------------------------------------------ */

const publicClient = createPublicClient({
  chain: MONAD_CHAIN,
  transport: http(MONAD_RPC_URL),
});

function getAdminWalletClient() {
  const pk = process.env.ARENA_WALLET_PRIVATE_KEY;
  if (!pk) throw new Error("ARENA_WALLET_PRIVATE_KEY not configured.");
  const account = privateKeyToAccount(pk as `0x${string}`);
  return createWalletClient({
    account,
    chain: MONAD_CHAIN,
    transport: http(MONAD_RPC_URL),
  });
}

/* ------------------------------------------------------------------ */
/*  Read                                                                */
/* ------------------------------------------------------------------ */

export async function getOnchainPool(poolId: number) {
  const pool = await publicClient.readContract({
    address: MOGS_ARENA_ADDRESS,
    abi: MOGS_ARENA_ABI,
    functionName: "getPool",
    args: [BigInt(poolId)],
  });

  const totalPrize = await publicClient.readContract({
    address: MOGS_ARENA_ADDRESS,
    abi: MOGS_ARENA_ABI,
    functionName: "getTotalPrize",
    args: [BigInt(poolId)],
  });

  return {
    id: Number(pool.id),
    sponsorPrize: pool.sponsorPrize.toString(),
    entryFee: pool.entryFee.toString(),
    player1: pool.player1,
    player2: pool.player2,
    winner: pool.winner,
    status: ["open", "full", "resolved", "cancelled"][pool.status] || "unknown",
    totalPrize: totalPrize.toString(),
    createdAt: Number(pool.createdAt),
    resolvedAt: Number(pool.resolvedAt),
  };
}

export async function getPoolCount(): Promise<number> {
  const count = await publicClient.readContract({
    address: MOGS_ARENA_ADDRESS,
    abi: MOGS_ARENA_ABI,
    functionName: "poolCount",
  });
  return Number(count);
}

/* ------------------------------------------------------------------ */
/*  Admin actions                                                       */
/* ------------------------------------------------------------------ */

export async function resolvePoolOnchain(poolId: number, winnerAddress: string) {
  const walletClient = getAdminWalletClient();

  const hash = await walletClient.writeContract({
    address: MOGS_ARENA_ADDRESS,
    abi: MOGS_ARENA_ABI,
    functionName: "resolvePool",
    args: [BigInt(poolId), winnerAddress as Address],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  return { txHash: hash, status: receipt.status };
}

/**
 * Give onchain reputation feedback to a player via ERC-8004 Reputation Registry.
 * Winner gets positive feedback (+10), loser gets negative (-3).
 */
export async function giveReputationFeedback(
  agentId: number,
  value: number,
  gameType: string,
  gameId: string
): Promise<{ txHash: string } | null> {
  // agentId 0 means not registered on ERC-8004 — skip
  if (!agentId) return null;

  try {
    const walletClient = getAdminWalletClient();

    const hash = await walletClient.writeContract({
      address: ERC8004_REPUTATION_REGISTRY_ADDRESS,
      abi: ERC8004_REPUTATION_REGISTRY_ABI,
      functionName: "giveFeedback",
      args: [
        BigInt(agentId),
        BigInt(value),         // int128 value (+10 or -3)
        0,                      // uint8 valueDecimals
        "arena",                // tag1
        gameType,               // tag2 (e.g. "rock-paper-scissors")
        `arena:${gameId}`,      // endpoint
        "",                     // feedbackURI
        "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`, // feedbackHash
      ],
    });

    await publicClient.waitForTransactionReceipt({ hash });
    return { txHash: hash };
  } catch (err) {
    console.error("Failed to give reputation feedback:", err);
    return null;
  }
}

export async function cancelPoolOnchain(poolId: number) {
  const walletClient = getAdminWalletClient();

  const hash = await walletClient.writeContract({
    address: MOGS_ARENA_ADDRESS,
    abi: MOGS_ARENA_ABI,
    functionName: "cancelPool",
    args: [BigInt(poolId)],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  return { txHash: hash, status: receipt.status };
}
