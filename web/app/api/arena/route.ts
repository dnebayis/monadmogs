import { NextResponse } from "next/server";
import { getOpenGames, getRecentGames, getLeaderboard } from "@/lib/arena";
import { getOnchainMatch, getMatchCount } from "@/lib/arena-pool";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function GET(request: Request) {
  // Rate limit: 60 reads per minute per IP
  const ip = getClientIp(request);
  const rl = await rateLimit(`arena-list:${ip}`, 60, 60);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  const { searchParams } = new URL(request.url);
  const view = searchParams.get("view") || "open";

  try {
    if (view === "leaderboard") {
      const entries = await getLeaderboard(20);
      return NextResponse.json({ leaderboard: entries });
    }

    if (view === "recent") {
      const games = await getRecentGames(20);
      return NextResponse.json({ games });
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
      return NextResponse.json({ matches: onchainMatches });
    }

    // default: open games
    const type = searchParams.get("type") as string | undefined;
    const games = await getOpenGames(type as any);
    return NextResponse.json({ games });
  } catch {
    return NextResponse.json({ games: [] });
  }
}
