"use client";

import { GAME_TYPES } from "@/lib/arena";

const GAME_TYPE_LIST = Object.entries(GAME_TYPES) as [string, { label: string; description: string }][];

export function ArenaTab() {
  return (
    <section className="tab-full">
      <div className="section-heading">
        <p className="eyebrow">Arena</p>
        <h2>Mog vs Mog.</h2>
        <p className="section-copy">
          Pick a game, choose your Mog, and challenge other players. Wins and losses are tracked on
          the leaderboard.
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
            <p>Winners receive NFTs or $MOGS directly to their wallet. Results are public and verifiable.</p>
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
          <p className="tab-block-copy">Top players by total wins.</p>
        </div>
        <div className="arena-empty">
          <p>No games played yet. Arena is coming soon.</p>
        </div>
      </div>
    </section>
  );
}
