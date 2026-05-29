import { NextResponse, type NextRequest } from "next/server";
import { resetLeaderboard, getPlayerStats } from "@/lib/arena";
import { cancelPoolOnchain } from "@/lib/arena-pool";

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

  if (action === "cancel-pool") {
    const poolId = body.poolId as number;
    if (!poolId || poolId < 1) {
      return NextResponse.json({ error: "Valid poolId required." }, { status: 400 });
    }
    try {
      const result = await cancelPoolOnchain(poolId);
      return NextResponse.json({ success: true, txHash: result.txHash });
    } catch (err) {
      return NextResponse.json({ error: "Cancel failed.", detail: String(err) }, { status: 500 });
    }
  }

  if (action === "player-stats") {
    const address = body.address as string;
    if (!address) {
      return NextResponse.json({ error: "address required." }, { status: 400 });
    }
    const stats = await getPlayerStats(address);
    return NextResponse.json({ stats });
  }

  return NextResponse.json({ error: "Invalid action. Use: reset-leaderboard, cancel-pool, player-stats." }, { status: 400 });
}
