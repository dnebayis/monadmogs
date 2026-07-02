import { NextResponse, type NextRequest } from "next/server";
import { buildMissionBrief, parseMogIdInput } from "@/lib/holder-tools";
import { HOLDER_TOOL_IDS, reportHolderToolUsage, requireHolderToolAccess } from "@/lib/tool-runtime-gate";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const access = await requireHolderToolAccess(request, HOLDER_TOOL_IDS.missionBrief);
  if (access.response) return access.response;

  const body = await request.json().catch(() => ({}));
  const mogId = parseMogIdInput(body.mogId);
  if (!mogId) {
    return NextResponse.json({ error: "mogId must be between 1 and 5000." }, { status: 400 });
  }

  const startedAt = Date.now();
  const result = await buildMissionBrief(mogId, access.wallet);
  if (!result.gate.verified) {
    return NextResponse.json(result, { status: 403 });
  }
  await reportHolderToolUsage({
    access,
    toolId: HOLDER_TOOL_IDS.missionBrief,
    toolName: "Mog Holder Mission Brief",
    latencyMs: Date.now() - startedAt,
  });
  return NextResponse.json(result);
}
