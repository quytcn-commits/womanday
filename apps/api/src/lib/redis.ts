import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

export const redis = new Redis(REDIS_URL, {
  lazyConnect: true,
  retryStrategy: (times) => Math.min(times * 100, 3000),
});

redis.on("error", (err) => {
  console.error("[Redis] Connection error:", err.message);
});

redis.on("connect", () => {
  console.log("[Redis] Connected");
});

// ── Rate Limiting ─────────────────────────────────────────────
const CHAT_RATE_WINDOW_MS = 3000; // 3 seconds

export async function checkChatRateLimit(userId: string): Promise<boolean> {
  const key = `ratelimit:chat:${userId}`;
  const now = Date.now();
  const windowStart = now - CHAT_RATE_WINDOW_MS;

  const pipeline = redis.pipeline();
  pipeline.zremrangebyscore(key, 0, windowStart);
  pipeline.zadd(key, now, `${now}`);
  pipeline.zcard(key);
  pipeline.expire(key, 10);
  const results = await pipeline.exec();

  const count = (results?.[2]?.[1] as number) || 0;
  return count <= 1; // allow only 1 per 3s window
}

// ── Wish Rate Limiting ──────────────────────────────────────────
const WISH_RATE_WINDOW_MS = 10000; // 10 seconds

export async function checkWishRateLimit(userId: string): Promise<boolean> {
  const key = `ratelimit:wish:${userId}`;
  const now = Date.now();
  const windowStart = now - WISH_RATE_WINDOW_MS;

  const pipeline = redis.pipeline();
  pipeline.zremrangebyscore(key, 0, windowStart);
  pipeline.zadd(key, now, `${now}`);
  pipeline.zcard(key);
  pipeline.expire(key, 15);
  const results = await pipeline.exec();

  const count = (results?.[2]?.[1] as number) || 0;
  return count <= 1; // allow only 1 per 10s window
}

export default redis;
