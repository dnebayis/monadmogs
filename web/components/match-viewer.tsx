"use client";

import { useEffect, useState } from "react";
import type { Game, RoundResult } from "@/lib/arena";
import { GAME_TYPES } from "@/lib/arena";

const MOVE_EMOJI: Record<string, string> = {
  rock: "✊",
  paper: "✋",
  scissors: "✌️",
  heads: "H",
  tails: "T",
  roll: "🎲",
  higher: "↑",
  lower: "↓",
};

function MoveDisplay({ move, result, gameType }: { move: string; result?: number; gameType: string }) {
  if (gameType === "dice-duel" && typeof result === "number") {
    return <span className="match-move">{result}</span>;
  }
  if (gameType === "higher-lower" && typeof result === "number") {
    return <span className="match-move">{result}</span>;
  }
  return <span className="match-move">{MOVE_EMOJI[move] || move}</span>;
}

type ResolveStatus = {
  status: "resolved" | "failed";
  matchId?: number;
  winnerAddress?: string | null;
  txHash?: string;
  error?: string;
  resolvedAt?: string;
  failedAt?: string;
} | null;

export function MatchViewer({ gameId }: { gameId: string }) {
  const [game, setGame] = useState<Game | null>(null);
  const [resolve, setResolve] = useState<ResolveStatus>(null);
  const [error, setError] = useState<string | null>(null);
  const [visibleRounds, setVisibleRounds] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let latestStatus: Game["status"] | null = null;

    const loadMatch = async () => {
      try {
        const res = await fetch(`/api/arena/games?id=${gameId}`, { cache: "no-store" });
        const data = await res.json();
        if (cancelled) return;
        if (data.error) {
          setError(data.error);
          return;
        }
        setError(null);
        setGame(data.game);
        setResolve(data.resolve ?? null);
        latestStatus = data.game?.status || null;
      } catch {
        if (!cancelled) setError("Failed to load match.");
      }
    };

    loadMatch();
    const interval = window.setInterval(() => {
      if (latestStatus !== "finished") {
        loadMatch();
      }
    }, 3000);
    window.addEventListener("focus", loadMatch);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", loadMatch);
    };
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
      </div>

      <div className="match-arena">
        {/* Player 1 */}
        <div className={`match-player ${isFinished && game.winner === p1?.address ? "winner" : ""}`}>
          {p1 ? (
            <>
              <div className="match-mog">
                <img src={`/api/v0/mogs/${p1.mogId}/render`} alt={p1.mogName} />
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
              <p>Waiting for opponent</p>
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
                      <MoveDisplay move={round.p1Move} result={round.p1Result} gameType={game.type} />
                      <span className="match-round-vs">vs</span>
                      <MoveDisplay move={round.p2Move} result={round.p2Result} gameType={game.type} />
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
                <img src={`/api/v0/mogs/${p2.mogId}/render`} alt={p2.mogName} />
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

      {resolve && (
        <div className={`match-resolve ${resolve.status}`}>
          {resolve.status === "resolved" ? (
            <>
              <span className="match-resolve-label">Prize settled onchain</span>
              {resolve.txHash && (
                <a
                  className="text-link muted"
                  href={`https://monadscan.com/tx/${resolve.txHash}`}
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

      <div className="match-footer">
        <a className="text-link muted" href="/#arena">Back to Arena</a>
        <span className="match-game-id">{gameId}</span>
      </div>
    </div>
  );
}
