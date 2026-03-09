# vi-monkey

Fuzz testing and chaos streams for [Vitest](https://vitest.dev/).

## Fuzz Testing

Async generators with auto-shrinking, regression cases, and seeded RNG.

```typescript
import { test, gen, take } from "vi-monkey"

test.fuzz("cursor stays in bounds", async () => {
  for await (const key of take(gen(["j", "k", "h", "l"]), 100)) {
    await handle.press(key)
    expect(getCursor()).toBeGreaterThanOrEqual(0)
  }
  // On failure: auto-shrinks to minimal repro, saves to __fuzz_cases__/
})
```

Generators support uniform arrays, weighted tuples, sync/async picker functions, and multi-value returns.

## Chaos Streams

Composable async iterable transformers that simulate unreliable delivery.

```typescript
import { chaos, drop, reorder } from "vi-monkey/chaos"

const chaotic = chaos(
  source,
  [
    { type: "drop", params: { rate: 0.2 } },
    { type: "reorder", params: { windowSize: 5 } },
    { type: "duplicate", params: { rate: 0.1 } },
  ],
  rng,
)
```

Built-in transformers: `drop`, `reorder`, `duplicate`, `burst`, `initGap`, `delay`. Extend with custom registries.

## Install

```bash
bun add vi-monkey
```

## Exports

```typescript
import { test, gen, take } from "vi-monkey"        // Fuzz testing
import { chaos, drop, reorder } from "vi-monkey/chaos"  // Chaos streams
import { viMonkeyPlugin } from "vi-monkey/plugin"   // Vitest plugin
```

## License

MIT
