const TOKEN_URL = "https://nad.fun/tokens/0x9cF1538f92341A311a922D411DE8C471DCEA7777";

export function StoryTab() {
  return (
    <section className="story-section tabbed">
      <div className="section-heading">
        <p className="eyebrow">Story</p>
        <h2>A small hamster relic from Monad culture.</h2>
      </div>
      <div className="story-copy">
        <p>
          Monad Mogs began as an onchain pixel experiment: 5,000 deterministic hamsters written for Monad mainnet.
        </p>
        <p>
          Each Mog is assembled from a stored mint seed and rendered as SVG by the contract itself. The collection is now
          sold out, frozen, and ownerless.
        </p>
        <div className="story-links">
          <a href="https://x.com/monadmogs" target="_blank" rel="noreferrer">
            X
          </a>
          <a href="https://opensea.io/collection/monad-mogs" target="_blank" rel="noreferrer">
            OpenSea
          </a>
          <a href={TOKEN_URL} target="_blank" rel="noreferrer">
            $MOGS
          </a>
        </div>
      </div>
    </section>
  );
}
