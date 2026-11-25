# 24-point-game-solver

A fast 24-point solver with exact fraction support — the algorithm behind [24pointgame.com](https://24pointgame.com/solver).

## Quick start

```bash
npm install
npx tsx example.ts
```

The example runs the classic hard puzzle `[3, 3, 8, 8]`. Under classic whole-number rules it has no solution, but with exact fraction arithmetic the solver finds answers such as `8 ÷ (3 − 8 ÷ 3)` and prints each expression with its step trace. The last line runs the same puzzle with `integersOnly: true` and prints `0` solution(s).

```bash
npm test
```

Runs the four test files in `src/` (solver, challenge, daily, generator).

The example, verbatim from `example.ts`:

```ts
// The classic hard puzzle: under classic whole-number rules [3, 3, 8, 8] is
// unsolvable, but with exact fraction arithmetic it yields 8 / (3 - 8 / 3).
// Run: npx tsx example.ts
import { solve24 } from './src/solver';

const puzzle = [3, 3, 8, 8];

const solutions = solve24(puzzle);
console.log(`solve24([${puzzle.join(', ')}]) -> ${solutions.length} distinct solution(s)`);
for (const s of solutions) {
  console.log(`\n  ${s.expression}`);
  for (const step of s.steps) console.log(`    ${step}`);
}

const classic = solve24(puzzle, 24, { integersOnly: true });
console.log(`\nsolve24(puzzle, 24, { integersOnly: true }) -> ${classic.length} solution(s)`);
```

## Algorithm

### Exhaustive search over operation trees

Per the header comment in `solver.ts`, the solver performs an "exhaustive search over all ways to combine the input numbers with + - * /, using exact rational arithmetic." Concretely, the search starts from the input numbers as leaves, picks two of the remaining values, applies one of the four operators to them, and replaces the pair with the combined value — recursing until a single value remains. Trying every ordered pair, every operator, and every grouping enumerates every binary operation tree over the inputs, with each number used exactly once. Two branches are pruned: division by zero produces no node, and in `integersOnly` mode any combination whose result is not a whole number is dropped (the classic rule that every intermediate must be a whole number). A final value that equals the target becomes a solution, and results are sorted by expression length, shortest first.

### Exact rational arithmetic, not floats

Every intermediate value is kept as a normalized fraction, in `Frac` form. As the header comment in `fraction.ts` puts it: "Division-heavy puzzles like 8/(3-8/3) can't be checked reliably with floats, so every value is kept as a normalized fraction: d > 0, gcd(|n|, d) = 1." Equality is checked exactly by comparing numerator and denominator, so a solution counts only when it lands exactly on the target — which is why `8 ÷ (3 − 8 ÷ 3)` resolves cleanly to 24 through the exact intermediates 8/3 and 1/3.

### Canonical dedup

The header comment continues: the solver "Returns every mathematically distinct solution (commutative/associative equivalents are deduplicated via a canonical form)." The canonical key, per its doc comment in `solver.ts`: "Additive chains treat subtraction as negation and multiplicative chains treat division as inversion, then flatten + sort, so a−(b−c) ≡ a+c−b and a÷(b÷c) ≡ a×c÷b collapse to one entry." In practice: terms joined by `+`/`−` are flattened into a sorted multiset of signed terms, factors joined by `×`/`÷` into a sorted multiset of factors with an inversion marker on divisors, and nested groups recurse through the same rules. Keys live in a set, and the first expression with a new key is the one kept.

## API

### `solve24`

```ts
export function solve24(
  input: number[],
  target = 24,
  options?: { integersOnly?: boolean }
): Solution[]
```

Finds every distinct way to make `target` from `input` numbers, each used exactly once. Typically input is 4 numbers in 1..13. `integersOnly` restricts every intermediate result to whole numbers (classic rules); the default allows exact fraction intermediates. Solutions are returned sorted by expression length.

### `solve24UpTo`

```ts
export function solve24UpTo(
  input: number[],
  target: number,
  limit: number,
  options?: { integersOnly?: boolean }
): Solution[]
```

Early-exit variant of `solve24`: stops after `limit` distinct solutions. Same search, same dedup — just truncated; per its doc comment, the worksheet generator uses it because solvability checks must not pay for full enumeration ("a 5-number deal costs ~800ms to enumerate exhaustively" — a note from the code comment, not a benchmark claim here). The returned solutions are the first found, not the shortest overall.

### `Solution`

```ts
export interface Solution {
  /** Display form with minimal parentheses, e.g. "8 ÷ (3 − 8 ÷ 3)" */
  expression: string;
  /** Merge trace, e.g. ["8 ÷ 3 = 8/3", "3 − 8/3 = 1/3", "8 ÷ 1/3 = 24"] */
  steps: string[];
}
```

### Fraction helpers (`src/fraction.ts`)

```ts
export interface Frac {
  n: number;
  d: number;
}

export function frac(n: number, d = 1): Frac;
export const fadd = (a: Frac, b: Frac): Frac;
export const fsub = (a: Frac, b: Frac): Frac;
export const fmul = (a: Frac, b: Frac): Frac;
export const fdiv = (a: Frac, b: Frac): Frac;
export const feq = (a: Frac, b: Frac): boolean;
export function fmtFrac(a: Frac): string;
```

- `frac` builds a normalized fraction — `d > 0`, `gcd(|n|, d) = 1` — and throws on `d === 0`.
- `fadd`, `fsub`, `fmul`, `fdiv` are exact rational arithmetic on `Frac` values.
- `feq` compares numerator and denominator exactly.
- `fmtFrac` prints `"3"` when `d === 1`, `"8/3"` otherwise.

## Module layout

- `src/solver.ts` — the solver core: exhaustive search over operation trees, exact-fraction evaluation, canonical dedup, minimal-parentheses printing; exports `solve24`, `solve24UpTo` and the `Solution` type.
- `src/fraction.ts` — exact rational arithmetic: the `Frac` type and the `frac` / `fadd` / `fsub` / `fmul` / `fdiv` / `feq` / `fmtFrac` helpers.
- `src/challenge.ts` — challenge-link (de)serialization for `/play/{seed}`: a compact JSON payload (`{"c":[3,3,8,8],"t":41}`) encoded as unpadded base64url; `decodeChallenge` validates every part of the shape (3–5 integers in 1..13, optional non-negative integer seconds) and returns `null` on anything else.
- `src/daily.ts` — deterministic daily-puzzle generation: a mulberry32 PRNG seeded from the date hash re-rolls candidates until the solver confirms a solution; keyed by the UTC date (`getTodayPuzzle`) or the player's local midnight (`getLocalTodayPuzzle`), plus `dayNumber` counting from `DAILY_LAUNCH_DATE`.
- `src/generator.ts` — deterministic worksheet generation for the print path: the same seed always produces the same sheet, easy/medium/hard difficulty contracts are checked with early-exit probes, and an `exclude` set dedups deals across sets in a batch.

`npm test` runs the four test files, written with `node:test` and `node:assert/strict`:

- `src/solver.test.ts` — solvability spot checks, `[1, 1, 1, 1]` reported unsolvable, `[3, 3, 8, 8]` solved only via fraction intermediates (and returning 0 solutions under `integersOnly`), no duplicate expressions, and every solution trace ending in `= 24`.
- `src/challenge.test.ts` — seed round-trips, seeds that stay a single URL-safe path segment, rejection of oversized/tampered/malformed seeds and wrong shapes, tolerance of unknown extra fields.
- `src/daily.test.ts` — determinism (same date → same puzzle), seven consecutive days producing distinct puzzles, month/year rollover, thirty generated days all solvable with numbers in 1..13, and UTC keying of `getTodayPuzzle`.
- `src/generator.test.ts` — seed determinism, different seeds producing different sheets, within-sheet and cross-set dedup, easy answers never requiring fractions, medium thresholds (≥3 solutions, ≥2 at three numbers), a short sheet instead of an error when the unique pool is exhausted, and the hard difficulty predicate.

## Extracted from production

The files in `src/` are a verbatim extract of the solver that runs in production at 24pointgame.com — same code, lifted as-is from the site's codebase. On the site this engine powers the 24-point game, the daily puzzle, shareable challenge links, and the printable worksheets and classroom modes. To try it as a game rather than a library, head to [24pointgame.com/solver](https://24pointgame.com/solver).

## License

Released under the MIT license — see [LICENSE](LICENSE).
