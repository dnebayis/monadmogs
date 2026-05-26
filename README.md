# Monad Mogs

Monad Mogs is a sold-out collection of 5,000 fully onchain pixel hamsters on Monad.

The collection is treated as a cc0 character layer: builders can remix, use, and spread Mogs through public metadata, SVG renders, traits, and API routes.

## Links

- Site: https://monadmogs.vercel.app/
- OpenSea: https://opensea.io/collection/monad-mogs
- X: https://x.com/monadmogs
- GitHub: https://github.com/dnebayis/monadmogs
- $MOGS: https://nad.fun/tokens/0x9cF1538f92341A311a922D411DE8C471DCEA7777

## Builder Kit

- API docs: https://monadmogs.vercel.app/developers
- Agent Identity: https://monadmogs.vercel.app/agents
- LLM context: https://monadmogs.vercel.app/llms.txt
- Sample Mog page: https://monadmogs.vercel.app/mogs/1
- Random Mog metadata: https://monadmogs.vercel.app/api/v0/mogs/random
- Trait schema: https://monadmogs.vercel.app/api/v0/traits

## API

```txt
GET /api/v0/mogs?cursor=1&limit=24
GET /api/v0/mogs/{id}
GET /api/v0/mogs/{id}/traits
GET /api/v0/mogs/{id}/render
GET /api/v0/mogs/random
GET /api/v0/traits
```

## Local Development

```bash
cd web
pnpm install
pnpm dev
```

The site runs at `http://localhost:3000`.

## Notes

- Final supply: 5,000 / 5,000
- Metadata: frozen
- Ownership: renounced
- Art and metadata source: onchain `tokenURI()`
- Primary site contract environment variable: `NEXT_PUBLIC_MONAD_MOGS_ADDRESS`
- Agent Identity v0 serves AgentURI JSON through `/api/agents/uri` and can submit ERC-8004 `register(agentURI)` transactions on Monad.
