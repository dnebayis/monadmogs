"use client";

import { useState } from "react";
import { MAX_SUPPLY } from "@/lib/mogs";

type MogDetailActionsProps = {
  apiUrl: string;
  tokenId: number;
};

export function MogDetailActions({ apiUrl, tokenId }: MogDetailActionsProps) {
  const [copied, setCopied] = useState(false);
  const nextRandomId = ((tokenId * 7919 + 104729) % MAX_SUPPLY) + 1;

  async function copyApiUrl() {
    await navigator.clipboard.writeText(apiUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="hero-actions">
      <a className="text-link muted" href={`/mogs/${nextRandomId}`}>
        Random Mog
      </a>
      <button className="secondary-action" type="button" onClick={copyApiUrl}>
        {copied ? "Copied" : "Copy API URL"}
      </button>
    </div>
  );
}
