/**
 * vi-monkey — Fuzz testing and chaos streams for Vitest
 */

// Fuzz API (primary)
export { gen, take, type Picker, type PickerContext } from "./fuzz/gen.js"
export { test, FuzzError, type FuzzTestOptions } from "./fuzz/test-fuzz.js"
export { describe, expect, it, beforeAll, afterAll, beforeEach, afterEach } from "./fuzz/test-fuzz.js"
export {
  fuzzContext,
  getFuzzContext,
  isInFuzzContext,
  createFuzzContext,
  createReplayContext,
  type FuzzContext,
} from "./fuzz/context.js"
export { shrinkSequence, formatShrinkResult, type ShrinkOptions, type ShrinkResult } from "./fuzz/shrink.js"
export {
  saveCase,
  loadCases,
  loadCasesForTest,
  deleteCase,
  clearCases,
  getFuzzCasesDir,
  type SavedCase,
} from "./fuzz/regression.js"

// Utilities
export { createSeededRandom, parseSeed, parseRepeats, deriveSeeds, type SeededRandom } from "./random.js"
export { getTestSys, type TestSys } from "./env.js"
