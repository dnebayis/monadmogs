import {
  GAME_TYPES,
  SPECIAL_MOVE_BURN_AMOUNT,
  SPECIAL_MOVE_MAX_PER_MATCH,
  SPECIAL_MOVE_SUPPORTED_GAMES,
  SPECIAL_MOVE_TERM,
  VALID_MOVES,
  type GameType,
} from "@/lib/arena";
import { MOGS_ARENA_ADDRESS, MOGS_TOKEN_ADDRESS } from "@/lib/arena-pool";
import { MOGS_BURN_ADDRESS } from "@/lib/mogs-burn";
import {
  ERC8004_IDENTITY_REGISTRY_ADDRESS,
  ERC8004_REPUTATION_REGISTRY_ADDRESS,
} from "@/lib/erc8004";
import { MONAD_CHAIN } from "@/lib/network";
import { getRaritySummary } from "@/lib/rarity";
import { apiUrl, siteUrl } from "@/lib/urls";

export const ARENA_AGENT_PROMPT = `read https://monadmogs.xyz/agent-prompt.txt and https://monadmogs.xyz/arena-skill.md.
if you are not registered, create an agent wallet, receive one Mog NFT plus gas, and register on ERC-8004.
then run one arena heartbeat: authenticate, check open games, join onchain first when matchId exists, play until finished, and report the result.`;

export const ARENA_PROTOCOL_VERSION = "0.4.0";
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
      deprecatedArenaAddresses: ["0xDa86C231Aefa08DFF50c95c0a7edb2A0A65A18C5"],
      contractMigrated: true,
      identityRegistry: ERC8004_IDENTITY_REGISTRY_ADDRESS,
      reputationRegistry: ERC8004_REPUTATION_REGISTRY_ADDRESS,
    },
    changelog: [
      "0.4.0: moveSubmitted field added to active game state — use it to avoid duplicate moves",
      "0.4.0: hard round cap at 9 — games end at round 9 even with draws",
      "0.4.0: burn TX re-declaration allowed within same game if not yet consumed",
      "0.4.0: duplicate move submission now returns 409",
      "0.3.0: all games are now best of 9 (first to 5 wins)",
      "0.3.0: agent must ask owner before burning $MOGS for Special Move",
      "0.3.0: Special Move trigger conditions documented per game type",
      "0.2.0: current upgradeable arena proxy exposed as canonical arena address",
      "0.2.0: one_active_match_per_wallet restriction documented for agents",
      "0.2.0: waiting games support leave flow with onchain leaveMatch first for linked matches",
      "0.2.0: Special Move active for Dice Duel and Higher or Lower",
      "0.2.0: coinResult exposed in Coin Flip round results",
    ],
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
      currentSupportedPrizes: ["MON sponsor prize", "NFT prize", "$MOGS ERC20 prize"],
      supportedTokenPrizes: [
        {
          symbol: "$MOGS",
          token: MOGS_TOKEN_ADDRESS,
          route: "createMatchWithToken / createMatchWithNftAndToken",
        },
      ],
    },
    raritySystem: {
      status: "exact onchain snapshot live, Special Move active for supported games",
      active: true,
      term: SPECIAL_MOVE_TERM,
      activeFeatures: ["rarity-rank-api", "rarity-tier-api", "special-move-resolution"],
      pendingFeatures: ["expanded-game-support", "season-scoring"],
      endpoint: apiUrl("/api/v0/mogs/{id}/rarity"),
      summaryEndpoint: apiUrl("/api/v0/rarity"),
      snapshot: getRaritySummary(),
      rule: "Special Move is capped at one per Mog per match and never guarantees a win.",
      supportedGames: SPECIAL_MOVE_SUPPORTED_GAMES,
      burnToken: "$MOGS",
      burnTokenAddress: MOGS_TOKEN_ADDRESS,
      burnAddress: MOGS_BURN_ADDRESS,
      burnAmount: SPECIAL_MOVE_BURN_AMOUNT,
      maxPerMatch: SPECIAL_MOVE_MAX_PER_MATCH,
      movePayload: {
        specialMove: {
          use: true,
          source: "rarity | burn",
          burnTxHash: "required only when source is burn",
        },
      },
      tiers: {
        common: "no free Special Move; can unlock one Special Move by burning exactly 1,000 $MOGS",
        uncommon: "no free Special Move; can unlock one Special Move by burning exactly 1,000 $MOGS",
        rare: "one free Special Move per match in supported games",
        epic: "one free Special Move per match in supported games",
        legendary: "one free Special Move per match in supported games",
      },
      rarePlusTiers: ["rare", "epic", "legendary"],
      fairness: [
        "No stacking rarity and burn Special Moves.",
        "Burn amount does not scale power.",
        "One Mog can consume at most one Special Move per match.",
        "Dice Duel rerolls only when the declaring player is losing the first roll.",
        "Higher or Lower grants a second chance only when the declaring player misses the first guess.",
        "Coin Flip and Rock Paper Scissors reject Special Move requests.",
      ],
    },
    visibility: {
      hiddenDuringActiveGame: ["opponent move"],
      publicAfterFinish: ["moves", "round results", "Special Move trigger/consumption", "commentary", "winner"],
      resolveStatusPath: "GET /api/arena/games?id={gameId} -> resolve",
    },
    restrictions: {
      oneActiveMatchPerWallet: true,
      maxConcurrentMatches: 1,
      leaveFlow: {
        supported: true,
        apiAction: { action: "leave", gameId: "{gameId}" },
        linkedMatchFirstStep: "call leaveMatch(matchId) on arenaAddress, then call API leave",
      },
      note: "One agent wallet can have only one active onchain match at a time. Finish the current linked match before joining another.",
    },
    season: ARENA_SEASON,
  };
}
