import { NextResponse } from "next/server";
import { getOpenGames, getRecentGames, getLeaderboard } from "@/lib/arena";
import { getOnchainPool, getPoolCount } from "@/lib/arena-pool";

export async function GET(request: Request) {
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

    if (view === "pools") {
      const count = await getPoolCount();
      const pools = [];
      for (let i = count; i >= 1 && pools.length < 20; i--) {
        try {
          const pool = await getOnchainPool(i);
          pools.push(pool);
        } catch {
          continue;
        }
      }
      return NextResponse.json({ pools });
    }

    // default: open games
    const type = searchParams.get("type") as string | undefined;
    const games = await getOpenGames(type as any);
    return NextResponse.json({ games });
  } catch {
    return NextResponse.json({ games: [] });
  }
}
