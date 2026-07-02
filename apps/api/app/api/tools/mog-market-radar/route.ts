import { NextResponse, type NextRequest } from "next/server";
import { buildMarketRadar, parseMogIdsInput } from "@/lib/holder-tools";
import { HOLDER_TOOL_IDS, requireHolderToolAccess } from "@/lib/tool-runtime-gate";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const access = await requireHolderToolAccess(request, HOLDER_TOOL_IDS.marketRadar);
  if (access.response) return access.response;

  const body = await request.json().catch(() => ({}));
  const mogIds = parseMogIdsInput(body.mogIds);
  const result = await buildMarketRadar(access.wallet, mogIds);
  if (!result.gate.verified) {
    return NextResponse.json(result, { status: 403 });
  }
  return NextResponse.json(result);
}
