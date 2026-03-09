/**
 * TEST_SYS environment handling
 *
 * Controls the implementation used during tests:
 * - fake: Use fake/mock implementations (fast, isolated)
 * - real:mem: Real implementation with in-memory storage
 * - real:disk: Real implementation with temporary disk storage
 */

export type TestSys = "fake" | "real:mem" | "real:disk"

const VALID_VALUES: TestSys[] = ["fake", "real:mem", "real:disk"]

/**
 * Get the current TEST_SYS value
 *
 * @returns The test system type, defaults to 'fake'
 *
 * @example
 * ```typescript
 * import { getTestSys } from 'vi-monkey'
 *
 * const sys = getTestSys()
 * if (sys === 'fake') {
 *   // use mock
 * } else if (sys === 'real:mem') {
 *   // use real with in-memory storage
 * } else {
 *   // use real with disk storage
 * }
 * ```
 */
export function getTestSys(): TestSys {
  const value = process.env.TEST_SYS

  if (!value) {
    return "fake"
  }

  if (!VALID_VALUES.includes(value as TestSys)) {
    console.warn(
      `Invalid TEST_SYS value: "${value}". ` + `Valid values: ${VALID_VALUES.join(", ")}. ` + `Defaulting to "fake".`,
    )
    return "fake"
  }

  return value as TestSys
}

/**
 * Check if running with real implementation
 */
export function isRealSys(): boolean {
  const sys = getTestSys()
  return sys === "real:mem" || sys === "real:disk"
}

/**
 * Check if running with disk storage
 */
export function isDiskSys(): boolean {
  return getTestSys() === "real:disk"
}
