"use client";

import "@rainbow-me/rainbowkit/styles.css";

import { RainbowKitProvider, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, WagmiProvider } from "wagmi";
import { useState, type ReactNode } from "react";
import { MONAD_CHAIN, MONAD_RPC_URL } from "@/lib/network";

const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "MONAD_MOGS_DEMO";

const config = getDefaultConfig({
  appName: "Monad Mogs",
  projectId: walletConnectProjectId,
  chains: [MONAD_CHAIN],
  transports: {
    [MONAD_CHAIN.id]: http(MONAD_RPC_URL),
  },
  ssr: true,
});

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>{children}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
