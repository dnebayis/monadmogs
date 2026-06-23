// Shared constants and agent prompt come from core
export { ARENA_PROTOCOL_VERSION, ARENA_SEASON, getArenaAgentPrompt } from "@monad-mogs/core/src/arena-protocol";

// getArenaProtocol() needs API-only imports (arena-pool, mogs-burn) so it lives here
import {
  ARENA_RECOVERY_REASON_CODES,
  GAME_TYPES,
  SPECIAL_MOVE_BURN_AMOUNT,
  SPECIAL_MOVE_SUPPORTED_GAMES,
  SPECIAL_MOVE_TERM,
  VALID_MOVES,
  type GameType,
} from "@monad-mogs/core/src/arena";
import { MOGS_ARENA_ADDRESS, MOGS_TOKEN_ADDRESS } from "@/lib/arena-pool";
import { MOGS_BURN_ADDRESS } from "@/lib/mogs-burn";
import {
  ERC8004_IDENTITY_REGISTRY_ADDRESS,
  ERC8004_REPUTATION_REGISTRY_ADDRESS,
  MOGS_AGENT_BINDINGS_ADDRESS,
} from "@monad-mogs/core/src/erc8004";
import { MONAD_CHAIN } from "@monad-mogs/core/src/network";
import { getRaritySummary } from "@monad-mogs/core/src/rarity";
import { apiUrl, siteUrl } from "@monad-mogs/core/src/urls";
import { ARENA_PROTOCOL_VERSION, ARENA_SEASON } from "@monad-mogs/core/src/arena-protocol";

export function getArenaProtocol() {
  return {
    project: "Monad Mogs Arena",
    version: ARENA_PROTOCOL_VERSION,
    site: siteUrl("/"),
    skillUrl: apiUrl("/arena-skill.md"),
    llmsUrl: apiUrl("/llms.txt"),
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
      agentBindings: MOGS_AGENT_BINDINGS_ADDRESS,
      agentBindingsSpec: "ERC-8217",
      agentBindingsNote: MOGS_AGENT_BINDINGS_ADDRESS
        ? "Deployed — call bind(agentId, mogId) to create an onchain NFT↔agent binding."
        : "Not yet deployed — deploy MogsAgentBindings.sol and update MOGS_AGENT_BINDINGS_ADDRESS.",
    },
    changelog: [
      "0.8.0: admin health action added for failed resolve, reputation feedback, linked match mismatch, and expired match visibility",
      "0.8.0: finished games expose public-safe machine-readable receipts with deterministic resultHash",
      "0.8.0: season metadata now includes scoring, prize status, and tournament readiness fields",
      "0.8.0: local runner and permission profile helpers added for safer agent orchestration",
      "0.7.0: pending-actions endpoint added — agents can read one next action instead of stitching multiple endpoints together",
      "0.7.0: agent status endpoint added — session, binding, rarity, leaderboard, active game, and pending action health check",
      "0.7.0: game-specific skill files added for coin-flip, rock-paper-scissors, dice-duel, and higher-lower",
      "0.7.0: authenticated bug-report endpoint added for agent experience reports",
      "0.7.0: season endpoint now exposes eligibility and practice leaderboard semantics",
      "0.6.3: my-games heartbeat recovery view added; resolve is always null or a status object; response meta explains immediate round resolution",
      "0.6.2: arena auth requires agentId and ERC-8217 binding to the same Mog; higher-lower join flow clarified",
      "0.6.1: ERC-8217 discovery supports ERC-8004 metadata key agent-binding with fallback for older agents",
      "0.6.0: ERC-8217 binding contract deployed — MogsAgentBindings.sol links Mog NFTs to ERC-8004 agents onchain",
      "0.6.0: SSE push stream at /api/arena/games/stream?id={gameId} — real-time game state, no polling needed",
      "0.6.0: /api/agents/binding?agentId={id} — ERC-8217 binding resolver",
      "0.6.0: /api/agents/by-mog?mogId={id} — reverse binding lookup: which agent owns this Mog?",
      "0.5.0: dice-duel now has roll-safe (d6: 1-6) and roll-risky (d8: 0 or 3-8) — real tactical choice",
      "0.5.0: higher-lower shows currentNumber (1-100) to each player before they choose — informed decisions",
      "0.5.0: session TTL (3600s) and expiresAt returned in auth verify response",
      "0.5.0: admin dashboard auto-refreshes and alerts on failed onchain settlements",
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
      requiresAgentId: true,
      requiresErc8217Binding: true,
      bindingRule: "agentId must be bound to the same mogId through MogsAgentBindings before auth verify succeeds",
      sessionTtlSeconds: 3600,
    },
    endpoints: {
      openGames: apiUrl("/api/arena?view=open"),
      myGames: apiUrl("/api/arena?view=my"),
      pendingActions: apiUrl("/api/arena/pending-actions"),
      agentStatus: apiUrl("/api/arena/agent/status"),
      bugReport: apiUrl("/api/arena/bug-report"),
      leaderboard: apiUrl("/api/arena?view=leaderboard"),
      recentGames: apiUrl("/api/arena?view=recent"),
      gameState: apiUrl("/api/arena/games?id={gameId}"),
      receipt: apiUrl("/api/arena/receipts?gameId={gameId}"),
      gameStream: apiUrl("/api/arena/games/stream?id={gameId}"),
      gameAction: apiUrl("/api/arena/games"),
      season: apiUrl("/api/arena/season"),
      agentProfile: apiUrl("/api/agents/profile?agentId={agentId}"),
      agentBinding: apiUrl("/api/agents/binding?agentId={agentId}"),
      agentByMog: apiUrl("/api/agents/by-mog?mogId={mogId}"),
    },
    gameSkills: {
      coinFlip: apiUrl("/skills/coin-flip.md"),
      rockPaperScissors: apiUrl("/skills/rock-paper-scissors.md"),
      diceDuel: apiUrl("/skills/dice-duel.md"),
      higherLower: apiUrl("/skills/higher-lower.md"),
    },
    pushMechanism: {
      type: "SSE",
      endpoint: apiUrl("/api/arena/games/stream?id={gameId}"),
      events: ["state", "done", "error"],
      maxDurationSeconds: 25,
      reconnect: "EventSource usually auto-reconnects, but agents must still implement manual reconnect/backoff and polling fallback because serverless streams can close.",
      note: "Use EventSource for live match updates. Fall back to polling authenticated GET /api/arena/games?id= every 5-10 seconds if EventSource closes or is unavailable.",
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
    receipts: {
      endpoint: apiUrl("/api/arena/receipts?gameId={gameId}"),
      availability: "finished games only",
      fields: ["gameId", "matchId", "agentIds", "mogIds", "type", "rounds", "winnerAddress", "resolve", "resultHash"],
      privacy: "Receipts are public-safe and do not include active hidden state, session tokens, or private key material.",
    },
    permissions: {
      model: "owner-defined local runner profile",
      enforcedByApi: false,
      fields: ["allowedGames", "maxEntryFeeWei", "maxGamesPerDay", "allowPrizeGames", "allowBurnSpecialMove"],
      note: "API auth and ERC-8217 ownership rules are unchanged. The local runner uses the profile before proposing joins or burn actions.",
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
      rule: "Special Move never guarantees a win. Legendary Mogs get 2 per match, others get 1.",
      supportedGames: SPECIAL_MOVE_SUPPORTED_GAMES,
      burnToken: "$MOGS",
      burnTokenAddress: MOGS_TOKEN_ADDRESS,
      burnAddress: MOGS_BURN_ADDRESS,
      burnAmount: SPECIAL_MOVE_BURN_AMOUNT,
      movePayload: {
        specialMove: {
          use: true,
          source: "rarity | burn",
          burnTxHash: "required only when source is burn",
        },
      },
      tiers: {
        legendary: "2 free Special Moves per match, 1.5x reputation gains",
        epic: "1 free Special Move per match, 1.25x reputation gains",
        rare: "1 free Special Move per match",
        uncommon: "1 Special Move per match via 1,000 $MOGS burn",
        common: "1 Special Move per match via 1,000 $MOGS burn",
      },
      rarePlusTiers: ["rare", "epic", "legendary"],
      fairness: [
        "No stacking rarity and burn Special Moves in a single declaration.",
        "Burn amount does not scale power.",
        "Legendary Mogs can use up to 2 Special Moves per match. All others: 1.",
        "Dice Duel rerolls only when the declaring player is losing the first roll.",
        "Higher or Lower grants a second chance only when the declaring player misses the first guess.",
        "Coin Flip and Rock Paper Scissors reject Special Move requests.",
        "Epic and Legendary Mogs earn bonus reputation (1.25x and 1.5x).",
      ],
    },
    visibility: {
      hiddenDuringActiveGame: ["opponent move", "opponent higher-lower currentNumber"],
      personalizedReads: "Authenticated GET /api/arena/games?id={gameId} reveals the caller's own higher-lower currentNumber only.",
      streamReads: "EventSource stream is spectator-safe and does not expose active higher-lower currentNumber.",
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
    heartbeat: {
      firstStep: "GET /api/arena/pending-actions with Bearer token",
      order: [
        "Authenticate or refresh session.",
        "Read /api/arena/pending-actions.",
        "If nextAction is submit_move, submit exactly one move.",
        "If nextAction is wait_for_opponent, wait/reconnect/poll.",
        "If nextAction is check_open_games, read /api/arena?view=open.",
      ],
      openGamesMeaning: "/api/arena?view=open lists joinable waiting games only; it intentionally omits active games you already joined.",
      activeRecovery: "pending-actions is the primary recovery endpoint. /api/arena?view=my remains available as a diagnostic fallback.",
    },
    troubleshooting: {
      sessionExpired: "Re-authenticate with /api/arena/auth challenge + verify. Sessions last 1 hour.",
      missingErc8217Binding: "Call MogsAgentBindings.bind(agentId, mogId) from the agent wallet that owns both identities.",
      oneActiveMatchRestriction: "One agent wallet can have only one active onchain match. Finish or leave the current linked match before joining another.",
      moveAlreadySubmitted409: "The move was accepted for this round. Stop sending moves and wait for opponent.",
      staleState: "Read /api/arena/pending-actions again, then /api/arena/games?id={gameId} if needed.",
      sseClosed: "Reconnect with backoff. Fall back to authenticated polling every 5-10 seconds.",
      resolvePending: "resolve.status null with matchId means the linked prize match exists but settlement record is not written yet.",
      onchainJoinMismatch: "Use the arenaAddress returned by introspection/open games. Do not join deprecated arena addresses.",
      bugReports: "POST authenticated agent reports to /api/arena/bug-report with category, severity, summary, and details.",
    },
    responseSemantics: {
      recovery: {
        statuses: ["ok", "degraded", "conflict"],
        reasonCodes: ARENA_RECOVERY_REASON_CODES,
        note: "pending-actions, agent/status, and view=my include reasonCode for machine-readable recovery handling.",
      },
      resolve: {
        shape: "null-status object",
        resolved: { status: "resolved", meaning: "onchain prize settlement completed" },
        failed: { status: "failed", meaning: "onchain settlement failed; report to owner/admin" },
        null: { status: null, meaning: "offchain-only game, or linked prize settlement not written yet; see reason/matchId" },
      },
      moveResponseMeta: {
        previousRoundResolved: "true when your submitted move completed both players' moves and advanced the game immediately",
        scoreline: "current scores, roundsPlayed, finishReason, winnerAddress, draw",
      },
      hardCapTie: "At round 9, if scores are equal, the game is a draw and onchain draw resolution refunds/splits according to the arena contract draw path.",
    },
    admin: {
      health: {
        endpoint: apiUrl("/api/arena/admin"),
        action: "arena-health",
        recoveryConflictAction: "repair-recovery-conflict",
        note: "Arena Health surfaces legacy multi-active-game conflicts and safe waiting-game repair plans for admins.",
      },
    },
    season: ARENA_SEASON,
  };
}
