import { NextResponse } from "next/server";
import { MAX_SUPPLY, TRAIT_SCHEMA, immutableHeaders } from "@/lib/mogs";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    {
      apiVersion: "v0",
      collection: "Monad Mogs",
      maxSupply: MAX_SUPPLY,
      traits: TRAIT_SCHEMA,
    },
    { headers: immutableHeaders() },
  );
}
