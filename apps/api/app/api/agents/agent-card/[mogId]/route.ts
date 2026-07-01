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
      name: persona.name,
      description: persona.tagline,
      url: apiUrl(`/api/agent-runtime/${mogId}`),
      version: "1.0.0",
      protocolVersion: "0.3.0",
      capabilities: {
        streaming: false,
        pushNotifications: false,
        stateTransitionHistory: false,
      },
      defaultInputModes: ["text/plain", "application/json"],
      defaultOutputModes: ["text/plain", "application/json"],
      skills: [
        {
          id: "talk",
          name: "Talk",
          description: "Persona-driven text response for this awakened Mog.",
          tags: ["persona", "monad-mogs"],
          examples: ["What do your traits say about you?"],
        },
        {
          id: "news",
          name: "News",
          description: "Receive or read public runtime updates for this Mog.",
          tags: ["updates", "restap"],
        },
      ],
      provider: {
        organization: "Monad Mogs",
        url: "https://www.monadmogs.xyz",
      },
      agent: binding.agent,
    },
    { headers: { "Cache-Control": "public, max-age=60" } },
  );
}
