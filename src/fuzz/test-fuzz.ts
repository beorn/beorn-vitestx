/**
 * test.fuzz wrapper with auto-tracking, shrinking, and regression
 *
 * Usage:
 * ```typescript
 * import { test } from 'vi-monkey/fuzz'
 *
 * test.fuzz('cursor invariants', async () => {
 *   const handle = await run(<Board />, { cols: 80, rows: 24 })
 *   for await (const key of take(gen(['j','k','h','l']), 100)) {
 *     await handle.press(key)
 *     expect(handle.locator('[data-cursor]').count()).toBe(1)
 *   }
 * })
 * ```
 */

import { test as vitestTest, type TestOptions } from "vitest"
import { fuzzContext, createFuzzContext, createReplayContext, type FuzzContext } from "./context.js"
import { shrinkSequence, formatShrinkResult } from "./shrink.js"
import { saveCase, loadCasesForTest, type SavedCase } from "./regression.js"
import { parseSeed, parseRepeats, deriveSeeds } from "../random.js"

/** Options for test.fuzz */
export interface FuzzTestOptions extends TestOptions {
  /** Seed for reproducibility (default: from FUZZ_SEED env or random) */
  seed?: number
  /** Whether to shrink failing sequences (default: true) */
  shrink?: boolean
  /** Whether to save failing sequences to __fuzz_cases__/ (default: true) */
  save?: boolean
  /** Whether to replay saved failing sequences first (default: true) */
  replay?: boolean
  /** Maximum shrinking attempts (default: 100) */
  maxShrinkAttempts?: number
}

/** Error with fuzz context attached */
export class FuzzError extends Error {
  readonly sequence: unknown[]
  readonly shrunk: unknown[]
  readonly seed: number
  readonly originalError: Error

  constructor(
    originalError: Error,
    info: {
      original: number
      shrunk: number
      sequence: unknown[]
      seed: number
    },
  ) {
    const msg = `Fuzz test failed after ${info.original} steps (shrunk to ${info.shrunk})
Minimal failing sequence: ${JSON.stringify(info.sequence)}
Seed: ${info.seed} (reproduce with FUZZ_SEED=${info.seed})

Original error: ${originalError.message}`

    super(msg)
    this.name = "FuzzError"
    this.sequence = info.sequence
    this.shrunk = info.sequence
    this.seed = info.seed
    this.originalError = originalError
  }
}

/**
 * Get the test file path from error stack
 * This is a heuristic - it looks for .test.ts or .fuzz.ts files
 */
function getTestFilePath(): string {
  const err = new Error()
  const stack = err.stack?.split("\n") ?? []

  for (const line of stack) {
    // Look for test file patterns
    const match = line.match(/\(([^)]+\.(test|fuzz)\.(ts|tsx|js|jsx)):\d+:\d+\)/)
    if (match) return match[1]

    // Also try without parentheses
    const match2 = line.match(/at\s+([^\s]+\.(test|fuzz)\.(ts|tsx|js|jsx)):\d+:\d+/)
    if (match2) return match2[1]
  }

  // Fallback to current working directory
  return process.cwd() + "/unknown.test.ts"
}

/**
 * Run a single fuzz test body with a specific seed.
 * Handles replay, shrinking, and saving of failing cases.
 */
async function runFuzzBody(
  name: string,
  fn: () => Promise<void>,
  seed: number,
  opts: { shrink: boolean; save: boolean; replay: boolean; maxShrinkAttempts: number },
) {
  const testFilePath = getTestFilePath()

  // Replay saved failing sequences first
  if (opts.replay) {
    const savedCases = loadCasesForTest(testFilePath, name)
    for (const savedCase of savedCases) {
      const replayCtx = createReplayContext(savedCase.sequence, savedCase.seed)
      try {
        await fuzzContext.run(replayCtx, fn)
        // If replay passes, the bug might be fixed - but we still run the main test
      } catch (error) {
        // Replay still fails - throw with saved context
        throw new FuzzError(error as Error, {
          original: savedCase.originalLength ?? savedCase.sequence.length,
          shrunk: savedCase.sequence.length,
          sequence: savedCase.sequence,
          seed: savedCase.seed,
        })
      }
    }
  }

  // Run the main fuzz test
  const ctx = createFuzzContext(seed)

  try {
    await fuzzContext.run(ctx, fn)
  } catch (error) {
    // Test failed - attempt shrinking
    if (ctx.history.length > 0) {
      let minimalSequence = ctx.history
      let shrinkResult

      if (opts.shrink) {
        // Define the test runner for shrinking
        const runWithSequence = async (seq: unknown[]) => {
          const replayCtx = createReplayContext(seq, seed)
          try {
            await fuzzContext.run(replayCtx, fn)
            return true // passed
          } catch {
            return false // still fails
          }
        }

        shrinkResult = await shrinkSequence(ctx.history, runWithSequence, {
          maxAttempts: opts.maxShrinkAttempts,
        })
        minimalSequence = shrinkResult.shrunk

        // Log shrink result
        console.log(formatShrinkResult(shrinkResult))
      }

      // Save failing case
      if (opts.save) {
        const savedCase: SavedCase = {
          test: name,
          seed,
          sequence: minimalSequence,
          error: String(error),
          timestamp: new Date().toISOString(),
          originalLength: ctx.history.length,
        }
        const filepath = saveCase(testFilePath, name, savedCase)
        console.log(`Saved failing case to: ${filepath}`)
      }

      throw new FuzzError(error as Error, {
        original: ctx.history.length,
        shrunk: minimalSequence.length,
        sequence: minimalSequence,
        seed,
      })
    }

    throw error
  }
}

/**
 * Create the test.fuzz wrapper
 *
 * When FUZZ_REPEATS > 1, registers multiple vitest tests — one per seed —
 * so each gets its own result in the reporter and failures are independently
 * visible. Seeds are deterministically derived from the base seed.
 */
function createFuzzTest(name: string, fn: () => Promise<void>, options: FuzzTestOptions = {}) {
  const {
    seed = parseSeed("env"),
    shrink = true,
    save = true,
    replay = true,
    maxShrinkAttempts = 100,
    ...testOptions
  } = options

  const repeats = parseRepeats()
  const bodyOpts = { shrink, save, replay, maxShrinkAttempts }

  if (repeats <= 1) {
    // Single run (default) — original behavior
    return vitestTest(name, testOptions, async () => {
      await runFuzzBody(name, fn, seed, bodyOpts)
    })
  }

  // Multiple runs — register one test per seed
  const seeds = deriveSeeds(seed, repeats)
  for (let i = 0; i < seeds.length; i++) {
    const s = seeds[i]
    vitestTest(`${name} [seed=${s}]`, testOptions, async () => {
      await runFuzzBody(name, fn, s, bodyOpts)
    })
  }
}

// Type for the fuzz function
type FuzzFn = {
  (name: string, fn: () => Promise<void>, options?: FuzzTestOptions): void
  (name: string, options: FuzzTestOptions, fn: () => Promise<void>): void
}

// Create the fuzz function with overloads
const fuzz: FuzzFn = (
  name: string,
  fnOrOptions: (() => Promise<void>) | FuzzTestOptions,
  optionsOrFn?: FuzzTestOptions | (() => Promise<void>),
) => {
  if (typeof fnOrOptions === "function") {
    return createFuzzTest(name, fnOrOptions, optionsOrFn as FuzzTestOptions)
  } else {
    return createFuzzTest(name, optionsOrFn as () => Promise<void>, fnOrOptions)
  }
}

/**
 * Extended test object with fuzz method
 */
export const test = Object.assign(vitestTest, { fuzz })

// Re-export vitest test types
export { describe, expect, it, beforeAll, afterAll, beforeEach, afterEach } from "vitest"
