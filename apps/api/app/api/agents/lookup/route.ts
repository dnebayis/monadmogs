import { NextResponse, type NextRequest } from "next/server";
import { createPublicClient, http } from "viem";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import {
  ERC8004_IDENTITY_REGISTRY_ABI,
  ERC8004_IDENTITY_REGISTRY_ADDRESS,
} from "@/lib/erc8004";
import { MONAD_CHAIN, MONAD_RPC_URL } from "@/lib/network";
import { classifyContractReadError } from "@/lib/chain-read-errors";

const client = createPublicClient({
  chain: MONAD_CHAIN,
  transport: http(MONAD_RPC_URL),
});

/**
 * GET /api/agents/lookup?agentId=1
 *
 * Reads the onchain tokenURI and agentWallet for a registered ERC-8004 agent.
 */
export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`agent-lookup:${ip}`, 30, 60);
  if (!rl.ok) {
    return NextResponse.json(
      { error: rl.message, degraded: rl.status === 503 ? true : undefined },
      {
        status: rl.status,
        headers: rl.status === 429 ? { "Retry-After": String(rl.retryAfter) } : undefined,
      }
    );
  }

  const { searchParams } = new URL(request.url);
  const agentIdRaw = searchParams.get("agentId");

  if (!agentIdRaw || !/^[1-9]\d*$/.test(agentIdRaw)) {
    return NextResponse.json({ error: "agentId must be a positive integer." }, { status: 400 });
  }

  const agentId = BigInt(agentIdRaw);

  try {
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

    return NextResponse.json(
      {
        agentId: Number(agentId),
        agentURI,
        owner,
        agentWallet,
        registry: ERC8004_IDENTITY_REGISTRY_ADDRESS,
        chainId: MONAD_CHAIN.id,
      },
      { headers: { "Cache-Control": "public, max-age=60" } },
    );
  } catch (error) {
    const classified = classifyContractReadError(error);
    return NextResponse.json(
      {
        error: classified.kind === "not_found" ? "Agent not found." : "Agent registry read failed.",
        code: classified.code,
        agentId: Number(agentId),
      },
      { status: classified.status },
    );
  }
}
