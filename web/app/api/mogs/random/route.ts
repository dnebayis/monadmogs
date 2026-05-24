import { NextResponse } from "next/server";
import { MAX_SUPPLY, enrichMogMetadata, getMogMetadata, immutableHeaders } from "@/lib/mogs";

export const dynamic = "force-dynamic";

export async function GET() {
  const tokenId = Math.floor(Math.random() * MAX_SUPPLY) + 1;
  const metadata = await getMogMetadata(tokenId);

  return NextResponse.json(enrichMogMetadata(metadata), { headers: immutableHeaders() });
}
