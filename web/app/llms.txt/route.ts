const body = `# Monad Mogs

Monad Mogs is a sold out collection of 5,000 fully onchain pixel hamsters on Monad.
The collection metadata is frozen and ownership has been renounced.

## Site
- Homepage: https://monadmogs.vercel.app/
- Developers: https://monadmogs.vercel.app/developers
- Agent Identity: https://monadmogs.vercel.app/agents
- OpenSea: https://opensea.io/collection/monad-mogs
- X: https://x.com/monadmogs
- $MOGS: https://nad.fun/tokens/0x9cF1538f92341A311a922D411DE8C471DCEA7777

## Public API v0
- GET https://monadmogs.vercel.app/api/v0/mogs?cursor=1&limit=24
- GET https://monadmogs.vercel.app/api/v0/mogs/{id}
- GET https://monadmogs.vercel.app/api/v0/mogs/{id}/traits
- GET https://monadmogs.vercel.app/api/v0/mogs/{id}/render
- GET https://monadmogs.vercel.app/api/v0/mogs/random
- GET https://monadmogs.vercel.app/api/v0/traits
- GET https://monadmogs.vercel.app/api/v0/assets/{id}

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
- Use /agents to generate, sign, and optionally register a Mog agent identity.
- Credit Monad Mogs and link back to https://monadmogs.vercel.app when publishing tools or remixes.

## Agent Identity v0
- A wallet can choose a Mog, define an agent name, strategy, and capabilities.
- The site creates an AgentURI URL at /api/agents/uri.
- The AgentURI returns JSON with owner, controlled Mog, image, attributes, capabilities, and service placeholders.
- Users can sign the AgentURI locally or submit ERC-8004 register(agentURI) through the Identity Registry on Monad.
- Hosted agent endpoints are reserved for future agent runners.

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
- Credit Monad Mogs or link to https://monadmogs.vercel.app when publishing derivative work.
- Do not imply official partnership, impersonate the project, modify NFT metadata, or use Mogs for scams.
`;

export function GET() {
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
