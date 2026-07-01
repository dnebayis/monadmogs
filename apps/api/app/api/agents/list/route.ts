import { NextResponse, type NextRequest } from "next/server";
import { getAwakenedIndex } from "@/lib/agent-registry";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit") || 100), 1), 500);
  const offset = Math.max(Number(searchParams.get("offset") || 0), 0);
  const agents = await getAwakenedIndex();
  const items = agents.slice(offset, offset + limit);

  return NextResponse.json(
    {
      count: agents.length,
      offset,
      limit,
      agents: items,
    },
    { headers: { "Cache-Control": "public, max-age=30" } },
  );
}
