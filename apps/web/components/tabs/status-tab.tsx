import { MintPanel } from "@/components/mint-panel";

export function StatusTab() {
  return (
    <section className="mint-section tabbed">
      <div className="section-heading">
        <p className="eyebrow">Final State</p>
        <h2>Mint closed, metadata frozen, ownership renounced.</h2>
        <p className="section-copy">
          The final supply is 5,000 / 5,000. Artwork and JSON metadata remain available through <code>tokenURI()</code>.
        </p>
      </div>
      <MintPanel />
    </section>
  );
}
