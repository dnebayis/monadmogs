"use client";

import { useState } from "react";
import { CopyPrompt } from "@/components/copy-prompt";

type DocSection = "api" | "kit" | "examples";

const agentPrompt = `read https://monadmogs.xyz/llms.txt first.
then use the monad mogs public api to fetch frozen metadata, traits, svg renders, or random mogs.
if you build with the assets, credit monad mogs and link back to https://monadmogs.xyz/.`;

const mogEndpoints = [
  { method: "GET", path: "/api/v0/mogs?cursor=1&limit=24", note: "Paginated metadata, image data URIs, traits, and links." },
  { method: "GET", path: "/api/v0/mogs/{id}", note: "Single Mog metadata with OpenSea, Monadscan, render, and traits links." },
  { method: "GET", path: "/api/v0/mogs/{id}/traits", note: "Trait-only response for one Mog." },
  { method: "GET", path: "/api/v0/mogs/{id}/render", note: "Raw SVG render served as image/svg+xml." },
  { method: "GET", path: "/api/v0/mogs/random", note: "Random fully onchain Mog metadata." },
  { method: "GET", path: "/api/v0/traits", note: "Full trait schema for the collection." },
  { method: "GET", path: "/api/v0/assets/{id}", note: "Trait asset image by trait id." },
];

const agentEndpoints = [
  { method: "GET", path: "/api/agents/uri?owner={addr}&mogId={id}", note: "ERC-8004 AgentURI JSON document." },
  { method: "GET", path: "/api/agents/lookup?agentId={id}", note: "Onchain agent tokenURI and wallet." },
  { method: "GET", path: "/api/agents/registries", note: "ERC-8004 contract addresses on Monad." },
];

const arenaEndpoints = [
  { method: "GET", path: "/api/arena?view=open", note: "Open games waiting for opponents." },
  { method: "GET", path: "/api/arena?view=leaderboard", note: "Top players by total wins." },
  { method: "GET", path: "/api/arena?view=recent", note: "Recently played games." },
  { method: "GET", path: "/api/arena/games?id={id}", note: "Single game state and result." },
  { method: "POST", path: "/api/arena/games", note: "Create, join, or submit a move." },
];

const utilEndpoints = [
  { method: "GET", path: "/llms.txt", note: "LLM-readable project, API, and IP context." },
  { method: "GET", path: "/api/studio", note: "Approved community projects list." },
  { method: "POST", path: "/api/studio/submit", note: "Submit a project." },
];

const examples = [
  {
    title: "Fetch a random Mog",
    code: `const mog = await fetch("https://monadmogs.xyz/api/v0/mogs/random").then((r) => r.json());
console.log(mog.name, mog.attributes);`,
  },
  {
    title: "Load a gallery page",
    code: `const page = await fetch("https://monadmogs.xyz/api/v0/mogs?cursor=1&limit=24").then((r) => r.json());
console.log(page.items, page.nextCursor);`,
  },
  {
    title: "Render an SVG",
    code: `const svg = await fetch("https://monadmogs.xyz/api/v0/mogs/1/render").then((r) => r.text());
document.body.innerHTML = svg;`,
  },
  {
    title: "Read trait schema",
    code: `const schema = await fetch("https://monadmogs.xyz/api/v0/traits").then((r) => r.json());
console.log(schema.traits.Background);`,
  },
  {
    title: "Generate AgentURI",
    code: `const uri = await fetch("https://monadmogs.xyz/api/agents/uri?owner=0x...&mogId=1&name=MyAgent&caps=trait-reader").then((r) => r.json());
console.log(uri.name, uri.services);`,
  },
];

export function DocsTab() {
  const [section, setSection] = useState<DocSection>("api");

  return (
    <section className="tab-full">
      <div className="section-heading">
        <p className="eyebrow">Docs</p>
        <h2>API, builder kit, and code examples.</h2>
        <p className="section-copy">
          Everything for building with Monad Mogs: endpoints, guides, copyable prompts, and integration patterns.
        </p>
      </div>

      <div className="inner-tabs">
        <button type="button" className={section === "api" ? "active" : ""} onClick={() => setSection("api")}>
          API
        </button>
        <button type="button" className={section === "kit" ? "active" : ""} onClick={() => setSection("kit")}>
          Builder Kit
        </button>
        <button type="button" className={section === "examples" ? "active" : ""} onClick={() => setSection("examples")}>
          Examples
        </button>
      </div>

      {section === "api" && (
        <div className="docs-content">
          <div className="tab-block-header">
            <p className="eyebrow">Mog Endpoints</p>
            <p className="tab-block-copy">Frozen onchain metadata. Immutable cache headers.</p>
          </div>
          <div className="endpoint-list">
            {mogEndpoints.map((ep) => (
              <article className="endpoint-card" key={ep.path}>
                <span>{ep.method}</span>
                <code>{ep.path}</code>
                <p>{ep.note}</p>
              </article>
            ))}
          </div>

          <div className="tab-block-header" style={{ marginTop: 32 }}>
            <p className="eyebrow">Agent Endpoints</p>
            <p className="tab-block-copy">ERC-8004 identity resolution and registry data.</p>
          </div>
          <div className="endpoint-list">
            {agentEndpoints.map((ep) => (
              <article className="endpoint-card" key={ep.path}>
                <span>{ep.method}</span>
                <code>{ep.path}</code>
                <p>{ep.note}</p>
              </article>
            ))}
          </div>

          <div className="tab-block-header" style={{ marginTop: 32 }}>
            <p className="eyebrow">Arena Endpoints</p>
            <p className="tab-block-copy">Game creation, matchmaking, and leaderboard.</p>
          </div>
          <div className="endpoint-list">
            {arenaEndpoints.map((ep) => (
              <article className="endpoint-card" key={ep.path}>
                <span>{ep.method}</span>
                <code>{ep.path}</code>
                <p>{ep.note}</p>
              </article>
            ))}
          </div>

          <div className="tab-block-header" style={{ marginTop: 32 }}>
            <p className="eyebrow">Utility</p>
          </div>
          <div className="endpoint-list">
            {utilEndpoints.map((ep) => (
              <article className="endpoint-card" key={ep.path}>
                <span>{ep.method}</span>
                <code>{ep.path}</code>
                <p>{ep.note}</p>
              </article>
            ))}
          </div>

          <div className="endpoint-list" style={{ marginTop: 32 }}>
            <article className="endpoint-card">
              <span>Cache</span>
              <p>Metadata and renders use immutable cache headers because the collection is frozen.</p>
            </article>
            <article className="endpoint-card">
              <span>Pagination</span>
              <p>Use cursor pagination. Keep limit at or below 100 for reliable performance.</p>
            </article>
            <article className="endpoint-card">
              <span>Source</span>
              <p>All responses are generated from onchain tokenURI data, not from IPFS or a mutable database.</p>
            </article>
          </div>

          <div className="hero-actions">
            <a className="text-link" href="/api/v0/mogs/random" target="_blank" rel="noreferrer">
              Try Random Mog
            </a>
            <a className="text-link muted" href="/api/agents/registries" target="_blank" rel="noreferrer">
              Try Registries
            </a>
            <a className="text-link muted" href="/llms.txt" target="_blank" rel="noreferrer">
              llms.txt
            </a>
          </div>
        </div>
      )}

      {section === "kit" && (
        <div className="docs-content">
          <div className="tab-block-header">
            <p className="eyebrow">Agent Prompt</p>
            <p className="tab-block-copy">Copy this into any LLM or agent tool to give it full project context.</p>
          </div>
          <CopyPrompt text={agentPrompt} />

          <div className="tab-block-header" style={{ marginTop: 32 }}>
            <p className="eyebrow">Getting Started</p>
            <p className="tab-block-copy">Four steps from zero to a working Mogs integration.</p>
          </div>
          <div className="endpoint-list">
            <article className="endpoint-card">
              <span>1 / Context</span>
              <p>
                Start with <code>/llms.txt</code> or the agent prompt so tools understand the project, API, and IP rules.
              </p>
            </article>
            <article className="endpoint-card">
              <span>2 / Fetch</span>
              <p>
                Use <code>/api/v0/mogs/random</code> or <code>/api/v0/mogs/&#123;id&#125;</code> for frozen metadata, traits, and images.
              </p>
            </article>
            <article className="endpoint-card">
              <span>3 / Render</span>
              <p>
                Use <code>/api/v0/mogs/&#123;id&#125;/render</code> for SVG source for stickers, bots, games, and dashboards.
              </p>
            </article>
            <article className="endpoint-card">
              <span>4 / Remix</span>
              <p>
                Use any asset from the public API. Credit Monad Mogs and link back to monadmogs.xyz.
              </p>
            </article>
          </div>

          <div className="tab-block-header" style={{ marginTop: 32 }}>
            <p className="eyebrow">Remix Assets</p>
            <p className="tab-block-copy">Source routes for community tools, art, and experiments.</p>
          </div>
          <div className="endpoint-list">
            <article className="endpoint-card">
              <span>Random Mog</span>
              <code>/api/v0/mogs/random</code>
              <p>Best starting point for bots, daily posts, and small experiments.</p>
            </article>
            <article className="endpoint-card">
              <span>SVG Render</span>
              <code>/api/v0/mogs/&#123;id&#125;/render</code>
              <p>Raw onchain SVG for remixing, stickers, and previews.</p>
            </article>
            <article className="endpoint-card">
              <span>Trait Schema</span>
              <code>/api/v0/traits</code>
              <p>Full trait map for filters, rarity explainers, and search tools.</p>
            </article>
            <article className="endpoint-card">
              <span>Gallery</span>
              <code>/api/v0/mogs?cursor=1&limit=24</code>
              <p>Paginated metadata for galleries, browsers, and datasets.</p>
            </article>
          </div>

          <div className="hero-actions">
            <a className="text-link" href="/mogs/1">
              Sample Mog Page
            </a>
            <a className="text-link muted" href="/api/v0/mogs/1/render" target="_blank" rel="noreferrer">
              Sample SVG
            </a>
            <a className="text-link muted" href="https://github.com/dnebayis/monadmogs" target="_blank" rel="noreferrer">
              GitHub
            </a>
          </div>
        </div>
      )}

      {section === "examples" && (
        <div className="docs-content">
          <div className="tab-block-header">
            <p className="eyebrow">Code Examples</p>
            <p className="tab-block-copy">Copy-paste patterns for common use cases.</p>
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

          <div className="hero-actions">
            <a className="text-link" href="/llms.txt" target="_blank" rel="noreferrer">
              llms.txt
            </a>
            <a className="text-link muted" href="https://github.com/dnebayis/monadmogs" target="_blank" rel="noreferrer">
              GitHub
            </a>
          </div>
        </div>
      )}
    </section>
  );
}
