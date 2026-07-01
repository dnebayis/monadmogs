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
  const updatedAt = binding.registration?.registeredAt
    ? Math.floor(new Date(binding.registration.registeredAt).getTime() / 1000)
    : undefined;
  const agentRegistry = `eip155:${binding.agent.chainId}:${binding.agent.registry}`;
  const agentWallet = `eip155:${binding.agent.chainId}:${binding.agent.agentWallet}`;

  return NextResponse.json(
    {
      type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
      name: persona.name,
      description: persona.backstory,
      image: apiUrl(`/api/agents/image/${mogId}`),
      external_url: siteUrl(`/mogs/${mogId}`),
      version: "1.0.0",
      active: true,
      x402Support: false,
      ...(updatedAt ? { updatedAt } : {}),
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
          name: "web",
          type: "web",
          endpoint: apiUrl(`/api/agents/info/${mogId}`),
          version: "1.0.0",
        },
        {
          name: "RESTAP",
          type: "RESTAP",
          endpoint: apiUrl(`/api/agent-runtime/${mogId}`),
          discovery: apiUrl(`/api/agent-runtime/${mogId}/.well-known/restap.json`),
          version: "1.0.0",
        },
        {
          name: "A2A",
          type: "A2A",
          endpoint: apiUrl(`/api/agents/agent-card/${mogId}`),
          version: "0.3.0",
        },
      ],
      registrations: [
        {
          agentId: binding.agent.agentId,
          agentRegistry,
          agentWallet,
        },
      ],
      supportedTrust: ["erc-8004-identity", "erc-8217-binding", "self-signed"],
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
        metadataKey: "agent-binding",
      },
    },
    { headers: { "Cache-Control": "public, max-age=60" } },
  );
}
