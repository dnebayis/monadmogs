"use client";

import { useEffect, useMemo, useState } from "react";
import { CollectionGallery } from "@/components/collection-gallery";
import { ConnectWalletButton } from "@/components/connect-wallet-button";
import { StudioShowcase } from "@/components/studio-showcase";
import { AgentsTab } from "@/components/tabs/agents-tab";
import { ArenaTab } from "@/components/tabs/arena-tab";
import { DocsTab } from "@/components/tabs/docs-tab";
import { IpTab } from "@/components/tabs/ip-tab";
import { OverviewTab } from "@/components/tabs/overview-tab";
import { StatusTab } from "@/components/tabs/status-tab";
import { StoryTab } from "@/components/tabs/story-tab";
import { TokenTab } from "@/components/tabs/token-tab";

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "collection", label: "Collection" },
  { id: "studio", label: "Studio" },
  { id: "final", label: "Final State" },
  { id: "token", label: "$MOGS" },
  { id: "ip", label: "IP Rules" },
  { id: "agents", label: "Agents" },
  { id: "arena", label: "Arena" },
  { id: "story", label: "Story" },
  { id: "docs", label: "Docs" },
] as const;

type TabId = (typeof tabs)[number]["id"];

function isTabId(value: string): value is TabId {
  return tabs.some((tab) => tab.id === value);
}

const TAB_COMPONENTS: Record<TabId, React.ComponentType> = {
  overview: OverviewTab,
  collection: () => <CollectionGallery compact />,
  studio: StudioShowcase,
  final: StatusTab,
  token: TokenTab,
  ip: IpTab,
  agents: AgentsTab,
  arena: ArenaTab,
  story: StoryTab,
  docs: DocsTab,
};

export function HomeTabs() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    function syncHash() {
      const hash = window.location.hash.replace("#", "");
      if (isTabId(hash)) {
        setActiveTab(hash);
        setMobileOpen(false);
      }
    }

    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  const activeLabel = useMemo(() => tabs.find((tab) => tab.id === activeTab)?.label || "Overview", [activeTab]);

  function selectTab(tab: TabId) {
    setActiveTab(tab);
    setMobileOpen(false);
    window.history.replaceState(null, "", `#${tab}`);
  }

  const ActiveComponent = TAB_COMPONENTS[activeTab];

  return (
    <section className="tabs-shell" aria-label="Monad Mogs sections">
      <nav className="tabs-nav">
        <a className="site-logo" href="#overview" onClick={() => selectTab("overview")} aria-label="Monad Mogs home">
          <img src="/logo.svg" alt="Monad Mogs" width={36} height={36} />
        </a>

        <button
          className="nav-mobile-toggle"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle navigation"
          aria-expanded={mobileOpen}
        >
          <span>{activeLabel}</span>
          <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
            <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <div className={`tabs-bar ${mobileOpen ? "open" : ""}`} role="tablist" aria-label="Sections">
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

        <ConnectWalletButton />
      </nav>

      <div className="tab-panel" role="tabpanel" aria-label={activeLabel}>
        <ActiveComponent />
      </div>
    </section>
  );
}
