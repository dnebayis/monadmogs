import { NextResponse, type NextRequest } from "next/server";
import { getAgentByMog } from "@/lib/agent-registry";
import { buildMogPersona } from "@/lib/agent-persona";
import { MAX_SUPPLY, parseTokenId } from "@/lib/mogs";
import { apiUrl, siteUrl } from "@/lib/urls";

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
      description: persona.backstory,
      image: apiUrl(`/api/agents/image/${mogId}`),
      external_url: siteUrl(`/mogs/${mogId}`),
      attributes: [
        { trait_type: "Agent Type", value: "Monad Mog Agent" },
        { trait_type: "Binding Spec", value: "ERC-8217" },
        { trait_type: "Controller Model", value: "Mog NFT owner" },
        ...(persona.rarity
          ? [
              { trait_type: "Rarity Tier", value: persona.rarity.tier },
              { trait_type: "Rarity Rank", value: persona.rarity.rank },
            ]
          : []),
      ],
      services: [
        {
          type: "web",
          endpoint: apiUrl(`/api/agents/info/${mogId}`),
        },
        {
          type: "RESTAP",
          endpoint: apiUrl(`/api/agent-runtime/${mogId}`),
          discovery: apiUrl(`/api/agent-runtime/${mogId}/.well-known/restap.json`),
        },
        {
          type: "A2A",
          endpoint: apiUrl(`/api/agents/agent-card/${mogId}`),
        },
      ],
      agent: {
        id: binding.agent.agentId,
        registry: binding.agent.registry,
        owner: binding.agent.owner,
        wallet: binding.agent.agentWallet,
        controller: binding.agent.controller,
      },
      binding: {
        spec: "ERC-8217",
        contract: binding.bindingContract,
        tokenContract: binding.mog.contract,
        tokenId: String(mogId),
        source: binding.source,
      },
    },
    { headers: { "Cache-Control": "public, max-age=60" } },
  );
}
