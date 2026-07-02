import { NextResponse, type NextRequest } from "next/server";
import { buildHolderPortfolio, parseMogIdsInput } from "@/lib/holder-tools";
import { HOLDER_TOOL_IDS, reportHolderToolUsage, requireHolderToolAccess } from "@/lib/tool-runtime-gate";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const access = await requireHolderToolAccess(request, HOLDER_TOOL_IDS.portfolio);
  if (access.response) return access.response;

  const body = await request.json().catch(() => ({}));
  const mogIds = parseMogIdsInput(body.mogIds);
  const startedAt = Date.now();
  const result = await buildHolderPortfolio(access.wallet, mogIds);
  if (!result.gate.verified) {
    return NextResponse.json(result, { status: 403 });
  }
  await reportHolderToolUsage({
    access,
    toolId: HOLDER_TOOL_IDS.portfolio,
    toolName: "Mog Holder Portfolio",
    latencyMs: Date.now() - startedAt,
  });
  return NextResponse.json(result);
}
