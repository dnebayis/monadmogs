import { NextResponse, type NextRequest } from "next/server";
import { resetLeaderboard, getPlayerStats, createOpenGame, linkGameToMatch, GAME_TYPES, TIER_PERKS } from "@/lib/arena";
import { getMogRarity } from "@/lib/rarity";
import { kv } from "@vercel/kv";
import {
  cancelOnchainMatch,
  expireOnchainMatch,
  createOnchainMatch,
  createOnchainMatchWithNftAndToken,
  createOnchainMatchWithNft,
  createOnchainMatchWithToken,
  MOGS_TOKEN_ADDRESS,
  resolveOnchainMatch,
  resolveOnchainDraw,
  gameIdToHash,
} from "@/lib/arena-pool";
import type { Address } from "viem";
import type { GameType } from "@/lib/arena";
import { KV_TTL, kvKeys } from "@/lib/kv-keys";
import { requireAdminSecret } from "@/lib/http-guards";
import { buildArenaHealth } from "@/lib/arena-health";

async function getLinkedGameId(matchId: number, explicitGameId?: unknown) {
  if (typeof explicitGameId === "string" && explicitGameId) return explicitGameId;
  return kv.get<string>(kvKeys.arena.games.gameByMatch(matchId));
}

async function markLinkedResolve(
  matchId: number,
  record: Record<string, unknown>,
  explicitGameId?: unknown
) {
  const gameId = await getLinkedGameId(matchId, explicitGameId);
  if (!gameId) return;
  await kv.set(kvKeys.arena.games.resolve(gameId), record, { ex: KV_TTL.resolve });
}

/* POST /api/arena/admin — admin actions (requires secret) */
export async function POST(request: NextRequest) {
  const admin = requireAdminSecret(request, "Unauthorized.", 401);
  if (!admin.ok) return admin.response;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const action = body.action as string;

  /* ---- Arena health (read-only) ---- */
  if (action === "arena-health") {
    try {
      const health = await buildArenaHealth({
        recentLimit: Number(body.recentLimit || 50),
        matchLimit: Number(body.matchLimit || 20),
      });
      return NextResponse.json({ health });
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 500 });
    }
  }

  /* ---- Create linked offchain game + onchain MON match ---- */
  if (action === "create-linked-game") {
    const { type, entryFee, sponsorMon } = body as {
      type: GameType;
      entryFee: string;
      sponsorMon: string;
    };
    if (!type || !GAME_TYPES[type]) {
      return NextResponse.json({ error: "Valid type required." }, { status: 400 });
    }
    if (!entryFee || !sponsorMon) {
      return NextResponse.json(
        { error: "entryFee and sponsorMon required." },
        { status: 400 }
      );
    }

    const gameId = crypto.randomUUID();
    let match: Awaited<ReturnType<typeof createOnchainMatch>> | null = null;
    try {
      match = await createOnchainMatch(BigInt(entryFee), gameId, BigInt(sponsorMon));
      const game = await createOpenGame(type, gameId);
      await linkGameToMatch(game.id, match.matchId);
      return NextResponse.json(
        {
          success: true,
          game,
          matchId: match.matchId,
          txHash: match.txHash,
          arenaFlow: "linked",
        },
        { status: 201 }
      );
    } catch (err) {
      return NextResponse.json({ error: String(err), gameId, matchId: match?.matchId, txHash: match?.txHash }, { status: 500 });
    }
  }

  /* ---- Create linked offchain game + onchain $MOGS token match ---- */
  if (action === "create-linked-game-mogs") {
    const { type, entryFee, sponsorMon, mogsAmount } = body as {
      type: GameType;
      entryFee: string;
      sponsorMon: string;
      mogsAmount: string;
    };
    if (!type || !GAME_TYPES[type]) {
      return NextResponse.json({ error: "Valid type required." }, { status: 400 });
    }
    if (!entryFee || !mogsAmount) {
      return NextResponse.json(
        { error: "entryFee and mogsAmount required." },
        { status: 400 }
      );
    }

    const gameId = crypto.randomUUID();
    let match: Awaited<ReturnType<typeof createOnchainMatchWithToken>> | null = null;
    try {
      match = await createOnchainMatchWithToken(
        BigInt(entryFee),
        gameId,
        BigInt(sponsorMon || "0"),
        MOGS_TOKEN_ADDRESS,
        BigInt(mogsAmount)
      );
      const game = await createOpenGame(type, gameId);
      await linkGameToMatch(game.id, match.matchId);
      return NextResponse.json(
        {
          success: true,
          game,
          matchId: match.matchId,
          txHash: match.txHash,
          approveTxHash: match.approveTxHash,
          tokenPrize: { token: MOGS_TOKEN_ADDRESS, amount: mogsAmount },
          arenaFlow: "linked",
        },
        { status: 201 }
      );
    } catch (err) {
      return NextResponse.json({ error: String(err), gameId, matchId: match?.matchId, txHash: match?.txHash }, { status: 500 });
    }
  }

  /* ---- Create linked offchain game + onchain NFT + $MOGS token match ---- */
  if (action === "create-linked-game-nft-mogs") {
    const { type, entryFee, sponsorMon, nftCollection, nftTokenId, mogsAmount } = body as {
      type: GameType;
      entryFee: string;
      sponsorMon: string;
      nftCollection: string;
      nftTokenId: string;
      mogsAmount: string;
    };
    if (!type || !GAME_TYPES[type]) {
      return NextResponse.json({ error: "Valid type required." }, { status: 400 });
    }
    if (!entryFee || !nftCollection || !nftTokenId || !mogsAmount) {
      return NextResponse.json(
        { error: "entryFee, nftCollection, nftTokenId, mogsAmount required." },
        { status: 400 }
      );
    }

    const gameId = crypto.randomUUID();
    let match: Awaited<ReturnType<typeof createOnchainMatchWithNftAndToken>> | null = null;
    try {
      match = await createOnchainMatchWithNftAndToken(
        BigInt(entryFee),
        gameId,
        BigInt(sponsorMon || "0"),
        nftCollection as Address,
        BigInt(nftTokenId),
        MOGS_TOKEN_ADDRESS,
        BigInt(mogsAmount)
      );
      const game = await createOpenGame(type, gameId);
      await linkGameToMatch(game.id, match.matchId);
      return NextResponse.json(
        {
          success: true,
          game,
          matchId: match.matchId,
          txHash: match.txHash,
          approveNftTxHash: match.approveNftTxHash,
          approveTokenTxHash: match.approveTokenTxHash,
          tokenPrize: { token: MOGS_TOKEN_ADDRESS, amount: mogsAmount },
          arenaFlow: "linked",
        },
        { status: 201 }
      );
    } catch (err) {
      return NextResponse.json({ error: String(err), gameId, matchId: match?.matchId, txHash: match?.txHash }, { status: 500 });
    }
  }

  /* ---- Create linked offchain game + onchain NFT match ---- */
  if (action === "create-linked-game-nft") {
    const { type, entryFee, sponsorMon, nftCollection, nftTokenId } = body as {
      type: GameType;
      entryFee: string;
      sponsorMon: string;
      nftCollection: string;
      nftTokenId: string;
    };
    if (!type || !GAME_TYPES[type]) {
      return NextResponse.json({ error: "Valid type required." }, { status: 400 });
    }
    if (!entryFee || !nftCollection || !nftTokenId) {
      return NextResponse.json(
        { error: "entryFee, nftCollection, nftTokenId required." },
        { status: 400 }
      );
    }

    const gameId = crypto.randomUUID();
    let match: Awaited<ReturnType<typeof createOnchainMatchWithNft>> | null = null;
    try {
      match = await createOnchainMatchWithNft(
        BigInt(entryFee),
        gameId,
        BigInt(sponsorMon || "0"),
        nftCollection as Address,
        BigInt(nftTokenId)
      );
      const game = await createOpenGame(type, gameId);
      await linkGameToMatch(game.id, match.matchId);
      return NextResponse.json(
        {
          success: true,
          game,
          matchId: match.matchId,
          txHash: match.txHash,
          approveTxHash: match.approveTxHash,
          arenaFlow: "linked",
        },
        { status: 201 }
      );
    } catch (err) {
      return NextResponse.json({ error: String(err), gameId, matchId: match?.matchId, txHash: match?.txHash }, { status: 500 });
    }
  }

  /* ---- Create onchain match (MON only) ---- */
  if (action === "create-match") {
    const { gameId, entryFee, sponsorMon } = body as {
      gameId: string;
      entryFee: string; // in wei
      sponsorMon: string; // in wei
    };
    if (!gameId || !entryFee || !sponsorMon) {
      return NextResponse.json(
        { error: "gameId, entryFee, sponsorMon required." },
        { status: 400 }
      );
    }
    try {
      const result = await createOnchainMatch(
        BigInt(entryFee),
        gameId,
        BigInt(sponsorMon)
      );
      return NextResponse.json({ success: true, txHash: result.txHash });
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 500 });
    }
  }

  /* ---- Create onchain match with NFT ---- */
  if (action === "create-match-nft") {
    const { gameId, entryFee, sponsorMon, nftCollection, nftTokenId } = body as {
      gameId: string;
      entryFee: string;
      sponsorMon: string;
      nftCollection: string;
      nftTokenId: string;
    };
    if (!gameId || !entryFee || !nftCollection || !nftTokenId) {
      return NextResponse.json(
        { error: "gameId, entryFee, nftCollection, nftTokenId required." },
        { status: 400 }
      );
    }
    try {
      const result = await createOnchainMatchWithNft(
        BigInt(entryFee),
        gameId,
        BigInt(sponsorMon || "0"),
        nftCollection as Address,
        BigInt(nftTokenId)
      );
      return NextResponse.json({
        success: true,
        txHash: result.txHash,
        approveTxHash: result.approveTxHash,
      });
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 500 });
    }
  }

  /* ---- Resolve match ---- */
  if (action === "resolve-match") {
    const { matchId, winner, gameId } = body as { matchId: number; winner: string; gameId?: string };
    if (!matchId || !winner) {
      return NextResponse.json({ error: "matchId and winner required." }, { status: 400 });
    }
    try {
      const result = await resolveOnchainMatch(matchId, winner);
      await markLinkedResolve(matchId, {
        status: "resolved",
        matchId,
        winnerAddress: winner,
        txHash: result.txHash,
        resolvedAt: new Date().toISOString(),
        source: "admin",
      }, gameId);
      return NextResponse.json({ success: true, txHash: result.txHash });
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 500 });
    }
  }

  /* ---- Resolve draw ---- */
  if (action === "resolve-draw") {
    const matchId = body.matchId as number;
    if (!matchId) {
      return NextResponse.json({ error: "matchId required." }, { status: 400 });
    }
    try {
      const result = await resolveOnchainDraw(matchId);
      await markLinkedResolve(matchId, {
        status: "resolved",
        matchId,
        winnerAddress: null,
        txHash: result.txHash,
        resolvedAt: new Date().toISOString(),
        source: "admin",
      }, body.gameId);
      return NextResponse.json({ success: true, txHash: result.txHash });
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 500 });
    }
  }

  /* ---- Cancel match ---- */
  if (action === "cancel-match") {
    const matchId = body.matchId as number;
    if (!matchId || matchId < 1) {
      return NextResponse.json({ error: "Valid matchId required." }, { status: 400 });
    }
    try {
      const result = await cancelOnchainMatch(matchId);
      await markLinkedResolve(matchId, {
        status: "cancelled",
        matchId,
        txHash: result.txHash,
        resolvedAt: new Date().toISOString(),
        source: "admin",
      }, body.gameId);
      return NextResponse.json({ success: true, txHash: result.txHash });
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 500 });
    }
  }

  /* ---- Expire match ---- */
  if (action === "expire-match") {
    const matchId = body.matchId as number;
    if (!matchId || matchId < 1) {
      return NextResponse.json({ error: "Valid matchId required." }, { status: 400 });
    }
    try {
      const result = await expireOnchainMatch(matchId);
      await markLinkedResolve(matchId, {
        status: "resolved",
        matchId,
        winnerAddress: null,
        txHash: result.txHash,
        resolvedAt: new Date().toISOString(),
        source: "admin-expire",
      }, body.gameId);
      return NextResponse.json({ success: true, txHash: result.txHash });
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 500 });
    }
  }

  /* ---- Reset leaderboard ---- */
  if (action === "reset-leaderboard") {
    try {
      await resetLeaderboard();
      return NextResponse.json({ success: true, message: "Leaderboard reset." });
    } catch {
      return NextResponse.json({ error: "Reset failed." }, { status: 500 });
    }
  }

  /* ---- Player stats ---- */
  if (action === "player-stats") {
    const address = body.address as string;
    if (!address) {
      return NextResponse.json({ error: "address required." }, { status: 400 });
    }
    const stats = await getPlayerStats(address);
    return NextResponse.json({ stats });
  }

  /* ---- Game hash helper ---- */
  if (action === "game-hash") {
    const gameId = body.gameId as string;
    if (!gameId) {
      return NextResponse.json({ error: "gameId required." }, { status: 400 });
    }
    return NextResponse.json({ gameId, hash: gameIdToHash(gameId) });
  }

  /* ---- Bug reports ---- */
  if (action === "bug-reports") {
    try {
      const limit = Math.min(Math.max(Number(body.limit || 25), 1), 100);
      const ids = await kv.lrange<string>(kvKeys.arena.reports.list, 0, limit - 1);
      const reports = await Promise.all(ids.map((id) => kv.get(kvKeys.arena.reports.item(id))));
      return NextResponse.json({ reports: reports.filter(Boolean) });
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 500 });
    }
  }

  /* ---- Recalculate reputation with tier multipliers ---- */
  if (action === "recalculate-reputation") {
    try {
      const addresses = await kv.zrange<string[]>(kvKeys.arena.leaderboard.sortedSet, 0, -1);
      let updated = 0;
      for (const addr of addresses) {
        const stats = await kv.get<{
          address: string;
          mogId: number;
          mogName: string;
          wins: number;
          losses: number;
          draws: number;
          games: number;
          reputation: number;
        }>(kvKeys.arena.leaderboard.playerStats(addr));
        if (!stats) continue;

        const rarity = getMogRarity(stats.mogId);
        const perks = TIER_PERKS[rarity?.tier || "common"];
        const multiplier = perks.reputationMultiplier;
        const reputation = Math.floor(Math.max(0, stats.wins * 10 - stats.losses * 3) * multiplier);

        const updatedStats = { ...stats, reputation };
        await kv.set(kvKeys.arena.leaderboard.playerStats(addr), updatedStats);
        await kv.zadd(kvKeys.arena.leaderboard.sortedSet, { score: reputation, member: addr });
        updated++;
      }
      return NextResponse.json({ success: true, updated });
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 500 });
    }
  }

  return NextResponse.json(
    {
      error: "Invalid action.",
      valid: [
        "create-match",
        "create-match-nft",
        "arena-health",
        "create-linked-game",
        "create-linked-game-mogs",
        "create-linked-game-nft",
        "create-linked-game-nft-mogs",
        "resolve-match",
        "resolve-draw",
        "cancel-match",
        "expire-match",
        "reset-leaderboard",
        "recalculate-reputation",
        "player-stats",
        "game-hash",
        "bug-reports",
      ],
    },
    { status: 400 }
  );
}
