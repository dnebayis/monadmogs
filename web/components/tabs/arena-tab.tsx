"use client";

import { useEffect, useState } from "react";
import { GAME_TYPES, type LeaderboardEntry } from "@/lib/arena";

const GAME_TYPE_LIST = Object.entries(GAME_TYPES) as [string, { label: string; description: string }][];

export function ArenaTab() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    fetch("/api/arena?view=leaderboard")
      .then((r) => r.json())
      .then((data) => setLeaderboard(data.leaderboard || []))
      .catch(() => {});
  }, []);

  return (
    <section className="tab-full">
      <div className="section-heading">
        <p className="eyebrow">Arena</p>
        <h2>Mog vs Mog.</h2>
        <p className="section-copy">
          Pick a game, choose your Mog, and challenge other players. Winners earn reputation and
          prizes.
        </p>
      </div>

      <div className="tab-block">
        <div className="tab-block-header">
          <p className="eyebrow">Games</p>
          <p className="tab-block-copy">Quick games powered by onchain randomness.</p>
        </div>
        <div className="arena-game-grid">
          {GAME_TYPE_LIST.map(([type, info]) => (
            <div key={type} className="arena-game-card disabled">
              <strong>{info.label}</strong>
              <p>{info.description}</p>
              <span className="arena-soon-badge">Soon</span>
            </div>
          ))}
        </div>
      </div>

      <div className="tab-block">
        <div className="tab-block-header">
          <p className="eyebrow">How It Works</p>
        </div>
        <div className="endpoint-list">
          <article className="endpoint-card">
            <span>1 / Own</span>
            <p>You must own a Monad Mog NFT. Your Mog is your player identity in the arena.</p>
          </article>
          <article className="endpoint-card">
            <span>2 / Play</span>
            <p>We create games with prize pools. You join with your Mog and play against others.</p>
          </article>
          <article className="endpoint-card">
            <span>3 / Win</span>
            <p>Winners earn reputation and prizes. Reputation is recorded onchain via ERC-8004.</p>
          </article>
          <article className="endpoint-card">
            <span>4 / Climb</span>
            <p>Leaderboard ranks by reputation. More wins, higher reputation, better matchmaking.</p>
          </article>
        </div>
      </div>

      <div className="tab-block">
        <div className="tab-block-header">
          <p className="eyebrow">Planned</p>
        </div>
        <div className="endpoint-list">
          <article className="endpoint-card">
            <span>Prize Pools</span>
            <p>Onchain prize contracts. Lock NFTs or $MOGS, winner takes the pool automatically.</p>
          </article>
          <article className="endpoint-card">
            <span>Chess</span>
            <p>Full chess matches between Mog agents. Moves influenced by trait personas.</p>
          </article>
          <article className="endpoint-card">
            <span>Tournaments</span>
            <p>Bracket tournaments with $MOGS prize pools. Weekly and seasonal events.</p>
          </article>
          <article className="endpoint-card">
            <span>Rarity Bonus</span>
            <p>Rarer Mogs unlock strategic advantages: extra rolls, better odds, bonus rewards.</p>
          </article>
        </div>
      </div>

      <div className="tab-block">
        <div className="tab-block-header">
          <p className="eyebrow">Leaderboard</p>
          <p className="tab-block-copy">Ranked by reputation. Wins earn +10, losses cost -3.</p>
        </div>
        {leaderboard.length > 0 ? (
          <div className="arena-leaderboard">
            <div className="arena-lb-header">
              <span>#</span>
              <span>Player</span>
              <span>Rep</span>
              <span>W</span>
              <span>L</span>
            </div>
            {leaderboard.map((entry, i) => (
              <div key={entry.address} className="arena-lb-row">
                <span>{i + 1}</span>
                <span className="arena-lb-player">
                  <img src={`/api/v0/mogs/${entry.mogId}/render`} alt={entry.mogName} />
                  {entry.mogName}
                </span>
                <span className="arena-lb-rep">{entry.reputation ?? 0}</span>
                <span>{entry.wins}</span>
                <span>{entry.losses}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="arena-empty">
            <p>No games played yet. Arena is coming soon.</p>
          </div>
        )}
      </div>
    </section>
  );
}
