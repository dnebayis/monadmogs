"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

export function ConnectWalletButton() {
  return (
    <div className="global-wallet">
      <ConnectButton
        chainStatus="none"
        showBalance={false}
        accountStatus="avatar"
      />
    </div>
  );
}
