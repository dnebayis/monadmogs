import { NextResponse, type NextRequest } from "next/server";
import { createChallenge, verifyAgentWallet } from "@/lib/arena-auth";

/* POST /api/arena/auth — challenge-response agent authentication */
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
    if (!address || !address.startsWith("0x") || address.length !== 42) {
      return NextResponse.json({ error: "Valid Ethereum address is required." }, { status: 400 });
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
    const mogId = typeof body.mogId === "number" ? body.mogId : undefined;

    if (!address || !signature || !challenge) {
      return NextResponse.json(
        { error: "address, signature, and challenge are required." },
        { status: 400 }
      );
    }

    try {
      const result = await verifyAgentWallet(address, signature, challenge, mogId);
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
