import type { Address } from "viem";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type AgentRegistration = {
  owner: string;
  mogId: number;
  agentName: string;
  strategy: string;
  capabilities: string[];
  agentURI: string;
  signature: string;
  txHash?: string;
  createdAt: string;
};

const configuredNetwork = process.env.NEXT_PUBLIC_MONAD_NETWORK;
const isMonadMainnet = configuredNetwork === "mainnet";

/* ------------------------------------------------------------------ */
/*  ERC-8004 Registry Addresses (same across 25+ chains incl. Monad)  */
/* ------------------------------------------------------------------ */

export const ERC8004_IDENTITY_REGISTRY_ADDRESS = (isMonadMainnet
  ? "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"
  : "0x8004A818BFB912233c491871b3d84c89A494BD9e") as Address;
export const ERC8004_REPUTATION_REGISTRY_ADDRESS = "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63" as Address;
// Adapter8004-style contract for new Monad Mogs Agent NFT registrations.
// Env values can override these deployed defaults for forks or redeploys.
export const MOGS_8004_ADAPTER_ADDRESS = (isMonadMainnet
  ? process.env.NEXT_PUBLIC_MOGS_8004_ADAPTER_ADDRESS || "0x0C789bcF41C9F30462250904EF0FB01e502E18f7"
  : process.env.NEXT_PUBLIC_TESTNET_MOGS_8004_ADAPTER_ADDRESS ||
    process.env.NEXT_PUBLIC_MOGS_8004_ADAPTER_ADDRESS ||
    "0x668b0876801923f50B79CA1BFDe7a695D08f4d73") as Address;
// ERC-8217 per-collection binding registry — MogsAgentBindings.sol
// Deployed on Monad mainnet, chain ID 143
export const MOGS_AGENT_BINDINGS_ADDRESS = "0xd79CE369eB5E2Dbf54F697e3215cf99E91691D65" as Address;
export const LEGACY_MOGS_AGENT_BINDINGS_ADDRESS = MOGS_AGENT_BINDINGS_ADDRESS;

/* ------------------------------------------------------------------ */
/*  Identity Registry ABI                                              */
/* ------------------------------------------------------------------ */

export const ERC8004_IDENTITY_REGISTRY_ABI = [
  // --- Registration ---
  {
    type: "function",
    name: "register",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentURI", type: "string" },
      {
        name: "metadata",
        type: "tuple[]",
        components: [
          { name: "metadataKey", type: "string" },
          { name: "metadataValue", type: "bytes" },
        ],
      },
    ],
    outputs: [{ name: "agentId", type: "uint256" }],
  },
  {
    type: "function",
    name: "register",
    stateMutability: "nonpayable",
    inputs: [{ name: "agentURI", type: "string" }],
    outputs: [{ name: "agentId", type: "uint256" }],
  },
  {
    type: "function",
    name: "register",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [{ name: "agentId", type: "uint256" }],
  },

  // --- URI management ---
  {
    type: "function",
    name: "setAgentURI",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "newURI", type: "string" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "tokenURI",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },

  // --- Metadata ---
  {
    type: "function",
    name: "getMetadata",
    stateMutability: "view",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "metadataKey", type: "string" },
    ],
    outputs: [{ name: "", type: "bytes" }],
  },
  {
    type: "function",
    name: "setMetadata",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "metadataKey", type: "string" },
      { name: "metadataValue", type: "bytes" },
    ],
    outputs: [],
  },

  // --- Agent wallet ---
  {
    type: "function",
    name: "setAgentWallet",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "newWallet", type: "address" },
      { name: "deadline", type: "uint256" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getAgentWallet",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "unsetAgentWallet",
    stateMutability: "nonpayable",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [],
  },

  // --- ERC-721 reads ---
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },

  // --- Events ---
  {
    type: "event",
    name: "Registered",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "agentURI", type: "string", indexed: false },
      { name: "owner", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "URIUpdated",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "newURI", type: "string", indexed: false },
      { name: "updatedBy", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "MetadataSet",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "indexedMetadataKey", type: "string", indexed: true },
      { name: "metadataKey", type: "string", indexed: false },
      { name: "metadataValue", type: "bytes", indexed: false },
    ],
  },
] as const;

/* ------------------------------------------------------------------ */
/*  Reputation Registry ABI                                            */
/* ------------------------------------------------------------------ */

export const ERC8004_REPUTATION_REGISTRY_ABI = [
  {
    type: "function",
    name: "giveFeedback",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "value", type: "int128" },
      { name: "valueDecimals", type: "uint8" },
      { name: "tag1", type: "string" },
      { name: "tag2", type: "string" },
      { name: "endpoint", type: "string" },
      { name: "feedbackURI", type: "string" },
      { name: "feedbackHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "revokeFeedback",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "feedbackIndex", type: "uint64" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "appendResponse",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "clientAddress", type: "address" },
      { name: "feedbackIndex", type: "uint64" },
      { name: "responseURI", type: "string" },
      { name: "responseHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getSummary",
    stateMutability: "view",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "clientAddresses", type: "address[]" },
      { name: "tag1", type: "string" },
      { name: "tag2", type: "string" },
    ],
    outputs: [
      { name: "count", type: "uint64" },
      { name: "summaryValue", type: "int128" },
      { name: "summaryValueDecimals", type: "uint8" },
    ],
  },
  {
    type: "function",
    name: "readFeedback",
    stateMutability: "view",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "clientAddress", type: "address" },
      { name: "feedbackIndex", type: "uint64" },
    ],
    outputs: [
      { name: "value", type: "int128" },
      { name: "valueDecimals", type: "uint8" },
      { name: "tag1", type: "string" },
      { name: "tag2", type: "string" },
      { name: "isRevoked", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "readAllFeedback",
    stateMutability: "view",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "clientAddresses", type: "address[]" },
      { name: "tag1", type: "string" },
      { name: "tag2", type: "string" },
      { name: "includeRevoked", type: "bool" },
    ],
    outputs: [
      { name: "clients", type: "address[]" },
      { name: "feedbackIndexes", type: "uint64[]" },
      { name: "values", type: "int128[]" },
      { name: "valueDecimals", type: "uint8[]" },
      { name: "tag1s", type: "string[]" },
      { name: "tag2s", type: "string[]" },
      { name: "revokedStatuses", type: "bool[]" },
    ],
  },
  {
    type: "function",
    name: "getClients",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "", type: "address[]" }],
  },
  {
    type: "function",
    name: "getLastIndex",
    stateMutability: "view",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "clientAddress", type: "address" },
    ],
    outputs: [{ name: "", type: "uint64" }],
  },
  {
    type: "function",
    name: "getIdentityRegistry",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "identityRegistry", type: "address" }],
  },

  // --- Events ---
  {
    type: "event",
    name: "NewFeedback",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "clientAddress", type: "address", indexed: true },
      { name: "feedbackIndex", type: "uint64", indexed: false },
      { name: "value", type: "int128", indexed: false },
      { name: "valueDecimals", type: "uint8", indexed: false },
      { name: "indexedTag1", type: "string", indexed: true },
      { name: "tag1", type: "string", indexed: false },
      { name: "tag2", type: "string", indexed: false },
      { name: "endpoint", type: "string", indexed: false },
      { name: "feedbackURI", type: "string", indexed: false },
      { name: "feedbackHash", type: "bytes32", indexed: false },
    ],
  },
  {
    type: "event",
    name: "FeedbackRevoked",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "clientAddress", type: "address", indexed: true },
      { name: "feedbackIndex", type: "uint64", indexed: true },
    ],
  },
] as const;

/* ------------------------------------------------------------------ */
/*  MogsAgentBindings ABI (ERC-8217)                                   */
/* ------------------------------------------------------------------ */

export const MOGS_AGENT_BINDINGS_ABI = [
  {
    type: "function",
    name: "bind",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "mogId", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "bindingOf",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "standard", type: "uint8" },
          { name: "tokenContract", type: "address" },
          { name: "tokenId", type: "uint256" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "agentOf",
    stateMutability: "view",
    inputs: [{ name: "mogId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "isBound",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "NFT_CONTRACT",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "IDENTITY_REGISTRY",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "event",
    name: "AgentBound",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "standard", type: "uint8", indexed: true },
      { name: "tokenContract", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: false },
      { name: "registeredBy", type: "address", indexed: false },
    ],
  },
] as const;

export const MOGS_8004_ADAPTER_ABI = [
  {
    type: "function",
    name: "registerMogAgent",
    stateMutability: "nonpayable",
    inputs: [
      { name: "mogId", type: "uint256" },
      { name: "agentURI", type: "string" },
    ],
    outputs: [{ name: "agentId", type: "uint256" }],
  },
  {
    type: "function",
    name: "setAgentURI",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "agentURI", type: "string" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "setAgentMetadata",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "metadataKey", type: "string" },
      { name: "metadataValue", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "bindingOf",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "standard", type: "uint8" },
          { name: "tokenContract", type: "address" },
          { name: "tokenId", type: "uint256" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "agentOf",
    stateMutability: "view",
    inputs: [{ name: "mogId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "isController",
    stateMutability: "view",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "account", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "controllerOf",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "NFT_CONTRACT",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "IDENTITY_REGISTRY",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "event",
    name: "AgentBound",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "standard", type: "uint8", indexed: true },
      { name: "tokenContract", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: false },
      { name: "registeredBy", type: "address", indexed: false },
    ],
  },
] as const;
