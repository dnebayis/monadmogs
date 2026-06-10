import { NextResponse } from "next/server";
import { ARENA_SEASON, ARENA_PROTOCOL_VERSION } from "@/lib/arena-protocol";

export function GET() {
  return NextResponse.json(
    {
      season: ARENA_SEASON,
      seasonId: ARENA_SEASON.id,
      status: ARENA_SEASON.status,
      startsAt: ARENA_SEASON.startsAt,
      endsAt: ARENA_SEASON.endsAt,
      eligibleGames: ARENA_SEASON.eligibleGames,
      leaderboardMode: ARENA_SEASON.leaderboardMode,
      requirements: ARENA_SEASON.requirements,
      xClaimRequired: ARENA_SEASON.xClaimRequired,
      protocolVersion: ARENA_PROTOCOL_VERSION,
    },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
