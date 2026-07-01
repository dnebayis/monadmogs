import { apiUrl } from "@/lib/urls";

const CREATOR_ADDRESS =
  process.env.NEXT_PUBLIC_TOOL_CREATOR_ADDRESS ||
  process.env.TOOL_CREATOR_ADDRESS ||
  "0x0000000000000000000000000000000000000000";

type JsonSchemaProperty = {
  type: string;
  description?: string;
  enum?: string[];
};

type ToolManifest = {
  type: "https";
  name: string;
  description: string;
  endpoint: string;
  inputs: {
    type: "object";
    properties: Record<string, JsonSchemaProperty>;
    required: string[];
  };
  outputs: {
    type: "object";
    properties: Record<string, JsonSchemaProperty>;
  };
  creatorAddress: string;
  image: string;
  featuredImage: string;
  tags: string[];
};

const baseInput = {
  type: "object" as const,
  properties: {
    mogId: {
      type: "integer",
      description: "Monad Mogs token id, from 1 to 5000.",
    },
  },
  required: ["mogId"],
};

export const toolManifests = {
  "mog-agent-lookup": {
    type: "https",
    name: "Monad Mogs Agent Lookup",
    description: "Read the ERC-8217 onchain agent binding for a Monad Mog.",
    endpoint: apiUrl("/api/tools/mog-agent-lookup"),
    inputs: baseInput,
    outputs: {
      type: "object",
      properties: {
        bound: { type: "boolean" },
        mogId: { type: "integer" },
        agentId: { type: "integer" },
        agentURI: { type: "string" },
        bindingContract: { type: "string" },
      },
    },
    creatorAddress: CREATOR_ADDRESS,
    image: apiUrl("/api/agents/image/1"),
    featuredImage: apiUrl("/api/agents/image/1"),
    tags: ["monad", "mogs", "erc-8004", "erc-8217", "agent"],
  },
  "mog-persona": {
    type: "https",
    name: "Monad Mogs Persona",
    description: "Return a deterministic persona generated from Monad Mogs onchain traits and rarity.",
    endpoint: apiUrl("/api/tools/mog-persona"),
    inputs: baseInput,
    outputs: {
      type: "object",
      properties: {
        mogId: { type: "integer" },
        name: { type: "string" },
        tagline: { type: "string" },
        backstory: { type: "string" },
        systemPrompt: { type: "string" },
      },
    },
    creatorAddress: CREATOR_ADDRESS,
    image: apiUrl("/api/agents/image/1"),
    featuredImage: apiUrl("/api/agents/image/1"),
    tags: ["monad", "mogs", "persona", "agent"],
  },
  "mog-rarity": {
    type: "https",
    name: "Monad Mogs Rarity",
    description: "Return exact rarity rank, tier, score, percentile, and traits for a Monad Mog.",
    endpoint: apiUrl("/api/tools/mog-rarity"),
    inputs: baseInput,
    outputs: {
      type: "object",
      properties: {
        mogId: { type: "integer" },
        rank: { type: "integer" },
        tier: { type: "string" },
        score: { type: "number" },
        percentile: { type: "number" },
      },
    },
    creatorAddress: CREATOR_ADDRESS,
    image: apiUrl("/api/agents/image/1"),
    featuredImage: apiUrl("/api/agents/image/1"),
    tags: ["monad", "mogs", "rarity", "nft"],
  },
} satisfies Record<string, ToolManifest>;
