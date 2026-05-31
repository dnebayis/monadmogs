import { NextResponse } from "next/server";
import { immutableHeaders } from "@/lib/mogs";
import { getRaritySummary, RARITY_SNAPSHOT } from "@/lib/rarity";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    {
      ...getRaritySummary(),
      traitFrequencies: RARITY_SNAPSHOT.traitFrequencies,
    },
    { headers: immutableHeaders() },
  );
}
