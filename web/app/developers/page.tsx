import { CopyPrompt } from "@/components/copy-prompt";

const endpoints = [
  {
    method: "GET",
    path: "/api/v0/mogs?cursor=1&limit=24",
    note: "Paginated metadata, image data URIs, traits, and links.",
  },
  {
    method: "GET",
    path: "/api/v0/mogs/1",
    note: "Single Mog metadata enriched with OpenSea, Monadscan, render, and traits links.",
  },
  {
    method: "GET",
    path: "/api/v0/mogs/1/traits",
    note: "Trait-only response for one Mog.",
  },
  {
    method: "GET",
    path: "/api/v0/mogs/1/render",
    note: "Raw SVG render served as image/svg+xml.",
  },
  {
    method: "GET",
    path: "/api/v0/mogs/random",
    note: "Random fully onchain Mog metadata.",
  },
  {
    method: "GET",
    path: "/api/v0/traits",
    note: "Full trait schema for the collection.",
  },
  {
    method: "GET",
    path: "/llms.txt",
    note: "LLM-readable project, API, and IP context for agents and AI tools.",
  },
];

const examples = [
  {
    title: "Fetch a random Mog",
    code: `const mog = await fetch("https://monadmogs.vercel.app/api/v0/mogs/random").then((r) => r.json());
console.log(mog.name, mog.attributes);`,
  },
  {
    title: "Load a gallery page",
    code: `const page = await fetch("https://monadmogs.vercel.app/api/v0/mogs?cursor=1&limit=24").then((r) => r.json());
console.log(page.items, page.nextCursor);`,
  },
  {
    title: "Render an SVG",
    code: `const svg = await fetch("https://monadmogs.vercel.app/api/v0/mogs/1/render").then((r) => r.text());
document.body.innerHTML = svg;`,
  },
  {
    title: "Read trait schema",
    code: `const schema = await fetch("https://monadmogs.vercel.app/api/v0/traits").then((r) => r.json());
console.log(schema.traits.Background);`,
  },
];

const agentPrompt = `read https://monadmogs.vercel.app/llms.txt first.
then use the monad mogs public api to fetch frozen metadata, traits, svg renders, or random mogs.
if you build with the assets, credit monad mogs and link back to https://monadmogs.vercel.app/.`;

const builderSteps = [
  {
    title: "1 / Read context",
    body: "Start with /llms.txt or the copyable agent prompt so tools understand Monad Mogs, IP rules, and API routes.",
  },
  {
    title: "2 / Fetch a Mog",
    body: "Use /api/v0/mogs/random or /api/v0/mogs/{id} to load frozen metadata, traits, image data, and links.",
  },
  {
    title: "3 / Render assets",
    body: "Use /api/v0/mogs/{id}/render for SVG source that can power stickers, bots, games, dashboards, and sites.",
  },
  {
    title: "4 / Share a page",
    body: "Use /mogs/{id} for a public detail page with render, traits, OpenSea, Monadscan, and API links.",
  },
];

const remixAssets = [
  {
    label: "Random Mog",
    href: "/api/v0/mogs/random",
    body: "Best starting point for bots, daily posts, and small experiments.",
  },
  {
    label: "SVG Render",
    href: "/api/v0/mogs/1/render",
    body: "Raw onchain-style SVG render for remixing, stickers, and previews.",
  },
  {
    label: "Trait Schema",
    href: "/api/v0/traits",
    body: "Full trait map for filters, rarity-style explainers, and search tools.",
  },
  {
    label: "Gallery Page",
    href: "/api/v0/mogs?cursor=1&limit=24",
    body: "Paginated metadata for galleries, collection browsers, and datasets.",
  },
];

export default function DevelopersPage() {
  return (
    <main>
      <section className="developer-hero">
        <p className="eyebrow">Public API</p>
        <h1>Mogs API</h1>
        <p className="hero-line">
          Metadata, traits, SVG renders, random Mogs, and remix-friendly endpoints for Monad Mogs builders.
        </p>
        <div className="hero-actions">
          <a className="text-link" href="/api/v0/mogs/1" target="_blank" rel="noreferrer">
            Try metadata
          </a>
          <a className="text-link muted" href="/api/v0/mogs/1/render" target="_blank" rel="noreferrer">
            Try render
          </a>
          <a className="text-link muted" href="/llms.txt" target="_blank" rel="noreferrer">
            llms.txt
          </a>
          <a className="text-link muted" href="/mogs/1">
            Sample Mog
          </a>
          <a className="text-link muted" href="https://github.com/dnebayis/monadmogs" target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a className="text-link muted" href="/">
            Back home
          </a>
        </div>
      </section>

      <section className="developer-section prompt-section">
        <div className="section-heading">
          <p className="eyebrow">For Agents</p>
          <h2>Give this prompt to any agent.</h2>
          <p className="section-copy">
            It points the agent at the project context first, then the public API for frozen metadata, traits, and SVG
            renders.
          </p>
        </div>
        <CopyPrompt text={agentPrompt} />
      </section>

      <section className="developer-section compact">
        <div className="section-heading">
          <p className="eyebrow">Builder Kit v0</p>
          <h2>Build with frozen Mogs data without asking permission.</h2>
          <p className="section-copy">
            The first builder kit is simple: context, metadata, traits, SVG renders, and examples that can plug into
            bots, games, galleries, dashboards, and creative tools.
          </p>
        </div>
        <div className="endpoint-list">
          {builderSteps.map((step) => (
            <article className="endpoint-card" key={step.title}>
              <span>{step.title}</span>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="developer-section compact">
        <div className="section-heading">
          <p className="eyebrow">Remix Assets</p>
          <h2>Use API routes as the source layer for Mogs remixes.</h2>
          <p className="section-copy">
            Monad Mogs is treated as a cc0 character layer. These routes are the first public asset surface for creators:
            use them for tools, art, stickers, bots, games, or experiments, and credit Monad Mogs when you publish.
          </p>
        </div>
        <div className="endpoint-list">
          {remixAssets.map((asset) => (
            <article className="endpoint-card" key={asset.label}>
              <span>{asset.label}</span>
              <a href={asset.href} target="_blank" rel="noreferrer">
                {asset.href}
              </a>
              <p>{asset.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="developer-section">
        <div className="section-heading">
          <p className="eyebrow">Endpoints</p>
          <h2>Read frozen onchain Mogs without wallet connection.</h2>
          <p className="section-copy">
            Responses are generated from <code>tokenURI()</code> and served with immutable cache headers because the
            collection is frozen and ownerless.
          </p>
        </div>
        <div className="endpoint-list">
          {endpoints.map((endpoint) => (
            <article className="endpoint-card" key={endpoint.path}>
              <span>{endpoint.method}</span>
              <code>{endpoint.path}</code>
              <p>{endpoint.note}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="developer-section compact">
        <div className="section-heading">
          <p className="eyebrow">LLM Context</p>
          <h2>Point agents and AI tools at <code>/llms.txt</code>.</h2>
          <p className="section-copy">
            The <code>llms.txt</code> file gives language models a compact map of Monad Mogs, public API routes, token
            links, and IP rules. Use it when building agents, chatbots, gallery generators, remix tools, or docs-aware
            assistants.
          </p>
        </div>
        <div className="endpoint-list">
          <article className="endpoint-card">
            <span>URL</span>
            <code>https://monadmogs.vercel.app/llms.txt</code>
            <p>Fetch this first so an LLM can understand the project surface before calling API endpoints.</p>
          </article>
          <article className="endpoint-card">
            <span>Agent prompt</span>
            <p>“Read the Monad Mogs llms.txt, then use the v0 API to fetch metadata, traits, or renders.”</p>
          </article>
          <article className="endpoint-card">
            <span>Use cases</span>
            <p>Trait explainers, collection bots, random Mog pickers, SVG remix tools, and API-aware support agents.</p>
          </article>
        </div>
      </section>

      <section className="developer-section compact">
        <div className="section-heading">
          <p className="eyebrow">Examples</p>
          <h2>Use the API in small bots, galleries, and remix tools.</h2>
        </div>
        <div className="example-list">
          {examples.map((example) => (
            <article className="example-card" key={example.title}>
              <h3>{example.title}</h3>
              <pre className="code-block">
                <code>{example.code}</code>
              </pre>
            </article>
          ))}
        </div>
      </section>

      <section className="developer-section compact">
        <div className="section-heading">
          <p className="eyebrow">Notes</p>
          <h2>Frozen data, practical limits.</h2>
        </div>
        <div className="endpoint-list">
          <article className="endpoint-card">
            <span>Cache</span>
            <p>Metadata and renders use immutable cache headers because the collection is frozen.</p>
          </article>
          <article className="endpoint-card">
            <span>Pagination</span>
            <p>Use cursor pagination. Keep limit at or below 100 for reliable RPC and Vercel performance.</p>
          </article>
          <article className="endpoint-card">
            <span>Source</span>
            <p>Responses are generated from onchain tokenURI data, not from IPFS or a mutable database.</p>
          </article>
        </div>
      </section>
    </main>
  );
}
