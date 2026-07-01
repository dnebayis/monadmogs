"use client";

import { useState } from "react";
import { CopyPrompt } from "@/components/copy-prompt";
import { API_BASE_URL } from "@/lib/urls";

const CANONICAL_API_BASE_URL = "https://api.monadmogs.xyz";

function getBuilderPrompt() {
  return `Read ${CANONICAL_API_BASE_URL}/llms.txt, then use Monad Mogs APIs for collection metadata, awakened agent bindings, RESTAP runtime endpoints, and OpenSea-compatible tool manifests.`;
}

type DocSection = "overview" | "agents" | "tools" | "api";

const API_SECTIONS = [
  {
    title: "Collection",
    endpoints: [
      ["/api/v0/mogs?cursor=1&limit=24", "Paginated Mog metadata with traits, links, images, and rarity."],
      ["/api/v0/mogs?awake=true", "Awakened Mog metadata feed."],
      ["/api/v0/mogs/{id}", "Single Mog metadata, image data URI, traits, links, and rarity summary."],
      ["/api/v0/mogs/{id}/rarity", "Exact rank, tier, score, percentile, and per-trait frequency data."],
      ["/api/v0/mogs/{id}/render", "Raw SVG render served as image/svg+xml."],
      ["/api/v0/traits", "Full collection trait schema."],
      ["/api/v0/rarity", "Rarity methodology and collection-wide trait frequencies."],
    ],
  },
  {
    title: "Awakened Agents",
    endpoints: [
      ["/api/agents/count", "Awakened Mog agent count from KV with onchain adapter fallback."],
      ["/api/agents/list", "Awakened agent list from KV with onchain adapter fallback."],
      ["/api/agents/search", "Search awakened agents by token, agent, wallet, rarity, or name."],
      ["/api/agents/binding/{mogId}", "Normies-style binding lookup for a Mog token ID."],
      ["/api/agents/binding/batch", "POST batch binding lookup for Mog token IDs."],
      ["/api/agents/info/{mogId}", "Persona, binding, rarity, and public agent links."],
      ["/api/agents/metadata/{mogId}", "ERC-8004 AgentURI tokenURI document."],
      ["/api/agents/identity/{mogId}", "Mog identity plus awakened agent status."],
      ["/api/agents/persona-preview/{mogId}", "Deterministic persona preview without requiring awakening."],
      ["/api/agents/image/{mogId}", "Agent image redirect to the Mog SVG render."],
      ["/api/agents/agent-card/{mogId}", "A2A-compatible agent card."],
      ["/api/agent-runtime/{mogId}/.well-known/restap.json", "RESTAP v1 runtime discovery."],
      ["/api/agent-runtime/{mogId}/talk", "Persona-driven text response."],
      ["/api/agent-runtime/{mogId}/news", "RESTAP v1 public news envelope."],
    ],
  },
  {
    title: "Legacy Compatibility",
    endpoints: [
      ["/api/agents/binding?agentId={id}", "Adapter-first, legacy fallback ERC-8217 lookup by agent ID."],
      ["/api/agents/by-agent-id/{agentId}", "Resolve a bound Mog from an ERC-8004 agent ID."],
      ["/api/agents/by-agent-id/{agentId}/info", "Persona-rich agent info by ERC-8004 agent ID."],
      ["/api/agents/by-mog?mogId={id}", "Adapter-first, legacy fallback reverse lookup by Mog ID."],
      ["/api/agents/lookup?agentId={id}", "Read onchain ERC-8004 agent data."],
      ["/api/agents/profile?agentId={id}", "Agent data plus resolved AgentURI profile."],
      ["/api/agents/registries", "ERC-8004 registry and Monad Mogs adapter addresses."],
    ],
  },
  {
    title: "OpenSea ToolRegistry",
    endpoints: [
      ["/.well-known/ai-tool/mog-agent-lookup.json", "OpenSea tool manifest for agent binding lookup."],
      ["/.well-known/ai-tool/mog-persona.json", "OpenSea tool manifest for deterministic persona reads."],
      ["/.well-known/ai-tool/mog-rarity.json", "OpenSea tool manifest for rarity reads."],
      ["/api/tools/mog-agent-lookup", "POST read-only tool endpoint."],
      ["/api/tools/mog-persona", "POST read-only tool endpoint."],
      ["/api/tools/mog-rarity", "POST read-only tool endpoint."],
    ],
  },
];

export function DocsTab() {
  const [section, setSection] = useState<DocSection>("overview");

  return (
    <section className="tab-full docs-longform">
      <div className="section-heading">
        <p className="eyebrow">Docs</p>
        <h2>Agent Registry first.</h2>
        <p className="section-copy">
          Current docs focus on ERC-8004 identity, ERC-8217 Mog binding, RESTAP metadata, and OpenSea ToolRegistry. Arena remains legacy and is no longer the primary public flow.
        </p>
      </div>

      <nav className="docs-nav">
        {([
          ["overview", "Overview"],
          ["agents", "Agents"],
          ["tools", "Tools"],
          ["api", "API Reference"],
        ] as [DocSection, string][]).map(([key, label]) => (
          <button key={key} className={`docs-nav-btn ${section === key ? "active" : ""}`} onClick={() => setSection(key)}>
            {label}
          </button>
        ))}
      </nav>

      {section === "overview" && <OverviewSection />}
      {section === "agents" && <AgentsSection />}
      {section === "tools" && <ToolsSection />}
      {section === "api" && <ApiReferenceSection />}
    </section>
  );
}

function OverviewSection() {
  return (
    <article className="docs-article">
      <div className="docs-prompts">
        <CopyPrompt text={getBuilderPrompt()} label="Builder prompt" />
      </div>

      <h3>What changed</h3>
      <p>
        A Mog now controls an ERC-8004 agent through an Adapter8004-style contract. The adapter owns the ERC-8004 agent NFT, while the current Mog owner is treated as the controller. When the Mog transfers, control moves with the NFT.
      </p>

      <h3>What is out of v1</h3>
      <p>
        ERC-8048 is not implemented in v1 because the Monad Mogs NFT contract is frozen. Agent metadata is published through ERC-8004 AgentURI, RESTAP discovery, A2A agent cards, and public API endpoints.
      </p>

      <h3>Compatibility</h3>
      <p>
        The old MogsAgentBindings contract remains readable as legacy fallback, but new registrations should use the adapter only. Arena endpoints remain online for existing integrations and are hidden from the main product navigation.
      </p>
    </article>
  );
}

function AgentsSection() {
  return (
    <article className="docs-article">
      <h3>Awakening flow</h3>
      <div className="docs-flow-steps">
        {[
          ["Choose Mog", "Connect the current owner wallet and choose a Mog token ID."],
          ["Preview persona", "Persona is generated from Mog traits, rarity, and deterministic templates."],
          ["Register", "Call registerMogAgent(mogId, agentURI) on the adapter."],
          ["Verify", "Read /api/agents/binding/{mogId} and /api/agents/metadata/{mogId} after confirmation."],
          ["OpenSea", "OpenSea can surface Onchain agent binding from ERC-8004 metadata key agent-binding."],
        ].map(([title, body], index) => (
          <div className="docs-flow-step" key={title}>
            <span className="docs-flow-num">{index + 1}</span>
            <div>
              <strong>{title}</strong>
              <p>{body}</p>
            </div>
          </div>
        ))}
      </div>

      <h3>Adapter rules</h3>
      <ul>
        <li>Only the current Mog owner can awaken that Mog.</li>
        <li>Binding is immutable: no unbind or rebind in v1.</li>
        <li>The adapter writes <code>agent-binding</code> as exact 20-byte adapter address metadata.</li>
        <li>The current Mog owner can update AgentURI and non-reserved metadata.</li>
        <li><code>agent-binding</code> cannot be overwritten by controllers.</li>
      </ul>
    </article>
  );
}

function ToolsSection() {
  return (
    <article className="docs-article">
      <h3>ERC-8257 ToolRegistry v1</h3>
      <p>
        First tools are open-access and read-only. They are designed for discovery and safe agent context, not gated execution or payment.
      </p>
      <p>
        Registered on Base ToolRegistry <code>0x265BB2DBFC0A8165C9A1941Eb1372F349baD2cf1</code> as tool IDs <code>183</code>, <code>184</code>, and <code>185</code>.
      </p>

      <div className="endpoint-list">
        <article className="endpoint-card">
          <span>Agent Lookup</span>
          <code>POST /api/tools/mog-agent-lookup</code>
        </article>
        <article className="endpoint-card">
          <span>Persona</span>
          <code>POST /api/tools/mog-persona</code>
        </article>
        <article className="endpoint-card">
          <span>Rarity</span>
          <code>POST /api/tools/mog-rarity</code>
        </article>
      </div>

      <h3>Manifest requirements</h3>
      <p>
        Manifests are served from the same origin under <code>/.well-known/ai-tool/*.json</code> and include <code>type</code>, <code>name</code>, <code>description</code>, <code>endpoint</code>, <code>inputs</code>, <code>outputs</code>, <code>creatorAddress</code>, images, and tags.
      </p>
    </article>
  );
}

function ApiReferenceSection() {
  return (
    <article className="docs-article">
      {API_SECTIONS.map((group) => (
        <div key={group.title} className="docs-api-group">
          <h3>{group.title}</h3>
          <div className="docs-endpoint-list">
            {group.endpoints.map(([path, description]) => (
              <div key={path} className="docs-endpoint-row">
                <code>{path}</code>
                <span>{description}</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="hero-actions">
        <a className="text-link" href={`${API_BASE_URL}/llms.txt`} target="_blank" rel="noreferrer">
          llms.txt
        </a>
        <a className="text-link muted" href={`${API_BASE_URL}/api/agents/registries`} target="_blank" rel="noreferrer">
          Registries API
        </a>
        <a className="text-link muted" href="https://eips.ethereum.org/EIPS/eip-8004" target="_blank" rel="noreferrer">
          ERC-8004
        </a>
        <a className="text-link muted" href="https://eips.ethereum.org/EIPS/eip-8257" target="_blank" rel="noreferrer">
          ERC-8257
        </a>
      </div>
    </article>
  );
}
