import { NextResponse } from "next/server";
import { toolManifests } from "@/lib/tool-manifests";

export function GET() {
  return NextResponse.json(toolManifests["mog-market-radar"], {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
