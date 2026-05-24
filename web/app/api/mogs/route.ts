import { NextResponse, type NextRequest } from "next/server";
import { MAX_SUPPLY, getMogBatch, immutableHeaders } from "@/lib/mogs";

export const dynamic = "force-dynamic";

function parsePositiveInt(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return parsed;
}

export async function GET(request: NextRequest) {
  const cursor = parsePositiveInt(request.nextUrl.searchParams.get("cursor"), 1);
  const limit = Math.min(parsePositiveInt(request.nextUrl.searchParams.get("limit"), 24), 100);

  if (cursor > MAX_SUPPLY) {
    return NextResponse.json({ error: "Cursor must be between 1 and 5000." }, { status: 400 });
  }

  const batch = await getMogBatch(cursor, limit);

  return NextResponse.json(
    {
      apiVersion: "v0",
      collection: "Monad Mogs",
      maxSupply: MAX_SUPPLY,
      cursor,
      limit,
      count: batch.items.length,
      nextCursor: batch.nextCursor,
      items: batch.items,
    },
    { headers: immutableHeaders() },
  );
}
