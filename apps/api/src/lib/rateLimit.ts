/** In-memory sliding window. Per process, fine for the MVP. */
export class RateLimiter {
  private hits = new Map<string, { times: number[]; windowMs: number }>();
  private calls = 0;
  private lastSweep = 0;
  /** Hard cap on tracked keys so a flood of distinct keys cannot grow memory without bound. */
  static readonly MAX_KEYS = 50_000;

  /** Returns true when the call is allowed. */
  allow(key: string, max: number, windowMs: number): boolean {
    const now = Date.now();
    if (++this.calls % 1000 === 0) this.sweep(now);
    const entry = this.hits.get(key) ?? { times: [], windowMs };
    entry.windowMs = windowMs;
    entry.times = entry.times.filter((t) => now - t < windowMs);
    // Delete and set again: Map keeps insertion order, so this moves the key to the "most recently used" end.
    this.hits.delete(key);
    this.hits.set(key, entry);
    const allowed = entry.times.length < max;
    if (allowed) entry.times.push(now);
    // Record the call before evicting, or a brand new (still empty) key would be swept away at once.
    if (this.hits.size > RateLimiter.MAX_KEYS) this.evict(now);
    return allowed;
  }

  /** Over the cap: drop expired keys (at most once a second), then the least recently used. */
  private evict(now: number) {
    if (now - this.lastSweep >= 1000) {
      this.lastSweep = now;
      this.sweep(now);
    }
    for (const k of this.hits.keys()) {
      if (this.hits.size <= RateLimiter.MAX_KEYS) break;
      this.hits.delete(k);
    }
  }

  /** Drop only keys whose own window has fully passed. */
  private sweep(now: number) {
    for (const [k, v] of this.hits) {
      if (v.times.every((t) => now - t >= v.windowMs)) this.hits.delete(k);
    }
  }
}
