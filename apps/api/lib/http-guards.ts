import { NextResponse, type NextRequest } from "next/server";
import { validateAuthHeader, type AgentSession } from "@/lib/arena-auth";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

export const API_ALLOWED_HEADERS = "authorization, content-type, x-admin-secret";

export type JsonBodyResult =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; response: NextResponse };

export async function parseJsonBody(request: NextRequest): Promise<JsonBodyResult> {
  try {
    return { ok: true, body: (await request.json()) as Record<string, unknown> };
  } catch {
    return { ok: false, response: jsonError("Invalid JSON body.", 400) };
  }
}

export function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...(extra || {}) }, { status });
}

export function authRequiredResponse() {
  return jsonError("Authentication required. Use POST /api/arena/auth to get a session token.", 401);
}

export function rateLimitedResponse(retryAfter: number, message = "Too many requests.", extra?: Record<string, unknown>) {
  return NextResponse.json(
    { error: message, ...(extra || {}) },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}

export function rateLimitUnavailableResponse(message = "Rate limit unavailable. Retry later.", extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, degraded: true, ...(extra || {}) }, { status: 503 });
}

export function requireAdminSecret(request: NextRequest, message = "Only the arena admin can create games.", status = 403) {
  const adminSecret = request.headers.get("x-admin-secret");
  if (!process.env.ARENA_ADMIN_SECRET || adminSecret !== process.env.ARENA_ADMIN_SECRET) {
    return { ok: false as const, response: jsonError(message, status) };
  }
  return { ok: true as const };
}

export async function requireAgentSession(request: NextRequest): Promise<
  | { ok: true; session: AgentSession }
  | { ok: false; response: NextResponse }
> {
  const session = await validateAuthHeader(request.headers.get("authorization"));
  if (!session) return { ok: false, response: authRequiredResponse() };
  return { ok: true, session };
}

export async function enforceRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
  message?: string,
  options?: { includeRetryAfterBody?: boolean },
) {
  const result = await rateLimit(key, limit, windowSeconds);
  if (result.ok) return { ok: true as const };
  const extra = options?.includeRetryAfterBody ? { retryAfter: result.retryAfter } : undefined;
  if (result.status === 503) {
    return { ok: false as const, response: rateLimitUnavailableResponse(result.message, extra) };
  }
  return { ok: false as const, response: rateLimitedResponse(result.retryAfter, message || result.message, extra) };
}

export async function enforceIpRateLimit(
  request: NextRequest,
  prefix: string,
  limit: number,
  windowSeconds: number,
  message?: string,
  options?: { includeRetryAfterBody?: boolean },
) {
  const ip = getClientIp(request);
  return enforceRateLimit(`${prefix}:${ip}`, limit, windowSeconds, message, options);
}
