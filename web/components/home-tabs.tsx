"use client";

import { useEffect, useMemo, useState } from "react";
import { CollectionGallery } from "@/components/collection-gallery";
import { MintPanel } from "@/components/mint-panel";

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "collection", label: "Collection" },
  { id: "status", label: "Status" },
  { id: "story", label: "Story" },
  { id: "api", label: "API" },
] as const;

type TabId = (typeof tabs)[number]["id"];

function isTabId(value: string): value is TabId {
  return tabs.some((tab) => tab.id === value);
}

export function HomeTabs() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (isTabId(hash)) setActiveTab(hash);
  }, []);

  const activeLabel = useMemo(() => tabs.find((tab) => tab.id === activeTab)?.label || "Overview", [activeTab]);

  function selectTab(tab: TabId) {
    setActiveTab(tab);
    window.history.replaceState(null, "", `#${tab}`);
  }

  return (
    <section className="tabs-shell" aria-label="Monad Mogs sections">
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

      <div className="tab-panel" role="tabpanel" aria-label={activeLabel}>
        {activeTab === "overview" ? (
          <OverviewTab />
        ) : activeTab === "collection" ? (
          <CollectionGallery compact />
        ) : activeTab === "status" ? (
          <StatusTab />
        ) : activeTab === "story" ? (
          <StoryTab />
        ) : (
          <ApiTab />
        )}
      </div>
    </section>
  );
}

function OverviewTab() {
  return (
    <section className="overview-grid">
      <div className="section-heading">
        <p className="eyebrow">Overview</p>
        <h2>5,000 fully onchain pixel hamsters, locked on Monad.</h2>
        <p className="section-copy">
          Monad Mogs are deterministic SVG NFTs rendered directly from the contract. The collection is sold out,
          metadata is frozen, and ownership has been renounced.
        </p>
      </div>
      <div className="overview-stats">
        <span>5,000 supply</span>
        <span>0 MON mint</span>
        <span>onchain SVG</span>
        <span>ownerless</span>
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

function StoryTab() {
  return (
    <section className="story-section tabbed">
      <div className="section-heading">
        <p className="eyebrow">Story</p>
        <h2>A small hamster relic from Monad culture.</h2>
      </div>
      <div className="story-copy">
        <p>
          Monad Mogs began as a free onchain experiment: no IPFS, no LP, no mint price, just 5,000 deterministic pixel
          hamsters written for Monad mainnet.
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
