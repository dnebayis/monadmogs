import { NextResponse, type NextRequest } from "next/server";
import {
  createArenaGameAction,
  getArenaGameView,
  joinArenaGameAction,
  leaveArenaGameAction,
  submitArenaMoveAction,
  type ArenaServiceResult,
} from "@/lib/arena-game-service";
import { validateAuthHeader } from "@/lib/arena-auth";
import {
  enforceIpRateLimit,
  enforceRateLimit,
  jsonError,
  parseJsonBody,
  requireAdminSecret,
  requireAgentSession,
} from "@/lib/http-guards";

function serviceResponse(result: ArenaServiceResult) {
  return NextResponse.json(result.body, { status: result.status, headers: result.headers });
}

/* POST /api/arena/games — create (admin), join, move, or leave */
export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody(request);
  if (!parsed.ok) return parsed.response;

  const body = parsed.body;
  const action = body.action as string;

  if (action === "create") {
    const admin = requireAdminSecret(request);
    if (!admin.ok) return admin.response;
    return serviceResponse(await createArenaGameAction(body));
  }

  const auth = await requireAgentSession(request);
  if (!auth.ok) return auth.response;

  const limited = await enforceRateLimit(`arena-game:${auth.session.address}`, 30, 60, "Too many requests. Try again later.");
  if (!limited.ok) return limited.response;

  if (action === "join") return serviceResponse(await joinArenaGameAction(body, auth.session));
  if (action === "move") return serviceResponse(await submitArenaMoveAction(body, auth.session));
  if (action === "leave") return serviceResponse(await leaveArenaGameAction(body, auth.session));

  return jsonError("Invalid action. Use: create, join, move, leave.", 400);
}

/* GET /api/arena/games?id={gameId} — get single game */
export async function GET(request: NextRequest) {
  const limited = await enforceIpRateLimit(request, "arena-read", 60, 60);
  if (!limited.ok) return limited.response;

  const { searchParams } = new URL(request.url);
  const session = await validateAuthHeader(request.headers.get("authorization"));
  return serviceResponse(await getArenaGameView(searchParams.get("id") || "", session?.address));
}
