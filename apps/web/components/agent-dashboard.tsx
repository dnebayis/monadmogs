"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import type { AgentRegistration } from "@/lib/erc8004";
import { MONAD_EXPLORER_URL } from "@/lib/network";
import { API_BASE_URL } from "@/lib/urls";

export function AgentDashboard() {
  const { address, isConnected } = useAccount();
  const [registration, setRegistration] = useState<AgentRegistration | null>(null);

  useEffect(() => {
    if (!address) {
      setRegistration(null);
      return;
    }

    const saved = window.localStorage.getItem(`monad-mogs-agent:${address.toLowerCase()}`);
    setRegistration(saved ? (JSON.parse(saved) as AgentRegistration) : null);
  }, [address]);

  if (!isConnected) {
    return (
      <div className="agent-dashboard">
        <div className="agent-dashboard-empty">
          <p>Connect a wallet to view your registered agents.</p>
        </div>
      </div>
    );
  }

  if (!registration) {
    return (
      <div className="agent-dashboard">
        <div className="agent-dashboard-empty">
          <p>No agent registered yet.</p>
          <a className="text-link" href="#agents" onClick={() => document.getElementById("agent-register-toggle")?.click()}>
            Register your first agent
          </a>
        </div>
      </div>
    );
  }

  const isOnchain = Boolean(registration.txHash);
  const mogImageUrl = `${API_BASE_URL}/api/v0/mogs/${registration.mogId}/render`;
  const createdDate = new Date(registration.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="agent-dashboard">
      <div className="agent-dashboard-card">
        <div className="agent-dashboard-mog">
          <img src={mogImageUrl} alt={`Mog #${registration.mogId}`} />
        </div>
        <div className="agent-dashboard-info">
          <div className="agent-dashboard-header">
            <strong>{registration.agentName}</strong>
            <span className={isOnchain ? "agent-badge onchain" : "agent-badge signed"}>
              {isOnchain ? "Registered" : "Signed"}
            </span>
          </div>
          <div className="agent-dashboard-meta">
            <span>Mog #{registration.mogId}</span>
            <span>{createdDate}</span>
            <span>{registration.capabilities.length} capabilities</span>
          </div>
          <p className="agent-dashboard-strategy">{registration.strategy}</p>
          <div className="agent-dashboard-caps">
            {registration.capabilities.map((cap) => (
              <span key={cap}>{cap}</span>
            ))}
          </div>
          <div className="agent-dashboard-actions">
            {registration.txHash && (
              <a
                className="text-link muted"
                href={`${MONAD_EXPLORER_URL}/tx/${registration.txHash}`}
                target="_blank"
                rel="noreferrer"
              >
                View tx
              </a>
            )}
            <a className="text-link muted" href={registration.agentURI} target="_blank" rel="noreferrer">
              AgentURI
            </a>
            <a className="text-link muted" href={`/mogs/${registration.mogId}`}>
              Mog page
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
