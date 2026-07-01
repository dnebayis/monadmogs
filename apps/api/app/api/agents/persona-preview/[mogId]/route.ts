import { NextResponse, type NextRequest } from "next/server";
import { buildMogPersona } from "@/lib/agent-persona";
import { MAX_SUPPLY, parseTokenId } from "@/lib/mogs";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: { params: Promise<{ mogId: string }> }) {
  const { mogId: rawMogId } = await context.params;
  const mogId = parseTokenId(rawMogId);

  if (!mogId || mogId < 1 || mogId > MAX_SUPPLY) {
    return NextResponse.json({ error: "mogId must be between 1 and 5000." }, { status: 400 });
  }

  const persona = await buildMogPersona(mogId);
  return NextResponse.json(
    {
      mogId,
      awakenedRequired: false,
      ...persona,
    },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
