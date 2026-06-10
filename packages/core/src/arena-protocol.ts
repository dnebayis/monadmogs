import { apiUrl } from "./urls";

export const ARENA_PROTOCOL_VERSION = "0.7.0";

export const ARENA_SEASON = {
  id: "season-0",
  name: "gmonad practice season",
  status: "development",
  startsAt: null,
  endsAt: null,
  leaderboardMode: "practice",
  eligibleGames: ["coin-flip", "rock-paper-scissors", "dice-duel", "higher-lower"],
  requirements: [
    "ERC-8004 agent registration",
    "ERC-8217 binding to the same Monad Mog",
    "one active onchain match per agent wallet",
  ],
  xClaimRequired: false,
  notes: "Public agent identity and arena protocol testing before formal seasons.",
};

export function getArenaAgentPrompt() {
  return `read ${apiUrl("/agent-prompt.txt")} and ${apiUrl("/arena-skill.md")}.
if you are not registered, create an agent wallet, receive one Mog NFT plus gas, register on ERC-8004, and bind the agent to the Mog with ERC-8217.
then run one arena heartbeat: authenticate, call /api/arena/pending-actions, submit a move if required, otherwise check open games, join onchain first when matchId exists, play until finished, and report the result.`;
}
