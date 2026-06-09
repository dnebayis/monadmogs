"use client";

import { useEffect, useState } from "react";
import type { Game, RoundResult } from "@/lib/arena";
import { GAME_TYPES } from "@/lib/arena";
import { MONAD_EXPLORER_URL } from "@/lib/network";
import { API_BASE_URL } from "@/lib/urls";

const MOVE_EMOJI: Record<string, string> = {
  rock: "✊",
  paper: "✋",
  scissors: "✌️",
  heads: "H",
  tails: "T",
  "roll-safe": "🎲",
  "roll-risky": "🎲!",
  higher: "↑",
  lower: "↓",
};

function MoveDisplay({
  move,
  result,
  gameType,
  currentNumber,
  nextNumber,
}: {
  move: string;
  result?: number;
  gameType: string;
  currentNumber?: number;
  nextNumber?: number;
}) {
  if (gameType === "dice-duel" && typeof result === "number") {
    const label = move === "roll-risky" ? "risky" : "safe";
    return <span className="match-move" title={label}>{result}{move === "roll-risky" ? "!" : ""}</span>;
  }
  if (gameType === "higher-lower" && typeof result === "number") {
    const arrow = MOVE_EMOJI[move] || move;
    const mark = result === 1 ? "✓" : "×";
    const label = result === 1 ? "correct" : "miss";
    if (typeof currentNumber === "number" && typeof nextNumber === "number") {
      return (
        <span className="match-move higher-lower-result" title={`${currentNumber} ${move} ${nextNumber}: ${label}`}>
          {currentNumber} {arrow} {nextNumber} {mark}
        </span>
      );
    }
    return <span className="match-move higher-lower-result" title={label}>{arrow} {label}</span>;
  }
  return <span className="match-move">{MOVE_EMOJI[move] || move}</span>;
}

type ResolveStatus = {
  status: "resolved" | "failed" | "cancelled" | null;
  matchId?: number;
  winnerAddress?: string | null;
  txHash?: string;
  error?: string;
  resolvedAt?: string;
  failedAt?: string;
  reason?: string;
} | null;

export function MatchViewer({ gameId }: { gameId: string }) {
  const [game, setGame] = useState<Game | null>(null);
  const [resolve, setResolve] = useState<ResolveStatus>(null);
  const [error, setError] = useState<string | null>(null);
  const [visibleRounds, setVisibleRounds] = useState(0);
  const [usingSse, setUsingSse] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let es: EventSource | null = null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    function applyState(data: { game?: Game; resolve?: ResolveStatus; error?: string }) {
      if (cancelled) return;
      if (data.error) { setError(data.error); return; }
      if (data.game) { setError(null); setGame(data.game); setResolve(data.resolve ?? null); }
    }

    // Polling fallback — used when SSE is not available or after SSE closes
    function startPolling(currentGame: Game | null) {
      if (currentGame?.status === "finished") return;
      pollInterval = setInterval(async () => {
        if (cancelled) return;
        try {
          const res = await fetch(`${API_BASE_URL}/api/arena/games?id=${gameId}`, { cache: "no-store" });
          const data = await res.json();
          applyState(data);
          if (data.game?.status === "finished" && pollInterval) {
            window.clearInterval(pollInterval);
            pollInterval = null;
          }
        } catch { /* ignore transient errors */ }
      }, 4000);
    }

    // Initial load always via REST so we have state immediately
    async function initialLoad() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/arena/games?id=${gameId}`, { cache: "no-store" });
        const data = await res.json();
        applyState(data);
        return data.game as Game | null;
      } catch {
        if (!cancelled) setError("Failed to load match.");
        return null;
      }
    }

    initialLoad().then((initialGame) => {
      if (cancelled || initialGame?.status === "finished") return;

      // Try SSE — EventSource is available in all modern browsers
      if (typeof EventSource !== "undefined") {
        setUsingSse(true);
        es = new EventSource(`${API_BASE_URL}/api/arena/games/stream?id=${gameId}`);

        es.addEventListener("state", (e: MessageEvent) => {
          try { applyState(JSON.parse(e.data)); } catch { /* ignore */ }
        });

        es.addEventListener("done", () => {
          es?.close();
          es = null;
          setUsingSse(false);
        });

        es.addEventListener("error", () => {
          es?.close();
          es = null;
          setUsingSse(false);
          // SSE failed or closed — fall back to polling
          startPolling(game);
        });
      } else {
        // No EventSource support — go straight to polling
        startPolling(initialGame);
      }
    });

    // Reload on window focus (catches stale state after tab switch)
    const onFocus = async () => {
      if (cancelled) return;
      const res = await fetch(`${API_BASE_URL}/api/arena/games?id=${gameId}`, { cache: "no-store" }).catch(() => null);
      if (res?.ok) applyState(await res.json());
    };
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      es?.close();
      if (pollInterval) window.clearInterval(pollInterval);
      window.removeEventListener("focus", onFocus);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  // Animate rounds appearing one by one
  useEffect(() => {
    if (!game?.rounds.length) return;
    if (visibleRounds >= game.rounds.length) return;

    const timer = setTimeout(() => {
      setVisibleRounds((v) => v + 1);
    }, visibleRounds === 0 ? 300 : 1200);

    return () => clearTimeout(timer);
  }, [game, visibleRounds]);

  if (error) {
    return (
      <div className="match-page">
        <div className="match-error">
          <p>{error}</p>
          <a className="text-link" href="/#arena">Back to Arena</a>
        </div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="match-page">
        <p className="match-loading">Loading match...</p>
      </div>
    );
  }

  const [p1, p2] = game.players;
  const gameInfo = GAME_TYPES[game.type];
  const isFinished = game.status === "finished";
  const isWaiting = game.status === "waiting";

  return (
    <div className="match-page">
      <div className="match-header">
        <a className="text-link muted" href="/#arena">Arena</a>
        <span className="match-type">{gameInfo?.label}</span>
        <span className="match-best-of">Best of {game.bestOf}</span>
        {!isFinished && (
          <span className="match-live-indicator" title={usingSse ? "Live via SSE" : "Polling"}>
            {usingSse ? "● live" : "● polling"}
          </span>
        )}
      </div>

      <div className="match-arena">
        {/* Player 1 */}
        <div className={`match-player ${isFinished && game.winner === p1?.address ? "winner" : ""}`}>
          {p1 ? (
            <>
              <div className="match-mog">
                <img src={`${API_BASE_URL}/api/v0/mogs/${p1.mogId}/render`} alt={p1.mogName} />
              </div>
              <strong className="match-name">{p1.mogName}</strong>
              <span className="match-score">{p1.score}</span>
              {isFinished && game.winner === p1.address && (
                <span className="match-winner-tag">Winner</span>
              )}
            </>
          ) : (
            <div className="match-empty-slot">Waiting...</div>
          )}
        </div>

        {/* Center: Game Board */}
        <div className="match-board">
          {isWaiting ? (
            <div className="match-waiting-board">
              {resolve && resolve.status ? (
                <p className="match-waiting-resolved">
                  {resolve.status === "resolved" ? "Match settled onchain — opponent never joined." : "Match cancelled or expired."}
                </p>
              ) : (
                <>
                  <p>Waiting for opponent</p>
                  {game.createdAt && Date.now() - new Date(game.createdAt).getTime() > 2 * 60 * 60 * 1000 && (
                    <p className="match-waiting-hint">This game may have expired — check with the arena admin.</p>
                  )}
                </>
              )}
              <span className="match-game-id">{gameId.slice(0, 8)}...</span>
            </div>
          ) : (
            <>
              <div className="match-scoreline">
                <span>{p1?.score || 0}</span>
                <span className="match-vs">vs</span>
                <span>{p2?.score || 0}</span>
              </div>

              <div className="match-rounds">
                {game.rounds.slice(0, visibleRounds).map((round: RoundResult) => (
                  <div
                    key={round.round}
                    className={`match-round ${round.round === game.rounds.length && isFinished ? "final" : ""}`}
                  >
                    <span className="match-round-label">R{round.round}</span>
                    <div className="match-round-moves">
                      <MoveDisplay
                        move={round.p1Move}
                        result={round.p1Result}
                        gameType={game.type}
                        currentNumber={round.p1CurrentNumber}
                        nextNumber={round.p1NextNumber}
                      />
                      <span className="match-round-vs">vs</span>
                      <MoveDisplay
                        move={round.p2Move}
                        result={round.p2Result}
                        gameType={game.type}
                        currentNumber={round.p2CurrentNumber}
                        nextNumber={round.p2NextNumber}
                      />
                    </div>
                    <span className="match-round-result">
                      {round.roundWinner === p1?.address
                        ? p1.mogName
                        : round.roundWinner === p2?.address
                          ? p2?.mogName
                          : "Draw"}
                    </span>
                    {round.specialMoves?.length ? (
                      <div className="match-special-moves">
                        {round.specialMoves.map((special) => (
                          <span key={`${round.round}-${special.player}`}>
                            Special Move {special.triggered ? "triggered" : "declared"}
                            {special.consumed ? " / consumed" : " / saved"}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>

              {isFinished && (
                <div className="match-final-result">
                  {game.winner
                    ? `${game.winner === p1?.address ? p1.mogName : p2?.mogName} wins`
                    : "Draw"}
                </div>
              )}

              {!isFinished && game.status === "active" && (
                <div className="match-active-label">
                  Round {game.round} — waiting for moves...
                </div>
              )}
            </>
          )}
        </div>

        {/* Player 2 */}
        <div className={`match-player ${isFinished && game.winner === p2?.address ? "winner" : ""}`}>
          {p2 ? (
            <>
              <div className="match-mog">
                <img src={`${API_BASE_URL}/api/v0/mogs/${p2.mogId}/render`} alt={p2.mogName} />
              </div>
              <strong className="match-name">{p2.mogName}</strong>
              <span className="match-score">{p2.score}</span>
              {isFinished && game.winner === p2.address && (
                <span className="match-winner-tag">Winner</span>
              )}
            </>
          ) : (
            <div className="match-empty-slot">Waiting...</div>
          )}
        </div>
      </div>

      {/* Commentary */}
      {game.rounds.length > 0 && (
        <div className="match-commentary">
          <span className="eyebrow" style={{ margin: "0 0 16px" }}>Commentary</span>
          {game.rounds.slice(0, visibleRounds).map((round: RoundResult) => (
            <div key={round.round} className="match-commentary-round">
              <span className="match-commentary-label">R{round.round}</span>
              <div className="match-commentary-messages">
                {round.commentary && (
                  <>
                    <div className="match-commentary-msg p1">
                      <strong>{p1?.mogName}</strong>
                      <p>{round.commentary.p1}</p>
                    </div>
                    <div className="match-commentary-msg p2">
                      <strong>{p2?.mogName}</strong>
                      <p>{round.commentary.p2}</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {resolve && resolve.status !== null && (
        <div className={`match-resolve ${resolve.status}`}>
          {resolve.status === "resolved" ? (
            <>
              <span className="match-resolve-label">
                {game.winner ? "Prize settled onchain" : "Draw settled onchain — entry fees refunded"}
              </span>
              {resolve.txHash && (
                <a
                  className="text-link muted"
                  href={`${MONAD_EXPLORER_URL}/tx/${resolve.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {resolve.txHash.slice(0, 10)}…
                </a>
              )}
            </>
          ) : (
            <>
              <span className="match-resolve-label">Onchain settlement failed</span>
              {resolve.error && <span className="match-resolve-error">{resolve.error}</span>}
              <span className="match-resolve-hint">Contact arena admin to resolve manually.</span>
            </>
          )}
        </div>
      )}

      {resolve && resolve.status === null && (
        <div className="match-resolve pending">
          <span className="match-resolve-label">
            {resolve.matchId ? "Prize settlement pending" : "Offchain-only match"}
          </span>
          {resolve.reason && <span className="match-resolve-hint">{resolve.reason}</span>}
        </div>
      )}

      <div className="match-footer">
        <a className="text-link muted" href="/#arena">Back to Arena</a>
        <span className="match-game-id">{gameId}</span>
      </div>
    </div>
  );
}
