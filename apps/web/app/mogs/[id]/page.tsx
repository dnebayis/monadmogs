import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MogDetailActions } from "@/components/mog-detail-actions";
import { enrichMogMetadata, getMogMetadata, parseTokenId } from "@/lib/mogs";
import { getMogRarity, getTierLabel } from "@/lib/rarity";
import { API_BASE_URL, SITE_URL } from "@/lib/urls";

type MogPageProps = {
  params: Promise<{ id: string }>;
};

async function loadMog(id: string) {
  const tokenId = parseTokenId(id);
  if (!tokenId) notFound();

  try {
    return enrichMogMetadata(await getMogMetadata(tokenId));
  } catch {
    notFound();
  }
}

export async function generateMetadata({ params }: MogPageProps): Promise<Metadata> {
  const { id } = await params;
  const mog = await loadMog(id);

  return {
    title: `${mog.name} | Monad Mogs`,
    description: `Frozen onchain metadata and traits for ${mog.name}.`,
    openGraph: {
      title: `${mog.name} | Monad Mogs`,
      description: "A fully onchain pixel hamster permanently minted on Monad.",
      images: [mog.image],
    },
  };
}

export default async function MogPage({ params }: MogPageProps) {
  const { id } = await params;
  const mog = await loadMog(id);
  const rarity = getMogRarity(mog.tokenId);
  const apiUrl = `${API_BASE_URL}/api/v0/mogs/${mog.tokenId}`;
  const previousId = mog.tokenId === 1 ? 5000 : mog.tokenId - 1;
  const nextId = mog.tokenId === 5000 ? 1 : mog.tokenId + 1;

  return (
    <main>
      <section className="mog-detail">
        <div className="mog-detail-art">
          <img src={mog.image} alt={mog.name} />
        </div>

        <div className="mog-detail-copy">
          <nav className="detail-nav" aria-label="Mog navigation">
            <Link href="/">Home</Link>
            <Link href="/#collection">Collection</Link>
            <Link href={`/mogs/${previousId}`}>Prev</Link>
            <Link href={`/mogs/${nextId}`}>Next</Link>
          </nav>

          <p className="eyebrow">Monad Mog / #{mog.tokenId}</p>
          <h1>{mog.name}</h1>
          <p className="hero-line">
            Frozen onchain metadata, SVG render, and traits for one permanently minted Monad Mog.
          </p>

          {rarity ? (
            <div className="rarity-summary">
              <span>{getTierLabel(rarity.tier)}</span>
              <strong>Rank #{rarity.rank} / 5,000</strong>
              <p>Score {rarity.score.toFixed(3)} · Top {rarity.percentile.toFixed(2)}%</p>
            </div>
          ) : null}

          <div className="hero-actions">
            <a className="text-link" href={mog.links.opensea} target="_blank" rel="noreferrer">
              OpenSea
            </a>
            <a className="text-link muted" href={mog.links.monadscan} target="_blank" rel="noreferrer">
              Monadscan
            </a>
            <a className="text-link muted" href={`${API_BASE_URL}/api/v0/mogs/${mog.tokenId}/render`} target="_blank" rel="noreferrer">
              SVG Render
            </a>
            <a className="text-link muted" href={`${API_BASE_URL}/api/v0/mogs/${mog.tokenId}/rarity`} target="_blank" rel="noreferrer">
              Rarity JSON
            </a>
            <Link className="text-link muted" href="/">
              Back Home
            </Link>
          </div>

          <MogDetailActions apiUrl={apiUrl} tokenId={mog.tokenId} />

          <div className="mog-trait-grid">
            {mog.attributes.map((attribute) => (
              <article className="endpoint-card" key={attribute.trait_type}>
                <span>{attribute.trait_type}</span>
                <p>{attribute.value}</p>
                {rarity ? (
                  <small>
                    {rarity.attributes.find((item) => item.trait_type === attribute.trait_type)?.frequency} / 5,000
                  </small>
                ) : null}
              </article>
            ))}
          </div>

          <div className="copy-prompt">
            <div className="copy-prompt-top">
              <span>API URL</span>
            </div>
            <pre className="code-block">
              <code>{apiUrl}</code>
            </pre>
          </div>
        </div>
      </section>
    </main>
  );
}
