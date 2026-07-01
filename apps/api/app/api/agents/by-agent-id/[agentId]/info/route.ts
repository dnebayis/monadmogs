import { NextResponse, type NextRequest } from "next/server";
import { getAgentByAgentId } from "@/lib/agent-registry";
import { buildMogPersona } from "@/lib/agent-persona";
import { apiUrl } from "@/lib/urls";

export const dynamic = "force-dynamic";

function parseAgentId(value: string) {
  return /^[1-9]\d*$/.test(value) ? BigInt(value) : null;
}

export async function GET(_request: NextRequest, context: { params: Promise<{ agentId: string }> }) {
  const { agentId: rawAgentId } = await context.params;
  const agentId = parseAgentId(rawAgentId);

  if (!agentId) {
    return NextResponse.json({ error: "agentId must be a positive integer." }, { status: 400 });
  }

  const binding = await getAgentByAgentId(agentId);
  if (!binding) {
    return NextResponse.json({ error: "Agent is not bound to a Mog.", agentId: Number(agentId), bound: false }, { status: 404 });
  }

  const persona = await buildMogPersona(binding.mogId);
  return NextResponse.json(
    {
      ...persona,
      type: "Monad Mog Agent",
      agent: binding.agent,
      binding: {
        spec: "ERC-8217",
        tokenId: String(binding.mogId),
        agentId: Number(agentId),
        contract: binding.bindingContract,
        source: binding.source,
      },
      links: {
        binding: apiUrl(`/api/agents/binding/${binding.mogId}`),
        metadata: apiUrl(`/api/agents/metadata/${binding.mogId}`),
        runtime: apiUrl(`/api/agent-runtime/${binding.mogId}`),
        agentCard: apiUrl(`/api/agents/agent-card/${binding.mogId}`),
      },
    },
    { headers: { "Cache-Control": "public, max-age=60" } },
  );
}
