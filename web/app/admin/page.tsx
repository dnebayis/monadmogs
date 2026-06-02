"use client";

import { useEffect, useState, useCallback } from "react";

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
  players: { address: string; mogName: string; score: number }[];
  winner?: string;
  createdAt: string;
  finishedAt?: string;
};

type ResolveRecord = {
  status: "resolved" | "failed";
  matchId?: number;
  winnerAddress?: string | null;
  txHash?: string;
  error?: string;
};

type LeaderboardEntry = {
  address: string;
  mogName: string;
  wins: number;
  losses: number;
  reputation: number;
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
  const [tab, setTab] = useState<"games" | "matches" | "leaderboard">("games");

  // Load secret from sessionStorage
  useEffect(() => {
    const s = sessionStorage.getItem("admin_secret");
    if (s) { setSecret(s); setAuthed(true); }
  }, []);

  function login() {
    sessionStorage.setItem("admin_secret", input);
    setSecret(input);
    setAuthed(true);
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
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
            className="admin-input"
          />
          <button className="primary-action" onClick={login}>Enter</button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <span className="eyebrow">Arena Admin</span>
        <button className="admin-logout" onClick={logout}>Sign out</button>
      </div>

      <div className="admin-tabs">
        {(["games", "matches", "leaderboard"] as const).map((t) => (
          <button
            key={t}
            className={`admin-tab-btn ${tab === t ? "active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "games" && <GamesPanel secret={secret} onAuthFail={logout} />}
      {tab === "matches" && <MatchesPanel secret={secret} onAuthFail={logout} />}
      {tab === "leaderboard" && <LeaderboardPanel secret={secret} onAuthFail={logout} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Games Panel                                                         */
/* ------------------------------------------------------------------ */

function GamesPanel({ secret, onAuthFail }: { secret: string; onAuthFail: () => void }) {
  const [games, setGames] = useState<Game[]>([]);
  const [resolves, setResolves] = useState<Record<string, ResolveRecord>>({});
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // Create game form state
  const [gameType, setGameType] = useState<typeof GAME_TYPES[number]>("dice-duel");
  const [linked, setLinked] = useState(true);
  const [entryFee, setEntryFee] = useState("10000000000000000"); // 0.01 MON in wei
  const [sponsorMon, setSponsorMon] = useState("0");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [recentRes, openRes] = await Promise.all([
        fetch("/api/arena?view=recent"),
        fetch("/api/arena?view=open"),
      ]);
      const recent = await recentRes.json();
      const open = await openRes.json();
      const all: Game[] = [...(recent.games || []), ...(open.games || [])];
      // Deduplicate
      const seen = new Set<string>();
      const deduped = all.filter((g) => { if (seen.has(g.id)) return false; seen.add(g.id); return true; });
      deduped.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setGames(deduped.slice(0, 30));

      // Fetch resolve status for finished games
      const finishedIds = deduped.filter((g) => g.status === "finished").map((g) => g.id);
      const resolveResults = await Promise.all(
        finishedIds.map(async (id) => {
          const r = await fetch(`/api/arena/games?id=${id}`);
          const data = await r.json();
          return { id, resolve: data.resolve };
        })
      );
      const resolveMap: Record<string, ResolveRecord> = {};
      for (const { id, resolve } of resolveResults) {
        if (resolve) resolveMap[id] = resolve;
      }
      setResolves(resolveMap);
    } catch {
      setMsg("Failed to load games.");
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createGame() {
    setMsg("");
    const action = linked ? "create-linked-game" : "create";
    const body = linked
      ? { action, type: gameType, entryFee, sponsorMon }
      : { action, type: gameType };

    const endpoint = linked ? "/api/arena/admin" : "/api/arena/games";
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (linked) headers["x-admin-secret"] = secret;
    else headers["x-admin-secret"] = secret;

    const res = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(body) });
    if (res.status === 401) { onAuthFail(); return; }
    const data = await res.json();
    if (data.error) { setMsg(`Error: ${data.error}`); return; }
    setMsg(`✓ Game created: ${data.game?.id || "ok"}${data.matchId ? ` (Match #${data.matchId})` : ""}`);
    load();
  }

  return (
    <div className="admin-panel">
      <div className="admin-section">
        <p className="admin-section-title">Create Game</p>
        <div className="admin-form-row">
          <label>Type</label>
          <select value={gameType} onChange={(e) => setGameType(e.target.value as typeof GAME_TYPES[number])} className="admin-select">
            {GAME_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="admin-form-row">
          <label>Linked (onchain)</label>
          <input type="checkbox" checked={linked} onChange={(e) => setLinked(e.target.checked)} />
        </div>
        {linked && (
          <>
            <div className="admin-form-row">
              <label>Entry Fee (wei)</label>
              <input className="admin-input-sm" value={entryFee} onChange={(e) => setEntryFee(e.target.value)} />
              <span className="admin-hint">{(Number(entryFee) / 1e18).toFixed(4)} MON</span>
            </div>
            <div className="admin-form-row">
              <label>Sponsor MON (wei)</label>
              <input className="admin-input-sm" value={sponsorMon} onChange={(e) => setSponsorMon(e.target.value)} />
              <span className="admin-hint">{(Number(sponsorMon) / 1e18).toFixed(4)} MON</span>
            </div>
          </>
        )}
        <button className="primary-action" onClick={createGame}>Create</button>
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
            return (
              <div key={g.id} className="admin-table-row">
                <span className="admin-mono">{g.id.slice(0, 8)}</span>
                <span>{g.type}</span>
                <span className={`admin-status ${g.status}`}>{g.status}</span>
                <span>{g.round}</span>
                <span className="admin-players">
                  {g.players.map((p) => (
                    <span key={p.address} className={g.winner === p.address ? "admin-winner" : ""}>
                      {p.mogName} ({p.score})
                    </span>
                  ))}
                </span>
                <span>
                  {resolve ? (
                    <span className={`admin-resolve-badge ${resolve.status}`}>
                      {resolve.status === "resolved"
                        ? `✓ ${resolve.txHash?.slice(0, 8)}…`
                        : `✗ failed`}
                    </span>
                  ) : g.status === "finished" ? "—" : ""}
                </span>
                <span className="admin-actions">
                  <a href={`/arena/match/${g.id}`} target="_blank" rel="noreferrer" className="admin-btn">View</a>
                </span>
              </div>
            );
          })}
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
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/arena?view=matches");
      const data = await res.json();
      setMatches(data.matches || []);
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function adminAction(action: string, matchId: number, extra?: Record<string, unknown>) {
    setMsg((m) => ({ ...m, [matchId]: "…" }));
    const res = await fetch("/api/arena/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-secret": secret },
      body: JSON.stringify({ action, matchId, ...extra }),
    });
    if (res.status === 401) { onAuthFail(); return; }
    const data = await res.json();
    if (data.error) {
      setMsg((m) => ({ ...m, [matchId]: `✗ ${data.error}` }));
    } else {
      setMsg((m) => ({ ...m, [matchId]: `✓ ${data.txHash?.slice(0, 10) || "ok"}` }));
      load();
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
          <button className="admin-refresh" onClick={load}>{loading ? "…" : "↻"}</button>
        </div>
        <div className="admin-table">
          <div className="admin-table-head">
            <span>#</span><span>Status</span><span>P1</span><span>P2</span><span>Entry</span><span>Prize</span><span>Deadline</span><span>Actions</span>
          </div>
          {matches.map((m) => {
            const expired = Date.now() / 1000 > m.deadline && (m.status === "open" || m.status === "full");
            const hasNft = m.nftPrize.collection !== ZERO;
            const hasToken = m.tokenPrize.amount !== "0";
            return (
              <div key={m.id} className={`admin-table-row ${expired ? "expired" : ""}`}>
                <span className="admin-mono">#{m.id}</span>
                <span className={`admin-status ${m.status}`}>{m.status}{expired ? " ⚠️" : ""}</span>
                <span className="admin-mono admin-addr">{m.player1 === ZERO ? "—" : m.player1.slice(0, 8)}</span>
                <span className="admin-mono admin-addr">{m.player2 === ZERO ? "—" : m.player2.slice(0, 8)}</span>
                <span>{(Number(m.entryFee) / 1e18).toFixed(4)}</span>
                <span>
                  {(Number(m.sponsorPrize) / 1e18).toFixed(4)} MON
                  {hasNft && " + NFT"}
                  {hasToken && ` + ${(Number(m.tokenPrize.amount) / 1e18).toFixed(0)} $MOGS`}
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
    const res = await fetch("/api/arena?view=leaderboard");
    const data = await res.json();
    setEntries(data.leaderboard || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function resetLb() {
    if (!window.confirm("Reset leaderboard? This deletes all reputation and game history from KV.")) return;
    const res = await fetch("/api/arena/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-secret": secret },
      body: JSON.stringify({ action: "reset-leaderboard" }),
    });
    if (res.status === 401) { onAuthFail(); return; }
    const data = await res.json();
    setMsg(data.error ? `✗ ${data.error}` : "✓ Leaderboard reset.");
    load();
  }

  return (
    <div className="admin-panel">
      <div className="admin-section">
        <div className="admin-section-header">
          <p className="admin-section-title">Leaderboard</p>
          <button className="admin-refresh" onClick={load}>{loading ? "…" : "↻"}</button>
        </div>
        <div className="admin-table">
          <div className="admin-table-head">
            <span>#</span><span>Mog</span><span>Address</span><span>Rep</span><span>W</span><span>L</span>
          </div>
          {entries.map((e, i) => (
            <div key={e.address} className="admin-table-row">
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
        <div style={{ marginTop: 24 }}>
          <button className="admin-btn red" onClick={resetLb}>Reset Leaderboard</button>
          {msg && <p className="admin-msg">{msg}</p>}
        </div>
      </div>
    </div>
  );
}
