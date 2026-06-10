import { type NextRequest } from "next/server";
import { getGame, gameScoreline, sanitizeGameForPublic, type GameResolution } from "@/lib/arena";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { kv } from "@vercel/kv";
import { kvKeys } from "@/lib/kv-keys";

// Max stream duration on Vercel: 25s (well under 30s function limit)
const MAX_DURATION_MS = 25_000;
const POLL_INTERVAL_MS = 2_000;

/**
 * GET /api/arena/games/stream?id={gameId}
 *
 * Server-Sent Events endpoint for live arena game state.
 * Pushes game state every 2 seconds until the game finishes or 25s elapses.
 * Client auto-reconnects via EventSource. Once finished, sends a final
 * "done" event so the client stops reconnecting.
 *
 * Events:
 *   event: state  — full sanitized game state (same shape as GET /api/arena/games?id)
 *   event: done   — game is finished, client should stop
 *   event: error  — game not found or rate limited
 */
export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`arena-stream:${ip}`, 20, 60);
  if (!rl.ok) {
    return new Response(
      `event: error\ndata: ${JSON.stringify({ error: "Too many requests.", retryAfter: rl.retryAfter })}\n\n`,
      {
        status: 429,
        headers: {
          "Content-Type": "text/event-stream",
          "Retry-After": String(rl.retryAfter),
        },
      }
    );
  }

  const { searchParams } = new URL(request.url);
  const gameId = searchParams.get("id");

  if (!gameId) {
    return new Response(
      `event: error\ndata: ${JSON.stringify({ error: "id is required." })}\n\n`,
      { status: 400, headers: { "Content-Type": "text/event-stream" } }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const started = Date.now();

      function send(event: string, data: unknown) {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      }

      // Send initial keepalive comment so connection is established immediately
      controller.enqueue(encoder.encode(`: connected\n\n`));

      while (Date.now() - started < MAX_DURATION_MS) {
        try {
          const game = await getGame(gameId);

          if (!game) {
            send("error", { error: "Game not found.", gameId });
            break;
          }

          const resolve = await getResolveStatus(gameId);
          const payload: Record<string, unknown> = {
            game: game.status === "finished" ? game : sanitizeGameForPublic(game),
            resolve,
            scoreline: gameScoreline(game),
          };

          send("state", payload);

          if (game.status === "finished") {
            send("done", { gameId, finishedAt: game.finishedAt });
            break;
          }
        } catch {
          send("error", { error: "Failed to fetch game state." });
          break;
        }

        // Wait before next poll
        await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

async function getResolveStatus(gameId: string): Promise<GameResolution> {
  const resolve = await kv.get<GameResolution>(kvKeys.arena.games.resolve(gameId));
  if (resolve) return resolve;

  const matchId = await kv.get<number>(kvKeys.arena.games.matchByGame(gameId));
  if (!matchId) {
    return { status: null, reason: "offchain-only game" };
  }

  return {
    status: null,
    matchId,
    reason: "linked prize match exists, but no settlement record has been written yet",
  };
}
