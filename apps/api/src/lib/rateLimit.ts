/** In-memory sliding window. Per process, fine for the MVP. */
export class RateLimiter {
  private hits = new Map<string, number[]>();
  private calls = 0;

  /** Returns true when the call is allowed. */
  allow(key: string, max: number, windowMs: number): boolean {
    const now = Date.now();
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (++this.calls % 1000 === 0) this.sweep(now, windowMs);
    if (recent.length >= max) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }

  private sweep(now: number, windowMs: number) {
    for (const [k, v] of this.hits) {
      if (v.every((t) => now - t >= windowMs)) this.hits.delete(k);
    }
  }
}
