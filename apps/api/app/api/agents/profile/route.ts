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

const MAX_PROFILE_BYTES = 64 * 1024;

function isSafeProfileUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "0.0.0.0" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host.endsWith(".local") ||
      host === "169.254.169.254" ||
      host.startsWith("10.") ||
      host.startsWith("192.168.") ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function readBoundedJson(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) return null;

  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    size += value.byteLength;
    if (size > MAX_PROFILE_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const text = new TextDecoder().decode(bytes);
  return JSON.parse(text);
}

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

    let profile: unknown = null;
    if (typeof agentURI === "string" && isSafeProfileUrl(agentURI)) {
      try {
        const response = await fetch(agentURI, {
          next: { revalidate: 300 },
          redirect: "error",
          signal: AbortSignal.timeout(4000),
        });
        const contentType = response.headers.get("content-type") || "";
        if (response.ok && contentType.includes("application/json")) {
          profile = await readBoundedJson(response);
        }
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
