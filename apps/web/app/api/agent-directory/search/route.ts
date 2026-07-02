import { NextResponse, type NextRequest } from "next/server";
import { API_BASE_URL } from "@/lib/urls";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const source = new URL(`${API_BASE_URL}/api/agents/search`);
  const params = new URL(request.url).searchParams;
  params.forEach((value, key) => source.searchParams.set(key, value));

  const response = await fetch(source, {
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
