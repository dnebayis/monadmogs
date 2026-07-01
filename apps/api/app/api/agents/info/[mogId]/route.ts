import { NextResponse, type NextRequest } from "next/server";
import { getAgentByMog } from "@/lib/agent-registry";
import { buildMogPersona } from "@/lib/agent-persona";
import { MAX_SUPPLY, parseTokenId } from "@/lib/mogs";
import { apiUrl } from "@/lib/urls";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: { params: Promise<{ mogId: string }> }) {
  const { mogId: rawMogId } = await context.params;
  const mogId = parseTokenId(rawMogId);

  if (!mogId || mogId < 1 || mogId > MAX_SUPPLY) {
    return NextResponse.json({ error: "mogId must be between 1 and 5000." }, { status: 400 });
  }

  const binding = await getAgentByMog(mogId);
  if (!binding) {
    return NextResponse.json({ error: "Mog agent is not awakened.", mogId, bound: false }, { status: 404 });
  }

  const persona = await buildMogPersona(mogId);
  return NextResponse.json(
    {
      ...persona,
      type: "Monad Mog Agent",
      agent: binding.agent,
      binding: {
        spec: "ERC-8217",
        tokenId: String(mogId),
        agentId: binding.agent.agentId,
        contract: binding.bindingContract,
        source: binding.source,
      },
      links: {
        metadata: apiUrl(`/api/agents/metadata/${mogId}`),
        runtime: apiUrl(`/api/agent-runtime/${mogId}`),
        agentCard: apiUrl(`/api/agents/agent-card/${mogId}`),
      },
    },
    { headers: { "Cache-Control": "public, max-age=60" } },
  );
}
