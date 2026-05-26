"use client";

import { useEffect, useMemo, useState } from "react";
import { CollectionGallery } from "@/components/collection-gallery";
import { MintPanel } from "@/components/mint-panel";

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "collection", label: "Collection" },
  { id: "final", label: "Final State" },
  { id: "token", label: "$MOGS" },
  { id: "ip", label: "IP Rules" },
  { id: "story", label: "Story" },
  { id: "api", label: "API" },
  { id: "docs", label: "Docs" },
] as const;

const TOKEN_ADDRESS = "0x9cF1538f92341A311a922D411DE8C471DCEA7777";
const TOKEN_URL = `https://nad.fun/tokens/${TOKEN_ADDRESS}`;
const RESERVE_TXS = [
  "0xac84218e1b6b675f01455258c5363d8151fa9203c756a7b5f4a6d364f76ad001",
  "0x50f8a58a24ddef84e65fc86558af255ec77d737ebc94c5b522eb1a08a94bca24",
  "0xd6650a9fde3920e876f4ebd3839e29ebeca2f13014f4e0c1364da0774d878a1c",
  "0x437cac45bca9128150b7f9944fa4f85f1af32443e8f249db0d290d29f422c433",
  "0x8a59cd5575ee1c8468bb1bebb4731d588067453480dc3b85c41c48888cdc7c0a",
  "0x9ed683682f96d0a3b8efbbf843db52c97e7cb91c2b14beea027968aa90a04bfa",
];

type TabId = (typeof tabs)[number]["id"];

function isTabId(value: string): value is TabId {
  return tabs.some((tab) => tab.id === value);
}

export function HomeTabs() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  useEffect(() => {
    function syncHash() {
      const hash = window.location.hash.replace("#", "");
      if (isTabId(hash)) setActiveTab(hash);
    }

    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  const activeLabel = useMemo(() => tabs.find((tab) => tab.id === activeTab)?.label || "Overview", [activeTab]);

  function selectTab(tab: TabId) {
    setActiveTab(tab);
    window.history.replaceState(null, "", `#${tab}`);
  }

  return (
    <section className="tabs-shell" aria-label="Monad Mogs sections">
      <div className="tabs-nav">
        <a className="site-logo" href="#overview" onClick={() => selectTab("overview")} aria-label="Monad Mogs home">
          Monad Mogs
        </a>
        <div className="tabs-bar" role="tablist" aria-label="Sections">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={tab.id === activeTab}
              className={tab.id === activeTab ? "active" : ""}
              onClick={() => selectTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="tab-panel" role="tabpanel" aria-label={activeLabel}>
        {activeTab === "overview" ? (
          <OverviewTab />
        ) : activeTab === "collection" ? (
          <CollectionGallery compact />
        ) : activeTab === "final" ? (
          <StatusTab />
        ) : activeTab === "token" ? (
          <TokenTab />
        ) : activeTab === "ip" ? (
          <IpTab />
        ) : activeTab === "story" ? (
          <StoryTab />
        ) : activeTab === "api" ? (
          <ApiTab />
        ) : (
          <DocsTab />
        )}
      </div>
    </section>
  );
}

function OverviewTab() {
  return (
    <section className="overview-hero">
      <div className="hero-copy">
        <p className="eyebrow">Monad Mainnet / Sold Out</p>
        <h1>Monad Mogs</h1>
        <p className="hero-line">5,000 fully onchain pixel hamsters, permanently minted on Monad and locked forever.</p>
        <div className="hero-actions">
          <a href="https://opensea.io/collection/monad-mogs" className="text-link" target="_blank" rel="noreferrer">
            View on OpenSea
          </a>
          <a href="https://x.com/monadmogs" className="text-link muted" target="_blank" rel="noreferrer">
            Follow X
          </a>
          <a href={TOKEN_URL} className="text-link muted" target="_blank" rel="noreferrer">
            $MOGS
          </a>
        </div>
      </div>
      <div className="mog-stage" aria-label="Pixel hamster mascot preview">
        <PixelMog />
        <div className="stage-caption">
          <span>5,000 supply</span>
          <span>onchain svg</span>
          <span>ownerless</span>
          <span>$MOGS live</span>
        </div>
      </div>
    </section>
  );
}

function StatusTab() {
  return (
    <section className="mint-section tabbed">
      <div className="section-heading">
        <p className="eyebrow">Final State</p>
        <h2>Mint closed, metadata frozen, ownership renounced.</h2>
        <p className="section-copy">
          The final supply is 5,000 / 5,000. Artwork and JSON metadata remain available through <code>tokenURI()</code>.
        </p>
      </div>
      <MintPanel />
    </section>
  );
}

function TokenTab() {
  return (
    <section className="api-summary">
      <div className="section-heading">
        <p className="eyebrow">$MOGS</p>
        <h2>An ecosystem layer around a sold-out cc0 onchain collection.</h2>
        <p className="section-copy">
          Monad Mogs should not just sit in wallets. $MOGS exists to fund tools, campaigns, liquidity, burns, and the
          Mogs Reserve without replacing or migrating the NFT collection.
        </p>
      </div>
      <div className="info-grid">
        <div className="token-card">
          <span>Token address</span>
          <code>{TOKEN_ADDRESS}</code>
          <div className="hero-actions">
            <a className="text-link" href={TOKEN_URL} target="_blank" rel="noreferrer">
              Open on nad.fun
            </a>
          </div>
        </div>
        <article className="endpoint-card">
          <span>Fee strategy</span>
          <p>60% creator, 25% LP support, 15% buyback and burn.</p>
        </article>
        <article className="endpoint-card">
          <span>Creator work</span>
          <p>Public API, open IP tools, campaigns, operations, and reserve growth.</p>
        </article>
        <article className="endpoint-card">
          <span>Reserve</span>
          <p>300 Monad Mogs collected so far and held as an ecosystem reserve, not for flipping.</p>
        </article>
        <article className="endpoint-card">
          <span>Flywheel</span>
          <p>Fees fund tools, liquidity, burns, and reserve. API drives builders, memes, and distribution.</p>
        </article>
        <article className="endpoint-card">
          <span>Boundary</span>
          <p>No price promises, no forced migration, and no replacement of Monad Mogs.</p>
        </article>
      </div>
      <div className="reserve-links">
        <span>Reserve txs</span>
        <div>
          {RESERVE_TXS.map((tx, index) => (
            <a key={tx} href={`https://monadscan.com/tx/${tx}`} target="_blank" rel="noreferrer">
              tx {index + 1}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function IpTab() {
  return (
    <section className="api-summary">
      <div className="section-heading">
        <p className="eyebrow">IP Rules</p>
        <h2>Build with the Mogs, keep the source clear.</h2>
        <p className="section-copy">
          Monad Mogs is a remix-friendly onchain character IP. These working rules are meant to make community art,
          memes, bots, stickers, and small products easier to ship while protecting the collection identity.
        </p>
      </div>
      <div className="endpoint-list">
        <article className="endpoint-card">
          <span>CC0</span>
          <p>
            Monad Mogs is treated as a cc0 character layer: remix it, build with it, and spread it without asking
            permission.
          </p>
        </article>
        <article className="endpoint-card">
          <span>Allowed</span>
          <p>Memes, fan art, stickers, banners, bots, dashboards, API experiments, and non-misleading community tools.</p>
        </article>
        <article className="endpoint-card">
          <span>Credit</span>
          <p>Use “Monad Mogs” or link back to monadmogs.vercel.app when publishing derivative work.</p>
        </article>
        <article className="endpoint-card">
          <span>Not allowed</span>
          <p>Implying official partnership, changing NFT metadata, impersonating the project, or using Mogs for scams.</p>
        </article>
        <article className="endpoint-card">
          <span>Commercial</span>
          <p>Small creator experiments are welcome. Larger commercial use should ask first so attribution stays clean.</p>
        </article>
        <article className="endpoint-card">
          <span>Remix assets</span>
          <p>Use SVG renders, metadata, traits, and random Mogs from the public API as source material.</p>
        </article>
        <article className="endpoint-card">
          <span>Attribution</span>
          <p>Credit Monad Mogs and link back to monadmogs.vercel.app when publishing remixes or tools.</p>
        </article>
      </div>
      <div className="hero-actions">
        <a className="text-link" href="/api/v0/mogs/1/render" target="_blank" rel="noreferrer">
          Open SVG render
        </a>
        <a className="text-link muted" href="/api/v0/mogs/random" target="_blank" rel="noreferrer">
          Random Mog
        </a>
        <a className="text-link muted" href="/developers">
          Builder Kit
        </a>
      </div>
    </section>
  );
}
function StoryTab() {
  return (
    <section className="story-section tabbed">
      <div className="section-heading">
        <p className="eyebrow">Story</p>
        <h2>A small hamster relic from Monad culture.</h2>
      </div>
      <div className="story-copy">
        <p>
          Monad Mogs began as an onchain pixel experiment: 5,000 deterministic hamsters written for Monad mainnet.
        </p>
        <p>
          Each Mog is assembled from a stored mint seed and rendered as SVG by the contract itself. The collection is now
          sold out, frozen, and ownerless.
        </p>
        <div className="story-links">
          <a href="https://x.com/monadmogs" target="_blank" rel="noreferrer">
            X
          </a>
          <a href="https://opensea.io/collection/monad-mogs" target="_blank" rel="noreferrer">
            OpenSea
          </a>
          <a href={TOKEN_URL} target="_blank" rel="noreferrer">
            $MOGS
          </a>
        </div>
      </div>
    </section>
  );
}

function ApiTab() {
  return (
    <section className="api-summary">
      <div className="section-heading">
        <p className="eyebrow">Public API</p>
        <h2>Metadata, traits, renders, random Mogs, and remix-friendly assets.</h2>
        <p className="section-copy">
          The API exposes frozen onchain data through versioned routes such as <code>/api/v0/mogs/1</code>,{" "}
          <code>/api/v0/mogs/1/render</code>, and <code>/api/v0/traits</code>.
        </p>
      </div>
      <div className="hero-actions">
        <a className="text-link" href="/developers">
          Open API docs
        </a>
        <a className="text-link muted" href="/api/v0/mogs/random" target="_blank" rel="noreferrer">
          Random Mog
        </a>
      </div>
    </section>
  );
}

function DocsTab() {
  return (
    <section className="api-summary">
      <div className="section-heading">
        <p className="eyebrow">Builder Kit v0</p>
        <h2>Start with docs, agent context, API examples, and remix assets.</h2>
        <p className="section-copy">
          The first builder kit is public: metadata, traits, SVG renders, random Mogs, copyable agent context, and
          remix-friendly source routes.
        </p>
      </div>
      <div className="endpoint-list">
        <article className="endpoint-card">
          <span>1 / Docs</span>
          <p>Human-readable API examples and shareable Mog pages for bots, galleries, trait tools, and remix projects.</p>
        </article>
        <article className="endpoint-card">
          <span>2 / LLM</span>
          <p>A copyable agent prompt plus <code>/llms.txt</code> for AI builders and docs-aware assistants.</p>
        </article>
        <article className="endpoint-card">
          <span>3 / Assets</span>
          <p>SVG renders and trait data that can feed stickers, banners, games, dashboards, and community tools.</p>
        </article>
      </div>
      <div className="hero-actions">
        <a className="text-link" href="/developers">
          Open Builder Kit
        </a>
        <a className="text-link muted" href="/mogs/1">
          Sample Mog Page
        </a>
        <a className="text-link muted" href="/llms.txt" target="_blank" rel="noreferrer">
          Open llms.txt
        </a>
        <a className="text-link muted" href="https://github.com/dnebayis/monadmogs" target="_blank" rel="noreferrer">
          GitHub
        </a>
        <a className="text-link muted" href="/api/v0/mogs/1/render" target="_blank" rel="noreferrer">
          Sample SVG
        </a>
      </div>
    </section>
  );
}

function PixelMog() {
  const pixels = [
    "ear left-ear",
    "ear right-ear",
    "inner left-inner",
    "inner right-inner",
    "fur head",
    "fur cheek-left",
    "fur cheek-right",
    "face faceplate",
    "shade face-shade",
    "eye eye-left",
    "eye eye-right",
    "shine shine-left",
    "shine shine-right",
    "nose",
    "mouth",
    "fur body",
    "paw paw-left",
    "paw paw-right",
    "foot foot-left",
    "foot foot-right",
  ];

  return (
    <div className="pixel-mog">
      {pixels.map((pixel) => (
        <span key={pixel} className={pixel} />
      ))}
    </div>
  );
}
