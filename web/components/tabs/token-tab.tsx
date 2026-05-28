const TOKEN_ADDRESS = "0x9cF1538f92341A311a922D411DE8C471DCEA7777";
const TOKEN_URL = `https://nad.fun/tokens/${TOKEN_ADDRESS}`;

const RESERVE_TXS = [
  "0xac84218e1b6b675f01455258c5363d8151fa9203c756a7b5f4a6d364f76ad001",
  "0x50f8a58a24ddef84e65fc86558af255ec77d737ebc94c5b522eb1a08a94bca24",
  "0xd6650a9fde3920e876f4ebd3839e29ebeca2f13014f4e0c1364da0774d878a1c",
  "0x437cac45bca9128150b7f9944fa4f85f1af32443e8f249db0d290d29f422c433",
  "0x8a59cd5575ee1c8468bb1bebb4731d588067453480dc3b85c41c48888cdc7c0a",
  "0x9ed683682f96d0a3b8efbbf843db52c97e7cb91c2b14beea027968aa90a04bfa",
];

export function TokenTab() {
  return (
    <section className="api-summary">
      <div className="section-heading">
        <p className="eyebrow">$MOGS</p>
        <h2>An ecosystem layer around a sold-out cc0 onchain collection.</h2>
        <p className="section-copy">
          Monad Mogs should not just sit in wallets. $MOGS exists to fund tools, campaigns, liquidity, burns, and the
          Mogs Reserve without replacing or migrating the NFT collection.
        </p>
      </div>
      <div className="info-grid">
        <div className="token-card">
          <span>Token address</span>
          <code>{TOKEN_ADDRESS}</code>
          <div className="hero-actions">
            <a className="text-link" href={TOKEN_URL} target="_blank" rel="noreferrer">
              Open on nad.fun
            </a>
          </div>
        </div>
        <article className="endpoint-card">
          <span>Fee strategy</span>
          <p>60% creator, 25% LP support, 15% buyback and burn.</p>
        </article>
        <article className="endpoint-card">
          <span>Creator work</span>
          <p>Public API, open IP tools, campaigns, operations, and reserve growth.</p>
        </article>
        <article className="endpoint-card">
          <span>Reserve</span>
          <p>300 Monad Mogs collected so far and held as an ecosystem reserve, not for flipping.</p>
        </article>
        <article className="endpoint-card">
          <span>Flywheel</span>
          <p>Fees fund tools, liquidity, burns, and reserve. API drives builders, memes, and distribution.</p>
        </article>
        <article className="endpoint-card">
          <span>Boundary</span>
          <p>No price promises, no forced migration, and no replacement of Monad Mogs.</p>
        </article>
      </div>
      <div className="reserve-links">
        <span>Reserve txs</span>
        <div>
          {RESERVE_TXS.map((tx, index) => (
            <a key={tx} href={`https://monadscan.com/tx/${tx}`} target="_blank" rel="noreferrer">
              tx {index + 1}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
