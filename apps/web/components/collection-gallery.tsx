"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createPublicClient, http } from "viem";
import { MONAD_MOGS_ABI, MONAD_MOGS_ADDRESS } from "@/lib/contract";
import { MAX_SUPPLY, TRAIT_GROUPS, type MogAttribute, type MogMetadata } from "@/lib/mogs";
import { MONAD_CHAIN, MONAD_RPC_URL } from "@/lib/network";

const PAGE_SIZE = 48;

type TokenMetadata = MogMetadata;

const client = createPublicClient({
  chain: MONAD_CHAIN,
  transport: http(MONAD_RPC_URL),
});

function decodeDataUri(uri: string) {
  const [, payload = ""] = uri.split(",");
  return JSON.parse(atob(payload)) as Omit<TokenMetadata, "tokenId">;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function normalizeSearch(value: string) {
  return value
    .toLowerCase()
    .replace(/#/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenMatches(token: TokenMetadata, filters: Record<string, string>, query: string) {
  const normalizedQuery = normalizeSearch(query);
  if (normalizedQuery) {
    const terms = normalizedQuery.split(" ").filter(Boolean);
    const searchable = normalizeSearch(
      [
        token.name,
        token.tokenId,
        `#${token.tokenId}`,
        ...token.attributes.flatMap((attribute) => [attribute.trait_type, attribute.value, `${attribute.trait_type} ${attribute.value}`]),
      ].join(" "),
    );

    if (!terms.every((term) => searchable.includes(term))) {
      return false;
    }
  }

  return Object.entries(filters).every(([group, value]) => {
    if (!value) return true;
    return token.attributes.some((attribute) => attribute.trait_type === group && attribute.value === value);
  });
}

function parseTokenIdSearch(query: string) {
  const normalized = query.trim().replace("#", "");
  if (!/^\d+$/.test(normalized)) return null;

  const tokenId = Number(normalized);
  if (!Number.isInteger(tokenId) || tokenId < 1 || tokenId > MAX_SUPPLY) return null;
  return tokenId;
}

export function CollectionGallery({ compact = false }: { compact?: boolean }) {
  const [tokens, setTokens] = useState<TokenMetadata[]>([]);
  const [nextTokenId, setNextTokenId] = useState(1);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadTokens(count = PAGE_SIZE) {
    if (isLoading || nextTokenId > MAX_SUPPLY) return;

    setIsLoading(true);
    setError("");

    try {
      const start = nextTokenId;
      const end = Math.min(MAX_SUPPLY, start + count - 1);
      const tokenIds = Array.from({ length: end - start + 1 }, (_, index) => start + index);
      const results = await Promise.allSettled(
        tokenIds.map(async (tokenId) => {
          const uri = await client.readContract({
            address: MONAD_MOGS_ADDRESS,
            abi: MONAD_MOGS_ABI,
            functionName: "tokenURI",
            args: [BigInt(tokenId)],
          });
          return { ...decodeDataUri(uri), tokenId };
        }),
      );
      const loaded = results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));

      setTokens((current) => {
        const known = new Set(current.map((token) => token.tokenId));
        return [...current, ...loaded.filter((token) => !known.has(token.tokenId))].sort((a, b) => a.tokenId - b.tokenId);
      });
      setNextTokenId(end + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Collection metadata could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadTokenById(tokenId: number) {
    if (tokens.some((token) => token.tokenId === tokenId)) return;

    setIsLoading(true);
    setError("");

    try {
      const uri = await client.readContract({
        address: MONAD_MOGS_ADDRESS,
        abi: MONAD_MOGS_ABI,
        functionName: "tokenURI",
        args: [BigInt(tokenId)],
      });
      const metadata = { ...decodeDataUri(uri), tokenId };

      setTokens((current) => {
        if (current.some((token) => token.tokenId === tokenId)) return current;
        return [...current, metadata].sort((a, b) => a.tokenId - b.tokenId);
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `Monad Mogs #${tokenId} could not be loaded.`);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadTokens();
  }, []);

  useEffect(() => {
    const tokenId = parseTokenIdSearch(query);
    if (!tokenId) return;

    const timeout = window.setTimeout(() => {
      void loadTokenById(tokenId);
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [query, tokens]);

  const traitOptions = useMemo(() => {
    return TRAIT_GROUPS.reduce<Record<string, string[]>>((options, group) => {
      options[group] = Array.from(
        new Set(
          tokens.flatMap((token) =>
            token.attributes.filter((attribute: MogAttribute) => attribute.trait_type === group).map((attribute) => attribute.value),
          ),
        ),
      ).sort();
      return options;
    }, {});
  }, [tokens]);

  const visibleTokens = useMemo(() => {
    return tokens.filter((token) => tokenMatches(token, filters, query));
  }, [filters, query, tokens]);

  function updateFilter(group: string, value: string) {
    setFilters((current) => ({ ...current, [group]: value }));
  }

  function clearFilters() {
    setFilters({});
    setQuery("");
  }

  return (
    <section id="collection" className={compact ? "collection-section tabbed" : "collection-section"}>
      <div className="section-heading">
        <p className="eyebrow">Collection</p>
        <h2>Browse the onchain Mogs and filter by loaded traits.</h2>
        <p className="section-copy">
          The gallery reads <code>tokenURI()</code> directly from Monad in batches. Load more tokens to expand the
          searchable set.
        </p>
      </div>

      <div className="collection-shell">
        <div className="collection-toolbar">
          <label className="collection-search">
            <span>Search</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="#143, raptor, gmonad" />
          </label>
          <button className="secondary-action" type="button" onClick={clearFilters}>
            Clear
          </button>
        </div>

        <div className="filter-grid">
          {TRAIT_GROUPS.map((group) => (
            <label key={group}>
              <span>{group}</span>
              <select value={filters[group] || ""} onChange={(event) => updateFilter(group, event.target.value)}>
                <option value="">All</option>
                {(traitOptions[group] || []).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>

        <div className="collection-meta">
          <span>{formatNumber(tokens.length)} loaded</span>
          <span>{formatNumber(visibleTokens.length)} visible</span>
          <span>{formatNumber(MAX_SUPPLY)} total</span>
        </div>

        <div className="nft-grid">
          {visibleTokens.map((token) => (
            <Link className="nft-card" href={`/mogs/${token.tokenId}`} key={token.tokenId}>
              <img src={token.image} alt={token.name} loading="lazy" />
              <div className="nft-card-body">
                <strong>{token.name}</strong>
                <div className="nft-traits">
                  {token.attributes.slice(0, 4).map((attribute) => (
                    <span key={`${token.tokenId}-${attribute.trait_type}`}>
                      {attribute.trait_type}: {attribute.value}
                    </span>
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="collection-actions">
          <button className="primary-action" type="button" disabled={isLoading || nextTokenId > MAX_SUPPLY} onClick={() => loadTokens()}>
            {isLoading ? "Loading..." : nextTokenId > MAX_SUPPLY ? "All loaded" : "Load more"}
          </button>
          <button className="secondary-action" type="button" disabled={isLoading || nextTokenId > MAX_SUPPLY} onClick={() => loadTokens(240)}>
            Load 240
          </button>
        </div>

        {error ? <p className="error">{error}</p> : null}
      </div>
    </section>
  );
}
