import { NextResponse, type NextRequest } from "next/server";
import { buildHolderPortfolio, parseMogIdsInput, parseWallet } from "@/lib/holder-tools";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const wallet = parseWallet(body.wallet);
  if (!wallet) {
    return NextResponse.json({ error: "wallet must be a valid EVM address." }, { status: 400 });
  }

  const mogIds = parseMogIdsInput(body.mogIds);
  const result = await buildHolderPortfolio(wallet, mogIds);
  if (!result.gate.verified) {
    return NextResponse.json(result, { status: 403 });
  }
  return NextResponse.json(result);
}
