import { NextResponse, type NextRequest } from "next/server";
import { buildArenaReceipt } from "@/lib/arena-receipts";
import { jsonError } from "@/lib/http-guards";

export async function GET(request: NextRequest) {
  const gameId = request.nextUrl.searchParams.get("gameId") || "";
  if (!gameId) {
    return jsonError("gameId is required.", 400);
  }

  const result = await buildArenaReceipt(gameId);
  if (!result.ok) {
    return jsonError(result.error, result.status);
  }

  return NextResponse.json({ receipt: result.receipt }, {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
