import { NextResponse } from "next/server";
import { getArenaProtocol } from "@/lib/arena-protocol";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`arena-introspection:${ip}`, 120, 60);
  if (!rl.ok) {
    return NextResponse.json(
      { error: rl.message, degraded: rl.status === 503 ? true : undefined },
      {
        status: rl.status,
        headers: rl.status === 429 ? { "Retry-After": String(rl.retryAfter) } : undefined,
      },
    );
  }

  return NextResponse.json(getArenaProtocol(), {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
