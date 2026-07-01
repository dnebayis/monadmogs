import { NextResponse, type NextRequest } from "next/server";
import { getAgentByMog } from "@/lib/agent-registry";
import { MAX_SUPPLY, parseTokenId } from "@/lib/mogs";

export const dynamic = "force-dynamic";

async function parseMogId(context: { params: Promise<{ mogId: string }> }) {
  const { mogId: rawMogId } = await context.params;
  return parseTokenId(rawMogId);
}

export async function GET(_request: NextRequest, context: { params: Promise<{ mogId: string }> }) {
  const mogId = await parseMogId(context);
  if (!mogId || mogId < 1 || mogId > MAX_SUPPLY) {
    return NextResponse.json({ error: "mogId must be between 1 and 5000." }, { status: 400 });
  }

  const binding = await getAgentByMog(mogId);
  if (!binding) {
    return NextResponse.json({ error: "Mog agent is not awakened.", mogId, bound: false }, { status: 404 });
  }

  return NextResponse.json({
    mogId,
    agentId: binding.agent.agentId,
    items: [],
    note: "RESTAP v1 news is read-only in this deployment until signed publishing is enabled.",
  });
}

export async function POST(request: NextRequest, context: { params: Promise<{ mogId: string }> }) {
  const mogId = await parseMogId(context);
  if (!mogId || mogId < 1 || mogId > MAX_SUPPLY) {
    return NextResponse.json({ error: "mogId must be between 1 and 5000." }, { status: 400 });
  }

  const binding = await getAgentByMog(mogId);
  if (!binding) {
    return NextResponse.json({ error: "Mog agent is not awakened.", mogId, bound: false }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  return NextResponse.json(
    {
      mogId,
      agentId: binding.agent.agentId,
      accepted: true,
      persisted: false,
      title: typeof body.title === "string" ? body.title.slice(0, 140) : null,
      note: "RESTAP v1 accepts the message envelope but does not publish signed news yet.",
    },
    { status: 202 },
  );
}
