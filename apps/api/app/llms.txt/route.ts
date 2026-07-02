import { API_BASE_URL, SITE_URL } from "@/lib/urls";

export function GET() {
  const body = `# Monad Mogs

version: 1.0.0-agent-registry

Monad Mogs is a sold-out collection of 5,000 fully onchain pixel hamster NFTs on Monad.
The NFT contract is frozen/renounced, so ERC-8048 is out of scope for v1.

## Current Priority
- Agent Registry / Awakening is the primary product flow.
- New registrations use a Monad Mogs Adapter8004-style contract.
- Old MogsAgentBindings is read-only legacy fallback for compatibility.

## Agent Model
- A Mog NFT controls an ERC-8004 agent identity.
- The adapter registers the ERC-8004 agent and keeps the ERC-8004 agent NFT in adapter custody.
- Current Mog owner is the current controller.
- Mog transfer moves controller rights to the new owner.
- Binding is immutable in v1.
- The adapter writes ERC-8004 metadata key agent-binding as exact 20-byte adapter address bytes.

## Site
- Homepage: ${SITE_URL}/
- Agent Registry: ${SITE_URL}/#agents
- Agent Directory: ${SITE_URL}/#agents
- Developers: ${SITE_URL}/developers
- OpenSea: https://opensea.io/collection/monad-mogs
- X: https://x.com/monadmogs

## Collection API
- GET ${API_BASE_URL}/api/v0/mogs?cursor=1&limit=24
- GET ${API_BASE_URL}/api/v0/mogs?awake=true
- GET ${API_BASE_URL}/api/v0/mogs?awake=false
- GET ${API_BASE_URL}/api/v0/mogs/{id}
- GET ${API_BASE_URL}/api/v0/mogs/{id}/traits
- GET ${API_BASE_URL}/api/v0/mogs/{id}/rarity
- GET ${API_BASE_URL}/api/v0/mogs/{id}/render
- GET ${API_BASE_URL}/api/v0/mogs/random
- GET ${API_BASE_URL}/api/v0/traits
- GET ${API_BASE_URL}/api/v0/rarity

## Awakened Agent API
- GET ${API_BASE_URL}/api/agents/count
- GET ${API_BASE_URL}/api/agents/list
- GET ${API_BASE_URL}/api/agents/search?q={query}
- GET ${API_BASE_URL}/api/agents/binding/{mogId}
- POST ${API_BASE_URL}/api/agents/binding/batch
- GET ${API_BASE_URL}/api/agents/info/{mogId}
- GET ${API_BASE_URL}/api/agents/metadata/{mogId}
- GET ${API_BASE_URL}/api/agents/identity/{mogId}
- GET ${API_BASE_URL}/api/agents/persona-preview/{mogId}
- GET ${API_BASE_URL}/api/agents/image/{mogId}
- GET ${API_BASE_URL}/api/agents/agent-card/{mogId}

## Agent Directory
- Web UI: ${SITE_URL}/#agents
- Data source: ${API_BASE_URL}/api/agents/search?awake=true&limit=24&offset=0&q={query}
- Directory is embedded in the Agents tab, lists awakened agents only, and links to binding, info, AgentURI, RESTAP discovery, and OpenSea item pages.

## Compatibility Agent API
- GET ${API_BASE_URL}/api/agents/binding?agentId={id}
- GET ${API_BASE_URL}/api/agents/by-agent-id/{agentId}
- GET ${API_BASE_URL}/api/agents/by-agent-id/{agentId}/info
- GET ${API_BASE_URL}/api/agents/by-mog?mogId={id}
- GET ${API_BASE_URL}/api/agents/lookup?agentId={id}
- GET ${API_BASE_URL}/api/agents/profile?agentId={id}
- GET ${API_BASE_URL}/api/agents/registries

## RESTAP v1
- GET ${API_BASE_URL}/api/agent-runtime/{mogId}/.well-known/restap.json
- POST ${API_BASE_URL}/api/agent-runtime/{mogId}/talk
- GET ${API_BASE_URL}/api/agent-runtime/{mogId}/news
- POST ${API_BASE_URL}/api/agent-runtime/{mogId}/news

RESTAP v1 is persona-driven text only.
It does not sign wallet actions or execute autonomously.

## ERC-8257 ToolRegistry v1
Open-access read-only tools:
- POST ${API_BASE_URL}/api/tools/mog-agent-lookup
- POST ${API_BASE_URL}/api/tools/mog-persona
- POST ${API_BASE_URL}/api/tools/mog-rarity

Holder-gated tool endpoints prepared for ERC-8257 gated registration:
- POST ${API_BASE_URL}/api/tools/mog-holder-portfolio
- POST ${API_BASE_URL}/api/tools/mog-holder-mission-brief
- POST ${API_BASE_URL}/api/tools/mog-market-radar

OpenSea-compatible manifests:
- GET ${API_BASE_URL}/.well-known/ai-tool/mog-agent-lookup.json
- GET ${API_BASE_URL}/.well-known/ai-tool/mog-persona.json
- GET ${API_BASE_URL}/.well-known/ai-tool/mog-rarity.json
- GET ${API_BASE_URL}/.well-known/ai-tool/mog-holder-portfolio.json
- GET ${API_BASE_URL}/.well-known/ai-tool/mog-holder-mission-brief.json
- GET ${API_BASE_URL}/.well-known/ai-tool/mog-market-radar.json

Base ToolRegistry:
- Registry: 0x265BB2DBFC0A8165C9A1941Eb1372F349baD2cf1
- mog-agent-lookup toolId: 183
- mog-persona toolId: 184
- mog-rarity toolId: 185

## Registry Contracts
- ERC-8004 Identity Registry: 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
- ERC-8004 Reputation Registry: 0x8004BAa17C55a88189AE136b182e5fdA19dE9b63
- Monad Mogs NFT: 0x1414f3BAF22404C42fD656af4aFAab4934045137
- Adapter8004 address: see ${API_BASE_URL}/api/agents/registries
- Legacy MogsAgentBindings: see ${API_BASE_URL}/api/agents/registries

## Usage Notes
- Token ids are 1 through 5000.
- Render endpoints return SVG.
- Persona is generated from Mog traits, rarity, and deterministic templates.
- ToolRegistry v1 tools are read-only and open-access.
- Gated/x402 tools are v2.
- ERC-8217 gives binding-level attribution from agent identity to Mog NFT and current controller.
- Public API v1 does not claim that individual wallet transactions were autonomously executed by an agent.
- Credit Monad Mogs and link back to ${SITE_URL} when publishing tools or remixes.
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
