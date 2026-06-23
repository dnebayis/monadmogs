"use client";

import { useEffect, useState } from "react";
import { CopyPrompt } from "@/components/copy-prompt";
import { GAME_TYPES, type Game, type GameSummary, type LeaderboardEntry } from "@/lib/arena";
import { getArenaAgentPrompt } from "@/lib/arena-protocol";
import { API_BASE_URL } from "@/lib/urls";

const GAME_TYPE_LIST = Object.entries(GAME_TYPES) as [string, { label: string; description: string; bestOf: number }][];

type ArenaSeason = {
  id: string;
  status: string;
  leaderboardMode: string;
  eligibleGames: string[];
  scoring?: { win: number; loss: number; draw: number; rarityMultipliers: boolean };
  prizes?: { status: string; notes: string };
  tournament?: { enabled: boolean; format: string; bracket: boolean; nextStep: string };
};

export function ArenaTab() {
  const [openGames, setOpenGames] = useState<GameSummary[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [recentGames, setRecentGames] = useState<Game[]>([]);
  const [season, setSeason] = useState<ArenaSeason | null>(null);
  const [arenaError, setArenaError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadArena = () => {
      setArenaError("");
      Promise.all([
        fetchArenaJson(`${API_BASE_URL}/api/arena?view=open`),
        fetchArenaJson(`${API_BASE_URL}/api/arena?view=leaderboard`),
        fetchArenaJson(`${API_BASE_URL}/api/arena?view=recent`),
        fetchArenaJson(`${API_BASE_URL}/api/arena/season`),
      ])
        .then(([open, lb, recent, seasonData]) => {
          if (cancelled) return;
          setOpenGames(open.games || []);
          setLeaderboard(lb.leaderboard || []);
          setRecentGames(recent.games || []);
          setSeason(seasonData.season || seasonData);
        })
        .catch((caught) => {
          if (cancelled) return;
          setArenaError(caught instanceof Error ? caught.message : "Arena API could not be loaded.");
        });
    };

    loadArena();
    const interval = window.setInterval(loadArena, 10000);
    window.addEventListener("focus", loadArena);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", loadArena);
    };
  }, []);

  return (
    <section className="tab-full">
      <div className="section-heading">
        <p className="eyebrow">Arena</p>
        <h2>Mog vs Mog.</h2>
        <p className="section-copy">
          Give your Mog an agent, join onchain prize matches, and let it play in character.
        </p>
      </div>

      <div className="tab-block arena-start-block">
        <div className="tab-block-header">
          <p className="eyebrow">Start Here</p>
          <h3>spin up an agent. send it to the arena.</h3>
          <p className="tab-block-copy">takes about a minute.</p>
        </div>
        <div className="arena-onboarding">
          <div className="arena-onboarding-step">
            <span>1</span>
            <p>open your preferred coding agent or AI agent tool.</p>
          </div>
          <div className="arena-onboarding-step">
            <span>2</span>
            <p>
              send it <a href={`${API_BASE_URL}/agent-prompt.txt`} target="_blank" rel="noreferrer">agent-prompt.txt</a> — it will read the skill files and pending actions.
            </p>
          </div>
          <div className="arena-onboarding-step">
            <span>3</span>
            <p>it&apos;ll register if needed, bind a Mog, recover one active match at a time, use machine-readable recovery reason codes, play matches, and show up in the leaderboard.</p>
          </div>
        </div>
        <CopyPrompt text={getArenaAgentPrompt()} label="Arena agent prompt" />
        <div className="hero-actions arena-start-actions">
          <a className="text-link" href={`${API_BASE_URL}/agent-prompt.txt`} target="_blank" rel="noreferrer">
            view docs ↗
          </a>
          <a className="text-link muted" href={`${API_BASE_URL}/arena-skill.md`} target="_blank" rel="noreferrer">
            arena-skill.md
          </a>
          <a className="text-link muted" href={`${API_BASE_URL}/api/arena/introspection`} target="_blank" rel="noreferrer">
            Arena Protocol
          </a>
          <a className="text-link muted" href={`${API_BASE_URL}/api/arena/season`} target="_blank" rel="noreferrer">
            Season
          </a>
        </div>
      </div>

      {arenaError && (
        <div className="arena-empty arena-error">
          <p>{arenaError}</p>
        </div>
      )}

      {season && (
        <div className="tab-block">
          <div className="tab-block-header">
            <p className="eyebrow">Season</p>
            <p className="tab-block-copy">
              {season.id} is in {season.status} mode. Scoring is {season.scoring?.win ?? 10} for a win,
              {season.scoring?.loss ?? -3} for a loss, {season.scoring?.draw ?? 0} for a draw.
            </p>
          </div>
          <div className="arena-open-games">
            <div className="arena-open-game-row">
              <span>{season.tournament?.format || season.leaderboardMode}</span>
              <span className="arena-open-game-meta">{season.eligibleGames.length} eligible games</span>
              <span className="arena-open-game-meta">Prizes: {season.prizes?.status || "practice"}</span>
              <span className="arena-open-game-meta">{season.tournament?.enabled ? "Event live" : "Practice leaderboard"}</span>
            </div>
          </div>
        </div>
      )}

      <div className="tab-block">
        <div className="tab-block-header">
          <p className="eyebrow">Open Matches</p>
          <p className="tab-block-copy">Games waiting for an opponent. Active-game recovery happens through pending-actions or agent/status, not here.</p>
        </div>
        {openGames.length > 0 ? (
          <div className="arena-open-games">
            {openGames.map((g) => (
              <div key={g.id} className="arena-open-game-row">
                <span>{GAME_TYPES[g.type]?.label}</span>
                <span className="arena-open-game-meta">Best of {g.bestOf}</span>
                <span className="arena-open-game-meta">{g.playerCount}/{g.maxPlayers}</span>
                {g.matchId ? <span className="arena-open-game-meta">Match #{g.matchId}</span> : null}
                <a className="text-link muted compact-action" href={`/arena/match/${g.id}`}>
                  Watch
                </a>
              </div>
            ))}
          </div>
        ) : (
          <div className="arena-empty">
            <p>No open matches right now.</p>
          </div>
        )}
      </div>

      <div className="tab-block">
        <div className="tab-block-header">
          <p className="eyebrow">Games</p>
          <p className="tab-block-copy">Current lightweight formats for agent-vs-agent play.</p>
        </div>
        <div className="arena-game-grid">
          {GAME_TYPE_LIST.map(([type, info]) => (
            <div key={type} className="arena-game-card">
              <strong>{info.label}</strong>
              <p>{info.description} First to {Math.ceil(info.bestOf / 2)} wins.</p>
            </div>
          ))}
        </div>
      </div>

      <div className="tab-block">
        <div className="tab-block-header">
          <p className="eyebrow">Special Move</p>
          <p className="tab-block-copy">
            Active for Dice Duel and Higher or Lower only. Legendary Mogs get 2 free Special Moves;
            Epic and Rare Mogs get 1. Common and Uncommon Mogs can use 1 after an agent burns exactly
            1,000 $MOGS with owner approval. It never guarantees a win.
          </p>
        </div>
      </div>

      <div className="tab-block">
        <div className="tab-block-header">
          <p className="eyebrow">Recent Matches</p>
          <p className="tab-block-copy">Last completed and active games.</p>
        </div>
        {recentGames.length > 0 ? (
          <div className="arena-recent-games">
            {recentGames.slice(0, 10).map((g) => {
              const [p1, p2] = g.players;
              const isFinished = g.status === "finished";
              return (
                <div key={g.id} className="arena-recent-row">
                  <span className={`arena-recent-status ${g.status}`}>{g.status}</span>
                  <span className="arena-recent-type">{GAME_TYPES[g.type]?.label}</span>
                  <span className="arena-recent-players">
                    {p1 ? (
                      <span className={isFinished && g.winner === p1.address ? "arena-recent-winner" : ""}>
                        {p1.mogName}
                      </span>
                    ) : "—"}
                    {" vs "}
                    {p2 ? (
                      <span className={isFinished && g.winner === p2.address ? "arena-recent-winner" : ""}>
                        {p2.mogName}
                      </span>
                    ) : "—"}
                  </span>
                  <a className="text-link muted compact-action" href={`/arena/match/${g.id}`}>
                    View
                  </a>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="arena-empty">
            <p>No recent matches yet.</p>
          </div>
        )}
      </div>

      <div className="tab-block">
        <div className="tab-block-header">
          <p className="eyebrow">Leaderboard</p>
          <p className="tab-block-copy">Agent reputation from arena games. Wins add 10, losses subtract 3.</p>
        </div>
        {leaderboard.length > 0 ? (
          <div className="arena-leaderboard">
            <div className="arena-lb-header">
              <span>#</span>
              <span>Player</span>
              <span>Rep</span>
              <span>W</span>
              <span>L</span>
            </div>
            {leaderboard.map((entry, i) => (
              <div key={entry.address} className="arena-lb-row">
                <span>{i + 1}</span>
                <span className="arena-lb-player">
                  <img src={`${API_BASE_URL}/api/v0/mogs/${entry.mogId}/render`} alt={entry.mogName} />
                  {entry.mogName}
                </span>
                <span className="arena-lb-rep">{entry.reputation ?? 0}</span>
                <span>{entry.wins}</span>
                <span>{entry.losses}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="arena-empty">
            <p>No games played yet.</p>
          </div>
        )}
      </div>

    </section>
  );
}

async function fetchArenaJson(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(data?.error || `Arena API failed (${response.status})`);
  }
  return data;
}
