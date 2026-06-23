import { NextResponse, type NextRequest } from "next/server";
import { buildPendingAction } from "@/lib/arena-agent-state";
import { enforceIpRateLimit, requireAgentSession } from "@/lib/http-guards";

export async function GET(request: NextRequest) {
  const limited = await enforceIpRateLimit(request, "arena-pending", 60, 60);
  if (!limited.ok) return limited.response;

  const auth = await requireAgentSession(request);
  if (!auth.ok) return auth.response;

  const pendingAction = await buildPendingAction(auth.session);
  const status =
    pendingAction.degraded
      ? pendingAction.recovery === "conflict" ? 409 : 503
      : 200;

  return NextResponse.json({
    agent: {
      address: auth.session.address,
      agentId: auth.session.agentId,
      mogId: auth.session.mogId,
      mogName: auth.session.mogName,
      sessionExpiresAt: auth.session.expiresAt,
    },
    ...pendingAction,
  }, { status });
}
