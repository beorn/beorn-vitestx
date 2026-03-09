# vi-monkey Tests

**Test Infrastructure — Vitest Extensions**: Fuzz testing, chaos streams, seeded RNG, and environment config.

## What to Test Here

- **Fuzz API**: `gen()` with array/weighted/custom pickers, `take()` limiting, deterministic seeding, `fuzzContext`/`createReplayContext`, `shrinkSequence` delta-debugging
- **Random**: `createSeededRandom` determinism, `int()`/`float()`/`pick()`/`shuffle()` range correctness, `parseSeed`
- **Chaos transformers**: `drop`, `reorder`, `duplicate`, `burst`, `initGap`, `delay`, composed `chaos()` pipeline, `builtinChaosRegistry`
- **Environment**: `getTestSys()` parsing (`fake`/`real:mem`/`real:disk`), `isRealSys()`, `isDiskSys()`, invalid value fallback

## What NOT to Test Here

- Vitest internals or reporter protocol — vi-monkey bridges to them

## Patterns

Fuzz and chaos tests use `createSeededRandom` for deterministic reproduction:

```typescript
import { gen, take, createSeededRandom } from "../src/fuzz/index.js"

test("gen is deterministic with same seed", async () => {
  const v1: string[] = [],
    v2: string[] = []
  for await (const v of take(gen(["a", "b"], 42), 10)) v1.push(v)
  for await (const v of take(gen(["a", "b"], 42), 10)) v2.push(v)
  expect(v1).toEqual(v2)
})
```

## Ad-Hoc Testing

```bash
bun vitest run tests/              # All vi-monkey tests
bun vitest run tests/fuzz.fuzz.ts  # Fuzz API tests
bun vitest run tests/chaos.test.ts # Chaos transformers
bun vitest run tests/random.test.ts # Seeded RNG
```

## Efficiency

Pure logic tests are fast (~50ms).

## See Also

- [Test layering philosophy](../../.claude/skills/tests/test-layers.md)
