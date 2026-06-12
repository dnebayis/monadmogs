import { NextResponse, type NextRequest } from "next/server";
import { buildAgentStatus } from "@/lib/arena-agent-state";
import { enforceIpRateLimit, requireAgentSession } from "@/lib/http-guards";

export async function GET(request: NextRequest) {
  const limited = await enforceIpRateLimit(request, "arena-agent-status", 60, 60);
  if (!limited.ok) return limited.response;

  const auth = await requireAgentSession(request);
  if (!auth.ok) return auth.response;

  const status = await buildAgentStatus(auth.session);
  return NextResponse.json(status);
}
