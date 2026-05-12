import type { Chain } from "viem";

const configuredNetwork = process.env.NEXT_PUBLIC_MONAD_NETWORK;

export const MONAD_NETWORK = configuredNetwork === "mainnet" ? "mainnet" : "testnet";
export const MONAD_RPC_URL =
  process.env.NEXT_PUBLIC_MONAD_RPC_URL ||
  (MONAD_NETWORK === "mainnet" ? "https://rpc.monad.xyz" : "https://testnet-rpc.monad.xyz");
export const MONAD_EXPLORER_URL = MONAD_NETWORK === "mainnet" ? "https://monadscan.com" : "https://testnet.monadscan.com";
export const MONAD_NETWORK_LABEL = MONAD_NETWORK === "mainnet" ? "Monad Mainnet" : "Monad Testnet";

export const MONAD_CHAIN = {
  id: MONAD_NETWORK === "mainnet" ? 143 : 10143,
  name: MONAD_NETWORK_LABEL,
  nativeCurrency: {
    decimals: 18,
    name: "Monad",
    symbol: "MON",
  },
  rpcUrls: {
    default: {
      http: [MONAD_RPC_URL],
    },
  },
  blockExplorers: {
    default: {
      name: "Monadscan",
      url: MONAD_EXPLORER_URL,
    },
  },
} as const satisfies Chain;
