import type { Metadata } from "next";
import { AgentIdentityForm } from "@/components/agent-identity-form";

export const metadata: Metadata = {
  title: "Mog Agent Identity | Monad Mogs",
  description: "Connect a wallet, generate an AgentURI, and register a Mog agent through ERC-8004.",
};

export default function AgentsPage() {
  return (
    <main>
      <section className="developer-hero agents-hero">
        <p className="eyebrow">Mog Identity</p>
        <h1>Agent Identity</h1>
        <p className="hero-line">
          Connect a wallet, choose a Mog, generate an AgentURI, and register the agent through the ERC-8004 Identity
          Registry on Monad.
        </p>
        <div className="hero-actions">
          <a className="text-link" href="/mogs/1">
            Sample Mog
          </a>
          <a className="text-link muted" href="/developers">
            Builder Kit
          </a>
          <a className="text-link muted" href="/llms.txt" target="_blank" rel="noreferrer">
            llms.txt
          </a>
        </div>
      </section>

      <section className="developer-section compact">
        <div className="section-heading">
          <p className="eyebrow">Identity v0</p>
          <h2>Bind an agent profile to a Monad Mog.</h2>
          <p className="section-copy">
            The AgentURI is served from <code>/api/agents/uri</code>. You can sign it locally first, then submit an
            ERC-8004 <code>register(agentURI)</code> transaction when ready.
          </p>
        </div>
        <AgentIdentityForm />
      </section>
    </main>
  );
}
