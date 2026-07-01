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

  const binding = await getAgentByMog(mogId);
  if (!binding) {
    return NextResponse.json({ error: "Mog agent is not awakened.", mogId, bound: false }, { status: 404 });
  }

  return NextResponse.json(
    {
      restap: "1.0",
      name: `Mog #${mogId}`,
      description: "Persona-driven Monad Mogs agent runtime.",
      agentURI: apiUrl(`/api/agents/metadata/${mogId}`),
      endpoints: {
        talk: {
          method: "POST",
          url: apiUrl(`/api/agent-runtime/${mogId}/talk`),
          input: "application/json",
          output: "application/json",
        },
        news: {
          read: {
            method: "GET",
            url: apiUrl(`/api/agent-runtime/${mogId}/news`),
          },
          publish: {
            method: "POST",
            url: apiUrl(`/api/agent-runtime/${mogId}/news`),
          },
        },
      },
      capabilities: {
        walletSigning: false,
        autonomousExecution: false,
        arenaActions: false,
      },
      binding: {
        spec: "ERC-8217",
        agentId: binding.agent.agentId,
        contract: binding.bindingContract,
      },
    },
    { headers: { "Cache-Control": "public, max-age=60" } },
  );
}
