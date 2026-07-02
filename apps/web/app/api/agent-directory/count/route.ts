import { NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/urls";

export const dynamic = "force-dynamic";

export async function GET() {
  const response = await fetch(`${API_BASE_URL}/api/agents/count`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 30 },
  });
  const text = await response.text();

  return new NextResponse(text, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") || "application/json",
      "Cache-Control": response.headers.get("cache-control") || "public, max-age=30",
    },
  });
}
