import { createHash } from "node:crypto";
import { kv } from "@vercel/kv";
import { getGame, type Game, type RoundResult, type RoundSpecialMoveResult } from "@/lib/arena";
import { getResolveStatus } from "@/lib/arena-game-service";
import { kvKeys } from "@/lib/kv-keys";
import { sanitizeOperationalError } from "@/lib/arena-observability";

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(object[key])}`)
    .join(",")}}`;
}

function resultHash(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function sanitizeSpecialMove(move: RoundSpecialMoveResult) {
  return {
    player: move.player,
    source: move.source,
    declared: move.declared,
    triggered: move.triggered,
    consumed: move.consumed,
    effect: move.effect,
    before: move.before,
    after: move.after,
  };
}

function sanitizeRound(round: RoundResult) {
  return {
    round: round.round,
    p1Move: round.p1Move,
    p2Move: round.p2Move,
    p1Result: round.p1Result,
    p2Result: round.p2Result,
    roundWinner: round.roundWinner,
    coinResult: round.coinResult,
    p1CurrentNumber: round.p1CurrentNumber,
    p2CurrentNumber: round.p2CurrentNumber,
    p1NextNumber: round.p1NextNumber,
    p2NextNumber: round.p2NextNumber,
    specialMoves: round.specialMoves?.map(sanitizeSpecialMove) || [],
  };
}

function baseReceipt(game: Game, matchId: number | null, resolve: Awaited<ReturnType<typeof getResolveStatus>>) {
  return {
    version: 1,
    gameId: game.id,
    matchId,
    agentIds: game.players.map((player) => player.agentId),
    mogIds: game.players.map((player) => player.mogId),
    type: game.type,
    status: game.status,
    bestOf: game.bestOf,
    roundsPlayed: game.rounds.length,
    winnerAddress: game.winner || null,
    draw: game.status === "finished" && !game.winner,
    finishReason: game.finishReason || null,
    players: game.players.map((player) => ({
      address: player.address,
      agentId: player.agentId,
      mogId: player.mogId,
      mogName: player.mogName,
      score: player.score,
      specialMoveUsedCount: player.specialMoveUsedCount || 0,
    })),
    rounds: game.rounds.map(sanitizeRound),
    resolve: {
      status: resolve.status,
      matchId: resolve.matchId ?? matchId,
      winnerAddress: resolve.winnerAddress ?? null,
      txHash: resolve.txHash,
      resolvedAt: resolve.resolvedAt,
      failedAt: resolve.failedAt,
      error: resolve.error ? sanitizeOperationalError(resolve.error) : undefined,
      reason: resolve.reason,
    },
    createdAt: game.createdAt,
    finishedAt: game.finishedAt || null,
  };
}

export async function buildArenaReceipt(gameId: string) {
  const game = await getGame(gameId);
  if (!game) {
    return { ok: false as const, status: 404, error: "Game not found." };
  }
  if (game.status !== "finished") {
    return { ok: false as const, status: 409, error: "Receipt is only available for finished games." };
  }

  const resolve = await getResolveStatus(game.id);
  const matchId = resolve.matchId ?? (await kv.get<number>(kvKeys.arena.games.matchByGame(game.id))) ?? null;
  const receiptWithoutHash = baseReceipt(game, matchId, resolve);

  return {
    ok: true as const,
    status: 200,
    receipt: {
      ...receiptWithoutHash,
      resultHash: resultHash(receiptWithoutHash),
    },
  };
}
