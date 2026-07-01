import { NextResponse, type NextRequest } from "next/server";
import { getAgentByMog } from "@/lib/agent-registry";
import { enrichMogMetadata, getMogMetadata, parseTokenId } from "@/lib/mogs";
import { getMogRarity } from "@/lib/rarity";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const tokenId = parseTokenId(id);

  if (!tokenId) {
    return NextResponse.json({ error: "Token id must be between 1 and 5000." }, { status: 400 });
  }

  let metadata;
  try {
    metadata = await getMogMetadata(tokenId);
  } catch (error) {
    console.error(`Failed to fetch Mog #${tokenId}:`, error);
    return NextResponse.json({ error: "Mog metadata unavailable." }, { status: 503 });
  }

  const agent = await getAgentByMog(tokenId);

  return NextResponse.json(
    {
      ...enrichMogMetadata(metadata),
      rarity: getMogRarity(tokenId),
      agentAwake: Boolean(agent),
      agentId: agent?.agent.agentId || null,
      agentBinding: agent
        ? {
            spec: "ERC-8217",
            contract: agent.bindingContract,
            source: agent.source,
            agentURI: agent.agent.agentURI,
            controller: agent.agent.controller,
          }
        : null,
    },
    { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=60" } },
  );
}
