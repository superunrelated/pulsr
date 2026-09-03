// Simple in-memory rate limiter (per Edge Function instance). Fine for a
// personal, single-user app — not distributed, resets on cold start.
const hits = new Map<string, number[]>();

export function isRateLimited(
  key: string,
  { maxHits, windowMs }: { maxHits: number; windowMs: number },
): boolean {
  const now = Date.now();
  const timestamps = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  timestamps.push(now);
  hits.set(key, timestamps);
  return timestamps.length > maxHits;
}
