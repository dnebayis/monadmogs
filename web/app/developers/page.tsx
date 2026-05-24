const endpoints = [
  {
    method: "GET",
    path: "/api/v0/mogs?cursor=1&limit=24",
    note: "Paginated metadata, image data URIs, traits, and links.",
  },
  {
    method: "GET",
    path: "/api/v0/mogs/1",
    note: "Single Mog metadata enriched with OpenSea, Monadscan, render, and traits links.",
  },
  {
    method: "GET",
    path: "/api/v0/mogs/1/traits",
    note: "Trait-only response for one Mog.",
  },
  {
    method: "GET",
    path: "/api/v0/mogs/1/render",
    note: "Raw SVG render served as image/svg+xml.",
  },
  {
    method: "GET",
    path: "/api/v0/mogs/random",
    note: "Random fully onchain Mog metadata.",
  },
  {
    method: "GET",
    path: "/api/v0/traits",
    note: "Full trait schema for the collection.",
  },
];

export default function DevelopersPage() {
  return (
    <main>
      <section className="developer-hero">
        <p className="eyebrow">Public API</p>
        <h1>Mogs API</h1>
        <p className="hero-line">
          Metadata, traits, SVG renders, random Mogs, and remix-friendly endpoints for Monad Mogs builders.
        </p>
        <div className="hero-actions">
          <a className="text-link" href="/api/v0/mogs/1" target="_blank" rel="noreferrer">
            Try metadata
          </a>
          <a className="text-link muted" href="/api/v0/mogs/1/render" target="_blank" rel="noreferrer">
            Try render
          </a>
          <a className="text-link muted" href="/">
            Back home
          </a>
        </div>
      </section>

      <section className="developer-section">
        <div className="section-heading">
          <p className="eyebrow">Endpoints</p>
          <h2>Read frozen onchain Mogs without wallet connection.</h2>
          <p className="section-copy">
            Responses are generated from <code>tokenURI()</code> and served with immutable cache headers because the
            collection is frozen and ownerless.
          </p>
        </div>
        <div className="endpoint-list">
          {endpoints.map((endpoint) => (
            <article className="endpoint-card" key={endpoint.path}>
              <span>{endpoint.method}</span>
              <code>{endpoint.path}</code>
              <p>{endpoint.note}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="developer-section compact">
        <div className="section-heading">
          <p className="eyebrow">Example</p>
          <h2>Fetch a random Mog.</h2>
        </div>
        <pre className="code-block">
          <code>{`const mog = await fetch("https://monadmogs.xyz/api/v0/mogs/random").then((r) => r.json());
console.log(mog.name, mog.attributes);`}</code>
        </pre>
      </section>
    </main>
  );
}
