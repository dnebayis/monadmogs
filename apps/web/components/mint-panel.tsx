import { MONAD_MOGS_ADDRESS } from "@/lib/contract";
import { MONAD_EXPLORER_URL, MONAD_NETWORK_LABEL } from "@/lib/network";

const FINAL_SUPPLY = 5000;

export function MintPanel() {
  return (
    <section className="mint-surface" aria-label="Mint Monad Mogs">
      <div className="mint-topline">
        <span>{MONAD_NETWORK_LABEL}</span>
        <span>Ownerless</span>
      </div>
      <div className="mint-count">
        <strong>{FINAL_SUPPLY.toLocaleString()}</strong>
        <span>/ {FINAL_SUPPLY.toLocaleString()} minted</span>
      </div>
      <div className="meter" aria-hidden="true">
        <span style={{ width: "100%" }} />
      </div>
      <p className="mint-status">Sold out. Mint is closed, metadata is frozen, and ownership has been renounced.</p>
      <div className="mint-actions">
        <button className="primary-action" disabled>
          Sold out
        </button>
        <a className="text-link muted" href="https://opensea.io/collection/monad-mogs" target="_blank" rel="noreferrer">
          OpenSea
        </a>
      </div>
      <p className="gas-note">
        Contract: <a href={`${MONAD_EXPLORER_URL}/address/${MONAD_MOGS_ADDRESS}`} target="_blank" rel="noreferrer">{MONAD_MOGS_ADDRESS}</a>
      </p>
    </section>
  );
}
