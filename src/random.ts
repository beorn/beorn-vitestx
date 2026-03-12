/**
 * Seeded random number generator
 *
 * Uses a Linear Congruential Generator (LCG) for reproducible random sequences.
 * Ported from km's chaos testing infrastructure.
 */

export interface SeededRandom {
  /** Get the current seed */
  seed: number

  /** Generate a random integer in [min, max] inclusive */
  int(min: number, max: number): number

  /** Generate a random float in [0, 1) */
  float(): number

  /** Pick a random element from an array */
  pick<T>(array: readonly T[]): T

  /** Pick a random element with weights */
  weightedPick<T extends string>(items: readonly T[], weights: Partial<Record<T, number>>): T

  /** Shuffle an array (returns new array) */
  shuffle<T>(array: readonly T[]): T[]

  /** Generate a random array */
  array<T>(length: number, generator: () => T): T[]

  /** Generate a random boolean with given probability of true */
  bool(probability?: number): boolean

  /** Fork the RNG (create independent stream) */
  fork(): SeededRandom
}

// Linear Congruential Generator constants (same as glibc's rand()).
// Full period of 2^31. See Numerical Recipes §7.1 or Knuth TAOCP Vol 2 §3.2.1.
const LCG_A = 1103515245 // multiplier
const LCG_C = 12345 // increment
const LCG_M = 2 ** 31 // modulus (2^31)

/**
 * Pick a random element from weighted tuples using a pre-generated random float.
 *
 * @param tuples - Array of [weight, value] pairs
 * @param rand - Random float in [0, 1)
 * @returns The selected value
 */
export function weightedPickFromTuples<T>(tuples: readonly (readonly [number, T])[], rand: number): T {
  let total = 0
  for (const [w] of tuples) total += w
  let r = rand * total
  for (const [weight, value] of tuples) {
    r -= weight
    if (r <= 0) return value
  }
  return tuples[tuples.length - 1][1]
}

/**
 * Create a seeded random number generator
 *
 * @param seed - Initial seed (uses Date.now() if not provided)
 * @returns Seeded random number generator
 *
 * @example
 * ```typescript
 * const random = createSeededRandom(12345)
 *
 * // Same seed = same sequence
 * random.int(0, 100)  // always 47 with seed 12345
 * random.pick(['a', 'b', 'c'])  // always 'b' with seed 12345
 * ```
 */
export function createSeededRandom(seed?: number): SeededRandom {
  let state = seed ?? Date.now()

  function next(): number {
    state = (LCG_A * state + LCG_C) % LCG_M
    return state
  }

  const random: SeededRandom = {
    get seed() {
      return state
    },

    float(): number {
      return next() / LCG_M
    },

    int(min: number, max: number): number {
      return Math.floor(random.float() * (max - min + 1)) + min
    },

    pick<T>(array: readonly T[]): T {
      if (array.length === 0) {
        throw new Error("Cannot pick from empty array")
      }
      return array[random.int(0, array.length - 1)]
    },

    weightedPick<T extends string>(items: readonly T[], weights: Partial<Record<T, number>>): T {
      const tuples: [number, T][] = items.map((item) => [weights[item] ?? 1, item])
      return weightedPickFromTuples(tuples, random.float())
    },

    shuffle<T>(array: readonly T[]): T[] {
      const result = [...array]
      for (let i = result.length - 1; i > 0; i--) {
        const j = random.int(0, i)
        ;[result[i], result[j]] = [result[j], result[i]]
      }
      return result
    },

    array<T>(length: number, generator: () => T): T[] {
      return Array.from({ length }, generator)
    },

    bool(probability = 0.5): boolean {
      return random.float() < probability
    },

    fork(): SeededRandom {
      // Use current state to seed new generator
      return createSeededRandom(next())
    },
  }

  return random
}

/**
 * Parse seed from environment or generate random
 */
export function parseSeed(source: "env" | "random" = "env"): number {
  if (source === "env") {
    const envSeed = process.env.FUZZ_SEED
    if (envSeed) {
      const parsed = parseInt(envSeed, 10)
      if (!isNaN(parsed)) {
        return parsed
      }
      console.warn(`Invalid FUZZ_SEED: "${envSeed}", using random seed`)
    }
  }
  return Date.now()
}

/**
 * Parse FUZZ_REPEATS from environment (default: 1)
 *
 * Controls how many times each test.fuzz() test runs with different seeds.
 * Use FUZZ_REPEATS=10000 for CI nightly runs.
 */
export function parseRepeats(): number {
  const env = process.env.FUZZ_REPEATS
  if (env) {
    const parsed = parseInt(env, 10)
    if (!isNaN(parsed) && parsed > 0) {
      return parsed
    }
    console.warn(`Invalid FUZZ_REPEATS: "${env}", using 1`)
  }
  return 1
}

/**
 * Derive N unique seeds from a base seed using LCG
 */
export function deriveSeeds(baseSeed: number, count: number): number[] {
  const seeds: number[] = []
  let state = baseSeed
  for (let i = 0; i < count; i++) {
    state = (LCG_A * state + LCG_C) % LCG_M
    seeds.push(state)
  }
  return seeds
}
