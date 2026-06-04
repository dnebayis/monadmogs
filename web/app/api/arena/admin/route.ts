import { NextResponse, type NextRequest } from "next/server";
import { resetLeaderboard, getPlayerStats, createOpenGame, linkGameToMatch, GAME_TYPES } from "@/lib/arena";
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
    try {
      const match = await createOnchainMatch(BigInt(entryFee), gameId, BigInt(sponsorMon));
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
      return NextResponse.json({ error: String(err), gameId }, { status: 500 });
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
    try {
      const match = await createOnchainMatchWithToken(
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
      return NextResponse.json({ error: String(err), gameId }, { status: 500 });
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
    try {
      const match = await createOnchainMatchWithNftAndToken(
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
      return NextResponse.json({ error: String(err), gameId }, { status: 500 });
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
    try {
      const match = await createOnchainMatchWithNft(
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
      return NextResponse.json({ error: String(err), gameId }, { status: 500 });
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

  /* ---- Expire match ---- */
  if (action === "expire-match") {
    const matchId = body.matchId as number;
    if (!matchId || matchId < 1) {
      return NextResponse.json({ error: "Valid matchId required." }, { status: 400 });
    }
    try {
      const result = await expireOnchainMatch(matchId);
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
        "create-linked-game",
        "create-linked-game-mogs",
        "create-linked-game-nft",
        "create-linked-game-nft-mogs",
        "resolve-match",
        "resolve-draw",
        "cancel-match",
        "expire-match",
        "reset-leaderboard",
        "player-stats",
        "game-hash",
      ],
    },
    { status: 400 }
  );
}
