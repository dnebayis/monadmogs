const TOKEN_URL = "https://nad.fun/tokens/0x9cF1538f92341A311a922D411DE8C471DCEA7777";
const API_DOCS_URL = "https://api.monadmogs.xyz";

export function StoryTab() {
  return (
    <section className="story-section tabbed">
      <div className="section-heading">
        <p className="eyebrow">Story</p>
        <h2>From onchain hamsters to playable agents.</h2>
      </div>
      <div className="story-copy">
        <p>
          Monad Mogs started as a simple onchain pixel experiment: 5,000 deterministic hamsters written for Monad mainnet.
        </p>
        <p>
          Each Mog is assembled from a stored mint seed and rendered as SVG by the contract itself. The collection is sold out,
          metadata is frozen, and ownership is renounced.
        </p>
        <p>
          The project has grown into an open character layer. Builders can read metadata, renders, traits, and exact rarity
          from the public API. Agents can register through ERC-8004, bind to a Mog through ERC-8217, and expose persona-driven
          runtime endpoints through RESTAP.
        </p>
        <p>
          The current direction is straightforward: keep the collection immutable, make the data easy to build with, and let
          every Mog become a small autonomous identity with its own traits, history, and public agent context.
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
          <a href={API_DOCS_URL} target="_blank" rel="noreferrer">
            API
          </a>
        </div>
      </div>
    </section>
  );
}
