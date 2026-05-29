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
// DEV_MODE skips Mog ownership verification — NEVER enable in production
const DEV_MODE = process.env.ARENA_DEV_MODE === "true" && process.env.NODE_ENV !== "production";
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
  challenge: string,
  claimedMogId?: number
): Promise<(AgentSession & { token: string }) | { error: string }> {
  const normalizedAddress = address.toLowerCase();

  // 1. Check challenge exists and matches
  const storedChallenge = await getChallenge(address);
  if (!storedChallenge || storedChallenge !== challenge) {
    return { error: "Invalid or expired challenge." };
  }

  // 1b. Verify challenge timestamp is within window (5 min)
  const timestampMatch = challenge.match(/Timestamp: (\d+)/);
  if (timestampMatch) {
    const challengeTime = Number(timestampMatch[1]);
    const now = Date.now();
    if (now - challengeTime > CHALLENGE_TTL * 1000) {
      await kv.del(`${CHALLENGE_PREFIX}${normalizedAddress}`);
      return { error: "Challenge expired." };
    }
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

  // 3. Verify Mog ownership
  let mogId: number | null = null;
  let mogName = "";
  let agentId = 0;

  if (DEV_MODE) {
    // Dev mode: skip onchain checks, use claimed mogId or random
    mogId = claimedMogId || Math.floor(Math.random() * 5000) + 1;
    mogName = `Mog #${mogId}`;
    agentId = 0;
  } else {
    // Production: verify onchain ownership
    if (claimedMogId && claimedMogId >= 1 && claimedMogId <= 5000) {
      try {
        const owner = await client.readContract({
          address: MONAD_MOGS_ADDRESS,
          abi: MONAD_MOGS_ABI,
          functionName: "ownerOf",
          args: [BigInt(claimedMogId)],
        });
        if (getAddress(owner) === getAddress(address as Address)) {
          mogId = claimedMogId;
          mogName = `Mog #${claimedMogId}`;
        }
      } catch {
        // ownerOf failed
      }
    }

    // Fallback: check balance first, then do limited scan
    if (!mogId) {
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

        for (let start = 1; start <= 5000 && !mogId; start += 100) {
          const end = Math.min(start + 99, 5000);
          const checks = [];
          for (let id = start; id <= end; id++) {
            checks.push(
              client
                .readContract({
                  address: MONAD_MOGS_ADDRESS,
                  abi: MONAD_MOGS_ABI,
                  functionName: "ownerOf",
                  args: [BigInt(id)],
                })
                .then((owner) => ({ id, owner }))
                .catch(() => null)
            );
          }
          const results = await Promise.all(checks);
          for (const r of results) {
            if (r && getAddress(r.owner) === getAddress(address as Address)) {
              mogId = r.id;
              mogName = `Mog #${r.id}`;
              break;
            }
          }
        }
      } catch {
        return { error: "Could not verify Mog ownership on Monad." };
      }
    }

    if (!mogId) {
      return { error: "No Monad Mog found in agent wallet." };
    }

    // Check ERC-8004 registration (optional)
    try {
      const registryBalance = await client.readContract({
        address: ERC8004_IDENTITY_REGISTRY_ADDRESS,
        abi: ERC8004_IDENTITY_REGISTRY_ABI,
        functionName: "balanceOf",
        args: [address as Address],
      });
      if (registryBalance > 0n) {
        agentId = Number(registryBalance);
      }
    } catch {
      // best-effort
    }
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

  return { ...session, token: sessionToken };
}

/* ------------------------------------------------------------------ */
/*  Session                                                             */
/* ------------------------------------------------------------------ */

export async function getSession(token: string): Promise<AgentSession | null> {
  const session = await kv.get<AgentSession>(`${SESSION_PREFIX}${token}`);
  if (!session) return null;

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
