/** In-memory sliding window. Per process, fine for the MVP. */
export class RateLimiter {
  private hits = new Map<string, { times: number[]; windowMs: number }>();
  private calls = 0;

  /** Returns true when the call is allowed. */
  allow(key: string, max: number, windowMs: number): boolean {
    const now = Date.now();
    if (++this.calls % 1000 === 0) this.sweep(now);
    const entry = this.hits.get(key) ?? { times: [], windowMs };
    entry.windowMs = windowMs;
    entry.times = entry.times.filter((t) => now - t < windowMs);
    this.hits.set(key, entry);
    if (entry.times.length >= max) return false;
    entry.times.push(now);
    return true;
  }

  /** Drop only keys whose own window has fully passed. */
  private sweep(now: number) {
    for (const [k, v] of this.hits) {
      if (v.times.every((t) => now - t >= v.windowMs)) this.hits.delete(k);
    }
  }
}
