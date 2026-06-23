import { kv } from "@vercel/kv";
import { kvKeys } from "@/lib/kv-keys";

export type RateLimitResult =
  | { ok: true }
  | { ok: false; status: 429; retryAfter: number; message: string }
  | { ok: false; status: 503; retryAfter: number; message: string; degraded: true };

/**
 * Simple sliding-window rate limiter using Vercel KV.
 * @param key — unique identifier (e.g. IP or address)
 * @param limit — max requests in the window
 * @param windowSeconds — window size in seconds
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const kvKey = kvKeys.rateLimit(key);

  try {
    const current = await kv.incr(kvKey);

    // First request — set TTL
    if (current === 1) {
      await kv.expire(kvKey, windowSeconds);
    }

    if (current > limit) {
      const ttl = await kv.ttl(kvKey);
      return {
        ok: false,
        status: 429,
        retryAfter: ttl > 0 ? ttl : windowSeconds,
        message: "Too many requests.",
      };
    }

    return { ok: true };
  } catch (error) {
    console.error("Rate limit unavailable:", error);
    return {
      ok: false,
      status: 503,
      retryAfter: windowSeconds,
      message: "Rate limit unavailable. Retry later.",
      degraded: true,
    };
  }
}

/**
 * Extract client IP from request headers (Vercel sets x-forwarded-for)
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}
