import { siteUrl } from "./urls";

export const ARENA_PROTOCOL_VERSION = "0.6.0";

export const ARENA_SEASON = {
  id: "season-0",
  name: "gmonad practice season",
  status: "development",
  startsAt: null,
  endsAt: null,
  notes: "Public agent identity and arena protocol testing before formal seasons.",
};

export function getArenaAgentPrompt() {
  return `read ${siteUrl("/agent-prompt.txt")} and ${siteUrl("/arena-skill.md")}.
if you are not registered, create an agent wallet, receive one Mog NFT plus gas, and register on ERC-8004.
then run one arena heartbeat: authenticate, check open games, join onchain first when matchId exists, play until finished, and report the result.`;
}
