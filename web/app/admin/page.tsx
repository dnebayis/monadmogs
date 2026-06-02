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
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function toWei(mon: string): string {
  const n = parseFloat(mon) || 0;
  return BigInt(Math.round(n * 1e18)).toString();
}

function fromWei(wei: string): string {
  return (Number(wei) / 1e18).toFixed(4);
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
    try {
      const [recentRes, openRes] = await Promise.all([
        fetch("/api/arena?view=recent"),
        fetch("/api/arena?view=open"),
      ]);
      const recent = await recentRes.json();
      const open = await openRes.json();
      const all: Game[] = [...(recent.games || []), ...(open.games || [])];
      const seen = new Set<string>();
      const deduped = all.filter((g) => { if (seen.has(g.id)) return false; seen.add(g.id); return true; });
      deduped.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setGames(deduped.slice(0, 30));

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

    if (!linked) {
      // Offchain-only game — just create in KV
      const res = await fetch("/api/arena/games", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-secret": secret },
        body: JSON.stringify({ action: "create", type: gameType }),
      });
      if (res.status === 401) { onAuthFail(); return; }
      const data = await res.json();
      if (data.error) { setMsg(`Error: ${data.error}`); return; }
      setMsg(`✓ Game created (offchain): ${data.game?.id}`);
      load();
      return;
    }

    // Linked onchain game — pick action by prize type
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

    const res = await fetch("/api/arena/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-secret": secret },
      body: JSON.stringify(body),
    });
    if (res.status === 401) { onAuthFail(); return; }
    const data = await res.json();
    if (data.error) { setMsg(`Error: ${data.error}`); return; }
    setMsg(`✓ Game created: ${data.game?.id} | Match #${data.matchId} | tx: ${data.txHash?.slice(0, 12)}…`);
    load();
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
              <span className="admin-hint">MON &nbsp;→ {toWei(entryFeeMon)} wei</span>
            </div>

            <div className="admin-form-row">
              <label>Sponsor Prize</label>
              <input
                className="admin-input-sm"
                value={sponsorMon}
                onChange={(e) => setSponsorMon(e.target.value)}
                placeholder="0"
              />
              <span className="admin-hint">MON &nbsp;→ {toWei(sponsorMon)} wei</span>
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
                <span className="admin-hint">$MOGS &nbsp;→ {mogsAmount ? toWei(mogsAmount) : "0"} wei &nbsp;(Arena wallet must hold this)</span>
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
