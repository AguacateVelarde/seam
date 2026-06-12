import { Redis } from "ioredis";

// Storage for sticky A/B variant assignments.
// Redis when REDIS_URL is set; otherwise an in-memory Map (non-persistent,
// resets on restart — acceptable for development and single-instance deploys).
export interface StickyStore {
  get(key: string): Promise<string | null>;
  setex(key: string, ttlSeconds: number, value: string): Promise<void>;
  count(prefix: string): Promise<number | null>;
}

export class RedisStore implements StickyStore {
  private redis: Redis;

  constructor(url: string) {
    this.redis = new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: true });
  }

  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async setex(key: string, ttlSeconds: number, value: string): Promise<void> {
    await this.redis.setex(key, ttlSeconds, value);
  }

  async count(prefix: string): Promise<number | null> {
    let cursor = "0";
    let total = 0;
    do {
      const [next, keys] = await this.redis.scan(cursor, "MATCH", `${prefix}*`, "COUNT", 500);
      cursor = next;
      total += keys.length;
    } while (cursor !== "0");
    return total;
  }
}

export class InMemoryStore implements StickyStore {
  private store = new Map<string, { value: string; expiresAt: number }>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async setex(key: string, ttlSeconds: number, value: string): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async count(prefix: string): Promise<number | null> {
    const now = Date.now();
    let total = 0;
    for (const [key, entry] of this.store) {
      if (key.startsWith(prefix) && entry.expiresAt >= now) total++;
    }
    return total;
  }
}

export const stickyStore: StickyStore = process.env.REDIS_URL
  ? new RedisStore(process.env.REDIS_URL)
  : new InMemoryStore();
