/**
 * Replay term — replays a recorded sequence of key events.
 *
 * Used for shrinking and regression testing. Same Provider interface as fuzz-term.
 *
 * @example
 * ```typescript
 * const term = createReplayTerm(['j','j','k','l','j'])
 * const app = createApp(<Board />, { term })
 * for await (const frame of app.run()) { ... }
 * ```
 */

import type { FuzzState, FuzzKeyEvent, FuzzKey } from './fuzz-term.js'

/**
 * Provider event shape.
 */
interface ProviderEvent<Events extends Record<string, unknown>> {
	type: keyof Events
	data: Events[keyof Events]
}

/**
 * Replay term provider interface.
 */
export interface ReplayTermProvider {
	getState(): FuzzState
	subscribe(listener: (state: FuzzState) => void): () => void
	events(): AsyncIterable<ProviderEvent<{ key: FuzzKeyEvent }>>
	[Symbol.dispose](): void
	/** The replayed sequence */
	readonly sequence: string[]
}

/**
 * Options for createReplayTerm.
 */
export interface ReplayTermOptions {
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
 * Create a replay term that yields a fixed sequence of key events.
 */
export function createReplayTerm(
	sequence: string[],
	options: ReplayTermOptions = {},
): ReplayTermProvider {
	const { cols = 80, rows = 24 } = options
	const state: FuzzState = { cols, rows }
	const listeners = new Set<(state: FuzzState) => void>()
	let disposed = false

	return {
		getState(): FuzzState {
			return state
		},

		subscribe(listener: (state: FuzzState) => void): () => void {
			listeners.add(listener)
			return () => listeners.delete(listener)
		},

		async *events(): AsyncGenerator<ProviderEvent<{ key: FuzzKeyEvent }>> {
			for (const key of sequence) {
				if (disposed) break
				yield {
					type: 'key' as const,
					data: { input: key, key: keyFromString(key) },
				}
			}
		},

		get sequence() {
			return sequence
		},

		[Symbol.dispose](): void {
			disposed = true
			listeners.clear()
		},
	}
}
