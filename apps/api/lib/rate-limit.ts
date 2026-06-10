import { kv } from "@vercel/kv";
import { kvKeys } from "@/lib/kv-keys";

type RateLimitResult = { ok: true } | { ok: false; retryAfter: number };

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
      return { ok: false, retryAfter: ttl > 0 ? ttl : windowSeconds };
    }

    return { ok: true };
  } catch (error) {
    // If KV fails, allow the request (fail-open)
    console.error("Rate limit failed open:", error);
    return { ok: true };
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
