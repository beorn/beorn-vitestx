/**
 * Fuzz testing API
 *
 * @example
 * ```typescript
 * import { test, gen, take, createSeededRandom } from 'vi-monkey/fuzz'
 *
 * // Simple random from array
 * test('navigation', async () => {
 *   const handle = await run(<Board />, { cols: 80, rows: 24 })
 *   for await (const key of take(gen(['j','k','h','l']), 100)) {
 *     await handle.press(key)
 *     expect(handle.locator('[data-cursor]').count()).toBe(1)
 *   }
 * })
 *
 * // Weighted random
 * test('weighted', async () => {
 *   for await (const key of take(gen([[40,'j'], [40,'k'], [20,'Enter']]), 100)) {
 *     await handle.press(key)
 *   }
 * })
 *
 * // Stateful with closure
 * test('stateful', async () => {
 *   const handle = await app.run(<Board />)
 *   const random = createSeededRandom(Date.now())
 *
 *   const keys = async function*() {
 *     while (true) {
 *       const state = handle.store.getState()
 *       yield state.cursor === 0 ? random.pick(['j','l']) : random.pick(['j','k','h','l'])
 *     }
 *   }
 *
 *   for await (const key of take(keys(), 100)) {
 *     await handle.press(key)
 *   }
 * })
 *
 * // With auto-tracking and shrinking
 * test.fuzz('cursor invariants', async () => {
 *   for await (const key of take(gen(['j','k']), 100)) {
 *     await handle.press(key)
 *     expect(...)  // On failure: shrinks, saves to __fuzz_cases__/
 *   }
 * })
 * ```
 */

// Core API
export { gen, take, type Picker, type PickerContext } from "./gen.js"

// test.fuzz wrapper
export { test, FuzzError, type FuzzTestOptions } from "./test-fuzz.js"
export { describe, expect, it, beforeAll, afterAll, beforeEach, afterEach } from "./test-fuzz.js"

// Context (for advanced use)
export {
  fuzzContext,
  getFuzzContext,
  isInFuzzContext,
  createFuzzContext,
  createReplayContext,
  type FuzzContext,
} from "./context.js"

// Shrinking (for advanced use)
export { shrinkSequence, formatShrinkResult, type ShrinkOptions, type ShrinkResult } from "./shrink.js"

// Regression (for advanced use)
export {
  saveCase,
  loadCases,
  loadCasesForTest,
  deleteCase,
  clearCases,
  getFuzzCasesDir,
  type SavedCase,
} from "./regression.js"

// Re-export random utilities
export { createSeededRandom, parseSeed, parseRepeats, deriveSeeds, type SeededRandom } from "../random.js"
