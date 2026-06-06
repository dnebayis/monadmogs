export function IpTab() {
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
          <p>Use &quot;Monad Mogs&quot; or link back to monadmogs.xyz when publishing derivative work.</p>
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
          <p>Credit Monad Mogs and link back to monadmogs.xyz when publishing remixes or tools.</p>
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
