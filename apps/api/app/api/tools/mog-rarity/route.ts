import { NextResponse, type NextRequest } from "next/server";
import { getMogMetadata, MAX_SUPPLY, parseTokenId } from "@/lib/mogs";
import { getMogRarity } from "@/lib/rarity";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const mogId = parseTokenId(String(body.mogId || ""));

  if (!mogId || mogId < 1 || mogId > MAX_SUPPLY) {
    return NextResponse.json({ error: "mogId must be between 1 and 5000." }, { status: 400 });
  }

  const [metadata, rarity] = await Promise.all([getMogMetadata(mogId), Promise.resolve(getMogRarity(mogId))]);
  if (!rarity) {
    return NextResponse.json({ error: "Rarity data not found.", mogId }, { status: 404 });
  }

  return NextResponse.json({
    mogId,
    rank: rarity.rank,
    tier: rarity.tier,
    score: rarity.score,
    percentile: rarity.percentile,
    attributes: metadata.attributes,
  });
}
