import { NextResponse, type NextRequest } from "next/server";
import { buildMissionBrief, parseMogIdInput, parseWallet } from "@/lib/holder-tools";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const wallet = parseWallet(body.wallet);
  const mogId = parseMogIdInput(body.mogId);

  if (!wallet) {
    return NextResponse.json({ error: "wallet must be a valid EVM address." }, { status: 400 });
  }
  if (!mogId) {
    return NextResponse.json({ error: "mogId must be between 1 and 5000." }, { status: 400 });
  }

  const result = await buildMissionBrief(mogId, wallet);
  if (!result.gate.verified) {
    return NextResponse.json(result, { status: 403 });
  }
  return NextResponse.json(result);
}
