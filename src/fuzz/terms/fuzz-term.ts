/**
 * Fuzz term — a Provider that generates random key events.
 *
 * Implements inkx's Provider<FuzzState, { key: KeyEvent }> interface,
 * making it a drop-in replacement for the real terminal provider.
 *
 * @example
 * ```typescript
 * // Random keys
 * const term = createFuzzTerm({ keys: ['j','k','h','l'], count: 100, seed: 42 })
 *
 * // Smart picking (reads state)
 * const term = createFuzzTerm({
 *   pick: (state) => state.cursor === 0 ? 'j' : sample(['j','k','h','l']),
 *   count: 200,
 * })
 *
 * const app = createApp(<Board />, { term })
 * for await (const frame of app.run()) { ... }
 * ```
 */

import { createSeededRandom, type SeededRandom } from '../../random.js'

/**
 * Fuzz term state (mirrors TermState from inkx).
 */
export interface FuzzState {
	cols: number
	rows: number
}

/**
 * Key event data (mirrors inkx key event shape).
 */
export interface FuzzKeyEvent {
	input: string
	key: FuzzKey
}

/**
 * Minimal Key shape compatible with inkx Key.
 */
export interface FuzzKey {
	upArrow: boolean
	downArrow: boolean
	leftArrow: boolean
	rightArrow: boolean
	pageDown: boolean
	pageUp: boolean
	home: boolean
	end: boolean
	return: boolean
	escape: boolean
	ctrl: boolean
	shift: boolean
	tab: boolean
	backspace: boolean
	delete: boolean
	meta: boolean
}

/**
 * Provider event shape.
 */
interface ProviderEvent<Events extends Record<string, unknown>> {
	type: keyof Events
	data: Events[keyof Events]
}

/**
 * Provider interface (compatible with inkx Provider).
 */
export interface FuzzTermProvider {
	getState(): FuzzState
	subscribe(listener: (state: FuzzState) => void): () => void
	events(): AsyncIterable<ProviderEvent<{ key: FuzzKeyEvent }>>
	[Symbol.dispose](): void
	/** Recorded history for shrinking/replay */
	readonly history: string[]
}

/**
 * Pick function receives flat store state and returns one or more keys.
 */
export type FuzzPick<S = Record<string, unknown>> = (
	state: S,
	history: string[],
	random: SeededRandom,
) => string | string[] | Promise<string | string[]>

/**
 * Options for createFuzzTerm.
 */
export interface FuzzTermOptions<S = Record<string, unknown>> {
	/** Simple mode: pick randomly from these keys */
	keys?: string[]
	/** Number of events to generate before stopping */
	count: number
	/** Seed for reproducibility */
	seed?: number
	/** Smart mode: pick function reads state */
	pick?: FuzzPick<S>
	/** Terminal dimensions (default: 80x24) */
	cols?: number
	rows?: number
}

/**
 * Create a simple Key object from a key string.
 */
function keyFromString(input: string): FuzzKey {
	return {
		upArrow: input === 'ArrowUp',
		downArrow: input === 'ArrowDown',
		leftArrow: input === 'ArrowLeft',
		rightArrow: input === 'ArrowRight',
		pageDown: input === 'PageDown',
		pageUp: input === 'PageUp',
		home: input === 'Home',
		end: input === 'End',
		return: input === 'Enter' || input === '\r',
		escape: input === 'Escape' || input === '\x1b',
		ctrl: false,
		shift: input.length === 1 && input >= 'A' && input <= 'Z',
		tab: input === 'Tab' || input === '\t',
		backspace: input === 'Backspace' || input === '\b',
		delete: input === 'Delete' || input === '\x7f',
		meta: false,
	}
}

/**
 * Create a fuzz term provider.
 *
 * Generates key events from random selection or a pick function.
 * Implements the inkx Provider interface so it can replace the real terminal.
 */
export function createFuzzTerm<S = Record<string, unknown>>(
	options: FuzzTermOptions<S>,
): FuzzTermProvider {
	const {
		keys,
		count,
		seed = Date.now(),
		pick,
		cols = 80,
		rows = 24,
	} = options

	const random = createSeededRandom(seed)
	const state: FuzzState = { cols, rows }
	const listeners = new Set<(state: FuzzState) => void>()
	const history: string[] = []
	let disposed = false

	// Default picker: random from keys array
	const defaultPick = (): string => {
		if (!keys || keys.length === 0) {
			throw new Error('createFuzzTerm: must provide either keys or pick')
		}
		return keys[Math.floor(random.float() * keys.length)]
	}

	return {
		getState(): FuzzState {
			return state
		},

		subscribe(listener: (state: FuzzState) => void): () => void {
			listeners.add(listener)
			return () => listeners.delete(listener)
		},

		async *events(): AsyncGenerator<ProviderEvent<{ key: FuzzKeyEvent }>> {
			let generated = 0
			// Batch buffer for picks that return arrays
			const batch: string[] = []

			while (generated < count && !disposed) {
				let key: string

				if (batch.length > 0) {
					key = batch.shift()!
				} else if (pick) {
					const result = await pick(state as unknown as S, history, random)
					if (Array.isArray(result)) {
						if (result.length === 0) continue
						key = result[0]
						for (let i = 1; i < result.length; i++) {
							batch.push(result[i])
						}
					} else {
						key = result
					}
				} else {
					key = defaultPick()
				}

				history.push(key)
				generated++

				yield {
					type: 'key' as const,
					data: { input: key, key: keyFromString(key) },
				}
			}
		},

		get history() {
			return history
		},

		[Symbol.dispose](): void {
			disposed = true
			listeners.clear()
		},
	}
}
