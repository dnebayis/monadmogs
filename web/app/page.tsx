import { CollectionGallery } from "@/components/collection-gallery";
import { MintPanel } from "@/components/mint-panel";

export default function Home() {
  return (
    <main>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Monad Mainnet / Sold Out</p>
          <h1>Monad Mogs</h1>
          <p className="hero-line">
            5,000 fully onchain pixel hamsters, permanently minted on Monad and locked forever.
          </p>
          <div className="hero-actions">
            <a href="https://opensea.io/collection/monad-mogs" className="text-link" target="_blank" rel="noreferrer">
              View on OpenSea
            </a>
            <a href="https://x.com/monadmogs" className="text-link muted" target="_blank" rel="noreferrer">
              Follow X
            </a>
            <a href="#collection" className="text-link muted">
              Browse
            </a>
            <a href="#story" className="text-link muted">
              Read story
            </a>
          </div>
        </div>
        <div className="mog-stage" aria-label="Pixel hamster mascot preview">
          <PixelMog />
          <div className="stage-caption">
            <span>no ipfs</span>
            <span>no lp</span>
            <span>sold out</span>
          </div>
        </div>
      </section>

      <section id="mint" className="mint-section">
        <div className="section-heading">
          <p className="eyebrow">Final Supply</p>
          <h2>5,000 / 5,000 Monad Mogs have been minted.</h2>
          <p className="section-copy">
            Mint is closed, metadata is frozen, and ownership has been renounced. The artwork and metadata remain
            available directly from <code>tokenURI()</code>.
          </p>
        </div>
        <MintPanel />
      </section>

      <CollectionGallery />

      <section id="story" className="story-section">
        <div className="section-heading">
          <p className="eyebrow">Story</p>
          <h2>A small hamster relic from Monad culture.</h2>
        </div>
        <div className="story-copy">
          <p>
            Monad Mogs began as a free onchain experiment: no IPFS, no LP, no mint price, just 5,000 deterministic
            pixel hamsters written for Monad mainnet.
          </p>
          <p>
            Each Mog is assembled from a stored mint seed and rendered as SVG by the contract itself. The collection is
            now sold out, frozen, and ownerless.
          </p>
          <div className="story-links">
            <a href="https://x.com/monadmogs" target="_blank" rel="noreferrer">
              X
            </a>
            <a href="https://opensea.io/collection/monad-mogs" target="_blank" rel="noreferrer">
              OpenSea
            </a>
          </div>
        </div>
      </section>

      <section className="proof-section">
        <p>SVG and JSON metadata are returned directly from <code>tokenURI()</code> as data URIs.</p>
        <p>Final state: sold out, metadata frozen, ownership renounced.</p>
      </section>
    </main>
  );
}

function PixelMog() {
  const pixels = [
    "ear left-ear",
    "ear right-ear",
    "inner left-inner",
    "inner right-inner",
    "fur head",
    "fur cheek-left",
    "fur cheek-right",
    "face faceplate",
    "shade face-shade",
    "eye eye-left",
    "eye eye-right",
    "shine shine-left",
    "shine shine-right",
    "nose",
    "mouth",
    "fur body",
    "paw paw-left",
    "paw paw-right",
    "foot foot-left",
    "foot foot-right",
  ];

  return (
    <div className="pixel-mog">
      {pixels.map((pixel) => (
        <span key={pixel} className={pixel} />
      ))}
    </div>
  );
}
