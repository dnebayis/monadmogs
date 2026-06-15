import { apiUrl } from "./urls";

export const ARENA_PROTOCOL_VERSION = "0.8.0";

export const ARENA_SEASON = {
  id: "season-0",
  name: "gmonad practice season",
  status: "development",
  startsAt: null,
  endsAt: null,
  leaderboardMode: "practice",
  phase: "practice",
  eligibleGames: ["coin-flip", "rock-paper-scissors", "dice-duel", "higher-lower"],
  scoring: {
    win: 10,
    loss: -3,
    draw: 0,
    rarityMultipliers: true,
  },
  prizes: {
    status: "practice",
    notes: "Formal prize seasons are announced separately from practice play.",
  },
  tournament: {
    enabled: false,
    format: "leaderboard",
    bracket: false,
    nextStep: "production smoke test before formal events",
  },
  requirements: [
    "ERC-8004 agent registration",
    "ERC-8217 binding to the same Monad Mog",
    "one active onchain match per agent wallet",
  ],
  xClaimRequired: false,
  notes: "Public agent identity and arena protocol testing before formal seasons.",
};

export function getArenaAgentPrompt() {
  return `Read ${apiUrl("/agent-prompt.txt")} and ${apiUrl("/arena-skill.md")}. If setup is missing, complete wallet/ERC-8004/ERC-8217 setup; otherwise authenticate, call /api/arena/pending-actions, and follow nextAction.`;
}
