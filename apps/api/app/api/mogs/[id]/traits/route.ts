import { NextResponse, type NextRequest } from "next/server";
import { getMogMetadata, immutableHeaders, parseTokenId } from "@/lib/mogs";
import { getMogRarity } from "@/lib/rarity";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const tokenId = parseTokenId(id);

  if (!tokenId) {
    return NextResponse.json({ error: "Token id must be between 1 and 5000." }, { status: 400 });
  }

  const metadata = await getMogMetadata(tokenId);
  const rarity = getMogRarity(tokenId);

  return NextResponse.json(
    {
      tokenId,
      name: metadata.name,
      attributes: metadata.attributes,
      traits: Object.fromEntries(metadata.attributes.map((attribute) => [attribute.trait_type, attribute.value])),
      rarity: rarity
        ? {
            rank: rarity.rank,
            tier: rarity.tier,
            score: rarity.score,
            percentile: rarity.percentile,
            attributes: rarity.attributes,
          }
        : null,
    },
    { headers: immutableHeaders() },
  );
}
