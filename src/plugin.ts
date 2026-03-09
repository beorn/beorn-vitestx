/**
 * Vitest plugin for vi-monkey
 *
 * @example
 * ```typescript
 * // vitest.config.ts
 * import { defineConfig } from 'vitest/config'
 * import { viMonkey } from 'vi-monkey/plugin'
 *
 * export default defineConfig({
 *   plugins: [
 *     viMonkey({
 *       fuzz: { iterations: 100 },
 *       ai: { model: 'claude-sonnet' },
 *       doc: { pattern: '**\/*.test.md' },
 *     })
 *   ]
 * })
 * ```
 */

import type { Plugin } from "vite"

export interface ViMonkeyFuzzOptions {
  /** Number of actions per test run (default: 100) */
  iterations?: number
  /** Seed source: 'env' reads FUZZ_SEED, 'random' generates new (default: 'env') */
  seed?: "env" | "random"
  /** Stop after first failure (default: true) */
  failFast?: boolean
  /** Shrinking settings */
  shrink?: {
    enabled?: boolean
    maxAttempts?: number
  }
}

export interface ViMonkeyAiOptions {
  /** Model identifier (Vercel AI SDK format) */
  model?: string
  /** Temperature for LLM (0 = deterministic) */
  temperature?: number
  /** Maximum actions per exploration */
  maxSteps?: number
  /** Token budget per file */
  maxTokens?: number
  /** Directory to save discovered tests */
  saveDir?: string
  /** Use Claude Code provider */
  provider?: "openai" | "anthropic" | "claude-code"
}

export interface ViMonkeyDocOptions {
  /** Glob pattern for mdtest files */
  pattern?: string
}

export interface ViMonkeyOptions {
  /** Fuzz mode configuration */
  fuzz?: ViMonkeyFuzzOptions
  /** AI mode configuration */
  ai?: ViMonkeyAiOptions
  /** Doc mode configuration (mdtest) */
  doc?: ViMonkeyDocOptions
}

/**
 * Creates the vi-monkey plugin for Vitest
 */
export function viMonkey(options: ViMonkeyOptions = {}): Plugin {
  const { fuzz = {}, ai = {}, doc = {} } = options

  return {
    name: "vi-monkey",

    config() {
      // Configure vitest for custom modes
      // Returns void for now - will be populated as modes are implemented
    },

    configureServer(server) {
      // Handle custom CLI modes: vitest fuzz, vitest ai, vitest doc
      // Implementation will intercept vitest CLI commands
    },
  }
}

export default viMonkey
