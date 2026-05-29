import { NextResponse, type NextRequest } from "next/server";
import { resetLeaderboard } from "@/lib/arena";

const ADMIN_SECRET = process.env.ARENA_ADMIN_SECRET || "";

/* POST /api/arena/admin — admin actions (requires secret) */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("x-admin-secret");
  if (!ADMIN_SECRET || authHeader !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const action = body.action as string;

  if (action === "reset-leaderboard") {
    try {
      await resetLeaderboard();
      return NextResponse.json({ success: true, message: "Leaderboard reset." });
    } catch {
      return NextResponse.json({ error: "Reset failed." }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Invalid action." }, { status: 400 });
}
