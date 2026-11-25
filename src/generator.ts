// Worksheet generator: deterministic puzzle sets for the /worksheets print
// path. The same seed always produces the same sheet (mulberry32 + hashCode,
// same as the daily generator), so a teacher can save a seed and reprint the
// exact same set later.

import { hashCode, mulberry32 } from './daily';
import { solve24, solve24UpTo, type Solution } from './solver';

export type WorksheetDifficulty = 'easy' | 'medium' | 'hard';

export interface WorksheetPuzzle {
  numbers: number[];
  /** A valid solution, e.g. "8 ÷ (3 − 8 ÷ 3)" — the answer-key line. */
  answer: string;
  /** Lower bound on the solution count (capped by the probe limit). */
  solutionCount: number;
}

export interface WorksheetOptions {
  seed: number;
  /** Puzzles per sheet: 6 or 12. */
  count: number;
  /** Numbers per puzzle: 3, 4 or 5. */
  numberCount: number;
  difficulty: WorksheetDifficulty;
  /** Sorted-number keys ("2,3,4,5") already used by earlier sets in a
      batch — cross-set dedup so N sets are N DIFFERENT sheets, not N
      parallel universes. */
  exclude?: ReadonlySet<string>;
}

/** Dedup key for a deal, shared by within-sheet and cross-set dedup. */
export function puzzleKey(numbers: number[]): string {
  return [...numbers].sort((a, b) => a - b).join(',');
}

/**
 * Difficulty contract (see .impeccable/surfaces/generator.md), checked with
 * early-exit probes so 5-number deals stay fast (full enumeration of one
 * 5-number deal costs ~800ms; a probe of 1-4 solutions costs a few ms):
 * - Easy: single digits (1-9), solvable with whole-number intermediate
 *   steps only (integersOnly probe). A puzzle whose every solution needs
 *   fraction intermediates (e.g. 8 ÷ (3 − 8 ÷ 3)) is NOT easy in a
 *   classroom, whatever the generator's filter used to say — teacher trust
 *   is the brand asset here.
 * - Medium: single digits, multiple distinct solutions — ≥3 at 4-5 numbers.
 *   At 3 numbers the solver's canonical dedup caps any deal at 2 solutions
 *   (exhaustively verified), so "multiple" relaxes to ≥2 there.
 * - Hard: range widened to 1-13, and the deal must either contain a
 *   two-digit number (10-13) or have only division-based solutions.
 *   Division is where this engine's fractional intermediate steps come
 *   from, so "every solution uses ÷" approximates "needs fractions" — a
 *   documented heuristic, not an exact classification.
 *
 * Returns the qualifying solutions (probe-capped) or null when the deal is
 * rejected. `answer` is the shortest of the probe's finds — good enough for
 * an answer key, though not guaranteed the global minimum.
 */
export function qualifyingSolutions(
  numbers: number[],
  difficulty: WorksheetDifficulty
): Solution[] | null {
  switch (difficulty) {
    case 'easy': {
      const probe = solve24UpTo(numbers, 24, 1, { integersOnly: true });
      return probe.length > 0 ? probe : null;
    }
    case 'medium': {
      const probe = solve24UpTo(numbers, 24, 3);
      const needed = numbers.length === 3 ? 2 : 3;
      return probe.length >= needed ? probe : null;
    }
    case 'hard': {
      const probe = solve24UpTo(numbers, 24, 1);
      if (probe.length === 0) return null;
      if (numbers.some((n) => n >= 10)) return probe;
      // No two-digit number: qualify only if every solution uses ÷. A
      // ÷-free solution in the first 4 rejects the deal; 4 all-÷ finds
      // means the probe truncated, so enumerate fully to stay exact (rare).
      const wider = solve24UpTo(numbers, 24, 4);
      if (wider.some((s) => !s.expression.includes('÷'))) return null;
      if (wider.length < 4) return wider;
      const all = solve24(numbers);
      return all.every((s) => s.expression.includes('÷')) ? all : null;
    }
  }
}

/**
 * Builds up to `count` distinct, always-solvable puzzles for the given seed
 * and settings. Deals are deduplicated within a sheet (sorted-number key),
 * so a printed sheet never repeats a puzzle.
 *
 * Returns fewer than `count` puzzles only when the unique-deal pool is
 * provably exhausted — e.g. Medium at 3 numbers has exactly 5 qualifying
 * multisets in 1..9, so a 12-puzzle Medium/3-number sheet comes back short.
 * The UI renders what it gets and shows a notice; it never crashes.
 */
export function generateWorksheet({
  seed,
  count,
  numberCount,
  difficulty,
  exclude,
}: WorksheetOptions): WorksheetPuzzle[] {
  const rng = mulberry32(hashCode(`worksheet:${seed}`));
  const max = difficulty === 'hard' ? 13 : 9;
  const puzzles: WorksheetPuzzle[] = [];
  const seen = new Set<string>(exclude);

  // Stop after PATIENCE consecutive rolls without a new puzzle: at the
  // observed match rates (≥3% even in the worst case) that means the unique
  // pool is exhausted, not bad luck.
  const PATIENCE = 2000;
  let misses = 0;
  while (puzzles.length < count && misses < PATIENCE) {
    const numbers = Array.from(
      { length: numberCount },
      () => 1 + Math.floor(rng() * max)
    );
    const key = puzzleKey(numbers);
    if (seen.has(key)) {
      misses++;
      continue;
    }
    const solutions = qualifyingSolutions(numbers, difficulty);
    if (!solutions) {
      misses++;
      continue;
    }
    misses = 0;
    seen.add(key);
    // Probe results are length-sorted, so [0] is the simplest find.
    puzzles.push({
      numbers,
      answer: solutions[0].expression,
      solutionCount: solutions.length,
    });
  }

  return puzzles;
}
