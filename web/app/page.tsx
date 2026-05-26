import { HomeTabs } from "@/components/home-tabs";

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
            <a href="/developers" className="text-link muted">
              API
            </a>
            <a
              href="https://nad.fun/tokens/0x9cF1538f92341A311a922D411DE8C471DCEA7777"
              className="text-link muted"
              target="_blank"
              rel="noreferrer"
            >
              $MOGS
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
            <span>onchain svg</span>
            <span>sold out</span>
          </div>
        </div>
      </section>

      <HomeTabs />
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
