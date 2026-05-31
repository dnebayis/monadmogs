import { NextResponse } from "next/server";
import { ARENA_SEASON, ARENA_PROTOCOL_VERSION } from "@/lib/arena-protocol";

export function GET() {
  return NextResponse.json(
    {
      season: ARENA_SEASON,
      protocolVersion: ARENA_PROTOCOL_VERSION,
    },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
