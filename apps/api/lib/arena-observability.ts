const LONG_HEX_OR_TOKEN = /\b(?:0x)?[a-fA-F0-9]{64,}\b|[A-Za-z0-9_-]{48,}/g;

export function sanitizeOperationalError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error || "Unknown error");
  return raw.replace(LONG_HEX_OR_TOKEN, "[redacted]").slice(0, 500);
}
