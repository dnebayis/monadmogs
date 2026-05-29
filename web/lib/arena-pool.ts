import { createPublicClient, createWalletClient, http, keccak256, toHex, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ERC8004_REPUTATION_REGISTRY_ABI, ERC8004_REPUTATION_REGISTRY_ADDRESS } from "@/lib/erc8004";
import { MONAD_CHAIN, MONAD_RPC_URL } from "@/lib/network";

/* ------------------------------------------------------------------ */
/*  MogsArena v2 Contract                                               */
/* ------------------------------------------------------------------ */

export const MOGS_ARENA_ADDRESS = (process.env.MOGS_ARENA_ADDRESS ||
  "0xa2c39E325e298653045C43bEB544737D655fbFa5") as Address;

export const MOGS_ARENA_ABI = [
  {
    type: "function",
    name: "createMatch",
    stateMutability: "payable",
    inputs: [
      { name: "entryFee", type: "uint256" },
      { name: "gameHash", type: "bytes32" },
    ],
    outputs: [{ name: "matchId", type: "uint256" }],
  },
  {
    type: "function",
    name: "joinMatch",
    stateMutability: "payable",
    inputs: [{ name: "matchId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "resolveMatch",
    stateMutability: "nonpayable",
    inputs: [
      { name: "matchId", type: "uint256" },
      { name: "winner", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "resolveDraw",
    stateMutability: "nonpayable",
    inputs: [{ name: "matchId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "cancelMatch",
    stateMutability: "nonpayable",
    inputs: [{ name: "matchId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "expireMatch",
    stateMutability: "nonpayable",
    inputs: [{ name: "matchId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "getMatch",
    stateMutability: "view",
    inputs: [{ name: "matchId", type: "uint256" }],
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
          { name: "deadline", type: "uint64" },
          { name: "gameHash", type: "bytes32" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "getTotalPrize",
    stateMutability: "view",
    inputs: [{ name: "matchId", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "matchCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "isMatchExpired",
    stateMutability: "view",
    inputs: [{ name: "matchId", type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "activeMatch",
    stateMutability: "view",
    inputs: [{ name: "player", type: "address" }],
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
    type: "function",
    name: "withdrawFees",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "feeCollected",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const;

const STATUS_NAMES = ["open", "full", "resolved", "draw", "cancelled", "expired"] as const;

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
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

export function gameIdToHash(gameId: string): `0x${string}` {
  return keccak256(toHex(gameId));
}

/* ------------------------------------------------------------------ */
/*  Read                                                                */
/* ------------------------------------------------------------------ */

export async function getOnchainMatch(matchId: number) {
  const m = await publicClient.readContract({
    address: MOGS_ARENA_ADDRESS,
    abi: MOGS_ARENA_ABI,
    functionName: "getMatch",
    args: [BigInt(matchId)],
  });

  const totalPrize = await publicClient.readContract({
    address: MOGS_ARENA_ADDRESS,
    abi: MOGS_ARENA_ABI,
    functionName: "getTotalPrize",
    args: [BigInt(matchId)],
  });

  return {
    id: Number(m.id),
    sponsorPrize: m.sponsorPrize.toString(),
    entryFee: m.entryFee.toString(),
    player1: m.player1,
    player2: m.player2,
    winner: m.winner,
    status: STATUS_NAMES[m.status] || "unknown",
    totalPrize: totalPrize.toString(),
    createdAt: Number(m.createdAt),
    resolvedAt: Number(m.resolvedAt),
    deadline: Number(m.deadline),
    gameHash: m.gameHash,
  };
}

export async function getMatchCount(): Promise<number> {
  const count = await publicClient.readContract({
    address: MOGS_ARENA_ADDRESS,
    abi: MOGS_ARENA_ABI,
    functionName: "matchCount",
  });
  return Number(count);
}

/* ------------------------------------------------------------------ */
/*  Admin actions                                                       */
/* ------------------------------------------------------------------ */

export async function createOnchainMatch(entryFee: bigint, gameId: string, sponsorValue: bigint) {
  const walletClient = getAdminWalletClient();
  const gameHash = gameIdToHash(gameId);

  const hash = await walletClient.writeContract({
    address: MOGS_ARENA_ADDRESS,
    abi: MOGS_ARENA_ABI,
    functionName: "createMatch",
    args: [entryFee, gameHash],
    value: sponsorValue,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  return { txHash: hash, status: receipt.status };
}

export async function resolveOnchainMatch(matchId: number, winnerAddress: string) {
  const walletClient = getAdminWalletClient();

  const hash = await walletClient.writeContract({
    address: MOGS_ARENA_ADDRESS,
    abi: MOGS_ARENA_ABI,
    functionName: "resolveMatch",
    args: [BigInt(matchId), winnerAddress as Address],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  return { txHash: hash, status: receipt.status };
}

export async function resolveOnchainDraw(matchId: number) {
  const walletClient = getAdminWalletClient();

  const hash = await walletClient.writeContract({
    address: MOGS_ARENA_ADDRESS,
    abi: MOGS_ARENA_ABI,
    functionName: "resolveDraw",
    args: [BigInt(matchId)],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  return { txHash: hash, status: receipt.status };
}

export async function cancelOnchainMatch(matchId: number) {
  const walletClient = getAdminWalletClient();

  const hash = await walletClient.writeContract({
    address: MOGS_ARENA_ADDRESS,
    abi: MOGS_ARENA_ABI,
    functionName: "cancelMatch",
    args: [BigInt(matchId)],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  return { txHash: hash, status: receipt.status };
}

/* ------------------------------------------------------------------ */
/*  Reputation                                                          */
/* ------------------------------------------------------------------ */

export async function giveReputationFeedback(
  agentId: number,
  value: number,
  gameType: string,
  gameId: string
): Promise<{ txHash: string } | null> {
  if (!agentId) return null;

  try {
    const walletClient = getAdminWalletClient();

    const hash = await walletClient.writeContract({
      address: ERC8004_REPUTATION_REGISTRY_ADDRESS,
      abi: ERC8004_REPUTATION_REGISTRY_ABI,
      functionName: "giveFeedback",
      args: [
        BigInt(agentId),
        BigInt(value),
        0,
        "arena",
        gameType,
        `arena:${gameId}`,
        "",
        "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`,
      ],
    });

    await publicClient.waitForTransactionReceipt({ hash });
    return { txHash: hash };
  } catch (err) {
    console.error("Failed to give reputation feedback:", err);
    return null;
  }
}
