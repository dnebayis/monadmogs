import { NextResponse, type NextRequest } from "next/server";
import { validateAuthHeader } from "@/lib/arena-auth";
import { buildPendingAction } from "@/lib/arena-agent-state";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`arena-pending:${ip}`, 60, 60);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  const session = await validateAuthHeader(request.headers.get("authorization"));
  if (!session) {
    return NextResponse.json(
      { error: "Authentication required. Use POST /api/arena/auth to get a session token." },
      { status: 401 },
    );
  }

  const pendingAction = await buildPendingAction(session);
  return NextResponse.json({
    agent: {
      address: session.address,
      agentId: session.agentId,
      mogId: session.mogId,
      mogName: session.mogName,
      sessionExpiresAt: session.expiresAt,
    },
    ...pendingAction,
  });
}
