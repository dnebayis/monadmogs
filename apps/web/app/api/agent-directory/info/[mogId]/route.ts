import { NextResponse, type NextRequest } from "next/server";
import { API_BASE_URL } from "@/lib/urls";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: { params: Promise<{ mogId: string }> }) {
  const { mogId } = await context.params;
  const response = await fetch(`${API_BASE_URL}/api/agents/info/${mogId}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  }).catch((error) => {
    const message = error instanceof Error ? error.message : "Agent info API request failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  });

  if (response instanceof NextResponse) return response;

  const text = await response.text();

  return new NextResponse(text, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") || "application/json",
      "Cache-Control": "no-store",
    },
  });
}
