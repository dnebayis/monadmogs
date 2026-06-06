import { NextResponse, type NextRequest } from "next/server";
import { MAX_SUPPLY, getMogBatch } from "@/lib/mogs";
import { getMogRarity } from "@/lib/rarity";

export const dynamic = "force-dynamic";

function parsePositiveInt(value: string | null, fallback: number): number | null {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return null;
  return parsed;
}

export async function GET(request: NextRequest) {
  const cursor = parsePositiveInt(request.nextUrl.searchParams.get("cursor"), 1);
  const limit = Math.min(parsePositiveInt(request.nextUrl.searchParams.get("limit"), 24) ?? 24, 100);

  if (cursor === null || cursor > MAX_SUPPLY) {
    return NextResponse.json({ error: "Cursor must be between 1 and 5000." }, { status: 400 });
  }

  const batch = await getMogBatch(cursor, limit);
  const items = batch.items.map((item) => ({
    ...item,
    rarity: getMogRarity(item.tokenId),
  }));

  return NextResponse.json(
    {
      apiVersion: "v0",
      collection: "Monad Mogs",
      maxSupply: MAX_SUPPLY,
      cursor,
      limit,
      count: items.length,
      nextCursor: batch.nextCursor,
      items,
    },
    { headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" } },
  );
}
