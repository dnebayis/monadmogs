"use client";

import { useMemo, useState } from "react";

const TRAITS = {
  Background: ["Off-White", "Monad Purple", "Monad Blue", "Berry", "Terminal Black", "Finality Pink", "Mempool Grid", "Validator Map"],
  Body: ["Nad", "Pixel Bot", "Parallel Runner", "Mempool Ghost", "Block Builder", "Validator Kid"],
  Eyes: ["400ms Blink", "Diamond Eyes", "Sleepy Gmonad", "Terminal Scan", "Purple Rage", "Empty Mempool"],
  Mouth: ["GM", "Gmonad", "Cope Smile", "Finalized", "Reorg No", "Silent"],
  Head: ["Monad Cap", "Validator Halo", "Block Crown", "Gas Meter", "Purple Beanie", "No Hat", "Mempool Crown"],
  Hands: ["Faucet Cup", "Block Receipt", "Pixel Flag", "Keyboard", "Diamond", "Empty Hands"],
  Aura: ["Proposed", "Voted", "Finalized", "Verified", "Async", "Raptor", "None"],
  Glitch: ["None", "Low", "Parallel Split", "JIT Burn", "State Root"],
  "Meme Tag": ["gmonad", "400ms", "800ms", "no global mempool", "sendRawSync", "monanimal energy", "full onchain", "testnet relic"],
} as const;

const GROUPS = Object.keys(TRAITS) as Array<keyof typeof TRAITS>;

export function TraitExplorer() {
  const [activeGroup, setActiveGroup] = useState<keyof typeof TRAITS>("Background");
  const [query, setQuery] = useState("");

  const visibleTraits = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return TRAITS[activeGroup].filter((trait) => trait.toLowerCase().includes(normalized));
  }, [activeGroup, query]);

  return (
    <div className="trait-explorer">
      <div className="trait-controls" aria-label="Trait filters">
        {GROUPS.map((group) => (
          <button
            key={group}
            className={group === activeGroup ? "active" : ""}
            type="button"
            onClick={() => setActiveGroup(group)}
          >
            {group}
          </button>
        ))}
      </div>
      <label className="trait-search">
        <span>Filter traits</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="gmonad, raptor, state root..."
        />
      </label>
      <div className="trait-results">
        {visibleTraits.map((trait) => (
          <span key={trait}>{trait}</span>
        ))}
      </div>
    </div>
  );
}
