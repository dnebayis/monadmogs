import { NextResponse, type NextRequest } from "next/server";
import { getAgentByMog } from "@/lib/agent-registry";
import { buildMogPersona } from "@/lib/agent-persona";
import { MAX_SUPPLY, parseTokenId } from "@/lib/mogs";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, context: { params: Promise<{ mogId: string }> }) {
  const { mogId: rawMogId } = await context.params;
  const mogId = parseTokenId(rawMogId);

  if (!mogId || mogId < 1 || mogId > MAX_SUPPLY) {
    return NextResponse.json({ error: "mogId must be between 1 and 5000." }, { status: 400 });
  }

  const binding = await getAgentByMog(mogId);
  if (!binding) {
    return NextResponse.json({ error: "Mog agent is not awakened.", mogId, bound: false }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const message = typeof body.message === "string" ? body.message.slice(0, 1000) : "";
  const persona = await buildMogPersona(mogId);
  const traitList = Object.entries(persona.traits.attributes)
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${value}`)
    .join(", ");

  return NextResponse.json({
    mogId,
    agentId: binding.agent.agentId,
    input: message,
    response: `${persona.greeting} ${message ? `You asked: "${message}". ` : ""}My current read is shaped by ${traitList}. I can talk, explain my traits, and expose public metadata, but I cannot sign wallet actions in RESTAP v1.`,
    persona: {
      name: persona.name,
      tagline: persona.tagline,
      communicationStyle: persona.communicationStyle,
    },
  });
}
