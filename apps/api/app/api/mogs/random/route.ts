import { NextResponse } from "next/server";
import { MAX_SUPPLY, enrichMogMetadata, getMogMetadata } from "@/lib/mogs";
import { getMogRarity } from "@/lib/rarity";

export const dynamic = "force-dynamic";

export async function GET() {
  const tokenId = Math.floor(Math.random() * MAX_SUPPLY) + 1;
  const metadata = await getMogMetadata(tokenId);

  return NextResponse.json(
    {
      ...enrichMogMetadata(metadata),
      rarity: getMogRarity(tokenId),
    },
    { headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" } },
  );
}
