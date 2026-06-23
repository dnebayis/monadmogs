"use client";

import { useEffect, useState, useCallback } from "react";
import { API_BASE_URL } from "@/lib/urls";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

type OnchainMatch = {
  id: number;
  status: string;
  player1: string;
  player2: string;
  entryFee: string;
  sponsorPrize: string;
  totalPrize: string;
  deadline: number;
  gameHash: string;
  nftPrize: { collection: string; tokenId: string };
  tokenPrize: { token: string; amount: string };
};

type Game = {
  id: string;
  type: string;
  status: string;
  bestOf: number;
  round: number;
  players?: { address: string; mogName: string; score: number }[];
  playerCount?: number;
  maxPlayers?: number;
  winner?: string;
  createdAt: string;
  finishedAt?: string;
};

type ResolveRecord = {
  status: "resolved" | "failed" | "cancelled" | null;
  matchId?: number;
  winnerAddress?: string | null;
  txHash?: string;
  error?: string;
  reason?: string;
};

type LeaderboardEntry = {
  address: string;
  mogName: string;
  wins: number;
  losses: number;
  reputation: number;
};

type BugReport = {
  id: string;
  createdAt: string;
  reporter: { address: string; agentId: number; mogId: number; mogName: string };
  category: string;
  severity: string;
  summary: string;
  details: string;
  gameId?: string;
  matchId?: number;
  txHash?: string;
  endpoint?: string;
};

type ArenaHealthIssue = {
  type: string;
  severity: "low" | "medium" | "high";
  gameId?: string;
  matchId?: number;
  status?: string | null;
  txHash?: string;
  error?: string;
  timestamp?: string;
  playerAddress?: string;
  activeGameIds?: string[];
  repair?: {
    strategy: "clear_waiting_games" | "manual_review_required";
    keepGameId: string | null;
    removableGameIds: string[];
    blockedGameIds: string[];
    requiresExplicitConfirmation: true;
  };
  suggestedNextAction: string;
};

type ArenaHealth = {
  checkedAt: string;
  arenaAddress: string;
  scanned: { recentGames: number; recentLimit: number; matchCount: number; matchLimit: number };
  counts: { total: number; high: number; medium: number; low: number };
  issues: ArenaHealthIssue[];
  suggestedNextAction: string;
};

/* ------------------------------------------------------------------ */
/*  Constants                                                           */
/* ------------------------------------------------------------------ */

const GAME_TYPES = ["coin-flip", "rock-paper-scissors", "dice-duel", "higher-lower"] as const;
const ZERO = "0x0000000000000000000000000000000000000000";

/* ------------------------------------------------------------------ */
/*  Admin Panel                                                         */
/* ------------------------------------------------------------------ */

export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [input, setInput] = useState("");
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<"health" | "games" | "matches" | "leaderboard" | "reports">("health");

  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginTime, setLoginTime] = useState<number | null>(null);

  // Restore session — re-validate against server on load
  useEffect(() => {
    const s = sessionStorage.getItem("admin_secret");
    if (!s) return;
    fetchJson(`${API_BASE_URL}/api/arena/admin`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-secret": s },
      body: JSON.stringify({ action: "game-hash", gameId: "ping" }),
    }).then(() => {
      setSecret(s);
      setAuthed(true);
      setLoginTime(Date.now());
    }).catch(() => sessionStorage.removeItem("admin_secret"));
  }, []);

  async function login() {
    if (!input) return;
    setLoginError("");
    setLoginLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/arena/admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-secret": input },
        body: JSON.stringify({ action: "game-hash", gameId: "ping" }),
      });
      if (res.status === 401) {
        setLoginError("Wrong secret.");
        setLoginLoading(false);
        return;
      }
      await readJson(res);
      sessionStorage.setItem("admin_secret", input);
      setSecret(input);
      setAuthed(true);
      setLoginTime(Date.now());
    } catch (caught) {
      setLoginError(errorMessage(caught, "Connection error."));
    }
    setLoginLoading(false);
  }

  function logout() {
    sessionStorage.removeItem("admin_secret");
    setSecret("");
    setAuthed(false);
  }

  if (!authed) {
    return (
      <div className="admin-login">
        <div className="admin-login-box">
          <p className="eyebrow">Admin</p>
          <h2>Monad Mogs Arena</h2>
          <input
            type="password"
            placeholder="Admin secret"
            value={input}
            onChange={(e) => { setInput(e.target.value); setLoginError(""); }}
            onKeyDown={(e) => e.key === "Enter" && login()}
            className="admin-input"
          />
          {loginError && <p className="admin-login-error">{loginError}</p>}
          <button className="primary-action" onClick={login} disabled={loginLoading}>
            {loginLoading ? "Checking…" : "Enter"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <span className="eyebrow">Arena Admin</span>
        {loginTime && (
          <span className="admin-session-time">
            session started {new Date(loginTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
        <button className="admin-logout" onClick={logout}>Sign out</button>
      </div>

      <div className="admin-tabs">
        {(["health", "games", "matches", "leaderboard", "reports"] as const).map((t) => (
          <button
            key={t}
            className={`admin-tab-btn ${tab === t ? "active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "health" && <HealthPanel secret={secret} onAuthFail={logout} />}
      {tab === "games" && <GamesPanel secret={secret} onAuthFail={logout} />}
      {tab === "matches" && <MatchesPanel secret={secret} onAuthFail={logout} />}
      {tab === "leaderboard" && <LeaderboardPanel secret={secret} onAuthFail={logout} />}
      {tab === "reports" && <ReportsPanel secret={secret} onAuthFail={logout} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Health Panel                                                        */
/* ------------------------------------------------------------------ */

function HealthPanel({ secret, onAuthFail }: { secret: string; onAuthFail: () => void }) {
  const [health, setHealth] = useState<ArenaHealth | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [repairMsg, setRepairMsg] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/arena/admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-secret": secret },
        body: JSON.stringify({ action: "arena-health", recentLimit: 50, matchLimit: 30 }),
      });
      if (res.status === 401) { onAuthFail(); return; }
      const data = await readJson<{ health?: ArenaHealth }>(res);
      setHealth(data.health || null);
    } catch (caught) {
      setLoadError(`Failed to load arena health: ${errorMessage(caught)}`);
    }
    setLoading(false);
  }, [secret, onAuthFail]);

  async function repairConflict(issue: ArenaHealthIssue) {
    if (!issue.playerAddress || !issue.repair?.keepGameId || issue.repair.removableGameIds.length === 0) return;
    const key = issue.playerAddress;
    setRepairMsg((current) => ({ ...current, [key]: "…" }));

    try {
      const res = await fetch(`${API_BASE_URL}/api/arena/admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-secret": secret },
        body: JSON.stringify({
          action: "repair-recovery-conflict",
          address: issue.playerAddress,
          keepGameId: issue.repair.keepGameId,
          removeFromGameIds: issue.repair.removableGameIds,
          confirm: "repair-recovery-conflict",
        }),
      });
      if (res.status === 401) { onAuthFail(); return; }
      const data = await readJson<{ repaired?: { repairedGames?: string[] } }>(res);
      const repairedCount = data.repaired?.repairedGames?.length || 0;
      setRepairMsg((current) => ({ ...current, [key]: `✓ repaired ${repairedCount}` }));
      load();
    } catch (caught) {
      setRepairMsg((current) => ({ ...current, [key]: `✗ ${errorMessage(caught)}` }));
    }
  }

  useEffect(() => {
    load();
    const interval = window.setInterval(load, 30_000);
    return () => window.clearInterval(interval);
  }, [load]);

  return (
    <div className="admin-panel">
      <div className="admin-section">
        <div className="admin-section-header">
          <p className="admin-section-title">Arena Health</p>
          <span className="admin-hint" style={{ marginLeft: 8, opacity: 0.5 }}>read-only, refreshes every 30s</span>
          <button className="admin-refresh" onClick={load}>{loading ? "…" : "↻"}</button>
        </div>

        {health && (
          <>
            <div className="admin-health-grid">
              <div className="admin-health-card"><strong>{health.counts.total}</strong><span>Total issues</span></div>
              <div className="admin-health-card high"><strong>{health.counts.high}</strong><span>High</span></div>
              <div className="admin-health-card medium"><strong>{health.counts.medium}</strong><span>Medium</span></div>
              <div className="admin-health-card low"><strong>{health.counts.low}</strong><span>Low</span></div>
            </div>
            <p className="admin-health-meta">
              Checked {new Date(health.checkedAt).toLocaleString()} · recent games {health.scanned.recentGames}/{health.scanned.recentLimit} · onchain matches scanned {health.scanned.matchLimit}
            </p>
          </>
        )}

        <div className="admin-table">
          <div className="admin-table-head health">
            <span>Severity</span><span>Type</span><span>Game</span><span>Match</span><span>Status</span><span>Next Action</span><span>Repair</span>
          </div>
          {(health?.issues || []).map((issue, index) => (
            <div key={`${issue.type}-${issue.gameId || issue.matchId || index}`} className="admin-table-row health">
              <span className={`admin-health-severity ${issue.severity}`}>{issue.severity}</span>
              <span>{issue.type.replaceAll("_", " ")}</span>
              <span>{issue.gameId ? <a href={`/arena/match/${issue.gameId}`} target="_blank" rel="noreferrer" className="admin-mono">{issue.gameId.slice(0, 8)}…</a> : "—"}</span>
              <span>{issue.matchId ? `#${issue.matchId}` : "—"}</span>
              <span>{issue.status || "—"}</span>
              <span title={issue.error || ""}>{issue.suggestedNextAction.replaceAll("_", " ")}</span>
              <span className="admin-actions">
                {issue.type === "recovery_conflict" && issue.playerAddress ? (
                  issue.repair?.strategy === "clear_waiting_games" && issue.repair.removableGameIds.length > 0 ? (
                    <>
                      <button className="admin-btn" onClick={() => repairConflict(issue)}>Repair</button>
                      {repairMsg[issue.playerAddress] && <span className="admin-msg-inline">{repairMsg[issue.playerAddress]}</span>}
                    </>
                  ) : (
                    <span className="admin-hint">
                      {issue.playerAddress.slice(0, 8)}… manual review
                    </span>
                  )
                ) : "—"}
              </span>
            </div>
          ))}
          {loadError && <p className="admin-empty admin-error">{loadError}</p>}
          {health && health.issues.length === 0 && !loading && <p className="admin-empty">No arena health issues found.</p>}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Reports Panel                                                       */
/* ------------------------------------------------------------------ */

function ReportsPanel({ secret, onAuthFail }: { secret: string; onAuthFail: () => void }) {
  const [reports, setReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/arena/admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-secret": secret },
        body: JSON.stringify({ action: "bug-reports", limit: 50 }),
      });
      if (res.status === 401) { onAuthFail(); return; }
      const data = await readJson<{ reports?: BugReport[] }>(res);
      setReports(data.reports || []);
    } catch (caught) {
      setLoadError(`Failed to load reports: ${errorMessage(caught)}`);
    }
    setLoading(false);
  }, [secret, onAuthFail]);

  useEffect(() => {
    load();
    const interval = window.setInterval(load, 30_000);
    return () => window.clearInterval(interval);
  }, [load]);

  return (
    <div className="admin-panel">
      <div className="admin-section">
        <div className="admin-section-header">
          <p className="admin-section-title">Agent Bug Reports</p>
          <button className="admin-refresh" onClick={load}>{loading ? "…" : "↻"}</button>
        </div>
        <div className="admin-report-list">
          {reports.map((report) => (
            <div key={report.id} className={`admin-report-card ${report.severity}`}>
              <div className="admin-report-top">
                <span className="admin-report-severity">{report.severity}</span>
                <span>{report.category}</span>
                <span>{new Date(report.createdAt).toLocaleString()}</span>
              </div>
              <strong>{report.summary}</strong>
              <p>{report.details}</p>
              <div className="admin-report-meta">
                <span>{report.reporter.mogName} / Agent #{report.reporter.agentId}</span>
                {report.gameId && <a href={`/arena/match/${report.gameId}`} target="_blank" rel="noreferrer">Game {report.gameId.slice(0, 8)}…</a>}
                {report.matchId && <span>Match #{report.matchId}</span>}
                {report.endpoint && <span>{report.endpoint}</span>}
              </div>
            </div>
          ))}
          {loadError && <p className="admin-empty admin-error">{loadError}</p>}
          {reports.length === 0 && !loading && <p className="admin-empty">No reports.</p>}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function toWei(mon: string): string {
  const trimmed = mon.trim();
  if (!trimmed) return "0";
  if (!/^\d+(\.\d{0,18})?$/.test(trimmed)) {
    throw new Error("Amount must be a non-negative decimal with at most 18 decimals.");
  }
  const [whole, fraction = ""] = trimmed.split(".");
  return (BigInt(whole || "0") * 10n ** 18n + BigInt(fraction.padEnd(18, "0"))).toString();
}

function toWeiPreview(mon: string): string {
  try {
    return toWei(mon);
  } catch {
    return "invalid amount";
  }
}

function fromWei(wei: string): string {
  return (Number(wei) / 1e18).toFixed(4);
}

function errorMessage(caught: unknown, fallback = "Request failed.") {
  return caught instanceof Error && caught.message ? caught.message : fallback;
}

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: unknown = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }

  if (!res.ok) {
    const record = data && typeof data === "object" ? data as Record<string, unknown> : {};
    const detail = String(record.error || record.message || record.detail || res.statusText || `HTTP ${res.status}`);
    throw new Error(`${detail} (${res.status})`);
  }

  return data as T;
}

async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  return readJson<T>(res);
}

/* ------------------------------------------------------------------ */
/*  Games Panel                                                         */
/* ------------------------------------------------------------------ */

type PrizeType = "mon" | "mon+nft" | "mon+mogs" | "mon+nft+mogs";

function GamesPanel({ secret, onAuthFail }: { secret: string; onAuthFail: () => void }) {
  const [games, setGames] = useState<Game[]>([]);
  const [resolves, setResolves] = useState<Record<string, ResolveRecord>>({});
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [loadError, setLoadError] = useState("");

  // Create game form — MON values (human-readable)
  const [gameType, setGameType] = useState<typeof GAME_TYPES[number]>("dice-duel");
  const [linked, setLinked] = useState(true);
  const [entryFeeMon, setEntryFeeMon] = useState("0.01");
  const [sponsorMon, setSponsorMon] = useState("0");
  const [prizeType, setPrizeType] = useState<PrizeType>("mon");

  // NFT prize
  const [nftCollection, setNftCollection] = useState("");
  const [nftTokenId, setNftTokenId] = useState("");

  // $MOGS prize
  const [mogsAmount, setMogsAmount] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [recent, open] = await Promise.all([
        fetchJson<{ games?: Game[] }>(`${API_BASE_URL}/api/arena?view=recent`),
        fetchJson<{ games?: Game[] }>(`${API_BASE_URL}/api/arena?view=open`),
      ]);
      const all: Game[] = [...(recent.games || []), ...(open.games || [])];
      const seen = new Set<string>();
      const deduped = all.filter((g) => { if (seen.has(g.id)) return false; seen.add(g.id); return true; });
      deduped.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setGames(deduped.slice(0, 30));

      const finishedIds = deduped.filter((g) => g.status === "finished").map((g) => g.id);
      const resolveResults = await Promise.all(
        finishedIds.map(async (id) => {
          const data = await fetchJson<{ resolve?: ResolveRecord }>(`${API_BASE_URL}/api/arena/games?id=${id}`);
          return { id, resolve: data.resolve };
        })
      );
      const resolveMap: Record<string, ResolveRecord> = {};
      for (const { id, resolve } of resolveResults) {
        if (resolve) resolveMap[id] = resolve;
      }
      setResolves(resolveMap);
    } catch (caught) {
      setLoadError(`Failed to load games: ${errorMessage(caught)}`);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const interval = window.setInterval(load, 10_000);
    return () => window.clearInterval(interval);
  }, [load]);

  async function createGame() {
    setMsg("");

    try {
      if (!linked) {
        const res = await fetch(`${API_BASE_URL}/api/arena/games`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-admin-secret": secret },
          body: JSON.stringify({ action: "create", type: gameType }),
        });
        if (res.status === 401) { onAuthFail(); return; }
        const data = await readJson<{ game?: { id?: string } }>(res);
        setMsg(`✓ Game created (offchain): ${data.game?.id}`);
        load();
        return;
      }

      const entryFeeWei = toWei(entryFeeMon);
      const sponsorMonWei = toWei(sponsorMon);
      const hasNft = prizeType === "mon+nft" || prizeType === "mon+nft+mogs";
      const hasMogs = prizeType === "mon+mogs" || prizeType === "mon+nft+mogs";

      if (hasNft && (!nftCollection || !nftTokenId)) {
        setMsg("NFT collection address and token ID are required."); return;
      }
      if (hasMogs && !mogsAmount) {
        setMsg("$MOGS amount is required."); return;
      }

      let action: string;
      const body: Record<string, unknown> = {
        type: gameType,
        entryFee: entryFeeWei,
        sponsorMon: sponsorMonWei,
      };

      if (hasNft && hasMogs) {
        action = "create-linked-game-nft-mogs";
        body.nftCollection = nftCollection;
        body.nftTokenId = nftTokenId;
        body.mogsAmount = toWei(mogsAmount);
      } else if (hasNft) {
        action = "create-linked-game-nft";
        body.nftCollection = nftCollection;
        body.nftTokenId = nftTokenId;
      } else if (hasMogs) {
        action = "create-linked-game-mogs";
        body.mogsAmount = toWei(mogsAmount);
      } else {
        action = "create-linked-game";
      }

      body.action = action;

      const res = await fetch(`${API_BASE_URL}/api/arena/admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-secret": secret },
        body: JSON.stringify(body),
      });
      if (res.status === 401) { onAuthFail(); return; }
      const data = await readJson<{ game?: { id?: string }; matchId?: number; txHash?: string }>(res);
      setMsg(`✓ Game created: ${data.game?.id} | Match #${data.matchId} | tx: ${data.txHash?.slice(0, 12)}…`);
      load();
    } catch (caught) {
      setMsg(`Error: ${errorMessage(caught, "Connection error — check network and retry.")}`);
    }
  }

  const hasNft = prizeType === "mon+nft" || prizeType === "mon+nft+mogs";
  const hasMogs = prizeType === "mon+mogs" || prizeType === "mon+nft+mogs";

  return (
    <div className="admin-panel">
      <div className="admin-section">
        <p className="admin-section-title">Create Game</p>

        <div className="admin-form-row">
          <label>Game Type</label>
          <select value={gameType} onChange={(e) => setGameType(e.target.value as typeof GAME_TYPES[number])} className="admin-select">
            {GAME_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="admin-form-row">
          <label>Linked (onchain)</label>
          <input type="checkbox" checked={linked} onChange={(e) => setLinked(e.target.checked)} />
          <span className="admin-hint">Offchain-only if unchecked — no prize contract</span>
        </div>

        {linked && (
          <>
            <div className="admin-form-divider" />

            <div className="admin-form-row">
              <label>Entry Fee</label>
              <input
                className="admin-input-sm"
                value={entryFeeMon}
                onChange={(e) => setEntryFeeMon(e.target.value)}
                placeholder="0.01"
              />
              <span className="admin-hint">MON &nbsp;→ {toWeiPreview(entryFeeMon)} wei</span>
            </div>

            <div className="admin-form-row">
              <label>Sponsor Prize</label>
              <input
                className="admin-input-sm"
                value={sponsorMon}
                onChange={(e) => setSponsorMon(e.target.value)}
                placeholder="0"
              />
              <span className="admin-hint">MON &nbsp;→ {toWeiPreview(sponsorMon)} wei</span>
            </div>

            <div className="admin-form-divider" />

            <div className="admin-form-row">
              <label>Prize Type</label>
              <div className="admin-prize-options">
                {(["mon", "mon+nft", "mon+mogs", "mon+nft+mogs"] as PrizeType[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`admin-prize-btn ${prizeType === p ? "active" : ""}`}
                    onClick={() => setPrizeType(p)}
                  >
                    {p === "mon" ? "MON only" : p === "mon+nft" ? "MON + NFT" : p === "mon+mogs" ? "MON + $MOGS" : "MON + NFT + $MOGS"}
                  </button>
                ))}
              </div>
            </div>

            {hasNft && (
              <>
                <div className="admin-form-row">
                  <label>NFT Collection</label>
                  <input
                    className="admin-input-sm admin-input-wide"
                    value={nftCollection}
                    onChange={(e) => setNftCollection(e.target.value)}
                    placeholder="0x1414f3BAF22404C42fD656af4aFAab4934045137"
                  />
                </div>
                <div className="admin-form-row">
                  <label>NFT Token ID</label>
                  <input
                    className="admin-input-sm"
                    value={nftTokenId}
                    onChange={(e) => setNftTokenId(e.target.value)}
                    placeholder="42"
                  />
                  <span className="admin-hint">Arena wallet must own this NFT</span>
                </div>
              </>
            )}

            {hasMogs && (
              <div className="admin-form-row">
                <label>$MOGS Amount</label>
                <input
                  className="admin-input-sm"
                  value={mogsAmount}
                  onChange={(e) => setMogsAmount(e.target.value)}
                  placeholder="1000"
                />
                <span className="admin-hint">$MOGS &nbsp;→ {mogsAmount ? toWeiPreview(mogsAmount) : "0"} wei &nbsp;(Arena wallet must hold this)</span>
              </div>
            )}
          </>
        )}

        <div className="admin-form-row" style={{ marginTop: 8 }}>
          <button className="primary-action" onClick={createGame} style={{ minHeight: 40 }}>
            Create Game
          </button>
        </div>
        {msg && <p className="admin-msg">{msg}</p>}
      </div>

      <div className="admin-section">
        <div className="admin-section-header">
          <p className="admin-section-title">Recent Games</p>
          <button className="admin-refresh" onClick={load}>{loading ? "…" : "↻"}</button>
        </div>
        <div className="admin-table">
          <div className="admin-table-head">
            <span>ID</span><span>Type</span><span>Status</span><span>Round</span><span>Players</span><span>Resolve</span><span>Actions</span>
          </div>
          {games.map((g) => {
            const resolve = resolves[g.id];
            const players = g.players || [];
            const playerCount = g.playerCount ?? players.length;
            const maxPlayers = g.maxPlayers ?? 2;
            return (
              <div key={g.id} className="admin-table-row">
                <span className="admin-mono">{g.id.slice(0, 8)}</span>
                <span>{g.type}</span>
                <span className={`admin-status ${g.status}`}>{g.status}</span>
                <span>{g.round}</span>
                <span className="admin-players">
                  {players.length
                    ? players.map((p) => (
                        <span key={p.address} className={g.winner === p.address ? "admin-winner" : ""}>
                          {p.mogName} ({p.score})
                        </span>
                      ))
                    : `${playerCount}/${maxPlayers}`}
                </span>
                <span>
                  {resolve ? (
                    <span className={`admin-resolve-badge ${resolve.status || "pending"}`} title={resolve.reason || ""}>
                      {resolve.status === "resolved"
                        ? `✓ ${resolve.txHash?.slice(0, 8)}…`
                        : resolve.status === "failed"
                          ? "✗ failed"
                          : resolve.status === "cancelled"
                            ? "cancelled"
                            : resolve.matchId
                              ? `pending #${resolve.matchId}`
                              : "offchain"}
                    </span>
                  ) : g.status === "finished" ? "—" : ""}
                </span>
                <span className="admin-actions">
                  <a href={`/arena/match/${g.id}`} target="_blank" rel="noreferrer" className="admin-btn">View</a>
                </span>
              </div>
            );
          })}
          {loadError && <p className="admin-empty admin-error">{loadError}</p>}
          {games.length === 0 && !loading && <p className="admin-empty">No games.</p>}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Matches Panel                                                       */
/* ------------------------------------------------------------------ */

function MatchesPanel({ secret, onAuthFail }: { secret: string; onAuthFail: () => void }) {
  const [matches, setMatches] = useState<OnchainMatch[]>([]);
  const [failedResolves, setFailedResolves] = useState<{ gameId: string; error: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<Record<number, string>>({});
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [matchData, recentData] = await Promise.all([
        fetchJson<{ matches?: OnchainMatch[] }>(`${API_BASE_URL}/api/arena?view=matches`),
        fetchJson<{ games?: { id: string; status: string }[] }>(`${API_BASE_URL}/api/arena?view=recent`),
      ]);
      setMatches(matchData.matches || []);

      // Check recent finished games for failed resolve records
      const finished: { id: string }[] = (recentData.games || []).filter((g) => g.status === "finished");
      const failed: { gameId: string; error: string }[] = [];
      await Promise.all(
        finished.slice(0, 20).map(async (g: { id: string }) => {
          try {
            const d = await fetchJson<{ resolve?: ResolveRecord }>(`${API_BASE_URL}/api/arena/games?id=${g.id}`);
            if (d.resolve?.status === "failed") {
              failed.push({ gameId: g.id, error: d.resolve.error || "Unknown error" });
            }
          } catch { /* ignore */ }
        })
      );
      setFailedResolves(failed);
    } catch (caught) {
      setLoadError(`Failed to load matches: ${errorMessage(caught)}`);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const interval = window.setInterval(load, 15_000);
    return () => window.clearInterval(interval);
  }, [load]);

  async function adminAction(action: string, matchId: number, extra?: Record<string, unknown>) {
    setMsg((m) => ({ ...m, [matchId]: "…" }));
    try {
      const res = await fetch(`${API_BASE_URL}/api/arena/admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-secret": secret },
        body: JSON.stringify({ action, matchId, ...extra }),
      });
      if (res.status === 401) { onAuthFail(); return; }
      const data = await readJson<{ txHash?: string }>(res);
      setMsg((m) => ({ ...m, [matchId]: `✓ ${data.txHash?.slice(0, 10) || "ok"}` }));
      load();
    } catch (caught) {
      setMsg((m) => ({ ...m, [matchId]: `✗ ${errorMessage(caught, "Connection error")}` }));
    }
  }

  function resolveWithWinner(matchId: number, match: OnchainMatch) {
    const winner = window.prompt(`Winner address for match #${matchId}:`, match.player1);
    if (!winner) return;
    adminAction("resolve-match", matchId, { winner });
  }

  return (
    <div className="admin-panel">
      <div className="admin-section">
        <div className="admin-section-header">
          <p className="admin-section-title">Onchain Matches</p>
          <span className="admin-hint" style={{ marginLeft: 8, opacity: 0.5 }}>auto-refreshes every 15s</span>
          <button className="admin-refresh" onClick={load}>{loading ? "…" : "↻"}</button>
        </div>
        {failedResolves.length > 0 && (
          <div className="admin-alert" style={{ background: "#3a1515", border: "1px solid #ff4444", borderRadius: 8, padding: "12px 16px", marginBottom: 16 }}>
            <strong style={{ color: "#ff6666" }}>⚠ Failed Onchain Settlements ({failedResolves.length})</strong>
            {failedResolves.map((f) => (
              <div key={f.gameId} style={{ marginTop: 8, fontSize: 13, color: "#ffaaaa" }}>
                Game {f.gameId.slice(0, 8)}… — {f.error}
                <a href={`/arena/match/${f.gameId}`} target="_blank" rel="noreferrer" className="admin-btn" style={{ marginLeft: 8 }}>View</a>
              </div>
            ))}
          </div>
        )}
        <div className="admin-table">
          <div className="admin-table-head matches">
            <span>#</span><span>Status</span><span>P1</span><span>P2</span><span>Entry</span><span>Prize</span><span>Deadline</span><span>Actions</span>
          </div>
          {matches.map((m) => {
            const expired = Date.now() / 1000 > m.deadline && (m.status === "open" || m.status === "full");
            const hasNft = m.nftPrize.collection !== ZERO;
            const hasToken = m.tokenPrize.amount !== "0";
            return (
              <div key={m.id} className={`admin-table-row matches ${expired ? "expired" : ""}`}>
                <span className="admin-mono">#{m.id}</span>
                <span className={`admin-status ${m.status}`}>{m.status}{expired ? " ⚠️" : ""}</span>
                <span className="admin-mono admin-addr">{m.player1 === ZERO ? "—" : m.player1.slice(0, 8)}</span>
                <span className="admin-mono admin-addr">{m.player2 === ZERO ? "—" : m.player2.slice(0, 8)}</span>
                <span>{fromWei(m.entryFee)} MON</span>
                <span>
                  {fromWei(m.sponsorPrize)} MON
                  {hasNft && <span className="admin-prize-tag">NFT #{m.nftPrize.tokenId}</span>}
                  {hasToken && <span className="admin-prize-tag">{(Number(m.tokenPrize.amount) / 1e18).toFixed(0)} $MOGS</span>}
                </span>
                <span>{new Date(m.deadline * 1000).toLocaleTimeString()}</span>
                <span className="admin-actions">
                  {m.status === "full" && (
                    <>
                      <button className="admin-btn green" onClick={() => resolveWithWinner(m.id, m)}>Resolve</button>
                      <button className="admin-btn" onClick={() => adminAction("resolve-draw", m.id)}>Draw</button>
                    </>
                  )}
                  {(m.status === "open" || m.status === "full") && (
                    <button className="admin-btn red" onClick={() => adminAction("cancel-match", m.id)}>Cancel</button>
                  )}
                  {expired && (
                    <button className="admin-btn" onClick={() => adminAction("expire-match", m.id)}>Expire</button>
                  )}
                  {msg[m.id] && <span className="admin-msg-inline">{msg[m.id]}</span>}
                </span>
              </div>
            );
          })}
          {loadError && <p className="admin-empty admin-error">{loadError}</p>}
          {matches.length === 0 && !loading && <p className="admin-empty">No matches.</p>}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Leaderboard Panel                                                   */
/* ------------------------------------------------------------------ */

function LeaderboardPanel({ secret, onAuthFail }: { secret: string; onAuthFail: () => void }) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchJson<{ leaderboard?: LeaderboardEntry[] }>(`${API_BASE_URL}/api/arena?view=leaderboard`);
      setEntries(data.leaderboard || []);
    } catch (caught) {
      setMsg(`Failed to load leaderboard: ${errorMessage(caught)}`);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function resetLb() {
    if (!window.confirm("Reset leaderboard? This deletes all reputation and game history from KV.")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/arena/admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-secret": secret },
        body: JSON.stringify({ action: "reset-leaderboard" }),
      });
      if (res.status === 401) { onAuthFail(); return; }
      await readJson(res);
      setMsg("✓ Leaderboard reset.");
      load();
    } catch (caught) {
      setMsg(`✗ ${errorMessage(caught)}`);
    }
  }

  return (
    <div className="admin-panel">
      <div className="admin-section">
        <div className="admin-section-header">
          <p className="admin-section-title">Leaderboard</p>
          <button className="admin-refresh" onClick={load}>{loading ? "…" : "↻"}</button>
        </div>
        <div className="admin-table">
          <div className="admin-table-head leaderboard">
            <span>#</span><span>Mog</span><span>Address</span><span>Rep</span><span>W</span><span>L</span>
          </div>
          {entries.map((e, i) => (
            <div key={e.address} className="admin-table-row leaderboard">
              <span>{i + 1}</span>
              <span>{e.mogName}</span>
              <span className="admin-mono admin-addr">{e.address.slice(0, 10)}…</span>
              <span className="admin-rep">{e.reputation}</span>
              <span>{e.wins}</span>
              <span>{e.losses}</span>
            </div>
          ))}
          {entries.length === 0 && !loading && <p className="admin-empty">No entries.</p>}
        </div>
        <div style={{ marginTop: 24, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button className="admin-btn" onClick={async () => {
            setMsg("Recalculating…");
            try {
              const res = await fetch(`${API_BASE_URL}/api/arena/admin`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-admin-secret": secret },
                body: JSON.stringify({ action: "recalculate-reputation" }),
              });
              if (res.status === 401) { onAuthFail(); return; }
              const data = await readJson<{ updated?: number }>(res);
              setMsg(`✓ Updated ${data.updated ?? 0} entries.`);
              load();
            } catch (caught) {
              setMsg(`✗ ${errorMessage(caught)}`);
            }
          }}>Recalculate Reputation</button>
          <button className="admin-btn red" onClick={resetLb}>Reset Leaderboard</button>
          {msg && <p className="admin-msg">{msg}</p>}
        </div>
      </div>
    </div>
  );
}
