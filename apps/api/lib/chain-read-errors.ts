function collectErrorMessages(error: unknown, messages: string[] = [], depth = 0): string[] {
  if (!error || depth > 4) return messages;

  if (error instanceof Error) {
    messages.push(error.message);
    const extra = error as Error & { shortMessage?: string; details?: string; cause?: unknown };
    if (extra.shortMessage) messages.push(extra.shortMessage);
    if (extra.details) messages.push(extra.details);
    if (extra.cause) collectErrorMessages(extra.cause, messages, depth + 1);
    return messages;
  }

  if (typeof error === "string") {
    messages.push(error);
  }

  return messages;
}

export function classifyContractReadError(error: unknown) {
  const text = collectErrorMessages(error).join(" | ").toLowerCase();
  const notFoundPatterns = [
    "erc721nonexistenttoken",
    "owner query for nonexistent token",
    "token does not exist",
    "token not minted",
    "nonexistent token",
  ];

  if (notFoundPatterns.some((pattern) => text.includes(pattern))) {
    return { kind: "not_found" as const, status: 404, code: "not_found" as const };
  }

  return { kind: "rpc_failure" as const, status: 503, code: "rpc_read_failed" as const };
}
