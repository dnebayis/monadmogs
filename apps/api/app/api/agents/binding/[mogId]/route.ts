import { NextResponse, type NextRequest } from "next/server";
import { getAgentByMog } from "@/lib/agent-registry";
import { MAX_SUPPLY, parseTokenId } from "@/lib/mogs";
import { apiUrl } from "@/lib/urls";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: { params: Promise<{ mogId: string }> }) {
  const { mogId: rawMogId } = await context.params;
  const mogId = parseTokenId(rawMogId);

  if (!mogId || mogId < 1 || mogId > MAX_SUPPLY) {
    return NextResponse.json({ error: "mogId must be between 1 and 5000." }, { status: 400 });
  }

  const result = await getAgentByMog(mogId);
  if (!result) {
    return NextResponse.json(
      {
        mogId,
        bound: false,
        binding: null,
        render: apiUrl(`/api/v0/mogs/${mogId}/render`),
      },
      { headers: { "Cache-Control": "public, max-age=30" } },
    );
  }

  return NextResponse.json(
    {
      mogId,
      bound: true,
      binding: {
        agentId: result.agent.agentId,
        tokenId: String(mogId),
        registeredBy: result.agent.controller || result.agent.owner,
        bindingContract: result.bindingContract,
        source: result.source,
      },
      agent: result.agent,
      mog: result.mog,
    },
    { headers: { "Cache-Control": "public, max-age=60" } },
  );
}
