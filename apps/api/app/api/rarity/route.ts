import { NextResponse } from "next/server";
import { getAwakenedIndex } from "@/lib/agent-registry";
import { getRaritySummary, RARITY_SNAPSHOT } from "@/lib/rarity";

export const dynamic = "force-dynamic";

export async function GET() {
  const awakened = await getAwakenedIndex();
  const awakenedByTier = awakened.reduce<Record<string, number>>((counts, record) => {
    const rarity = RARITY_SNAPSHOT.tokens[String(record.tokenId)];
    if (!rarity) return counts;
    counts[rarity.tier] = (counts[rarity.tier] || 0) + 1;
    return counts;
  }, {});

  return NextResponse.json(
    {
      ...getRaritySummary(),
      traitFrequencies: RARITY_SNAPSHOT.traitFrequencies,
      awakenedCount: awakened.length,
      awakenedByTier,
    },
    { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=60" } },
  );
}
