import { NextResponse, type NextRequest } from "next/server";
import { getAgentByMog } from "@/lib/agent-registry";
import { MAX_SUPPLY, parseTokenId } from "@/lib/mogs";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const mogId = parseTokenId(String(body.mogId || ""));

  if (!mogId || mogId < 1 || mogId > MAX_SUPPLY) {
    return NextResponse.json({ error: "mogId must be between 1 and 5000." }, { status: 400 });
  }

  const result = await getAgentByMog(mogId);
  if (!result) {
    return NextResponse.json({ mogId, bound: false, agent: null, binding: null });
  }

  return NextResponse.json({
    mogId,
    bound: true,
    agentId: result.agent.agentId,
    agentURI: result.agent.agentURI,
    controller: result.agent.controller,
    bindingContract: result.bindingContract,
    source: result.source,
  });
}
