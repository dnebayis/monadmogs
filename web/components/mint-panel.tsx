"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useMemo } from "react";
import {
  useAccount,
  useChainId,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { MONAD_MOGS_ABI, MONAD_MOGS_ADDRESS, hasConfiguredContract } from "@/lib/contract";
import { MONAD_CHAIN, MONAD_EXPLORER_URL, MONAD_NETWORK_LABEL } from "@/lib/network";

const FINAL_SUPPLY = 5000;

export function MintPanel() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash });

  const totalSupply = useReadContract({
    address: MONAD_MOGS_ADDRESS,
    abi: MONAD_MOGS_ABI,
    functionName: "totalSupply",
    query: { enabled: hasConfiguredContract },
  });
  const maxSupply = useReadContract({
    address: MONAD_MOGS_ADDRESS,
    abi: MONAD_MOGS_ABI,
    functionName: "MAX_SUPPLY",
    query: { enabled: hasConfiguredContract },
  });
  const walletLimit = useReadContract({
    address: MONAD_MOGS_ADDRESS,
    abi: MONAD_MOGS_ABI,
    functionName: "WALLET_LIMIT",
    query: { enabled: hasConfiguredContract },
  });
  const mintOpen = useReadContract({
    address: MONAD_MOGS_ADDRESS,
    abi: MONAD_MOGS_ABI,
    functionName: "mintOpen",
    query: { enabled: hasConfiguredContract },
  });
  const mintedCount = useReadContract({
    address: MONAD_MOGS_ADDRESS,
    abi: MONAD_MOGS_ABI,
    functionName: "mintedCount",
    args: address ? [address] : undefined,
    query: { enabled: hasConfiguredContract && Boolean(address) },
  });

  const supply = Math.max(Number(totalSupply.data || BigInt(FINAL_SUPPLY)), FINAL_SUPPLY);
  const max = Number(maxSupply.data || BigInt(FINAL_SUPPLY));
  const walletMinted = Number(mintedCount.data || 0n);
  const perWallet = Number(walletLimit.data || 5n);
  const soldOut = true;
  const wrongNetwork = isConnected && chainId !== MONAD_CHAIN.id;
  const disabled =
    !hasConfiguredContract ||
    !isConnected ||
    wrongNetwork ||
    soldOut ||
    !mintOpen.data ||
    walletMinted >= perWallet ||
    isPending ||
    receipt.isLoading;

  const status = useMemo(() => {
    if (!hasConfiguredContract) return "Awaiting deployed contract address";
    if (!isConnected) return "Connect wallet to mint";
    if (wrongNetwork) return `Switch to ${MONAD_NETWORK_LABEL}`;
    if (soldOut) return "Sold out";
    if (!mintOpen.data) return "Mint not open";
    if (walletMinted >= perWallet) return "Wallet mint limit reached";
    if (receipt.isLoading) return "Confirming on Monad";
    if (receipt.isSuccess) return "Mint confirmed";
    return "Ready for free mint";
  }, [isConnected, mintOpen.data, perWallet, receipt.isLoading, receipt.isSuccess, soldOut, walletMinted, wrongNetwork]);

  function mint() {
    writeContract({
      address: MONAD_MOGS_ADDRESS,
      abi: MONAD_MOGS_ABI,
      functionName: "mint",
      gas: 240000n,
    });
  }

  return (
    <section className="mint-surface" aria-label="Mint Monad Mogs">
      <div className="mint-topline">
        <span>{MONAD_NETWORK_LABEL}</span>
        <span>Chain ID {MONAD_CHAIN.id}</span>
      </div>
      <div className="mint-count">
        <strong>{supply.toLocaleString()}</strong>
        <span>/ {max.toLocaleString()} minted</span>
      </div>
      <div className="meter" aria-hidden="true">
        <span style={{ width: `${Math.min(100, (supply / max) * 100)}%` }} />
      </div>
      <p className="mint-status">{status}</p>
      <p className="wallet-count">
        Wallet minted {walletMinted} / {perWallet}
      </p>
      <div className="mint-actions">
        <ConnectButton showBalance={false} />
        {wrongNetwork ? (
          <button className="primary-action" onClick={() => switchChain({ chainId: MONAD_CHAIN.id })}>
            Switch Network
          </button>
        ) : (
          <button className="primary-action" disabled={disabled} onClick={mint}>
            {soldOut ? "Sold out" : "Mint Free"}
          </button>
        )}
      </div>
      <p className="gas-note">
        Mint price is 0 MON. Monad charges gas by the submitted gas limit, so this UI sends a tight explicit limit.
      </p>
      {hash ? (
        <a className="tx-link" href={`${MONAD_EXPLORER_URL}/tx/${hash}`} target="_blank" rel="noreferrer">
          View transaction
        </a>
      ) : null}
      {error ? <p className="error">{error.message}</p> : null}
    </section>
  );
}
