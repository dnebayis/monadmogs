import { MintPanel } from "@/components/mint-panel";

export default function Home() {
  return (
    <main>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Monad Mainnet / Free Mint</p>
          <h1>Monad Mogs</h1>
          <p className="hero-line">
            5,000 fully onchain pixel hamsters born from Monad culture, deterministic traits, and SVG metadata.
          </p>
          <div className="hero-actions">
            <a href="#mint" className="text-link">
              Mint on Monad
            </a>
            <a href="https://app.monad.xyz/" className="text-link muted" target="_blank" rel="noreferrer">
              Get MON
            </a>
          </div>
        </div>
        <div className="mog-stage" aria-label="Pixel hamster mascot preview">
          <PixelMog />
          <div className="stage-caption">
            <span>no ipfs</span>
            <span>no lp</span>
            <span>no price</span>
          </div>
        </div>
      </section>

      <section id="mint" className="mint-section">
        <div className="section-heading">
          <p className="eyebrow">Mint Surface</p>
          <h2>One wallet can mint five testnet Mogs.</h2>
          <p className="section-copy">
            The contract returns the artwork and metadata directly from <code>tokenURI()</code>. Mint is free; only Monad
            gas is paid.
          </p>
        </div>
        <MintPanel />
      </section>

      <section className="trait-section">
        <div className="section-heading">
          <p className="eyebrow">Locked Renderer</p>
          <h2>A simple hamster mask with Monad-native traits.</h2>
        </div>
        <div className="trait-list" aria-label="Trait groups">
          {["Background", "Body", "Eyes", "Mouth", "Head", "Hands", "Aura", "Glitch", "Meme Tag"].map((trait) => (
            <span key={trait}>{trait}</span>
          ))}
        </div>
      </section>

      <section className="proof-section">
        <p>SVG and JSON metadata are returned directly from <code>tokenURI()</code> as data URIs.</p>
        <p>Final launch flow: verify, smoke test, freeze metadata, renounce ownership.</p>
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
