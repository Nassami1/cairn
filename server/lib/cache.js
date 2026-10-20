/**
 * Bounded in-memory caches. Deliberately not durable: a dossier is a snapshot
 * of what the web said when it was asked, and pretending otherwise would be
 * misleading.
 */

export class TtlCache {
  constructor({ ttlMs = 30 * 60 * 1000, max = 200 } = {}) {
    this.ttlMs = ttlMs;
    this.max = max;
    this.map = new Map();
  }

  get(key) {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    // Refresh LRU position.
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key, value) {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    while (this.map.size > this.max) {
      const oldest = this.map.keys().next().value;
      this.map.delete(oldest);
    }
  }

  get size() {
    return this.map.size;
  }

  clear() {
    this.map.clear();
  }
}

/** Fixed-window limiter: enough to stop a runaway tab, not a security boundary. */
export function createRateLimiter({ windowMs = 60_000, limit = 10 } = {}) {
  const buckets = new Map();
  let lastSweep = Date.now();

  return function check(key) {
    const now = Date.now();
    if (now - lastSweep > windowMs * 2) {
      for (const [bucketKey, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(bucketKey);
      }
      lastSweep = now;
    }
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    if (bucket.count >= limit) {
      return { allowed: false, remaining: 0, retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
    }
    bucket.count += 1;
    return { allowed: true, remaining: limit - bucket.count, retryAfter: 0 };
  };
}

/** Simple FIFO semaphore for bounding concurrent upstream work. */
export function createSemaphore(max = 8) {
  let active = 0;
  const queue = [];

  const release = () => {
    active = Math.max(0, active - 1);
    const next = queue.shift();
    if (next) next();
  };

  return {
    get active() {
      return active;
    },
    get waiting() {
      return queue.length;
    },
    acquire() {
      if (active < max) {
        active += 1;
        return Promise.resolve(release);
      }
      return new Promise((resolve) => {
        queue.push(() => {
          active += 1;
          resolve(release);
        });
      });
    },
  };
}
