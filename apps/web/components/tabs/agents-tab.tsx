"use client";

import { useMemo, useState } from "react";
import { getAddress } from "viem";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { ConnectWalletButton } from "@/components/connect-wallet-button";
import { MONAD_MOGS_ABI, MONAD_MOGS_ADDRESS } from "@/lib/contract";
import { MOGS_8004_ADAPTER_ABI, MOGS_8004_ADAPTER_ADDRESS } from "@/lib/erc8004";
import { API_BASE_URL } from "@/lib/urls";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

type PersonaPreview = {
  name: string;
  tagline: string;
  backstory: string;
  communicationStyle: string;
  personalityTraits: string[];
};

function sameAddress(a?: string, b?: string) {
  if (!a || !b) return false;
  try {
    return getAddress(a) === getAddress(b);
  } catch {
    return false;
  }
}

export function AgentsTab() {
  const [mogIdInput, setMogIdInput] = useState("");
  const [preview, setPreview] = useState<PersonaPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const { address, isConnected } = useAccount();
  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract();

  const mogId = useMemo(() => {
    const parsed = Number(mogIdInput);
    return Number.isInteger(parsed) && parsed >= 1 && parsed <= 5000 ? parsed : null;
  }, [mogIdInput]);
  const adapterConfigured = !sameAddress(MOGS_8004_ADAPTER_ADDRESS, ZERO_ADDRESS);
  const metadataUrl = mogId ? `${API_BASE_URL}/api/agents/metadata/${mogId}` : "";

  const { data: mogOwner, isLoading: ownerLoading } = useReadContract({
    address: MONAD_MOGS_ADDRESS,
    abi: MONAD_MOGS_ABI,
    functionName: "ownerOf",
    args: mogId ? [BigInt(mogId)] : undefined,
    query: { enabled: Boolean(mogId) },
  });

  const ownsMog = sameAddress(address, mogOwner as string | undefined);
  const canRegister = Boolean(adapterConfigured && mogId && isConnected && ownsMog && metadataUrl && !isPending);

  async function loadPreview() {
    if (!mogId) return;
    setPreviewError(null);
    setPreview(null);
    const response = await fetch(`${API_BASE_URL}/api/tools/mog-persona`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mogId }),
    });
    const json = await response.json();
    if (!response.ok) {
      setPreviewError(json.error || "Persona preview failed.");
      return;
    }
    setPreview(json);
  }

  function registerAgent() {
    if (!mogId || !canRegister) return;
    writeContract({
      address: MOGS_8004_ADAPTER_ADDRESS,
      abi: MOGS_8004_ADAPTER_ABI,
      functionName: "registerMogAgent",
      args: [BigInt(mogId), metadataUrl],
    });
  }

  return (
    <section className="tab-full">
      <div className="section-heading">
        <p className="eyebrow">Awaken / Agent Registry</p>
        <h2>Mog ownership controls the agent.</h2>
        <p className="section-copy">
          New registrations use the Adapter8004 model: the adapter registers the ERC-8004 agent, keeps the agent NFT in adapter custody, and treats the current Mog owner as controller.
        </p>
        <p className="section-copy">
          Arena is legacy for now. The active flow is ERC-8004 identity, ERC-8217 binding, RESTAP metadata, and OpenSea agent visibility.
        </p>
      </div>

      <div className="tab-block">
        <div className="tab-block-header">
          <p className="eyebrow">Register</p>
          <p className="tab-block-copy">Enter a Mog you own, preview its deterministic persona, then awaken it onchain.</p>
        </div>

        <div className="endpoint-list">
          <article className="endpoint-card">
            <span>1 / Connect</span>
            <p>The connected wallet must currently own the Mog NFT.</p>
            <ConnectWalletButton />
          </article>
          <article className="endpoint-card">
            <span>2 / Mog ID</span>
            <input
              className="arena-input"
              inputMode="numeric"
              min={1}
              max={5000}
              placeholder="4354"
              value={mogIdInput}
              onChange={(event) => setMogIdInput(event.target.value)}
            />
            <p>
              {mogId
                ? ownerLoading
                  ? "Checking owner..."
                  : ownsMog
                    ? "Ownership verified for the connected wallet."
                    : "Connected wallet is not the current owner."
                : "Use a token id from 1 to 5000."}
            </p>
          </article>
          <article className="endpoint-card">
            <span>3 / AgentURI</span>
            <code>{metadataUrl || `${API_BASE_URL}/api/agents/metadata/{mogId}`}</code>
            <p>This becomes the ERC-8004 tokenURI after the adapter registers the agent.</p>
          </article>
        </div>

        <div className="hero-actions" style={{ marginTop: 24 }}>
          <button className="primary-link" type="button" disabled={!mogId} onClick={loadPreview}>
            Preview persona
          </button>
          <button className="primary-link" type="button" disabled={!canRegister} onClick={registerAgent}>
            {isPending ? "Confirm in wallet..." : "Awaken onchain"}
          </button>
        </div>

        {!adapterConfigured ? (
          <p className="section-copy" style={{ marginTop: 16 }}>
            Adapter address is not configured yet. Set <code>NEXT_PUBLIC_MOGS_8004_ADAPTER_ADDRESS</code> after deployment.
          </p>
        ) : null}
        {previewError ? <p className="section-copy">{previewError}</p> : null}
        {writeError ? <p className="section-copy">{writeError.message}</p> : null}
      </div>

      {preview ? (
        <div className="tab-block">
          <div className="tab-block-header">
            <p className="eyebrow">Persona Preview</p>
            <p className="tab-block-copy">{preview.name}</p>
          </div>
          <div className="endpoint-list">
            <article className="endpoint-card">
              <span>Tagline</span>
              <p>{preview.tagline}</p>
            </article>
            <article className="endpoint-card">
              <span>Style</span>
              <p>{preview.communicationStyle}</p>
            </article>
            <article className="endpoint-card">
              <span>Backstory</span>
              <p>{preview.backstory}</p>
            </article>
          </div>
        </div>
      ) : null}

      <div className="tab-block">
        <div className="tab-block-header">
          <p className="eyebrow">Registry APIs</p>
          <p className="tab-block-copy">Public agent data follows the awakened Mog model.</p>
        </div>
        <div className="endpoint-list">
          <article className="endpoint-card">
            <span>Count</span>
            <code>/api/agents/count</code>
          </article>
          <article className="endpoint-card">
            <span>Binding</span>
            <code>/api/agents/binding/&#123;mogId&#125;</code>
          </article>
          <article className="endpoint-card">
            <span>Metadata</span>
            <code>/api/agents/metadata/&#123;mogId&#125;</code>
          </article>
          <article className="endpoint-card">
            <span>RESTAP</span>
            <code>/api/agent-runtime/&#123;mogId&#125;/.well-known/restap.json</code>
          </article>
        </div>
      </div>

      {txHash && mogId ? (
        <div className="tab-block">
          <div className="tab-block-header">
            <p className="eyebrow">Submitted</p>
            <p className="tab-block-copy">After confirmation, these links should resolve for the awakened Mog.</p>
          </div>
          <div className="hero-actions">
            <a className="text-link" href={`${API_BASE_URL}/api/agents/binding/${mogId}`} target="_blank" rel="noreferrer">
              Binding API
            </a>
            <a className="text-link" href={metadataUrl} target="_blank" rel="noreferrer">
              AgentURI
            </a>
            <a className="text-link" href={`https://opensea.io/item/monad/${MONAD_MOGS_ADDRESS}/${mogId}`} target="_blank" rel="noreferrer">
              OpenSea item
            </a>
          </div>
          <code>{txHash}</code>
        </div>
      ) : null}

      <div className="tab-block">
        <div className="tab-block-header">
          <p className="eyebrow">Contracts</p>
          <p className="tab-block-copy">Legacy bindings remain readable, but new awakenings use the adapter.</p>
        </div>
        <div className="endpoint-list">
          <article className="endpoint-card">
            <span>Adapter8004</span>
            <code>{MOGS_8004_ADAPTER_ADDRESS}</code>
          </article>
          <article className="endpoint-card">
            <span>ERC-8004 Identity Registry</span>
            <code>0x8004A169FB4a3325136EB29fA0ceB6D2e539a432</code>
          </article>
          <article className="endpoint-card">
            <span>Monad Mogs NFT</span>
            <code>{MONAD_MOGS_ADDRESS}</code>
          </article>
        </div>
      </div>
    </section>
  );
}
