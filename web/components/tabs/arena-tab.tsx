"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";
import type { Game, GameSummary, GameType, GameMove, LeaderboardEntry } from "@/lib/arena";
import { GAME_TYPES } from "@/lib/arena";

type ArenaView = "lobby" | "play" | "result";

type OwnedMog = { tokenId: number; name: string; image: string };

const GAME_TYPE_LIST = Object.entries(GAME_TYPES) as [GameType, (typeof GAME_TYPES)[GameType]][];

export function ArenaTab() {
  const { address, isConnected } = useAccount();
  const [view, setView] = useState<ArenaView>("lobby");
  const [openGames, setOpenGames] = useState<GameSummary[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [activeGame, setActiveGame] = useState<Game | null>(null);
  const [selectedType, setSelectedType] = useState<GameType>("coin-flip");
  const [selectedMove, setSelectedMove] = useState<GameMove | null>(null);
  const [ownedMogs, setOwnedMogs] = useState<OwnedMog[]>([]);
  const [selectedMog, setSelectedMog] = useState<OwnedMog | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch open games and leaderboard
  const fetchLobby = useCallback(async () => {
    try {
      const [gamesRes, lbRes] = await Promise.all([
        fetch("/api/arena?view=open"),
        fetch("/api/arena?view=leaderboard"),
      ]);
      const gamesData = await gamesRes.json();
      const lbData = await lbRes.json();
      setOpenGames(gamesData.games || []);
      setLeaderboard(lbData.leaderboard || []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchLobby();
  }, [fetchLobby]);

  // Fetch owned mogs
  useEffect(() => {
    if (!address) {
      setOwnedMogs([]);
      setSelectedMog(null);
      return;
    }
    // Try to load from localStorage first (agent registration has mogId)
    const saved = window.localStorage.getItem(`monad-mogs-agent:${address.toLowerCase()}`);
    if (saved) {
      try {
        const reg = JSON.parse(saved);
        setOwnedMogs([{ tokenId: reg.mogId, name: `Mog #${reg.mogId}`, image: `/api/v0/mogs/${reg.mogId}/render` }]);
        setSelectedMog({ tokenId: reg.mogId, name: `Mog #${reg.mogId}`, image: `/api/v0/mogs/${reg.mogId}/render` });
      } catch { /* ignore */ }
    }
  }, [address]);

  function getMovesForType(type: GameType): { value: GameMove; label: string }[] {
    switch (type) {
      case "coin-flip":
        return [
          { value: "heads", label: "Heads" },
          { value: "tails", label: "Tails" },
        ];
      case "rock-paper-scissors":
        return [
          { value: "rock", label: "Rock" },
          { value: "paper", label: "Paper" },
          { value: "scissors", label: "Scissors" },
        ];
      case "dice-duel":
        return [{ value: "roll", label: "Roll Dice" }];
      case "higher-lower":
        return [
          { value: "higher", label: "Higher" },
          { value: "lower", label: "Lower" },
        ];
    }
  }

  async function createGame() {
    if (!address || !selectedMog || !selectedMove) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/arena/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          type: selectedType,
          player: { address, mogId: selectedMog.tokenId, mogName: selectedMog.name },
          move: selectedMove,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create game.");
        return;
      }
      setActiveGame(data.game);
      setView("play");
      setSelectedMove(null);
    } catch {
      setError("Network error.");
    } finally {
      setIsLoading(false);
    }
  }

  async function joinGame(gameId: string) {
    if (!address || !selectedMog || !selectedMove) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/arena/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "join",
          gameId,
          player: { address, mogId: selectedMog.tokenId, mogName: selectedMog.name },
          move: selectedMove,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to join game.");
        return;
      }
      setActiveGame(data.game);
      setView(data.game.status === "finished" ? "result" : "play");
      setSelectedMove(null);
      fetchLobby();
    } catch {
      setError("Network error.");
    } finally {
      setIsLoading(false);
    }
  }

  function backToLobby() {
    setActiveGame(null);
    setView("lobby");
    setError(null);
    setSelectedMove(null);
    fetchLobby();
  }

  return (
    <section className="tab-full">
      <div className="section-heading">
        <p className="eyebrow">Arena</p>
        <h2>Mog vs Mog.</h2>
        <p className="section-copy">
          Pick a game, choose your Mog, and challenge other players. Wins and losses are tracked on
          the leaderboard.
        </p>
      </div>

      {/* Game Types */}
      <div className="tab-block">
        <div className="tab-block-header">
          <p className="eyebrow">Games</p>
          <p className="tab-block-copy">Quick games powered by onchain randomness.</p>
        </div>
        <div className="arena-game-grid">
          {GAME_TYPE_LIST.map(([type, info]) => (
            <button
              key={type}
              type="button"
              className={`arena-game-card ${selectedType === type ? "active" : ""}`}
              onClick={() => {
                setSelectedType(type);
                setSelectedMove(null);
              }}
            >
              <strong>{info.label}</strong>
              <p>{info.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Play Area */}
      <div className="tab-block">
        <div className="tab-block-header">
          <p className="eyebrow">
            {view === "lobby" ? "Play" : view === "play" ? "Waiting" : "Result"}
          </p>
        </div>

        {!isConnected ? (
          <div className="arena-empty">
            <p>Connect a wallet to play.</p>
          </div>
        ) : !selectedMog ? (
          <div className="arena-empty">
            <p>Register a Mog agent first to play arena games.</p>
          </div>
        ) : view === "lobby" ? (
          <div className="arena-play-area">
            <div className="arena-your-mog">
              <img src={selectedMog.image} alt={selectedMog.name} />
              <span>{selectedMog.name}</span>
            </div>

            <div className="arena-move-picker">
              <span className="eyebrow" style={{ margin: 0 }}>
                Your Move — {GAME_TYPES[selectedType].label}
              </span>
              <div className="arena-moves">
                {getMovesForType(selectedType).map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    className={`arena-move-btn ${selectedMove === m.value ? "active" : ""}`}
                    onClick={() => setSelectedMove(m.value)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="arena-actions">
              <button
                type="button"
                className="primary-action"
                disabled={!selectedMove || isLoading}
                onClick={createGame}
              >
                {isLoading ? "Creating..." : "Create Game"}
              </button>
            </div>

            {error && <p className="error">{error}</p>}

            {/* Open games to join */}
            {openGames.length > 0 && (
              <div className="arena-open-games">
                <span className="eyebrow" style={{ margin: 0 }}>
                  Open Games
                </span>
                {openGames.map((g) => (
                  <div key={g.id} className="arena-open-game-row">
                    <span>{GAME_TYPES[g.type]?.label}</span>
                    <span className="arena-open-game-meta">
                      {g.playerCount}/{g.maxPlayers}
                    </span>
                    <button
                      type="button"
                      className="secondary-action compact-action"
                      disabled={!selectedMove || isLoading || g.type !== selectedType}
                      onClick={() => joinGame(g.id)}
                    >
                      Join
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : view === "play" ? (
          <div className="arena-waiting">
            <p>Waiting for opponent to join...</p>
            <p className="arena-game-id">Game: {activeGame?.id.slice(0, 8)}...</p>
            <button type="button" className="secondary-action" onClick={backToLobby}>
              Back to Lobby
            </button>
          </div>
        ) : (
          /* RESULT */
          <div className="arena-result">
            {activeGame && (
              <>
                <div className="arena-result-header">
                  <strong>
                    {!activeGame.winner
                      ? "Draw"
                      : activeGame.winner.toLowerCase() === address?.toLowerCase()
                        ? "You Win"
                        : "You Lose"}
                  </strong>
                  <span>{GAME_TYPES[activeGame.type]?.label}</span>
                </div>

                <div className="arena-result-players">
                  {activeGame.players.map((p, i) => (
                    <div
                      key={p.address}
                      className={`arena-result-player ${
                        activeGame.winner === p.address ? "winner" : ""
                      }`}
                    >
                      <img
                        src={`/api/v0/mogs/${p.mogId}/render`}
                        alt={p.mogName}
                      />
                      <strong>{p.mogName}</strong>
                      <span>
                        {p.move || "—"} → {p.result ?? "—"}
                      </span>
                      {activeGame.winner === p.address && (
                        <span className="arena-winner-badge">Winner</span>
                      )}
                    </div>
                  ))}
                </div>

                <button type="button" className="primary-action" onClick={backToLobby}>
                  Play Again
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Leaderboard */}
      <div className="tab-block">
        <div className="tab-block-header">
          <p className="eyebrow">Leaderboard</p>
          <p className="tab-block-copy">Top players by total wins.</p>
        </div>
        {leaderboard.length > 0 ? (
          <div className="arena-leaderboard">
            <div className="arena-lb-header">
              <span>#</span>
              <span>Player</span>
              <span>W</span>
              <span>L</span>
              <span>D</span>
            </div>
            {leaderboard.map((entry, i) => (
              <div key={entry.address} className="arena-lb-row">
                <span>{i + 1}</span>
                <span className="arena-lb-player">
                  <img src={`/api/v0/mogs/${entry.mogId}/render`} alt={entry.mogName} />
                  {entry.mogName}
                </span>
                <span>{entry.wins}</span>
                <span>{entry.losses}</span>
                <span>{entry.draws}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="arena-empty">
            <p>No games played yet.</p>
          </div>
        )}
      </div>

      {/* What's Next for Arena */}
      <div className="tab-block">
        <div className="tab-block-header">
          <p className="eyebrow">Coming Soon</p>
        </div>
        <div className="endpoint-list">
          <article className="endpoint-card">
            <span>Chess</span>
            <p>Full chess matches between Mog agents. Moves influenced by trait personas.</p>
          </article>
          <article className="endpoint-card">
            <span>Tournaments</span>
            <p>Bracket tournaments with $MOGS prize pools. Weekly and seasonal events.</p>
          </article>
          <article className="endpoint-card">
            <span>Rarity Bonus</span>
            <p>Rarer Mogs unlock strategic advantages in games: extra rolls, better odds, bonus rewards.</p>
          </article>
        </div>
      </div>
    </section>
  );
}
