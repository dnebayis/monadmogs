import { API_BASE_URL, SITE_URL } from "@/lib/urls";

export function GET() {
  const body = `# Monad Mogs

Monad Mogs is a sold out collection of 5,000 fully onchain pixel hamsters on Monad.
The collection metadata is frozen and ownership has been renounced.

## Site
- Homepage: ${SITE_URL}/
- Developers: ${SITE_URL}/developers
- Agent Identity: ${SITE_URL}/#agents
- OpenSea: https://opensea.io/collection/monad-mogs
- X: https://x.com/monadmogs
- $MOGS: https://nad.fun/tokens/0x9cF1538f92341A311a922D411DE8C471DCEA7777

## Public API v0
- GET ${API_BASE_URL}/api/v0/mogs?cursor=1&limit=24
- GET ${API_BASE_URL}/api/v0/mogs/{id}
- GET ${API_BASE_URL}/api/v0/mogs/{id}/traits
- GET ${API_BASE_URL}/api/v0/mogs/{id}/render
- GET ${API_BASE_URL}/api/v0/mogs/random
- GET ${API_BASE_URL}/api/v0/traits
- GET ${API_BASE_URL}/api/v0/assets/{id}

## Agent API
- GET ${API_BASE_URL}/api/agents/uri?owner={address}&mogId={id}&name={name}&caps={csv}&strategy={text}
- GET ${API_BASE_URL}/api/agents/lookup?agentId={id}
- GET ${API_BASE_URL}/api/agents/registries

## Usage Notes
- Token ids are 1 through 5000.
- Use cursor pagination for collection reads.
- Keep limit at or below 100.
- Render endpoints return SVG.
- Metadata and renders are generated from onchain tokenURI data.
- Data can be used for galleries, bots, remix tools, search, trait displays, and creative experiments.

## Builder Kit v0
- Start with this llms.txt file for project context.
- Use /api/v0/mogs/random for bots, daily posts, and lightweight experiments.
- Use /api/v0/mogs/{id}/render for SVG source material.
- Use /api/v0/traits for trait filters, search, and explainers.
- Use /api/agents/uri to resolve ERC-8004-compatible AgentURI JSON.
- Use /api/agents/lookup to read onchain agent data.
- Use /api/agents/registries to get ERC-8004 contract addresses on Monad.
- Credit Monad Mogs and link back to ${SITE_URL} when publishing tools or remixes.

## Agent Identity v0
- A wallet can choose a Mog, define an agent name, strategy, and capabilities.
- The AgentURI is generated at /api/agents/uri with spec-compliant ERC-8004 JSON.
- Users register their agent onchain through the ERC-8004 Identity Registry on Monad.
- Each agent is bound to a Monad Mog NFT and uses the Mog's traits as strategy context.
- Agents can participate in games, chat, and community workflows.

## ERC-8004 Registries on Monad
- Identity Registry: 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
- Reputation Registry: 0x8004BAa17C55a88189AE136b182e5fdA19dE9b63
- Validation Registry: coming soon
- Spec: https://eips.ethereum.org/EIPS/eip-8004
- Docs: https://docs.monad.xyz/guides/erc-8004

## $MOGS Utility
- $MOGS is an ecosystem layer around Monad Mogs, not a replacement or migration.
- Fee strategy: 60% creator, 25% LP support, 15% buyback and burn.
- Creator fees are intended for public API work, open IP tools, campaigns, operations, and reserve growth.
- The Mogs Reserve has collected 300 Monad Mogs so far and is intended for future rewards, activations, experiments, and community campaigns.
- No price promises.

## IP Notes
- Monad Mogs is treated as a cc0 character layer.
- Remixing, building, and spreading Mogs is encouraged.
- Community memes, fan art, stickers, banners, bots, dashboards, and remix tools are welcome.
- Credit Monad Mogs or link to ${SITE_URL} when publishing derivative work.
- Do not imply official partnership, impersonate the project, modify NFT metadata, or use Mogs for scams.
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
