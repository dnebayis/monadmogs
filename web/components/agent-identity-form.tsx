"use client";

import { useEffect, useMemo, useState } from "react";
import { BaseError, createPublicClient, getAddress, http, stringToHex } from "viem";
import { useAccount, useReadContract, useSignMessage, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { MONAD_MOGS_ABI, MONAD_MOGS_ADDRESS } from "@/lib/contract";
import { ERC8004_IDENTITY_REGISTRY_ABI, ERC8004_IDENTITY_REGISTRY_ADDRESS } from "@/lib/erc8004";
import { MAX_SUPPLY, type MogMetadata } from "@/lib/mogs";
import { MONAD_CHAIN, MONAD_EXPLORER_URL, MONAD_RPC_URL } from "@/lib/network";
import { API_BASE_URL } from "@/lib/urls";

type AgentRegistration = {
  owner: string;
  mogId: number;
  agentName: string;
  strategy: string;
  capabilities: string[];
  agentURI: string;
  signature: string;
  txHash?: string;
  createdAt: string;
};

const CAPABILITIES = [
  "gmonad-chat",
  "trait-reader",
  "meme-engine",
  "arena-runner",
  "400ms-reaction",
  "finality-check",
  "mempool-scout",
  "remix-builder",
  "reserve-quest",
  "monad-lore",
  "svg-render",
  "agent-json",
];
const PLAYSTYLES = [
  {
    id: "parallel-runner",
    label: "Parallel Runner",
    description: "Fast and aggressive. Prefers quick moves, high tempo decisions, and 400ms reaction windows.",
  },
  {
    id: "finality-guardian",
    label: "Finality Guardian",
    description: "Careful and defensive. Waits for stronger signals, protects the Mog, and avoids sloppy risk.",
  },
  {
    id: "mempool-trickster",
    label: "Mempool Trickster",
    description: "Chaotic and meme-native. Uses surprise moves, social energy, and unpredictable routing.",
  },
  {
    id: "builder-mog",
    label: "Builder Mog",
    description: "Tool-focused. Explains decisions clearly and favors useful outputs for bots, games, and remix apps.",
  },
];
const OWNED_SCAN_BATCH = 250;
const client = createPublicClient({
  chain: MONAD_CHAIN,
  transport: http(MONAD_RPC_URL),
});

function parseCapabilities(values: Record<string, boolean>) {
  return Object.entries(values)
    .filter(([, enabled]) => enabled)
    .map(([capability]) => capability);
}

function registrationMessage(input: Omit<AgentRegistration, "signature" | "txHash" | "createdAt">) {
  return [
    "Monad Mogs Agent Identity v0",
    `Owner: ${input.owner}`,
    `Mog: ${input.mogId}`,
    `Agent: ${input.agentName}`,
    "Endpoint: none",
    `Capabilities: ${input.capabilities.join(", ") || "none"}`,
    `AgentURI: ${input.agentURI}`,
  ].join("\n");
}

function buildAgentURIUrl(input: Pick<AgentRegistration, "owner" | "mogId" | "agentName" | "capabilities" | "strategy">) {
  const params = new URLSearchParams({
    owner: input.owner,
    mogId: String(input.mogId),
    name: input.agentName,
    caps: input.capabilities.join(","),
    strategy: input.strategy,
  });
  return `${API_BASE_URL}/api/agents/uri?${params.toString()}`;
}

function getFriendlyError(caught: unknown) {
  if (caught instanceof BaseError) {
    const message = caught.shortMessage || caught.message;
    if (message.toLowerCase().includes("user rejected")) return "Request rejected in wallet.";
    return message;
  }
  if (caught instanceof Error) {
    if (caught.message.toLowerCase().includes("user rejected")) return "Request rejected in wallet.";
    return caught.message;
  }
  return "Request failed.";
}

function buildOnchainMetadata(input: Pick<AgentRegistration, "mogId" | "agentName" | "capabilities" | "strategy" | "agentURI">) {
  const detail = `${API_BASE_URL}/mogs/${input.mogId}`;
  const image = `${API_BASE_URL}/api/v0/mogs/${input.mogId}/render`;
  const metadata = `${API_BASE_URL}/api/v0/mogs/${input.mogId}`;

  return [
    { metadataKey: "project", metadataValue: stringToHex("Monad Mogs") },
    { metadataKey: "version", metadataValue: stringToHex("1.0.0") },
    { metadataKey: "category", metadataValue: stringToHex("onchain-collectible-agent") },
    { metadataKey: "pricing", metadataValue: stringToHex("free") },
    { metadataKey: "mogId", metadataValue: stringToHex(String(input.mogId)) },
    { metadataKey: "mogName", metadataValue: stringToHex(`Monad Mogs #${input.mogId}`) },
    { metadataKey: "mogDetail", metadataValue: stringToHex(detail) },
    { metadataKey: "mogImage", metadataValue: stringToHex(image) },
    { metadataKey: "mogMetadata", metadataValue: stringToHex(metadata) },
    { metadataKey: "agentName", metadataValue: stringToHex(input.agentName) },
    { metadataKey: "agentURI", metadataValue: stringToHex(input.agentURI) },
    { metadataKey: "image", metadataValue: stringToHex(image) },
    { metadataKey: "external_url", metadataValue: stringToHex(detail) },
    { metadataKey: "description", metadataValue: stringToHex(`${input.agentName} is a Monad Mogs agent identity.`) },
    { metadataKey: "capabilities", metadataValue: stringToHex(input.capabilities.join(",")) },
    { metadataKey: "strategy", metadataValue: stringToHex(input.strategy) },
  ];
}

export function AgentIdentityForm() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync, isPending } = useSignMessage();
  const { writeContractAsync, data: txHash, isPending: isWriting } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });
  const [mogId, setMogId] = useState("1");
  const [agentName, setAgentName] = useState("");
  const [strategy, setStrategy] = useState(PLAYSTYLES[0].description);
  const [capabilities, setCapabilities] = useState<Record<string, boolean>>({
    "gmonad-chat": true,
    "trait-reader": true,
    "agent-json": true,
  });
  const [mog, setMog] = useState<MogMetadata | null>(null);
  const [ownedMogs, setOwnedMogs] = useState<MogMetadata[]>([]);
  const [ownedScanCursor, setOwnedScanCursor] = useState(1);
  const [isLoadingOwned, setIsLoadingOwned] = useState(false);
  const [error, setError] = useState("");
  const [registration, setRegistration] = useState<AgentRegistration | null>(null);

  const numericMogId = Number(mogId);
  const selectedCapabilities = useMemo(() => parseCapabilities(capabilities), [capabilities]);
  const validMogId = Number.isInteger(numericMogId) && numericMogId >= 1 && numericMogId <= MAX_SUPPLY;
  const { data: mogOwner, isLoading: isOwnerLoading } = useReadContract({
    address: MONAD_MOGS_ADDRESS,
    abi: MONAD_MOGS_ABI,
    functionName: "ownerOf",
    args: validMogId ? [BigInt(numericMogId)] : undefined,
    query: {
      enabled: Boolean(address && validMogId),
    },
  });
  const { data: walletBalance } = useReadContract({
    address: MONAD_MOGS_ADDRESS,
    abi: MONAD_MOGS_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: Boolean(address),
    },
  });
  const ownsSelectedMog = Boolean(address && mogOwner && getAddress(mogOwner) === getAddress(address));

  const agentURI = useMemo(() => {
    if (!address || !validMogId || !ownsSelectedMog) return "";
    return buildAgentURIUrl({
      owner: address,
      mogId: numericMogId,
      agentName: agentName || `Mog Pilot #${numericMogId}`,
      capabilities: selectedCapabilities,
      strategy,
    });
  }, [address, agentName, numericMogId, ownsSelectedMog, selectedCapabilities, strategy, validMogId]);

  useEffect(() => {
    const tokenId = Number(mogId);
    if (!Number.isInteger(tokenId) || tokenId < 1 || tokenId > MAX_SUPPLY) {
      setMog(null);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/v0/mogs/${tokenId}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Mog metadata could not be loaded.");
        setMog((await response.json()) as MogMetadata);
      } catch (caught) {
        if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "Mog metadata could not be loaded.");
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [mogId]);

  useEffect(() => {
    if (!address) return;
    const saved = window.localStorage.getItem(`monad-mogs-agent:${address.toLowerCase()}`);
    setRegistration(saved ? (JSON.parse(saved) as AgentRegistration) : null);
    setOwnedMogs([]);
    setOwnedScanCursor(1);
  }, [address]);

  async function loadOwnedMogs() {
    if (!address || isLoadingOwned || ownedScanCursor > MAX_SUPPLY) return;

    setIsLoadingOwned(true);
    setError("");

    try {
      const start = ownedScanCursor;
      const end = Math.min(MAX_SUPPLY, start + OWNED_SCAN_BATCH - 1);
      const tokenIds = Array.from({ length: end - start + 1 }, (_, index) => start + index);
      const owners = await Promise.allSettled(
        tokenIds.map(async (tokenId) => {
          const owner = await client.readContract({
            address: MONAD_MOGS_ADDRESS,
            abi: MONAD_MOGS_ABI,
            functionName: "ownerOf",
            args: [BigInt(tokenId)],
          });
          return { tokenId, owner };
        }),
      );
      const ownedIds = owners.flatMap((result) =>
        result.status === "fulfilled" && getAddress(result.value.owner) === getAddress(address) ? [result.value.tokenId] : [],
      );
      const metadata = await Promise.allSettled(
        ownedIds.map(async (tokenId) => {
          const response = await fetch(`/api/v0/mogs/${tokenId}`);
          if (!response.ok) throw new Error(`Mog #${tokenId} metadata could not be loaded.`);
          return (await response.json()) as MogMetadata;
        }),
      );
      const loaded = metadata.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));

      setOwnedMogs((current) => {
        const known = new Set(current.map((item) => item.tokenId));
        return [...current, ...loaded.filter((item) => !known.has(item.tokenId))].sort((a, b) => a.tokenId - b.tokenId);
      });
      setOwnedScanCursor(end + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Owned Mogs could not be loaded.");
    } finally {
      setIsLoadingOwned(false);
    }
  }

  useEffect(() => {
    if (!address) return;
    void loadOwnedMogs();
  }, [address]);

  function selectOwnedMog(token: MogMetadata) {
    setMogId(String(token.tokenId));
    setMog(token);
  }

  function updateCapability(capability: string, enabled: boolean) {
    setCapabilities((current) => ({ ...current, [capability]: enabled }));
  }

  async function registerAgent() {
    setError("");

    if (!address) {
      setError("Connect a wallet first.");
      return;
    }
    if (!validMogId) {
      setError("Mog id must be between 1 and 5000.");
      return;
    }
    if (!ownsSelectedMog) {
      setError("Connected wallet does not own this Monad Mog.");
      return;
    }

    const nextAgentURI = buildAgentURIUrl({
      owner: address,
      mogId: numericMogId,
      agentName: agentName || `Mog Pilot #${numericMogId}`,
      capabilities: selectedCapabilities,
      strategy,
    });
    const unsigned = {
      owner: address,
      mogId: numericMogId,
      agentName: agentName || `Mog Pilot #${numericMogId}`,
      strategy,
      capabilities: selectedCapabilities,
      agentURI: nextAgentURI,
    };

    try {
      const signature = await signMessageAsync({ message: registrationMessage(unsigned) });

      const hash = await writeContractAsync({
        address: ERC8004_IDENTITY_REGISTRY_ADDRESS,
        abi: ERC8004_IDENTITY_REGISTRY_ABI,
        functionName: "register",
        args: [nextAgentURI, buildOnchainMetadata(unsigned)],
      });

      const nextRegistration: AgentRegistration = {
        ...unsigned,
        signature,
        txHash: hash,
        createdAt: new Date().toISOString(),
      };

      window.localStorage.setItem(`monad-mogs-agent:${address.toLowerCase()}`, JSON.stringify(nextRegistration));
      setRegistration(nextRegistration);
    } catch (caught) {
      setError(getFriendlyError(caught));
    }
  }

  const currentStep = !isConnected ? 1 : !ownsSelectedMog ? 2 : 3;
  const [showPreview, setShowPreview] = useState(false);

  return (
    <section className="agent-panel">
      <div className="agent-progress">
        <div className={`agent-progress-step ${currentStep >= 1 ? "active" : ""}`}>
          <span className="agent-progress-number">1</span>
          <span>Connect</span>
        </div>
        <div className="agent-progress-line" />
        <div className={`agent-progress-step ${currentStep >= 2 ? "active" : ""}`}>
          <span className="agent-progress-number">2</span>
          <span>Select Mog</span>
        </div>
        <div className="agent-progress-line" />
        <div className={`agent-progress-step ${currentStep >= 3 ? "active" : ""}`}>
          <span className="agent-progress-number">3</span>
          <span>Register</span>
        </div>
      </div>

      <div className="agent-wallet-bar">
        <div className={ownsSelectedMog ? "agent-note owned" : "agent-note"}>
          <span>Ownership</span>
          <p>
            {!isConnected
              ? "Connect wallet to verify ownership."
              : isOwnerLoading
                ? "Checking ownerOf on Monad..."
                : ownsSelectedMog
                  ? "Connected wallet owns this Mog."
                  : "Choose a Mog owned by this wallet."}
          </p>
        </div>
      </div>

      {isConnected && (
        <div className="agent-workspace">
          <div className="owned-mogs-picker">
            <div className="copy-prompt-top">
              <div>
                <span>Your Mogs</span>
                <small>
                  {walletBalance === undefined ? "connect wallet" : `${ownedMogs.length}/${walletBalance.toString()} loaded`}
                </small>
              </div>
              <label className="manual-mog-inline">
                <span>Token ID</span>
                <input value={mogId} onChange={(event) => setMogId(event.target.value)} inputMode="numeric" placeholder="1" />
              </label>
            </div>
            {ownedMogs.length ? (
              <div className="owned-mogs-grid">
                {ownedMogs.map((token) => (
                  <button
                    key={token.tokenId}
                    type="button"
                    className={Number(mogId) === token.tokenId ? "owned-mog-card active" : "owned-mog-card"}
                    onClick={() => selectOwnedMog(token)}
                  >
                    <img src={token.image} alt={token.name} />
                    <span>#{token.tokenId}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p>{isLoadingOwned ? "Scanning your wallet..." : "No owned Mogs loaded yet."}</p>
            )}
            <button
              className="secondary-action compact-action"
              type="button"
              onClick={loadOwnedMogs}
              disabled={!isConnected || isLoadingOwned || ownedScanCursor > MAX_SUPPLY}
            >
              {isLoadingOwned ? "Scanning..." : ownedScanCursor > MAX_SUPPLY ? "Scan complete" : "Scan more"}
            </button>
          </div>

          <div className={`agent-config ${!ownsSelectedMog ? "dimmed" : ""}`}>
            <div className="agent-top-grid">
              <div className="selected-mog-strip">
                <span>Selected</span>
                <p>{mog ? `${mog.name} is ready.` : "Pick one of your Mogs."}</p>
              </div>

              <label>
                <span>Agent name</span>
                <input value={agentName} onChange={(event) => setAgentName(event.target.value)} placeholder="Mog Pilot #1" disabled={!ownsSelectedMog} />
              </label>
            </div>

            <div className="agent-step">
              <span>Define Agent</span>
              <p>Choose a behavior profile and capability tags. AgentURI is generated in the background.</p>
            </div>

            <div className="playstyle-grid">
              {PLAYSTYLES.map((playstyle) => (
                <button
                  key={playstyle.id}
                  type="button"
                  className={strategy === playstyle.description ? "playstyle-card active" : "playstyle-card"}
                  onClick={() => setStrategy(playstyle.description)}
                  disabled={!ownsSelectedMog}
                >
                  <strong>{playstyle.label}</strong>
                  <span>{playstyle.description}</span>
                </button>
              ))}
            </div>

            <div className="agent-capabilities">
              <span>Capabilities</span>
              <p>Choose what this agent claims it can do. These become capability tags in the AgentURI.</p>
              <div>
                {CAPABILITIES.map((capability) => (
                  <label key={capability}>
                    <input
                      type="checkbox"
                      checked={Boolean(capabilities[capability])}
                      onChange={(event) => updateCapability(capability, event.target.checked)}
                      disabled={!ownsSelectedMog}
                    />
                    {capability}
                  </label>
                ))}
              </div>
            </div>

            {agentURI && (
              <div className="agent-preview-toggle">
                <button type="button" className="secondary-action compact-action" onClick={() => setShowPreview(!showPreview)}>
                  {showPreview ? "Hide preview" : "Preview AgentURI"}
                </button>
                {showPreview && (
                  <div className="agent-preview">
                    <pre className="code-block"><code>{agentURI}</code></pre>
                  </div>
                )}
              </div>
            )}

            <div className="agent-step">
              <span>Register</span>
              <p>Sign and submit the AgentURI to the ERC-8004 Identity Registry on Monad.</p>
            </div>

            <div className="agent-actions">
              <button
                className="primary-action"
                type="button"
                onClick={() => registerAgent()}
                disabled={!isConnected || !ownsSelectedMog || isPending || isWriting || isConfirming}
              >
                {isPending ? "Signing..." : isWriting ? "Check wallet..." : isConfirming ? "Confirming..." : "Register on ERC-8004"}
              </button>
            </div>

            {error ? <p className="error">{error}</p> : null}
            {txHash ? (
              <a className="tx-link" href={`${MONAD_EXPLORER_URL}/tx/${txHash}`} target="_blank" rel="noreferrer">
                {isConfirmed ? "ERC-8004 tx confirmed" : "View ERC-8004 tx"}
              </a>
            ) : null}

            {registration ? (
              <div className="agent-status">
                <span>Registered</span>
                <p>Agent identity was submitted to the ERC-8004 Identity Registry on Monad.</p>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
