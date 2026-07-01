import { NextResponse, type NextRequest } from "next/server";
import { getAgentByMog, getAwakenedIndex } from "@/lib/agent-registry";
import { MAX_SUPPLY, enrichMogMetadata, getMogBatch, getMogMetadata } from "@/lib/mogs";
import { getMogRarity } from "@/lib/rarity";

export const dynamic = "force-dynamic";

function parsePositiveInt(value: string | null, fallback: number): number | null {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return null;
  return parsed;
}

function parseAwake(value: string | null) {
  if (value === null || value === "") return null;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return undefined;
}

async function addAgentSummary(item: ReturnType<typeof enrichMogMetadata>) {
  const agent = await getAgentByMog(item.tokenId);
  return {
    ...item,
    rarity: getMogRarity(item.tokenId),
    agentAwake: Boolean(agent),
    agentId: agent?.agent.agentId || null,
    agentBinding: agent
      ? {
          spec: "ERC-8217",
          contract: agent.bindingContract,
          source: agent.source,
        }
      : null,
  };
}

export async function GET(request: NextRequest) {
  const cursor = parsePositiveInt(request.nextUrl.searchParams.get("cursor"), 1);
  const limit = Math.min(parsePositiveInt(request.nextUrl.searchParams.get("limit"), 24) ?? 24, 100);
  const awake = parseAwake(request.nextUrl.searchParams.get("awake"));

  if (awake === undefined) {
    return NextResponse.json({ error: "awake must be true or false." }, { status: 400 });
  }

  if (cursor === null || cursor > MAX_SUPPLY) {
    return NextResponse.json({ error: "Cursor must be between 1 and 5000." }, { status: 400 });
  }

  if (awake !== null) {
    const awakened = await getAwakenedIndex();
    const awakenedIds = new Set(awakened.map((record) => Number(record.tokenId)));
    const tokenIds =
      awake === true
        ? [...awakenedIds].sort((a, b) => a - b)
        : Array.from({ length: MAX_SUPPLY }, (_, index) => index + 1).filter((tokenId) => !awakenedIds.has(tokenId));
    const startIndex = cursor - 1;
    const selectedIds = tokenIds.slice(startIndex, startIndex + limit);
    const results = await Promise.allSettled(selectedIds.map((tokenId) => getMogMetadata(tokenId)));
    const items = await Promise.all(
      results.flatMap((result) => (result.status === "fulfilled" ? [enrichMogMetadata(result.value)] : [])).map(addAgentSummary),
    );

    return NextResponse.json(
      {
        apiVersion: "v0",
        collection: "Monad Mogs",
        maxSupply: MAX_SUPPLY,
        awake,
        cursor,
        limit,
        count: items.length,
        totalFiltered: tokenIds.length,
        nextCursor: startIndex + limit < tokenIds.length ? startIndex + limit + 1 : null,
        items,
      },
      { headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" } },
    );
  }

  const batch = await getMogBatch(cursor, limit);
  const items = await Promise.all(batch.items.map(addAgentSummary));

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
