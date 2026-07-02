import { NextResponse, type NextRequest } from "next/server";
import { API_BASE_URL } from "@/lib/urls";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const response = await fetch(`${API_BASE_URL}/api/tools/mog-persona`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  }).catch((error) => {
    const message = error instanceof Error ? error.message : "Persona API request failed.";
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
