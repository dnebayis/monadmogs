import { NextResponse, type NextRequest } from "next/server";
import { getAgentByMog } from "@/lib/agent-registry";
import { MAX_SUPPLY, parseTokenId } from "@/lib/mogs";
import { getMogRarity } from "@/lib/rarity";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { apiUrl } from "@/lib/urls";

/**
 * GET /api/agents/by-mog?mogId={id}
 *
 * Legacy query endpoint kept for existing integrations.
 * Resolution is adapter-first, then legacy MogsAgentBindings fallback.
 */
export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`agent-by-mog:${ip}`, 60, 60);
  if (!rl.ok) {
    return NextResponse.json(
      { error: rl.message, degraded: rl.status === 503 ? true : undefined },
      {
        status: rl.status,
        headers: rl.status === 429 ? { "Retry-After": String(rl.retryAfter) } : undefined,
      },
    );
  }

  const { searchParams } = new URL(request.url);
  const mogId = parseTokenId(searchParams.get("mogId") || "");

  if (!mogId || mogId < 1 || mogId > MAX_SUPPLY) {
    return NextResponse.json({ error: "mogId must be between 1 and 5000." }, { status: 400 });
  }

  try {
    const result = await getAgentByMog(mogId);
    const rarity = getMogRarity(mogId);

    if (!result) {
      return NextResponse.json({
        mogId,
        bound: false,
        spec: "ERC-8217",
        discovery: {
          metadataKey: "agent-binding",
          source: "adapter-first",
        },
        rarity: rarity ? { rank: rarity.rank, tier: rarity.tier } : null,
        render: apiUrl(`/api/v0/mogs/${mogId}/render`),
      });
    }

    return NextResponse.json(
      {
        mogId,
        bound: true,
        spec: "ERC-8217",
        agent: result.agent,
        mog: result.mog,
        bindingContract: result.bindingContract,
        discovery: {
          metadataKey: "agent-binding",
          source: result.source,
          bindingContract: result.bindingContract,
        },
      },
      { headers: { "Cache-Control": "public, max-age=60" } },
    );
  } catch {
    return NextResponse.json({ error: "Binding contract read failed.", mogId }, { status: 502 });
  }
}
