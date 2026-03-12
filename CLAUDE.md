# vimonkey — Fuzz Testing & Chaos Streams for Vitest

Fuzz testing (gen/take generators, test.fuzz() with auto-shrinking) and chaos stream transformers for Vitest.

## Commands

bun test # run tests

## Architecture

src/
├── index.ts # Public API (re-exports fuzz)
├── plugin.ts # Vitest plugin (stub — config injection, custom CLI modes)
├── env.ts # TEST_SYS environment handling
├── random.ts # Seeded RNG (LCG algorithm)
├── fuzz/ # Fuzz testing API
│ ├── gen.ts # gen() and take() async generators
│ ├── test-fuzz.ts # test.fuzz() wrapper with tracking
│ ├── context.ts # FuzzContext for tracking state
│ ├── shrink.ts # Delta-debugging shrink
│ └── regression.ts # **fuzz_cases**/ save/load
└── chaos/ # Chaos stream transformers
└── index.ts # drop, reorder, duplicate, burst, initGap, delay + chaos()

## Subpath Exports

```typescript
import { test, gen, take } from "vimonkey" // Root: re-exports fuzz + utilities
import { test, gen, take } from "vimonkey/fuzz" // Fuzz: gen/take/test.fuzz/shrink/regression
import { chaos, drop, reorder } from "vimonkey/chaos" // Chaos: stream transformers
import { viMonkeyPlugin } from "vimonkey/plugin" // Vitest plugin
```

## Key APIs

### gen/take (async generators)

gen(['j','k','h','l']) — uniform random from array
gen([[40,'j'],[40,'k'],[20,'Enter']]) — weighted random
gen((ctx) => ctx.random.pick([...])) — custom picker

take(generator, 100) — limit + auto-track for shrinking

### test.fuzz (vitest wrapper)

test.fuzz('name', async () => {
for await (const key of take(gen(['j','k']), 100)) {
await handle.press(key)
expect(...) // On failure: auto-shrink, save to **fuzz_cases**/
}
})

### Chaos stream transformers

Composable async iterable transformers: drop, reorder, duplicate, burst, initGap, delay.
Plus chaos() combinator with extensible ChaosRegistry<T>.

```typescript
import { chaos, drop, reorder, builtinChaosRegistry } from "vimonkey/chaos"

const chaotic = chaos(
  source,
  [
    { type: "drop", params: { rate: 0.2 } },
    { type: "reorder", params: { windowSize: 5 } },
  ],
  rng,
)
```

## Code Style

- Factory functions (`createX()` with options), not classes
- Explicit deps, no globals/singletons
- ESM imports only
- TypeScript strict mode
