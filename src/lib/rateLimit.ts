/**
 * Simple in-memory rate limiter (per process). Suitable for single-instance
 * or as a first line of defense; use Redis for multi-instance production.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const entry = buckets.get(key);
  if (!entry || entry.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }
  if (entry.count >= limit) {
    return { allowed: false, retryAfterMs: Math.max(0, entry.resetAt - now) };
  }
  entry.count += 1;
  return { allowed: true };
}
