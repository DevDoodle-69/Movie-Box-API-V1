interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class MemoryCache {
  private store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  async getOrFetch<T>(key: string, fetcher: () => Promise<T>, ttlMs: number): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) return cached;
    const fresh = await fetcher();
    this.set(key, fresh, ttlMs);
    return fresh;
  }

  invalidate(key: string): void {
    this.store.delete(key);
  }

  size(): number {
    return this.store.size;
  }
}

export const cache = new MemoryCache();

export const TTL = {
  TRENDING: 5 * 60 * 1000,       // 5 minutes
  HOMEPAGE: 10 * 60 * 1000,      // 10 minutes
  HOT: 10 * 60 * 1000,           // 10 minutes
  POPULAR: 15 * 60 * 1000,       // 15 minutes
  SUBJECT: 30 * 60 * 1000,       // 30 minutes
  SEASON: 15 * 60 * 1000,        // 15 minutes
  PLAY: 2 * 60 * 1000,           // 2 minutes (URLs may expire)
  RESOURCE: 2 * 60 * 1000,       // 2 minutes (URLs may expire)
} as const;
