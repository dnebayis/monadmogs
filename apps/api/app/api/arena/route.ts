import { NextResponse } from "next/server";
import { getOpenGames, getRecentGames, getLeaderboard, sanitizeGameForPublic, gameScoreline } from "@/lib/arena";
import { getOnchainMatch, getMatchCount, MOGS_ARENA_ADDRESS } from "@/lib/arena-pool";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { getArenaProtocol } from "@/lib/arena-protocol";
import { validateAuthHeader } from "@/lib/arena-auth";
import { getRecoveryState } from "@/lib/arena-agent-state";

export async function GET(request: Request) {
  // Rate limit: 60 reads per minute per IP
  const ip = getClientIp(request);
  const rl = await rateLimit(`arena-list:${ip}`, 60, 60);
  if (!rl.ok) {
    return NextResponse.json(
      { error: rl.message },
      {
        status: rl.status,
        headers: rl.status === 429 ? { "Retry-After": String(rl.retryAfter) } : undefined,
      }
    );
  }

  const { searchParams } = new URL(request.url);
  const view = searchParams.get("view") || "open";
  const validViews = new Set(["open", "my", "leaderboard", "recent", "introspection", "matches"]);
  if (!validViews.has(view)) {
    return NextResponse.json(
      { error: "Invalid view.", valid: Array.from(validViews) },
      { status: 400 }
    );
  }

  try {
    if (view === "leaderboard") {
      const entries = await getLeaderboard(20);
      return NextResponse.json({ leaderboard: entries });
    }

    if (view === "recent") {
      const games = await getRecentGames(20, { strict: true });
      return NextResponse.json({ games: games.map((game) => ({ ...sanitizeGameForPublic(game), scoreline: gameScoreline(game) })) });
    }

    if (view === "introspection") {
      return NextResponse.json(getArenaProtocol());
    }

    if (view === "my") {
      const session = await validateAuthHeader(request.headers.get("authorization"));
      if (!session) {
        return NextResponse.json(
          { error: "Authentication required. Use POST /api/arena/auth to get a session token." },
          { status: 401 },
        );
      }

      const recovery = await getRecoveryState(session.address);
      if (recovery.status === "degraded") {
        return NextResponse.json({
          error: "Arena recovery state unavailable.",
          degraded: true,
          reason: recovery.reason,
          reasonCode: recovery.reasonCode,
          nextAction: "retry_later",
        }, { status: 503 });
      }
      if (recovery.status === "conflict") {
        return NextResponse.json({
          error: "Multiple active games detected for this wallet.",
          degraded: true,
          reason: recovery.reason,
          reasonCode: recovery.reasonCode,
          nextAction: "resolve_recovery_conflict",
          activeGameIds: recovery.activeGames.map((game) => game.id),
          games: recovery.games.map((game) => ({
            ...sanitizeGameForPublic(game, session.address),
            scoreline: gameScoreline(game),
          })),
        }, { status: 409 });
      }

      const games = recovery.games;
      return NextResponse.json({
        games: games.map((game) => ({
          ...sanitizeGameForPublic(game, session.address),
          scoreline: gameScoreline(game),
        })),
        active: games.filter((game) => game.status !== "finished").map((game) => game.id),
        note: "Use this view for heartbeat state recovery. /api/arena?view=open only lists joinable waiting games.",
      });
    }

    if (view === "matches") {
      const count = await getMatchCount();
      const onchainMatches = [];
      for (let i = count; i >= 1 && onchainMatches.length < 20; i--) {
        try {
          const m = await getOnchainMatch(i);
          onchainMatches.push(m);
        } catch {
          continue;
        }
      }
      return NextResponse.json({ arenaAddress: MOGS_ARENA_ADDRESS, matches: onchainMatches });
    }

    // default: open games
    const type = searchParams.get("type") as string | undefined;
    const games = await getOpenGames(type as any, { strict: true });
    return NextResponse.json({
      arenaAddress: MOGS_ARENA_ADDRESS,
      arenaVersion: getArenaProtocol().version,
      canonicalApiBase: getArenaProtocol().endpoints.gameAction.replace("/api/arena/games", ""),
      contractMigrated: true,
      deprecatedArenaAddresses: ["0xDa86C231Aefa08DFF50c95c0a7edb2A0A65A18C5"],
      restrictions: ["one_active_match_per_wallet"],
      maxConcurrentMatches: 1,
      leaveFlow: {
        supported: true,
        linkedMatchFirstStep: "call leaveMatch(matchId) on arenaAddress",
        apiSecondStep: { action: "leave", gameId: "{gameId}" },
      },
      skillUrl: getArenaProtocol().skillUrl,
      games: games.map((game) => ({
        ...game,
        nextAction: game.matchId
          ? "join_onchain_match_then_join_api"
          : "join_api",
      })),
    });
  } catch (error) {
    console.error("Arena route failed:", error);
    return NextResponse.json({ error: "Arena data unavailable." }, { status: 503 });
  }
}
