/**
 * Deterministic, seedable PRNG (mulberry32).
 *
 * The engine never uses Math.random() directly: every "choice" flows through a
 * seeded generator so that routine generation is reproducible (critical for
 * tests and for honoring `usedSignatures` anti-repeat logic), while still
 * producing thousands of valid combinations across different seeds.
 */
export class Rng {
  private state: number;

  constructor(seed = 0x9e3779b9) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error("Rng.pick called on empty array");
    return arr[Math.floor(this.next() * arr.length)];
  }

  /** Returns true with probability p ∈ [0, 1]. */
  prob(p: number): boolean {
    return this.next() < p;
  }

  /** Weighted pick: [{item, weight}, ...] — weight is relative. */
  weightedPick<T>(items: ReadonlyArray<{ item: T; weight: number }>): T {
    const total = items.reduce((s, i) => s + i.weight, 0);
    let r = this.next() * total;
    for (const { item, weight } of items) {
      r -= weight;
      if (r <= 0) return item;
    }
    return items[items.length - 1].item;
  }

  /** Fisher-Yates shuffle returning a new array. */
  shuffle<T>(arr: readonly T[]): T[] {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
}
