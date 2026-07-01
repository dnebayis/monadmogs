import { NextResponse, type NextRequest } from "next/server";
import { getAgentByAgentId } from "@/lib/agent-registry";
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

  const result = await getAgentByAgentId(agentId);
  if (!result) {
    return NextResponse.json({ agentId: Number(agentId), bound: false, binding: null }, { status: 404 });
  }

  return NextResponse.json(
    {
      agentId: Number(agentId),
      bound: true,
      binding: {
        ...result.binding,
        bindingContract: result.bindingContract,
        source: result.source,
      },
      agent: result.agent,
      mog: result.mog,
      links: {
        binding: apiUrl(`/api/agents/binding/${result.mogId}`),
        info: apiUrl(`/api/agents/info/${result.mogId}`),
        metadata: apiUrl(`/api/agents/metadata/${result.mogId}`),
        byMog: apiUrl(`/api/agents/by-mog?mogId=${result.mogId}`),
      },
      attribution: {
        level: "binding",
        statement:
          "ERC-8217 links this ERC-8004 agent identity to a Mog NFT and its current controller. This does not prove individual wallet transactions were executed autonomously by the agent.",
      },
    },
    { headers: { "Cache-Control": "public, max-age=60" } },
  );
}
