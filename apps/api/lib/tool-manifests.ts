import { encodeAbiParameters } from "viem";
import { apiUrl } from "@/lib/urls";

const CREATOR_ADDRESS =
  (
    process.env.NEXT_PUBLIC_TOOL_CREATOR_ADDRESS ||
    process.env.TOOL_CREATOR_ADDRESS ||
    "0x0000000000000000000000000000000000000000"
  ).toLowerCase();

const TOOL_MANIFEST_TYPE = "https://ercs.ethereum.org/ERCS/erc-8257#tool-manifest-v1";

type JsonSchemaProperty = {
  type: string;
  description?: string;
  enum?: string[];
  items?: JsonSchemaProperty;
  minimum?: number;
  maximum?: number;
};

type ToolManifest = {
  type: typeof TOOL_MANIFEST_TYPE;
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
  access?: {
    logic: "OR" | "AND";
    requirements: Array<{
      kind: string;
      data: string;
      label: string;
      links?: Record<string, string>;
    }>;
  };
  version: string;
  verifiability: {
    tier: "self-attested";
    execution: "standard";
    description: string;
    dataRetention: "metadata-only";
    sourceVisibility: "open-source";
  };
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

const MONAD_MOGS_ADDRESS = "0x1414f3BAF22404C42fD656af4aFAab4934045137";
const ERC721_ACCESS_KIND = "0xbdf8c428";
const MONAD_MOGS_ACCESS = {
  logic: "OR" as const,
  requirements: [
    {
      kind: ERC721_ACCESS_KIND,
      data: encodeAbiParameters([{ type: "address" }], [MONAD_MOGS_ADDRESS]),
      label: "Hold at least one Monad Mogs NFT on Monad.",
      links: {
        opensea: "https://opensea.io/collection/monad-mogs",
      },
    },
  ],
};

const holderInput = {
  type: "object" as const,
  properties: {
    wallet: {
      type: "string",
      description: "Holder wallet address to verify against Monad ownerOf reads.",
    },
    mogIds: {
      type: "array",
      description: "Optional Monad Mogs token ids to scan, maximum 25.",
      items: {
        type: "integer",
        minimum: 1,
        maximum: 5000,
      },
    },
  },
  required: ["wallet"],
};

const holderMogInput = {
  type: "object" as const,
  properties: {
    wallet: {
      type: "string",
      description: "Holder wallet address to verify against Monad ownerOf reads.",
    },
    mogId: {
      type: "integer",
      description: "Monad Mogs token id, from 1 to 5000.",
      minimum: 1,
      maximum: 5000,
    },
  },
  required: ["wallet", "mogId"],
};

export const toolManifests = {
  "mog-agent-lookup": {
    type: TOOL_MANIFEST_TYPE,
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
    featuredImage: apiUrl("/api/tools/featured-image/mog-agent-lookup"),
    tags: ["ai", "nft", "monad", "mogs", "erc-8004", "erc-8217", "agent"],
    version: "1.0.0",
    verifiability: {
      tier: "self-attested",
      execution: "standard",
      description: "Open-source serverless API endpoint. No hardware attestation is claimed.",
      dataRetention: "metadata-only",
      sourceVisibility: "open-source",
    },
  },
  "mog-persona": {
    type: TOOL_MANIFEST_TYPE,
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
    featuredImage: apiUrl("/api/tools/featured-image/mog-persona"),
    tags: ["ai", "nft", "monad", "mogs", "persona", "agent"],
    version: "1.0.0",
    verifiability: {
      tier: "self-attested",
      execution: "standard",
      description: "Open-source serverless API endpoint. No hardware attestation is claimed.",
      dataRetention: "metadata-only",
      sourceVisibility: "open-source",
    },
  },
  "mog-rarity": {
    type: TOOL_MANIFEST_TYPE,
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
    featuredImage: apiUrl("/api/tools/featured-image/mog-rarity"),
    tags: ["ai", "nft", "monad", "mogs", "rarity"],
    version: "1.0.0",
    verifiability: {
      tier: "self-attested",
      execution: "standard",
      description: "Open-source serverless API endpoint. No hardware attestation is claimed.",
      dataRetention: "metadata-only",
      sourceVisibility: "open-source",
    },
  },
  "mog-holder-portfolio": {
    type: TOOL_MANIFEST_TYPE,
    name: "Mog Holder Portfolio",
    description: "Summarize verified Monad Mogs holdings, rarity, and awakened agent status for a holder wallet.",
    endpoint: apiUrl("/api/tools/mog-holder-portfolio"),
    inputs: holderInput,
    outputs: {
      type: "object",
      properties: {
        wallet: { type: "string" },
        gate: { type: "object" },
        portfolio: { type: "object" },
      },
    },
    creatorAddress: CREATOR_ADDRESS,
    image: apiUrl("/api/agents/image/1"),
    featuredImage: apiUrl("/api/tools/featured-image/mog-holder-portfolio"),
    tags: ["ai", "nft", "monad", "mogs", "holder", "portfolio", "nft-gated"],
    access: MONAD_MOGS_ACCESS,
    version: "1.0.0",
    verifiability: {
      tier: "self-attested",
      execution: "standard",
      description: "Open-source serverless API endpoint. Holder checks use Monad ownerOf reads.",
      dataRetention: "metadata-only",
      sourceVisibility: "open-source",
    },
  },
  "mog-holder-mission-brief": {
    type: TOOL_MANIFEST_TYPE,
    name: "Mog Holder Mission Brief",
    description: "Generate a holder-verified mission brief for a specific Monad Mog agent identity.",
    endpoint: apiUrl("/api/tools/mog-holder-mission-brief"),
    inputs: holderMogInput,
    outputs: {
      type: "object",
      properties: {
        mogId: { type: "integer" },
        wallet: { type: "string" },
        gate: { type: "object" },
        mission: { type: "object" },
      },
    },
    creatorAddress: CREATOR_ADDRESS,
    image: apiUrl("/api/agents/image/1"),
    featuredImage: apiUrl("/api/tools/featured-image/mog-holder-mission-brief"),
    tags: ["ai", "nft", "monad", "mogs", "holder", "mission", "nft-gated"],
    access: MONAD_MOGS_ACCESS,
    version: "1.0.0",
    verifiability: {
      tier: "self-attested",
      execution: "standard",
      description: "Open-source serverless API endpoint. Holder checks use Monad ownerOf reads.",
      dataRetention: "metadata-only",
      sourceVisibility: "open-source",
    },
  },
  "mog-market-radar": {
    type: TOOL_MANIFEST_TYPE,
    name: "Mog Market Radar",
    description: "Return holder-verified rarity, awakening, and collection positioning signals without claiming live market prices.",
    endpoint: apiUrl("/api/tools/mog-market-radar"),
    inputs: holderInput,
    outputs: {
      type: "object",
      properties: {
        wallet: { type: "string" },
        gate: { type: "object" },
        radar: { type: "object" },
      },
    },
    creatorAddress: CREATOR_ADDRESS,
    image: apiUrl("/api/agents/image/1"),
    featuredImage: apiUrl("/api/tools/featured-image/mog-market-radar"),
    tags: ["ai", "nft", "monad", "mogs", "holder", "market", "nft-gated"],
    access: MONAD_MOGS_ACCESS,
    version: "1.0.0",
    verifiability: {
      tier: "self-attested",
      execution: "standard",
      description: "Open-source serverless API endpoint. Holder checks use Monad ownerOf reads; no live listing or offer data is claimed.",
      dataRetention: "metadata-only",
      sourceVisibility: "open-source",
    },
  },
} satisfies Record<string, ToolManifest>;
