import { NextResponse, type NextRequest } from "next/server";
import { enrichMogMetadata, getMogMetadata, immutableHeaders, parseTokenId } from "@/lib/mogs";
import { getMogRarity } from "@/lib/rarity";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const tokenId = parseTokenId(id);

  if (!tokenId) {
    return NextResponse.json({ error: "Token id must be between 1 and 5000." }, { status: 400 });
  }

  const metadata = await getMogMetadata(tokenId);

  return NextResponse.json(
    {
      ...enrichMogMetadata(metadata),
      rarity: getMogRarity(tokenId),
    },
    { headers: immutableHeaders() },
  );
}
