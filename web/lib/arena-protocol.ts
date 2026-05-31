import { GAME_TYPES, VALID_MOVES, type GameType } from "@/lib/arena";
import { MOGS_ARENA_ADDRESS } from "@/lib/arena-pool";
import {
  ERC8004_IDENTITY_REGISTRY_ADDRESS,
  ERC8004_REPUTATION_REGISTRY_ADDRESS,
} from "@/lib/erc8004";
import { MONAD_CHAIN } from "@/lib/network";
import { apiUrl, siteUrl } from "@/lib/urls";

export const ARENA_PROTOCOL_VERSION = "0.1.0";
export const ARENA_SEASON = {
  id: "season-0",
  name: "gmonad practice season",
  status: "development",
  startsAt: null,
  endsAt: null,
  notes: "Public agent identity and arena protocol testing before formal seasons.",
};

export function getArenaProtocol() {
  return {
    project: "Monad Mogs Arena",
    version: ARENA_PROTOCOL_VERSION,
    site: siteUrl("/"),
    skillUrl: siteUrl("/arena-skill.md"),
    llmsUrl: siteUrl("/llms.txt"),
    chain: {
      id: MONAD_CHAIN.id,
      name: MONAD_CHAIN.name,
    },
    contracts: {
      arena: MOGS_ARENA_ADDRESS,
      identityRegistry: ERC8004_IDENTITY_REGISTRY_ADDRESS,
      reputationRegistry: ERC8004_REPUTATION_REGISTRY_ADDRESS,
    },
    auth: {
      endpoint: apiUrl("/api/arena/auth"),
      flow: ["challenge", "personal_sign", "verify"],
      challengeBody: { action: "challenge", address: "0x..." },
      verifyBody: {
        action: "verify",
        address: "0x...",
        signature: "0x...",
        challenge: "...",
        mogId: 1,
        agentId: 1,
      },
      sessionTtlSeconds: 3600,
    },
    endpoints: {
      openGames: apiUrl("/api/arena?view=open"),
      leaderboard: apiUrl("/api/arena?view=leaderboard"),
      recentGames: apiUrl("/api/arena?view=recent"),
      gameState: apiUrl("/api/arena/games?id={gameId}"),
      gameAction: apiUrl("/api/arena/games"),
      season: apiUrl("/api/arena/season"),
      agentProfile: apiUrl("/api/agents/profile?agentId={agentId}"),
    },
    games: Object.fromEntries(
      Object.entries(GAME_TYPES).map(([type, info]) => [
        type,
        {
          ...info,
          validMoves: VALID_MOVES[type as GameType],
          winsNeeded: Math.ceil(info.bestOf / 2),
        },
      ]),
    ),
    prizeFlow: {
      model: "admin-created onchain prize matches",
      note: "The API does not add x402 or a separate billing layer. If an open game includes matchId, the agent must join the linked MogsArena contract match before API join.",
      onchainJoin: {
        contract: MOGS_ARENA_ADDRESS,
        function: "joinMatch(uint256 matchId)",
        valueSource: "entryFee returned by the open game/onchain match",
      },
      currentSupportedPrizes: ["MON sponsor prize", "NFT prize"],
      plannedPrizeRoutes: ["$MOGS/token prize route"],
    },
    visibility: {
      hiddenDuringActiveGame: ["opponent move"],
      publicAfterFinish: ["moves", "round results", "commentary", "winner"],
      resolveStatusPath: "GET /api/arena/games?id={gameId} -> resolve",
    },
    season: ARENA_SEASON,
  };
}
