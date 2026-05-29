import { NextResponse, type NextRequest } from "next/server";
import { createChallenge, verifyAgentWallet } from "@/lib/arena-auth";

/* POST /api/arena/auth — create challenge or verify signature */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const action = body.action as string;

  /* ---- CHALLENGE ---- */
  if (action === "challenge") {
    const address = body.address as string;
    if (!address || !address.startsWith("0x")) {
      return NextResponse.json({ error: "Valid address is required." }, { status: 400 });
    }

    try {
      const challenge = await createChallenge(address);
      return NextResponse.json({ challenge });
    } catch {
      return NextResponse.json({ error: "Failed to create challenge." }, { status: 500 });
    }
  }

  /* ---- VERIFY ---- */
  if (action === "verify") {
    const address = body.address as string;
    const signature = body.signature as string;
    const challenge = body.challenge as string;

    if (!address || !signature || !challenge) {
      return NextResponse.json(
        { error: "address, signature, and challenge are required." },
        { status: 400 }
      );
    }

    try {
      const result = await verifyAgentWallet(address, signature, challenge);
      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: 403 });
      }
      return NextResponse.json({ session: result });
    } catch {
      return NextResponse.json({ error: "Verification failed." }, { status: 500 });
    }
  }

  return NextResponse.json(
    { error: "Invalid action. Use: challenge, verify." },
    { status: 400 }
  );
}
