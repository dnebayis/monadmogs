import { NextResponse, type NextRequest } from "next/server";
import { searchAwakenedAgents } from "@/lib/agent-registry";

export const dynamic = "force-dynamic";

function parseLimit(value: string | null) {
  if (!value) return 50;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 500 ? parsed : null;
}

function parseOffset(value: string | null) {
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function parseAwake(value: string | null) {
  if (value === null || value === "") return null;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return undefined;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = parseLimit(searchParams.get("limit"));
  const offset = parseOffset(searchParams.get("offset"));
  const awake = parseAwake(searchParams.get("awake"));

  if (limit === null) return NextResponse.json({ error: "limit must be an integer from 1 to 500." }, { status: 400 });
  if (offset === null) return NextResponse.json({ error: "offset must be a non-negative integer." }, { status: 400 });
  if (awake === undefined) return NextResponse.json({ error: "awake must be true or false." }, { status: 400 });

  const result = await searchAwakenedAgents({
    q: searchParams.get("q"),
    limit,
    offset,
    awake,
  });

  return NextResponse.json(
    {
      query: searchParams.get("q") || "",
      awake,
      ...result,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
