// ============================================================
// Redis Client & Caching Utility — Graceful Cache Management
// ============================================================

import { Redis } from "ioredis";
import { createChildLogger } from "./logger.js";

const redisLogger = createChildLogger("Redis");

let redisClient: Redis | null = null;
let isRedisAvailable = false;

/**
 * Initialize Redis connection with fallback handling.
 */
export function initRedis(): Redis {
  const host = process.env.REDIS_HOST || "localhost";
  const port = parseInt(process.env.REDIS_PORT || "6379", 10);

  redisClient = new Redis({
    host,
    port,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    retryStrategy(times) {
      if (times > 3) {
        redisLogger.warn("Maximum connection retries reached. Operating in DB-only mode.");
        return null; // Stop retrying
      }
      return Math.min(times * 200, 1000);
    },
  });

  redisClient.on("connect", () => {
    isRedisAvailable = true;
    redisLogger.info(`Connected successfully → ${host}:${port}`);
  });

  redisClient.on("error", (err) => {
    isRedisAvailable = false;
    redisLogger.warn(`Error/Offline (${err.message}). Falling back to Direct Database Queries.`);
  });

  redisClient.connect().catch((err) => {
    isRedisAvailable = false;
    redisLogger.warn(`Initial connection skipped (${err.message}). Falling back to Database.`);
  });

  return redisClient;
}

/**
 * Get item from cache safely. Returns null on cache miss or Redis failure.
 */
export async function getCache<T>(key: string): Promise<T | null> {
  if (!redisClient || !isRedisAvailable) return null;
  try {
    const data = await redisClient.get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  } catch (err) {
    redisLogger.warn({ key, err }, `Read error for key "${key}"`);
    return null;
  }
}

/**
 * Set item in cache safely with TTL (in seconds). Default TTL: 60s.
 */
export async function setCache(key: string, value: unknown, ttlSeconds = 60): Promise<void> {
  if (!redisClient || !isRedisAvailable) return;
  try {
    const payload = JSON.stringify(value);
    await redisClient.set(key, payload, "EX", ttlSeconds);
  } catch (err) {
    redisLogger.warn({ key, err }, `Write error for key "${key}"`);
  }
}

/**
 * Delete key(s) from cache safely.
 */
export async function delCache(keyOrPattern: string): Promise<void> {
  if (!redisClient || !isRedisAvailable) return;
  try {
    if (keyOrPattern.includes("*")) {
      const keys = await redisClient.keys(keyOrPattern);
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
    } else {
      await redisClient.del(keyOrPattern);
    }
  } catch (err) {
    redisLogger.warn({ keyOrPattern, err }, `Delete error for key "${keyOrPattern}"`);
  }
}

/**
 * Helper to invalidate pageant results cache when scores change.
 */
export async function invalidatePageantResults(pageantId: string): Promise<void> {
  if (!pageantId) return;
  await delCache(`pageant:results:${pageantId}`);
}
