// ========================================
// Seeded Random Number Generator
// mulberry32 - deterministic PRNG
// NO React or DOM imports
// ========================================

export function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class SeededRandom {
  private rng: () => number;
  public seed: number;

  constructor(seed: number) {
    this.seed = seed;
    this.rng = mulberry32(seed);
  }

  /** Uniform [0, 1) */
  random(): number {
    return this.rng();
  }

  /** Uniform integer in [min, max] inclusive */
  randInt(min: number, max: number): number {
    return Math.floor(this.random() * (max - min + 1)) + min;
  }

  /** Uniform float in [min, max] */
  uniform(min: number, max: number): number {
    return min + this.random() * (max - min);
  }

  /** Triangular distribution with mode at midpoint */
  triangular(min: number, max: number): number {
    const mid = (min + max) / 2;
    const u = this.random();
    const range = max - min;
    if (range === 0) return min;
    const f = (mid - min) / range;
    if (u < f) {
      return min + Math.sqrt(u * range * (mid - min));
    } else {
      return max - Math.sqrt((1 - u) * range * (max - mid));
    }
  }

  /** Lognormal with given mean and sigma */
  lognormal(mean: number = 1, sigma: number = 0.3): number {
    // Box-Muller transform
    const u1 = this.random();
    const u2 = this.random();
    const z = Math.sqrt(-2 * Math.log(Math.max(u1, 1e-10))) * Math.cos(2 * Math.PI * u2);
    const mu = Math.log(mean) - (sigma * sigma) / 2;
    return Math.exp(mu + sigma * z);
  }

  /** Poisson-distributed random number */
  poisson(lambda: number): number {
    const L = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= this.random();
    } while (p > L);
    return k - 1;
  }

  /** Pick random element from array */
  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.random() * arr.length)];
  }

  /** Shuffle array in place */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}
