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
        <h2>A culture token for the Monad Mogs character universe.</h2>
        <p className="section-copy">
          $MOGS is positioned as a community and culture layer around the IP, API, remix assets, builder experiments,
          and future Mogs-native campaigns. The NFT collection remains sold out, frozen, and ownerless.
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
          <span>Purpose</span>
          <p>Culture signal, community rewards, art bounties, API remix incentives, and Mogs-native experiments.</p>
        </article>
        <article className="endpoint-card">
          <span>Boundary</span>
          <p>No ownership changes, no NFT metadata changes, and no promises around financial return.</p>
        </article>
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
      </div>
      <div className="hero-actions">
        <a className="text-link" href="/api/v0/mogs/1/render" target="_blank" rel="noreferrer">
          Open SVG render
        </a>
        <a className="text-link muted" href="/developers">
          API docs
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
        <p className="eyebrow">Docs</p>
        <h2>Public docs and LLM-readable context for builders.</h2>
        <p className="section-copy">
          Use the developers page for human-readable examples, or <code>/llms.txt</code> when giving context to agents
          and AI tools.
        </p>
      </div>
      <div className="hero-actions">
        <a className="text-link" href="/developers">
          Open developers
        </a>
        <a className="text-link muted" href="/llms.txt" target="_blank" rel="noreferrer">
          Open llms.txt
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
