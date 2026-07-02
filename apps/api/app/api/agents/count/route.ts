import { NextResponse } from "next/server";
import { getAwakenedCount } from "@/lib/agent-registry";

export const dynamic = "force-dynamic";

export async function GET() {
  const count = await getAwakenedCount();
  return NextResponse.json({ count }, { headers: { "Cache-Control": "no-store" } });
}
