"use client";

import { useState } from "react";

type CopyPromptProps = {
  text: string;
};

export function CopyPrompt({ text }: CopyPromptProps) {
  const [copied, setCopied] = useState(false);

  async function copyText() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="copy-prompt">
      <div className="copy-prompt-top">
        <span>Agent prompt</span>
        <button type="button" className="secondary-action compact-action" onClick={copyText}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="code-block">
        <code>{text}</code>
      </pre>
    </div>
  );
}
