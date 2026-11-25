import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { generateWorksheet } from './generator';
import { solve24 } from './solver';

describe('worksheet generator', () => {
  it('is deterministic: same seed → same sheet', () => {
    const opts = {
      seed: 42,
      count: 12,
      numberCount: 4,
      difficulty: 'medium' as const,
    };
    const a = generateWorksheet(opts);
    const b = generateWorksheet(opts);
    assert.deepEqual(a, b);
  });

  it('different seeds produce different sheets', () => {
    const base = { count: 6, numberCount: 4, difficulty: 'easy' as const };
    const a = generateWorksheet({ ...base, seed: 1 });
    const b = generateWorksheet({ ...base, seed: 2 });
    assert.notDeepEqual(
      a.map((p) => p.numbers),
      b.map((p) => p.numbers)
    );
  });

  it('returns the requested count, every puzzle solvable, no repeats', () => {
    const puzzles = generateWorksheet({
      seed: 7,
      count: 12,
      numberCount: 5,
      difficulty: 'easy',
    });
    assert.equal(puzzles.length, 12);
    const keys = new Set(
      puzzles.map((p) => [...p.numbers].sort((x, y) => x - y).join(','))
    );
    assert.equal(keys.size, 12);
    for (const p of puzzles) {
      assert.ok(p.numbers.every((n) => n >= 1 && n <= 9));
      assert.ok(solve24(p.numbers).length > 0);
      assert.ok(p.answer.length > 0);
    }
  });

  it('easy: never requires fraction-intermediate steps (classroom trust)', () => {
    // [3, 3, 8, 8] is solvable only via fraction intermediates — the
    // generator must never emit such puzzles at easy difficulty. Spot-check
    // a spread of seeds and verify every easy answer is fraction-free.
    for (let seed = 1; seed <= 25; seed++) {
      const puzzles = generateWorksheet({
        seed,
        count: 6,
        numberCount: 4,
        difficulty: 'easy',
      });
      for (const p of puzzles) {
        assert.ok(
          !p.answer.includes('/'),
          `easy puzzle ${p.numbers} needs fractions: ${p.answer}`
        );
      }
    }
  });

  it('batch: cross-set dedup — no deal repeats across sets', () => {
    const used = new Set<string>();
    const all: string[][] = [];
    for (let i = 0; i < 3; i++) {
      const puzzles = generateWorksheet({
        seed: 100 + i,
        count: 6,
        numberCount: 4,
        difficulty: 'easy',
        exclude: used,
      });
      for (const p of puzzles) {
        const key = [...p.numbers].sort((a, b) => a - b).join(',');
        assert.ok(!used.has(key), `duplicate deal ${key} across sets`);
        used.add(key);
      }
      all.push(puzzles.map((p) => p.numbers.join(',')));
    }
    // sanity: sets are still deterministic per seed
    const again = generateWorksheet({
      seed: 100,
      count: 6,
      numberCount: 4,
      difficulty: 'easy',
    });
    assert.deepEqual(
      again.map((p) => p.numbers.join(',')),
      all[0]
    );
  });

  it('easy: single digits, solvable', () => {
    const puzzles = generateWorksheet({
      seed: 11,
      count: 6,
      numberCount: 3,
      difficulty: 'easy',
    });
    for (const p of puzzles) {
      assert.ok(p.numbers.every((n) => n >= 1 && n <= 9));
      assert.ok(p.solutionCount >= 1);
    }
  });

  it('medium: single digits with multiple solutions (≥3; ≥2 at 3 numbers)', () => {
    for (const numberCount of [4, 5]) {
      const puzzles = generateWorksheet({
        seed: 13,
        count: 6,
        numberCount,
        difficulty: 'medium',
      });
      assert.equal(puzzles.length, 6);
      for (const p of puzzles) {
        assert.ok(p.numbers.every((n) => n >= 1 && n <= 9));
        assert.ok(p.solutionCount >= 3, `count=${numberCount}: ${p.numbers}`);
      }
    }
    // 3 numbers: the canonical dedup caps any deal at 2 solutions.
    const puzzles = generateWorksheet({
      seed: 13,
      count: 6,
      numberCount: 3,
      difficulty: 'medium',
    });
    for (const p of puzzles) {
      assert.ok(p.solutionCount >= 2, `count=3: ${p.numbers}`);
    }
  });

  it('returns a short sheet (never throws) when the unique pool is exhausted', () => {
    // Medium/3-number has exactly 5 qualifying multisets in 1..9, so a
    // 12-puzzle request deterministically comes back with 5.
    const puzzles = generateWorksheet({
      seed: 13,
      count: 12,
      numberCount: 3,
      difficulty: 'medium',
    });
    assert.equal(puzzles.length, 5);
  });

  it('hard: two-digit number or division-only solutions, range 1..13', () => {
    const puzzles = generateWorksheet({
      seed: 17,
      count: 12,
      numberCount: 4,
      difficulty: 'hard',
    });
    for (const p of puzzles) {
      assert.ok(p.numbers.every((n) => n >= 1 && n <= 13));
      const solutions = solve24(p.numbers);
      assert.ok(
        p.numbers.some((n) => n >= 10) ||
          solutions.every((s) => s.expression.includes('÷')),
        `hard predicate failed for ${p.numbers}`
      );
    }
  });
});
