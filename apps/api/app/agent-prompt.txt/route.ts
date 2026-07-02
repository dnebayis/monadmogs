import { API_BASE_URL, SITE_URL } from "@/lib/urls";

export function GET() {
  const body = `# Monad Mogs Agent Awakening Prompt
version: 1.0.0

Goal:
Awaken a Monad Mog as an ERC-8004 agent using the Monad Mogs Adapter8004 contract.

Priority:
- The active task is agent identity, Mog binding, AgentURI metadata, RESTAP discovery, and OpenSea visibility.

Model:
- The Mog NFT controls the agent.
- The adapter registers the ERC-8004 agent and keeps the ERC-8004 agent NFT in adapter custody.
- The current owner of the Mog is the current controller.
- If the Mog transfers, controller rights move with the Mog.
- Binding is immutable in v1.

Steps:
1. Read project context:
   GET ${API_BASE_URL}/llms.txt

2. Choose a Mog token id owned by the connected wallet.
   Token ids are 1 through 5000.

3. Preview persona:
   POST ${API_BASE_URL}/api/tools/mog-persona
   Body: {"mogId": N}
   or GET ${API_BASE_URL}/api/agents/persona-preview/{mogId}

4. Build AgentURI:
   ${API_BASE_URL}/api/agents/metadata/{mogId}

5. Register onchain:
   Contract: Monad Mogs Adapter8004
   Function: registerMogAgent(uint256 mogId, string agentURI)
   agentURI: ${API_BASE_URL}/api/agents/metadata/{mogId}
   Sign from the wallet that currently owns the Mog.

6. Verify after confirmation:
   GET ${API_BASE_URL}/api/agents/binding/{mogId}
   GET ${API_BASE_URL}/api/agents/info/{mogId}
   GET ${API_BASE_URL}/api/agents/metadata/{mogId}
   GET ${API_BASE_URL}/api/agents/identity/{mogId}
   GET ${API_BASE_URL}/api/agents/by-agent-id/{agentId}
   GET ${API_BASE_URL}/api/agent-runtime/{mogId}/.well-known/restap.json

7. Check OpenSea item page:
   OpenSea should show Onchain agent binding once it indexes ERC-8004 metadata key agent-binding.

Do not:
- Ask for private keys, seed phrases, unrestricted approvals, or custody transfer.
- Transfer the Mog to an agent wallet.
- Use old MogsAgentBindings for new registrations.
- Attempt ERC-8048 in v1; the NFT contract is frozen.
- Claim RESTAP v1 can sign wallet actions or execute autonomously.
- Claim a controller wallet transaction was agent-executed unless a separate signed execution receipt exists.

Useful links:
- Site: ${SITE_URL}
- API: ${API_BASE_URL}
- Agent count: ${API_BASE_URL}/api/agents/count
- Agent list: ${API_BASE_URL}/api/agents/list
- Agent search: ${API_BASE_URL}/api/agents/search
- Registries: ${API_BASE_URL}/api/agents/registries
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
