/**
 * Rate limiter with Upstash Redis (distributed) or in-memory fallback.
 *
 * When UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set,
 * uses @upstash/ratelimit with Redis for distributed rate limiting
 * across all Vercel instances.
 *
 * When env vars are missing, falls back to a per-instance in-memory
 * sliding window (sufficient for development and single-instance deploys).
 *
 * Usage (unchanged from before):
 *   const { limited, remaining } = await rateLimit("login:user@email.com", 5, 15 * 60 * 1000);
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// ─── Upstash Redis (distributed) ─────────────────────────────────
let redisClient: Redis | null = null;
const rateLimiters = new Map<string, Ratelimit>();

function getRedis(): Redis | null {
  if (redisClient) return redisClient;
  if (
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    return redisClient;
  }
  return null;
}

function getUpstashLimiter(limit: number, windowMs: number): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;

  const cacheKey = `${limit}:${windowMs}`;
  let limiter = rateLimiters.get(cacheKey);
  if (!limiter) {
    const windowSec = Math.ceil(windowMs / 1000);
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`),
      analytics: true,
      prefix: "rl",
    });
    rateLimiters.set(cacheKey, limiter);
  }
  return limiter;
}

// ─── In-memory fallback ──────────────────────────────────────────
interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);
    if (entry.timestamps.length === 0) store.delete(key);
  }
}

function inMemoryRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { limited: boolean; remaining: number; retryAfterMs: number } {
  cleanup(windowMs);
  const now = Date.now();
  let entry = store.get(key);

  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

  if (entry.timestamps.length >= limit) {
    const oldest = entry.timestamps[0];
    const retryAfterMs = windowMs - (now - oldest);
    return { limited: true, remaining: 0, retryAfterMs };
  }

  entry.timestamps.push(now);
  return {
    limited: false,
    remaining: limit - entry.timestamps.length,
    retryAfterMs: 0,
  };
}

// ─── Public API (same signature as before) ───────────────────────

/**
 * Check if a request should be rate-limited.
 *
 * @param key      - Unique identifier (e.g. "login:user@email.com")
 * @param limit    - Max requests allowed in the window
 * @param windowMs - Time window in milliseconds
 * @returns { limited, remaining, retryAfterMs }
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<{ limited: boolean; remaining: number; retryAfterMs: number }> {
  const upstash = getUpstashLimiter(limit, windowMs);

  if (upstash) {
    const result = await upstash.limit(key);
    return {
      limited: !result.success,
      remaining: result.remaining,
      retryAfterMs: result.success ? 0 : Math.max(0, result.reset - Date.now()),
    };
  }

  // Fallback to in-memory
  return inMemoryRateLimit(key, limit, windowMs);
}
