"use client";

import { useEffect, useMemo, useState } from "react";
import { MONAD_MOGS_ADDRESS } from "@/lib/contract";
import { API_BASE_URL } from "@/lib/urls";

const PAGE_SIZE = 24;

type AgentRecord = {
  agentId: string | number;
  tokenId: string;
  mogId?: number;
  name?: string;
  registeredBy?: string;
  controller?: string | null;
  source?: "adapter" | "legacy";
  rarity?: {
    rank: number;
    tier: string;
    percentile?: number;
  } | null;
  links?: {
    binding?: string;
    info?: string;
    metadata?: string;
  };
};

type AgentSearchResponse = {
  count: number;
  offset: number;
  limit: number;
  agents: AgentRecord[];
  hasMore: boolean;
};

type AgentCountResponse = {
  count: number;
};

type AgentInfo = {
  name: string;
  tagline: string;
  greeting?: string;
  backstory: string;
  communicationStyle: string;
  personalityTraits?: string[];
  quirks?: string[];
  image: string;
  agent: {
    agentId: number;
    agentURI: string;
    controller?: string | null;
    owner?: string | null;
    agentWallet?: string | null;
  };
  binding: {
    tokenId: string;
    agentId: number;
    contract: string;
    source: string;
  };
  rarity?: {
    rank: number;
    tier: string;
  } | null;
  links?: {
    metadata?: string;
    runtime?: string;
    agentCard?: string;
  };
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function shortAddress(value?: string | null) {
  if (!value) return "Not resolved";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function tokenIdOf(agent: AgentRecord) {
  return agent.mogId || Number(agent.tokenId);
}

function tierLabel(agent: AgentRecord) {
  if (!agent.rarity) return "Rarity pending";
  return `${agent.rarity.tier} #${formatNumber(agent.rarity.rank)}`;
}

function buildSearchUrl(query: string, offset: number) {
  const params = new URLSearchParams({
    awake: "true",
    limit: String(PAGE_SIZE),
    offset: String(offset),
  });
  if (query.trim()) params.set("q", query.trim());
  return `/api/agent-directory/search?${params.toString()}`;
}

export function AgentDirectory({ embedded = false }: { embedded?: boolean }) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [totalAwakened, setTotalAwakened] = useState<number | null>(null);
  const [filteredCount, setFilteredCount] = useState(0);
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [selectedMogId, setSelectedMogId] = useState<number | null>(null);
  const [selectedInfo, setSelectedInfo] = useState<AgentInfo | null>(null);
  const [selectedError, setSelectedError] = useState("");
  const [isInfoLoading, setIsInfoLoading] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    if (!selectedMogId) return undefined;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeAgentInfo();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedMogId]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadInitial() {
      setIsLoading(true);
      setError("");

      try {
        const [countResponse, searchResponse] = await Promise.all([
          fetch("/api/agent-directory/count", { signal: controller.signal }),
          fetch(buildSearchUrl(debouncedQuery, 0), { signal: controller.signal }),
        ]);

        if (!countResponse.ok) throw new Error("Awakened count could not be loaded.");
        if (!searchResponse.ok) throw new Error("Agent directory could not be loaded.");

        const countJson = (await countResponse.json()) as AgentCountResponse;
        const searchJson = (await searchResponse.json()) as AgentSearchResponse;

        setTotalAwakened(countJson.count);
        setFilteredCount(searchJson.count);
        setAgents(searchJson.agents);
        setHasMore(searchJson.hasMore);
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setError(caught instanceof Error ? caught.message : "Agent directory could not be loaded.");
        setAgents([]);
        setFilteredCount(0);
        setHasMore(false);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    void loadInitial();
    return () => controller.abort();
  }, [debouncedQuery]);

  async function loadMore() {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    setError("");

    try {
      const response = await fetch(buildSearchUrl(debouncedQuery, agents.length));
      if (!response.ok) throw new Error("More agents could not be loaded.");
      const json = (await response.json()) as AgentSearchResponse;
      setAgents((current) => [...current, ...json.agents]);
      setFilteredCount(json.count);
      setHasMore(json.hasMore);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "More agents could not be loaded.");
    } finally {
      setIsLoadingMore(false);
    }
  }

  async function openAgentInfo(mogId: number) {
    setSelectedMogId(mogId);
    setSelectedInfo(null);
    setSelectedError("");
    setIsInfoLoading(true);

    try {
      const response = await fetch(`/api/agent-directory/info/${mogId}`, { cache: "no-store" });
      const json = await response.json().catch(() => ({ error: "Agent info returned an invalid response." }));
      if (!response.ok) {
        setSelectedError(json.error || "Agent info could not be loaded.");
        return;
      }
      setSelectedInfo(json);
    } catch {
      setSelectedError("Agent info could not reach the API.");
    } finally {
      setIsInfoLoading(false);
    }
  }

  function closeAgentInfo() {
    setSelectedMogId(null);
    setSelectedInfo(null);
    setSelectedError("");
    setIsInfoLoading(false);
  }

  const statusText = useMemo(() => {
    if (totalAwakened === null) return "Loading awakened agents";
    if (debouncedQuery) return `${formatNumber(filteredCount)} matching ${formatNumber(totalAwakened)} awakened agents`;
    return `${formatNumber(totalAwakened)} awakened agents`;
  }, [debouncedQuery, filteredCount, totalAwakened]);

  return (
    <section className={embedded ? "agent-directory-page embedded" : "agent-directory-page"}>
      <section className="agent-directory-header">
        <div>
          <p className="eyebrow">Agent Directory</p>
          {embedded ? <h3>Awakened agents</h3> : <h1>Awakened Monad Mogs</h1>}
          <p>
            Browse ERC-8004 agent identities bound to Monad Mogs through ERC-8217. Directory data is public discovery only; it does not claim individual wallet transactions were executed by an agent.
          </p>
        </div>
        <div className="agent-directory-summary">
          <span>Awakened</span>
          <strong>{totalAwakened === null ? "..." : formatNumber(totalAwakened)}</strong>
          {embedded ? <a href={`${API_BASE_URL}/api/agents/search?awake=true&limit=24`} target="_blank" rel="noreferrer">Search API</a> : <a href="/#agents">Awaken a Mog</a>}
        </div>
      </section>

      <section className="agent-directory-toolbar" aria-label="Agent directory filters">
        <label>
          <span>Search</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Mog ID, agent ID, wallet, rarity"
          />
        </label>
        <div className="agent-directory-status">{statusText}</div>
      </section>

      {error ? <p className="agent-directory-error">{error}</p> : null}

      {isLoading ? (
        <section className="agent-directory-grid" aria-busy="true">
          {Array.from({ length: 6 }, (_, index) => (
            <div className="agent-directory-card skeleton" key={index} />
          ))}
        </section>
      ) : agents.length === 0 ? (
        <section className="agent-directory-empty">
          <p>No awakened agents found.</p>
          <span>Try another token ID, agent ID, wallet, rarity tier, or clear the search.</span>
        </section>
      ) : (
        <>
          <section className="agent-directory-grid">
            {agents.map((agent) => {
              const mogId = tokenIdOf(agent);
              const bindingUrl = agent.links?.binding || `${API_BASE_URL}/api/agents/binding/${mogId}`;
              const infoUrl = agent.links?.info || `${API_BASE_URL}/api/agents/info/${mogId}`;
              const metadataUrl = agent.links?.metadata || `${API_BASE_URL}/api/agents/metadata/${mogId}`;
              const restapUrl = `${API_BASE_URL}/api/agent-runtime/${mogId}/.well-known/restap.json`;

              return (
                <article className="agent-directory-card" key={`${agent.agentId}-${mogId}`}>
                  <button className="agent-directory-image" type="button" onClick={() => openAgentInfo(mogId)} aria-label={`Open Mog #${mogId} agent info`}>
                    <img src={`${API_BASE_URL}/api/v0/mogs/${mogId}/render`} alt={`Mog #${mogId}`} loading="lazy" />
                  </button>

                  <div className="agent-directory-body">
                    <div className="agent-directory-title">
                      <div>
                        <span>{agent.source || "adapter"}</span>
                        <h2>Mog #{mogId}</h2>
                      </div>
                      <strong>Agent #{agent.agentId}</strong>
                    </div>

                    <div className="agent-directory-meta">
                      <span>{tierLabel(agent)}</span>
                      <span>Controller {shortAddress(agent.controller)}</span>
                      {agent.registeredBy ? <span>Registered {shortAddress(agent.registeredBy)}</span> : null}
                    </div>

                    <div className="agent-directory-actions">
                      <a href={bindingUrl} target="_blank" rel="noreferrer">Binding</a>
                      <a href={infoUrl} target="_blank" rel="noreferrer">Info</a>
                      <a href={metadataUrl} target="_blank" rel="noreferrer">AgentURI</a>
                      <a href={restapUrl} target="_blank" rel="noreferrer">RESTAP</a>
                      <a href={`https://opensea.io/item/monad/${MONAD_MOGS_ADDRESS}/${mogId}`} target="_blank" rel="noreferrer">
                        OpenSea
                      </a>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>

          <div className="agent-directory-load">
            <button className="secondary-action" type="button" disabled={!hasMore || isLoadingMore} onClick={loadMore}>
              {isLoadingMore ? "Loading..." : hasMore ? "Load more" : "All awakened agents loaded"}
            </button>
          </div>
        </>
      )}

      {selectedMogId ? (
        <div className="agent-info-overlay" role="presentation" onMouseDown={closeAgentInfo}>
          <section className="agent-info-panel" role="dialog" aria-modal="true" aria-label={`Mog #${selectedMogId} agent info`} onMouseDown={(event) => event.stopPropagation()}>
            <button className="agent-info-close" type="button" onClick={closeAgentInfo} aria-label="Close agent info">
              Close
            </button>

            {isInfoLoading ? (
              <div className="agent-info-state">Loading agent info...</div>
            ) : selectedError ? (
              <div className="agent-info-state error">{selectedError}</div>
            ) : selectedInfo ? (
              <>
                <div className="agent-info-visual">
                  <img src={selectedInfo.image || `${API_BASE_URL}/api/v0/mogs/${selectedMogId}/render`} alt={selectedInfo.name} />
                </div>
                <div className="agent-info-content">
                  <div className="agent-info-heading">
                    <span>{selectedInfo.binding.source || "adapter"} binding</span>
                    <h2>{selectedInfo.name}</h2>
                    <p>{selectedInfo.tagline}</p>
                  </div>

                  <div className="agent-info-facts">
                    <span>Agent #{selectedInfo.agent.agentId}</span>
                    {selectedInfo.rarity ? <span>{selectedInfo.rarity.tier} #{formatNumber(selectedInfo.rarity.rank)}</span> : null}
                    <span>Controller {shortAddress(selectedInfo.agent.controller)}</span>
                    <span>Wallet {shortAddress(selectedInfo.agent.agentWallet)}</span>
                  </div>

                  <p className="agent-info-copy">{selectedInfo.greeting || selectedInfo.backstory}</p>
                  <p className="agent-info-copy">{selectedInfo.communicationStyle}</p>

                  {selectedInfo.personalityTraits?.length ? (
                    <div className="agent-info-list">
                      {selectedInfo.personalityTraits.slice(0, 4).map((trait) => (
                        <span key={trait}>{trait}</span>
                      ))}
                    </div>
                  ) : null}

                  <div className="agent-info-links">
                    <a href={`${API_BASE_URL}/api/agents/binding/${selectedMogId}`} target="_blank" rel="noreferrer">Binding</a>
                    <a href={selectedInfo.links?.metadata || `${API_BASE_URL}/api/agents/metadata/${selectedMogId}`} target="_blank" rel="noreferrer">AgentURI</a>
                    <a href={`${API_BASE_URL}/api/agent-runtime/${selectedMogId}/.well-known/restap.json`} target="_blank" rel="noreferrer">RESTAP</a>
                    <a href={`https://opensea.io/item/monad/${MONAD_MOGS_ADDRESS}/${selectedMogId}`} target="_blank" rel="noreferrer">OpenSea</a>
                  </div>
                </div>
              </>
            ) : null}
          </section>
        </div>
      ) : null}
    </section>
  );
}
