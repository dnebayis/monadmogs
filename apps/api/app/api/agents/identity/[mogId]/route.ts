import { NextResponse, type NextRequest } from "next/server";
import { getAgentByMog, getCurrentMogOwner } from "@/lib/agent-registry";
import { enrichMogMetadata, getMogMetadata, MAX_SUPPLY, parseTokenId } from "@/lib/mogs";
import { getMogRarity } from "@/lib/rarity";
import { apiUrl } from "@/lib/urls";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: { params: Promise<{ mogId: string }> }) {
  const { mogId: rawMogId } = await context.params;
  const mogId = parseTokenId(rawMogId);

  if (!mogId || mogId < 1 || mogId > MAX_SUPPLY) {
    return NextResponse.json({ error: "mogId must be between 1 and 5000." }, { status: 400 });
  }

  const [metadata, owner, binding] = await Promise.all([
    getMogMetadata(mogId),
    getCurrentMogOwner(mogId).catch(() => null),
    getAgentByMog(mogId),
  ]);

  return NextResponse.json(
    {
      mogId,
      mog: {
        ...enrichMogMetadata(metadata),
        owner,
        rarity: getMogRarity(mogId),
      },
      agentAwake: Boolean(binding),
      agentId: binding?.agent.agentId || null,
      agentBinding: binding
        ? {
            spec: "ERC-8217",
            contract: binding.bindingContract,
            source: binding.source,
            tokenId: String(mogId),
          }
        : null,
      agent: binding?.agent || null,
      links: {
        binding: apiUrl(`/api/agents/binding/${mogId}`),
        personaPreview: apiUrl(`/api/agents/persona-preview/${mogId}`),
        metadata: binding ? apiUrl(`/api/agents/metadata/${mogId}`) : null,
      },
      attribution: {
        level: "binding",
        statement:
          "ERC-8217 links an awakened ERC-8004 agent identity to this Mog NFT and its current owner. It does not prove individual transactions were autonomously executed by the agent.",
      },
    },
    { headers: { "Cache-Control": "public, max-age=60" } },
  );
}
