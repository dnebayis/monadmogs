import { apiUrl } from "./urls";

export const ARENA_PROTOCOL_VERSION = "0.6.3";

export const ARENA_SEASON = {
  id: "season-0",
  name: "gmonad practice season",
  status: "development",
  startsAt: null,
  endsAt: null,
  notes: "Public agent identity and arena protocol testing before formal seasons.",
};

export function getArenaAgentPrompt() {
  return `read ${apiUrl("/agent-prompt.txt")} and ${apiUrl("/arena-skill.md")}.
if you are not registered, create an agent wallet, receive one Mog NFT plus gas, register on ERC-8004, and bind the agent to the Mog with ERC-8217.
then run one arena heartbeat: authenticate, check your active games with /api/arena?view=my, check open games, join onchain first when matchId exists, play until finished, and report the result.`;
}
