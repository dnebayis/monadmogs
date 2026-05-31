import { NextResponse, type NextRequest } from "next/server";
import { resetLeaderboard, getPlayerStats } from "@/lib/arena";
import {
  cancelOnchainMatch,
  createOnchainMatch,
  createOnchainMatchWithNft,
  resolveOnchainMatch,
  resolveOnchainDraw,
  gameIdToHash,
} from "@/lib/arena-pool";
import type { Address } from "viem";

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
    const { matchId, winner } = body as { matchId: number; winner: string };
    if (!matchId || !winner) {
      return NextResponse.json({ error: "matchId and winner required." }, { status: 400 });
    }
    try {
      const result = await resolveOnchainMatch(matchId, winner);
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

  return NextResponse.json(
    {
      error: "Invalid action.",
      valid: [
        "create-match",
        "create-match-nft",
        "resolve-match",
        "resolve-draw",
        "cancel-match",
        "reset-leaderboard",
        "player-stats",
        "game-hash",
      ],
    },
    { status: 400 }
  );
}
