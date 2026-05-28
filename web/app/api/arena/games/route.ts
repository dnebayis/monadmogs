import { NextResponse, type NextRequest } from "next/server";
import {
  createGame,
  joinGame,
  submitMove,
  getGame,
  type GameType,
  type GameMove,
  type GamePlayer,
  GAME_TYPES,
} from "@/lib/arena";

/* POST /api/arena/games — create, join, or move */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const action = body.action as string;

  /* ---- CREATE ---- */
  if (action === "create") {
    const type = body.type as GameType;
    if (!type || !GAME_TYPES[type]) {
      return NextResponse.json({ error: "Invalid game type." }, { status: 400 });
    }

    const player = validatePlayer(body.player);
    if (!player) {
      return NextResponse.json({ error: "Invalid player data." }, { status: 400 });
    }

    const move = body.move as GameMove | undefined;

    try {
      const game = await createGame(type, player, move);
      return NextResponse.json({ game }, { status: 201 });
    } catch {
      return NextResponse.json({ error: "Failed to create game." }, { status: 500 });
    }
  }

  /* ---- JOIN ---- */
  if (action === "join") {
    const gameId = body.gameId as string;
    if (!gameId) {
      return NextResponse.json({ error: "gameId is required." }, { status: 400 });
    }

    const player = validatePlayer(body.player);
    if (!player) {
      return NextResponse.json({ error: "Invalid player data." }, { status: 400 });
    }

    const move = body.move as GameMove | undefined;

    try {
      const game = await joinGame(gameId, player, move);
      if (!game) {
        return NextResponse.json({ error: "Cannot join this game." }, { status: 400 });
      }
      return NextResponse.json({ game });
    } catch {
      return NextResponse.json({ error: "Failed to join game." }, { status: 500 });
    }
  }

  /* ---- MOVE ---- */
  if (action === "move") {
    const gameId = body.gameId as string;
    const address = body.address as string;
    const move = body.move as GameMove;

    if (!gameId || !address || !move) {
      return NextResponse.json({ error: "gameId, address, and move are required." }, { status: 400 });
    }

    try {
      const game = await submitMove(gameId, address, move);
      if (!game) {
        return NextResponse.json({ error: "Cannot submit move." }, { status: 400 });
      }
      return NextResponse.json({ game });
    } catch {
      return NextResponse.json({ error: "Failed to submit move." }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Invalid action. Use: create, join, move." }, { status: 400 });
}

/* GET /api/arena/games?id={gameId} — get single game */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Game id is required." }, { status: 400 });
  }

  try {
    const game = await getGame(id);
    if (!game) {
      return NextResponse.json({ error: "Game not found." }, { status: 404 });
    }

    // Hide opponent moves for active games
    if (game.status !== "finished") {
      const sanitized = {
        ...game,
        players: game.players.map((p) => ({ ...p, move: undefined })),
      };
      return NextResponse.json({ game: sanitized });
    }

    return NextResponse.json({ game });
  } catch {
    return NextResponse.json({ error: "Failed to fetch game." }, { status: 500 });
  }
}

/* ---- Helpers ---- */

function validatePlayer(data: unknown): GamePlayer | null {
  if (!data || typeof data !== "object") return null;
  const p = data as Record<string, unknown>;

  if (typeof p.address !== "string" || !p.address.startsWith("0x")) return null;
  if (typeof p.mogId !== "number" || p.mogId < 1 || p.mogId > 5000) return null;
  if (typeof p.mogName !== "string" || !p.mogName.trim()) return null;

  return {
    address: p.address,
    mogId: p.mogId,
    mogName: p.mogName.trim(),
  };
}
