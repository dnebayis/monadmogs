import { NextResponse, type NextRequest } from "next/server";
import { immutableHeaders, parseTokenId } from "@/lib/mogs";
import { getMogRarity, getRaritySummary } from "@/lib/rarity";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const tokenId = parseTokenId(id);

  if (!tokenId) {
    return NextResponse.json({ error: "Token id must be between 1 and 5000." }, { status: 400 });
  }

  const rarity = getMogRarity(tokenId);
  if (!rarity) {
    return NextResponse.json({ error: "Rarity data not found." }, { status: 404 });
  }

  return NextResponse.json(
    {
      ...rarity,
      snapshot: getRaritySummary(),
    },
    { headers: immutableHeaders() },
  );
}
