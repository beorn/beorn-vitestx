/**
 * Chaos stream transformers for fuzz testing
 *
 * Composable async iterable transformers that sit between gen() and take()
 * to simulate unreliable delivery: dropped messages, reordering, duplicates,
 * bursts, delays, and gaps.
 *
 * @example
 * ```typescript
 * import { gen, take } from "vitestx"
 * import { drop, reorder, chaos } from "vitestx/chaos"
 *
 * const base = gen(picker)
 * const chaotic = reorder(drop(base, 0.2, rng), 5, rng)
 * for await (const event of take(chaotic, 100)) { ... }
 * ```
 */

import type { SeededRandom } from "../random.js"

// ---------------------------------------------------------------------------
// Individual transformers
// ---------------------------------------------------------------------------

/**
 * Skip items with probability `rate`.
 * Simulates message loss, queue overflow, network drops.
 */
export async function* drop<T>(
  source: AsyncIterable<T>,
  rate: number,
  rng: SeededRandom,
): AsyncGenerator<T> {
  for await (const item of source) {
    if (!rng.bool(rate)) yield item
  }
}

/**
 * Buffer up to `windowSize` items, shuffle, yield when buffer is full.
 * Simulates out-of-order delivery, non-deterministic event ordering.
 */
export async function* reorder<T>(
  source: AsyncIterable<T>,
  windowSize: number,
  rng: SeededRandom,
): AsyncGenerator<T> {
  const buffer: T[] = []
  for await (const item of source) {
    buffer.push(item)
    if (buffer.length >= windowSize) {
      const shuffled = rng.shuffle(buffer)
      buffer.length = 0
      for (const e of shuffled) yield e
    }
  }
  if (buffer.length > 0) {
    const shuffled = rng.shuffle(buffer)
    for (const e of shuffled) yield e
  }
}

/**
 * With probability `rate`, yield the item twice.
 * Simulates duplicate delivery, at-least-once semantics.
 */
export async function* duplicate<T>(
  source: AsyncIterable<T>,
  rate: number,
  rng: SeededRandom,
): AsyncGenerator<T> {
  for await (const item of source) {
    yield item
    if (rng.bool(rate)) yield item
  }
}

/**
 * Collect `burstSize` items, then yield them all at once.
 * Simulates bursty delivery, batched network packets.
 */
export async function* burst<T>(
  source: AsyncIterable<T>,
  burstSize: number,
): AsyncGenerator<T> {
  const buffer: T[] = []
  for await (const item of source) {
    buffer.push(item)
    if (buffer.length >= burstSize) {
      for (const e of buffer) yield e
      buffer.length = 0
    }
  }
  for (const e of buffer) yield e
}

/**
 * Skip the first `count` items.
 * Simulates missed events during initialization, late subscriber.
 */
export async function* initGap<T>(
  source: AsyncIterable<T>,
  count: number,
): AsyncGenerator<T> {
  let skipped = 0
  for await (const item of source) {
    if (skipped < count) {
      skipped++
      continue
    }
    yield item
  }
}

/**
 * Add a random delay before yielding each item.
 * Simulates slow I/O, network latency, disk delays.
 */
export async function* delay<T>(
  source: AsyncIterable<T>,
  minMs: number,
  maxMs: number,
  rng: SeededRandom,
): AsyncGenerator<T> {
  for await (const item of source) {
    const ms = rng.int(minMs, maxMs)
    await new Promise((resolve) => setTimeout(resolve, ms))
    yield item
  }
}

// ---------------------------------------------------------------------------
// Combinator
// ---------------------------------------------------------------------------

/** Configuration for a chaos transformer in the pipeline */
export interface ChaosConfig {
  type: string
  params: Record<string, unknown>
}

/** Registry of transformer factories keyed by config type */
export type ChaosRegistry<T> = Record<
  string,
  (
    source: AsyncIterable<T>,
    params: Record<string, unknown>,
    rng: SeededRandom,
  ) => AsyncIterable<T>
>

/** Built-in transformer registry (works for any T) */
const BUILTIN_REGISTRY: ChaosRegistry<unknown> = {
  drop: (s, p, rng) => drop(s, (p.rate as number) ?? 0.2, rng),
  reorder: (s, p, rng) => reorder(s, (p.windowSize as number) ?? 5, rng),
  duplicate: (s, p, rng) => duplicate(s, (p.rate as number) ?? 0.3, rng),
  burst: (s, p) => burst(s, (p.burstSize as number) ?? 10),
  init_gap: (s, p) => initGap(s, (p.count as number) ?? 5),
  delay: (s, p, rng) =>
    delay(s, (p.minMs as number) ?? 1, (p.maxMs as number) ?? 5, rng),
}

/**
 * Compose multiple chaos transformer configs into a single async iterable pipeline.
 *
 * Uses built-in transformers by default. Pass a custom `registry` to add
 * domain-specific transformers (e.g., FS-specific atomicSave, coalesce).
 *
 * @example
 * ```typescript
 * const chaotic = chaos(source, [
 *   { type: "drop", params: { rate: 0.2 } },
 *   { type: "reorder", params: { windowSize: 5 } },
 * ], rng)
 * ```
 *
 * @example Custom registry
 * ```typescript
 * const chaotic = chaos(source, configs, rng, {
 *   ...builtinChaosRegistry,
 *   atomic_save: (s, p, rng) => atomicSave(s, p.rate, rng),
 * })
 * ```
 */
export function chaos<T>(
  source: AsyncIterable<T>,
  configs: ChaosConfig[],
  rng: SeededRandom,
  registry?: ChaosRegistry<T>,
): AsyncIterable<T> {
  const reg = registry ?? (BUILTIN_REGISTRY as ChaosRegistry<T>)
  let pipeline = source
  for (const config of configs) {
    const factory = reg[config.type]
    if (factory) {
      pipeline = factory(pipeline, config.params, rng)
    }
  }
  return pipeline
}

/** Re-export the built-in registry for extension */
export const builtinChaosRegistry: ChaosRegistry<unknown> = BUILTIN_REGISTRY
