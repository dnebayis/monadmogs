const body = `# Monad Mogs

Monad Mogs is a sold out collection of 5,000 fully onchain pixel hamsters on Monad.
The collection metadata is frozen and ownership has been renounced.

## Site
- Homepage: https://monadmogs.vercel.app/
- Developers: https://monadmogs.vercel.app/developers
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

## IP Notes
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
