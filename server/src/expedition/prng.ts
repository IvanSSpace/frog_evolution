// Deterministic PRNG for expeditions. No dependencies.
//
// Why deterministic: an expedition log + loot is never stored — it is a PURE
// FUNCTION of (seed, elapsed ticks, content version). The same seed always
// replays the same journey. This keeps the DB tiny and makes the engine
// trivially testable (see demo.ts).
//
// mulberry32: fast, well-distributed 32-bit PRNG.
// xfnv1a: string -> uint32 hash, used to derive an independent sub-seed per
// tick so tick N is reproducible without simulating ticks 0..N-1 in sequence.

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function xfnv1a(str: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619)
  }
  return h >>> 0
}

// Independent, reproducible seed for a given tick of a given expedition.
export function tickSeed(seed: number, tick: number): number {
  return xfnv1a(seed + ':' + tick)
}

// Thin ergonomic wrapper around a raw generator.
export class Rng {
  private next: () => number
  constructor(seed: number) {
    this.next = mulberry32(seed)
  }

  float(): number {
    return this.next()
  }

  // Integer in [min, max] inclusive.
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1))
  }

  // True with probability p (0..1).
  chance(p: number): boolean {
    return this.next() < p
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)]
  }

  // Weighted pick. Items carry a numeric `weight` field.
  weighted<T extends { weight: number }>(items: readonly T[]): T {
    const total = items.reduce((s, it) => s + it.weight, 0)
    let roll = this.next() * total
    for (const it of items) {
      roll -= it.weight
      if (roll <= 0) return it
    }
    return items[items.length - 1]
  }
}
