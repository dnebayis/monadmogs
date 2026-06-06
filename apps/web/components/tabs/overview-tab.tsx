import { PixelMog } from "@/components/pixel-mog";

const TOKEN_URL = "https://nad.fun/tokens/0x9cF1538f92341A311a922D411DE8C471DCEA7777";

export function OverviewTab() {
  return (
    <section className="overview-hero">
      <div className="hero-copy">
        <p className="eyebrow">Monad Mainnet / Sold Out</p>
        <h1>Monad Mogs</h1>
        <p className="hero-line">5,000 fully onchain pixel hamsters, permanently minted on Monad and locked forever.</p>
        <div className="hero-actions">
          <a href="https://opensea.io/collection/monad-mogs" className="text-link" target="_blank" rel="noreferrer">
            View on OpenSea
          </a>
          <a href="https://x.com/monadmogs" className="text-link muted" target="_blank" rel="noreferrer">
            Follow X
          </a>
          <a href={TOKEN_URL} className="text-link muted" target="_blank" rel="noreferrer">
            $MOGS
          </a>
        </div>
      </div>
      <div className="mog-stage" aria-label="Pixel hamster mascot preview">
        <PixelMog />
        <div className="stage-caption">
          <span>5,000 supply</span>
          <span>onchain svg</span>
          <span>ownerless</span>
          <span>$MOGS live</span>
        </div>
      </div>
    </section>
  );
}
