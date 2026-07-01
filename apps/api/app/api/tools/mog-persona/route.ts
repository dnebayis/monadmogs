import { NextResponse, type NextRequest } from "next/server";
import { buildMogPersona } from "@/lib/agent-persona";
import { MAX_SUPPLY, parseTokenId } from "@/lib/mogs";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const mogId = parseTokenId(String(body.mogId || ""));

  if (!mogId || mogId < 1 || mogId > MAX_SUPPLY) {
    return NextResponse.json({ error: "mogId must be between 1 and 5000." }, { status: 400 });
  }

  const persona = await buildMogPersona(mogId);
  return NextResponse.json({
    mogId,
    name: persona.name,
    tagline: persona.tagline,
    backstory: persona.backstory,
    greeting: persona.greeting,
    personalityTraits: persona.personalityTraits,
    communicationStyle: persona.communicationStyle,
    quirks: persona.quirks,
    systemPrompt: persona.systemPrompt,
    safetyRails: persona.safetyRails,
  });
}
