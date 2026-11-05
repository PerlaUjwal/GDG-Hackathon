// In-memory TTL Cache for expensive reads
class MemoryCache {
  constructor(defaultTtlMs = 30000) {
    this.cache = new Map();
    this.defaultTtl = defaultTtlMs;
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    return item.value;
  }

  set(key, value, ttlMs = this.defaultTtl) {
    this.cache.set(key, {
      value,
      expiry: Date.now() + ttlMs,
    });
  }

  invalidate(prefix) {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  clear() {
    this.cache.clear();
  }
}

export const apiCache = new MemoryCache(20000); // 20s TTL

