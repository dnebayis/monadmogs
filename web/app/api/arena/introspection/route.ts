import { NextResponse } from "next/server";
import { getArenaProtocol } from "@/lib/arena-protocol";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`arena-introspection:${ip}`, 120, 60);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  return NextResponse.json(getArenaProtocol(), {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
