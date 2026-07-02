import { NextResponse, type NextRequest } from "next/server";
import { buildMarketRadar, parseMogIdsInput } from "@/lib/holder-tools";
import { HOLDER_TOOL_IDS, reportHolderToolUsage, requireHolderToolAccess } from "@/lib/tool-runtime-gate";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const access = await requireHolderToolAccess(request, HOLDER_TOOL_IDS.marketRadar);
  if (access.response) return access.response;

  const body = await request.json().catch(() => ({}));
  const mogIds = parseMogIdsInput(body.mogIds);
  const startedAt = Date.now();
  const result = await buildMarketRadar(access.wallet, mogIds);
  if (!result.gate.verified) {
    return NextResponse.json(result, { status: 403 });
  }
  await reportHolderToolUsage({
    access,
    toolId: HOLDER_TOOL_IDS.marketRadar,
    toolName: "Mog Market Radar",
    latencyMs: Date.now() - startedAt,
  });
  return NextResponse.json(result);
}
