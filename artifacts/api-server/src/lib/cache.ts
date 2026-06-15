interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  hits: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  inflight: number;
  size: number;
  evictions: number;
}

class MemoryCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private inflight = new Map<string, Promise<unknown>>();
  private stats: CacheStats = { hits: 0, misses: 0, inflight: 0, size: 0, evictions: 0 };
  private cleanupTimer: ReturnType<typeof setInterval>;

  constructor(cleanupIntervalMs = 60_000) {
    this.cleanupTimer = setInterval(() => this.cleanup(), cleanupIntervalMs);
    if (typeof this.cleanupTimer.unref === "function") {
      this.cleanupTimer.unref();
    }
  }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      this.stats.misses++;
      return undefined;
    }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.stats.evictions++;
      this.stats.misses++;
      return undefined;
    }
    entry.hits++;
    this.stats.hits++;
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs, hits: 0 });
    this.stats.size = this.store.size;
  }

  /**
   * Get from cache or fetch. Deduplicates concurrent fetches for the same key
   * so that 1000 simultaneous requests for the same uncached key only trigger
   * one upstream call — the rest wait for that single promise to resolve.
   */
  async getOrFetch<T>(key: string, fetcher: () => Promise<T>, ttlMs: number): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) return cached;

    const existing = this.inflight.get(key);
    if (existing) {
      this.stats.inflight++;
      return existing as Promise<T>;
    }

    const promise = fetcher().then((result) => {
      this.set(key, result, ttlMs);
      this.inflight.delete(key);
      return result;
    }).catch((err) => {
      this.inflight.delete(key);
      throw err;
    });

    this.inflight.set(key, promise);
    return promise as Promise<T>;
  }

  invalidate(key: string): void {
    this.store.delete(key);
    this.stats.size = this.store.size;
  }

  invalidatePrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
    this.stats.size = this.store.size;
  }

  size(): number {
    return this.store.size;
  }

  getStats(): CacheStats {
    return { ...this.stats, size: this.store.size, inflight: this.inflight.size };
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
        this.stats.evictions++;
      }
    }
    this.stats.size = this.store.size;
  }

  destroy(): void {
    clearInterval(this.cleanupTimer);
    this.store.clear();
    this.inflight.clear();
  }
}

export const cache = new MemoryCache();

export const TTL = {
  TRENDING:  5  * 60 * 1000,
  HOMEPAGE:  10 * 60 * 1000,
  HOT:       10 * 60 * 1000,
  POPULAR:   15 * 60 * 1000,
  SUBJECT:   30 * 60 * 1000,
  SEASON:    15 * 60 * 1000,
  SEARCH:     5 * 60 * 1000,
  SUGGEST:    5 * 60 * 1000,
  PLAY:       2 * 60 * 1000,
  RESOURCE:   2 * 60 * 1000,
} as const;
