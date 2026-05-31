import { NextResponse, type NextRequest } from "next/server";
import { createPublicClient, http } from "viem";
import {
  ERC8004_IDENTITY_REGISTRY_ABI,
  ERC8004_IDENTITY_REGISTRY_ADDRESS,
} from "@/lib/erc8004";
import { MONAD_CHAIN, MONAD_RPC_URL } from "@/lib/network";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

const client = createPublicClient({
  chain: MONAD_CHAIN,
  transport: http(MONAD_RPC_URL),
});

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`agent-profile:${ip}`, 60, 60);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  const { searchParams } = new URL(request.url);
  const agentIdRaw = searchParams.get("agentId");

  if (!agentIdRaw || Number.isNaN(Number(agentIdRaw)) || Number(agentIdRaw) < 1) {
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

    let profile: unknown = null;
    if (typeof agentURI === "string" && /^https?:\/\//.test(agentURI)) {
      try {
        const response = await fetch(agentURI, { next: { revalidate: 300 } });
        if (response.ok) profile = await response.json();
      } catch {
        profile = null;
      }
    }

    return NextResponse.json(
      {
        agentId: Number(agentId),
        owner,
        agentWallet,
        agentURI,
        registry: ERC8004_IDENTITY_REGISTRY_ADDRESS,
        chainId: MONAD_CHAIN.id,
        profile,
      },
      { headers: { "Cache-Control": "public, max-age=60" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Agent not found or contract call failed.", agentId: Number(agentId) },
      { status: 404 },
    );
  }
}
