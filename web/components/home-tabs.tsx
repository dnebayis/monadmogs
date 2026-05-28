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

  const ActiveComponent = TAB_COMPONENTS[activeTab];

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
        <ConnectWalletButton />
      </div>

      <div className="tab-panel" role="tabpanel" aria-label={activeLabel}>
        <ActiveComponent />
      </div>
    </section>
  );
}
