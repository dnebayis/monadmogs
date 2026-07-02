import { NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/urls";

export const dynamic = "force-dynamic";

export async function GET() {
  const response = await fetch(`${API_BASE_URL}/api/agents/count`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const text = await response.text();

  return new NextResponse(text, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") || "application/json",
      "Cache-Control": "no-store",
    },
  });
}
