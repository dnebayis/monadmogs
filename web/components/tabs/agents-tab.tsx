"use client";

import { useState } from "react";
import { AgentDashboard } from "@/components/agent-dashboard";
import { AgentIdentityForm } from "@/components/agent-identity-form";
import { CopyPrompt } from "@/components/copy-prompt";

const agentOnboardingPrompt = `read https://monadmogs.xyz/agent-prompt.txt and follow every step.
create a wallet, request a Mog NFT and gas from the owner, register on ERC-8004, and save all credentials locally.`;

export function AgentsTab() {
  const [showManualForm, setShowManualForm] = useState(false);

  return (
    <section className="tab-full">
      <div className="section-heading">
        <p className="eyebrow">ERC-8004 on Monad</p>
        <h2>Give your Mog an agent.</h2>
        <p className="section-copy">
          Copy the prompt below, give it to any AI agent (Claude, GPT, etc.), and it will create its own wallet, request a Mog from you, and register on ERC-8004 automatically.
        </p>
      </div>

      <div className="tab-block">
        <div className="tab-block-header">
          <p className="eyebrow">Agent Setup</p>
          <p className="tab-block-copy">Give this prompt to your AI agent. It handles the rest.</p>
        </div>
        <CopyPrompt text={agentOnboardingPrompt} label="Agent setup prompt" />

        <div className="endpoint-list" style={{ marginTop: 24 }}>
          <article className="endpoint-card">
            <span>1 / Prompt</span>
            <p>Copy the prompt above and paste it into Claude, GPT, or any AI agent tool.</p>
          </article>
          <article className="endpoint-card">
            <span>2 / Wallet</span>
            <p>The agent creates its own wallet and saves the private key locally in its directory.</p>
          </article>
          <article className="endpoint-card">
            <span>3 / Fund</span>
            <p>Transfer a Mog NFT and a small amount of MON to the agent's wallet address.</p>
          </article>
          <article className="endpoint-card">
            <span>4 / Register</span>
            <p>The agent calls ERC-8004 Identity Registry on Monad and registers itself onchain.</p>
          </article>
        </div>
      </div>

      <div className="tab-block">
        <div className="tab-block-header">
          <p className="eyebrow">Your Agents</p>
        </div>
        <AgentDashboard />
      </div>

      <div className="tab-block">
        <div className="tab-block-header">
          <p className="eyebrow">Manual Register</p>
          <p className="tab-block-copy">If you prefer to register from your own wallet instead of through an AI agent.</p>
        </div>
        <button
          type="button"
          className="secondary-action"
          onClick={() => setShowManualForm(!showManualForm)}
        >
          {showManualForm ? "Hide Manual Form" : "Show Manual Form"}
        </button>
        {showManualForm && (
          <div style={{ marginTop: 18 }}>
            <AgentIdentityForm />
          </div>
        )}
      </div>

      <div className="tab-block">
        <div className="tab-block-header">
          <p className="eyebrow">ERC-8004 Registries</p>
          <p className="tab-block-copy">Monad uses the same ERC-8004 contract addresses deployed across 25+ chains.</p>
        </div>
        <div className="endpoint-list">
          <article className="endpoint-card">
            <span>Identity Registry</span>
            <p>ERC-721 agent cards with AgentURI, metadata, and wallet management.</p>
            <code>0x8004A169FB4a3325136EB29fA0ceB6D2e539a432</code>
          </article>
          <article className="endpoint-card">
            <span>Reputation Registry</span>
            <p>Onchain feedback signals with tags, values, and dispute responses.</p>
            <code>0x8004BAa17C55a88189AE136b182e5fdA19dE9b63</code>
          </article>
          <article className="endpoint-card">
            <span>Validation Registry</span>
            <p>Third-party validation requests and responses. Coming soon.</p>
          </article>
        </div>
      </div>

      <div className="tab-block">
        <div className="tab-block-header">
          <p className="eyebrow">Agent API</p>
          <p className="tab-block-copy">Programmatic access to agent identities and ERC-8004 data.</p>
        </div>
        <div className="endpoint-list">
          <article className="endpoint-card">
            <span>AgentURI</span>
            <code>/api/agents/uri?owner=&#123;addr&#125;&mogId=&#123;id&#125;</code>
            <p>Generate a spec-compliant ERC-8004 AgentURI JSON document.</p>
          </article>
          <article className="endpoint-card">
            <span>Lookup</span>
            <code>/api/agents/lookup?agentId=&#123;id&#125;</code>
            <p>Read onchain tokenURI and agentWallet for a registered agent.</p>
          </article>
          <article className="endpoint-card">
            <span>Registries</span>
            <code>/api/agents/registries</code>
            <p>ERC-8004 contract addresses and chain info for Monad.</p>
          </article>
        </div>
      </div>

      <div className="tab-block">
        <div className="tab-block-header">
          <p className="eyebrow">Agent Chat</p>
          <p className="tab-block-copy">Talk to your Mog. Its personality, tone, and decisions reflect its traits and playstyle.</p>
        </div>
        <div className="agent-chat-preview">
          <div className="agent-chat-disabled">
            <p>Agent Chat is coming soon.</p>
            <p>Every Mog will have a unique persona derived from its 9 onchain traits. Chat with your agent, ask it about strategy, or just talk.</p>
          </div>
        </div>
      </div>

      <div className="tab-block">
        <div className="tab-block-header">
          <p className="eyebrow">What&rsquo;s Next</p>
          <p className="tab-block-copy">Agents will go beyond registration.</p>
        </div>
        <div className="endpoint-list">
          <article className="endpoint-card">
            <span>Trait Personas</span>
            <p>Every Mog has a unique persona derived from its 9 onchain traits. Agents behave accordingly.</p>
          </article>
          <article className="endpoint-card">
            <span>Agent Runners</span>
            <p>Persistent agent endpoints that act autonomously, respond to API calls, and interact with other agents.</p>
          </article>
          <article className="endpoint-card">
            <span>Reputation</span>
            <p>Agents earn reputation from game results, community interactions, and peer feedback via ERC-8004.</p>
          </article>
          <article className="endpoint-card">
            <span>Rarity Advantage</span>
            <p>Exact onchain rarity ranks are live. Rare+ Mogs unlock one capped Special Move, never a guaranteed win.</p>
          </article>
        </div>
      </div>

      <div className="hero-actions">
        <a className="text-link" href="https://docs.monad.xyz/guides/erc-8004" target="_blank" rel="noreferrer">
          Monad ERC-8004 Docs
        </a>
        <a className="text-link muted" href="https://eips.ethereum.org/EIPS/eip-8004" target="_blank" rel="noreferrer">
          EIP Spec
        </a>
        <a className="text-link muted" href="https://github.com/erc-8004/erc-8004-contracts" target="_blank" rel="noreferrer">
          Contracts
        </a>
        <a className="text-link muted" href="/api/agents/registries" target="_blank" rel="noreferrer">
          Registries API
        </a>
        <a className="text-link muted" href="/llms.txt" target="_blank" rel="noreferrer">
          llms.txt
        </a>
      </div>
    </section>
  );
}
