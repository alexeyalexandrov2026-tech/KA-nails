// Abuse limits. The per-address window lives in memory (per instance), which
// is enough to slow a single client; the daily cap is shared through storage
// and bounds the AI bill.

export class RateLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  /** Records a hit and returns false when the key is over its limit. */
  allow(key: string, now: number): boolean {
    const recent = (this.hits.get(key) ?? []).filter(
      (t) => now - t < this.windowMs,
    );
    if (recent.length >= this.max) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > 10_000) this.prune(now);
    return true;
  }

  private prune(now: number) {
    for (const [key, times] of this.hits) {
      if (times.every((t) => now - t >= this.windowMs)) this.hits.delete(key);
    }
  }
}

export interface DailyCounter {
  /** Adds one and returns the new count for the given UTC day. */
  increment(day: string): Promise<number>;
}

export function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}
