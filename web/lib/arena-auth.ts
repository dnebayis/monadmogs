import { createPublicClient, http, verifyMessage, type Address, getAddress } from "viem";
import { kv } from "@vercel/kv";
import { MONAD_MOGS_ABI, MONAD_MOGS_ADDRESS } from "@/lib/contract";
import { ERC8004_IDENTITY_REGISTRY_ABI, ERC8004_IDENTITY_REGISTRY_ADDRESS } from "@/lib/erc8004";
import { MONAD_CHAIN, MONAD_RPC_URL } from "@/lib/network";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

export type AgentSession = {
  address: string;
  agentId: number;
  mogId: number;
  mogName: string;
  verified: boolean;
  createdAt: string;
  expiresAt: string;
};

/* ------------------------------------------------------------------ */
/*  Constants                                                           */
/* ------------------------------------------------------------------ */

const SESSION_TTL = 3600; // 1 hour
const CHALLENGE_TTL = 300; // 5 minutes
const CHALLENGE_PREFIX = "arena:challenge:";
const SESSION_PREFIX = "arena:session:";

/* ------------------------------------------------------------------ */
/*  Client                                                              */
/* ------------------------------------------------------------------ */

const client = createPublicClient({
  chain: MONAD_CHAIN,
  transport: http(MONAD_RPC_URL),
});

/* ------------------------------------------------------------------ */
/*  Challenge                                                           */
/* ------------------------------------------------------------------ */

export async function createChallenge(address: string): Promise<string> {
  const nonce = crypto.randomUUID();
  const timestamp = Date.now();
  const challenge = `Monad Mogs Arena Authentication\nAddress: ${address}\nNonce: ${nonce}\nTimestamp: ${timestamp}`;

  await kv.set(`${CHALLENGE_PREFIX}${address.toLowerCase()}`, challenge, { ex: CHALLENGE_TTL });
  return challenge;
}

export async function getChallenge(address: string): Promise<string | null> {
  return kv.get<string>(`${CHALLENGE_PREFIX}${address.toLowerCase()}`);
}

/* ------------------------------------------------------------------ */
/*  Verification                                                        */
/* ------------------------------------------------------------------ */

export async function verifyAgentWallet(
  address: string,
  signature: string,
  challenge: string
): Promise<AgentSession | { error: string }> {
  const normalizedAddress = address.toLowerCase();

  // 1. Check challenge exists and matches
  const storedChallenge = await getChallenge(address);
  if (!storedChallenge || storedChallenge !== challenge) {
    return { error: "Invalid or expired challenge." };
  }

  // 2. Verify signature
  let isValid: boolean;
  try {
    isValid = await verifyMessage({
      address: address as Address,
      message: challenge,
      signature: signature as `0x${string}`,
    });
  } catch {
    return { error: "Invalid signature." };
  }

  if (!isValid) {
    return { error: "Signature verification failed." };
  }

  // 3. Check if wallet owns a Monad Mog
  let mogId: number | null = null;
  let mogName = "";

  try {
    const balance = await client.readContract({
      address: MONAD_MOGS_ADDRESS,
      abi: MONAD_MOGS_ABI,
      functionName: "balanceOf",
      args: [address as Address],
    });

    if (balance === 0n) {
      return { error: "Agent wallet does not own any Monad Mogs." };
    }

    // Find the first owned Mog by scanning
    for (let id = 1; id <= 5000; id++) {
      try {
        const owner = await client.readContract({
          address: MONAD_MOGS_ADDRESS,
          abi: MONAD_MOGS_ABI,
          functionName: "ownerOf",
          args: [BigInt(id)],
        });
        if (getAddress(owner) === getAddress(address as Address)) {
          mogId = id;
          mogName = `Mog #${id}`;
          break;
        }
      } catch {
        continue;
      }
    }
  } catch {
    return { error: "Could not verify Mog ownership on Monad." };
  }

  if (!mogId) {
    return { error: "No Monad Mog found in agent wallet." };
  }

  // 4. Check ERC-8004 registration
  let agentId = 0;
  try {
    const registryBalance = await client.readContract({
      address: ERC8004_IDENTITY_REGISTRY_ADDRESS,
      abi: ERC8004_IDENTITY_REGISTRY_ABI,
      functionName: "balanceOf",
      args: [address as Address],
    });

    if (registryBalance > 0n) {
      agentId = Number(registryBalance); // simplified — in production, resolve actual token ID
    }
  } catch {
    // ERC-8004 check is optional for now
  }

  // 5. Create session
  const now = new Date();
  const session: AgentSession = {
    address: normalizedAddress,
    agentId,
    mogId,
    mogName,
    verified: true,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + SESSION_TTL * 1000).toISOString(),
  };

  const sessionToken = crypto.randomUUID();
  await kv.set(`${SESSION_PREFIX}${sessionToken}`, session, { ex: SESSION_TTL });

  // Clean up challenge
  await kv.del(`${CHALLENGE_PREFIX}${normalizedAddress}`);

  return { ...session, token: sessionToken } as AgentSession & { token: string };
}

/* ------------------------------------------------------------------ */
/*  Session                                                             */
/* ------------------------------------------------------------------ */

export async function getSession(token: string): Promise<AgentSession | null> {
  const session = await kv.get<AgentSession>(`${SESSION_PREFIX}${token}`);
  if (!session) return null;

  // Check expiry
  if (new Date(session.expiresAt) < new Date()) {
    await kv.del(`${SESSION_PREFIX}${token}`);
    return null;
  }

  return session;
}

export async function validateAuthHeader(
  authHeader: string | null
): Promise<AgentSession | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  return getSession(token);
}
