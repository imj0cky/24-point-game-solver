import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getPuzzleForDate, getTodayPuzzle } from './daily';
import { solve24 } from './solver';

function datePlus(base: string, days: number): string {
  const d = new Date(`${base}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

describe('daily puzzle', () => {
  it('generates a different puzzle on 7 consecutive days', () => {
    const puzzles = new Set<string>();
    for (let i = 0; i < 7; i++) {
      const p = getPuzzleForDate(datePlus('2026-07-24', i));
      puzzles.add(JSON.stringify([...p.numbers].sort((a, b) => a - b)));
    }
    assert.equal(puzzles.size, 7);
  });

  it('is deterministic: same date → same puzzle (any "browser")', () => {
    const a = getPuzzleForDate('2026-07-24');
    const b = getPuzzleForDate('2026-07-24');
    assert.deepEqual(a.numbers, b.numbers);
  });

  it('rolls over month/year boundaries (2025-12-31 → 2026-01-01)', () => {
    const nye = getPuzzleForDate('2025-12-31');
    const jan = getPuzzleForDate('2026-01-01');
    assert.notDeepEqual(nye.numbers, jan.numbers);
    assert.equal(nye.date, '2025-12-31');
    assert.equal(jan.date, '2026-01-01');
  });

  it('every generated puzzle is solvable, with numbers in 1..13', () => {
    for (let i = 0; i < 30; i++) {
      const p = getPuzzleForDate(datePlus('2026-01-01', i));
      assert.ok(p.numbers.every((n) => n >= 1 && n <= 13));
      assert.ok(p.solutionCount > 0);
      assert.ok(solve24(p.numbers).length > 0);
    }
  });

  it('getTodayPuzzle uses the UTC date', () => {
    const now = new Date('2026-07-24T23:30:00Z');
    assert.equal(getTodayPuzzle(now).date, '2026-07-24');
  });
});
