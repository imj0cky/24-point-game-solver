import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { solve24 } from './solver';

describe('solve24', () => {
  it('solves [4, 7, 3, 9] (e.g. (7-3)×(9-4))', () => {
    const solutions = solve24([4, 7, 3, 9]);
    assert.ok(solutions.length > 0);
  });

  it('reports [1, 1, 1, 1] as unsolvable', () => {
    assert.equal(solve24([1, 1, 1, 1]).length, 0);
  });

  it('solves the classic hard puzzle [3, 3, 8, 8] via fractions (8 ÷ (3 − 8 ÷ 3))', () => {
    const solutions = solve24([3, 3, 8, 8]);
    assert.ok(solutions.length > 0);
    assert.ok(solutions.some((s) => s.expression.includes('÷')));
  });

  it('solves [1, 2, 3, 4] (e.g. 1×2×3×4)', () => {
    assert.ok(solve24([1, 2, 3, 4]).length > 0);
  });

  it('solves [1, 5, 5, 5] via fractions (5 × (5 − 1 ÷ 5))', () => {
    assert.ok(solve24([1, 5, 5, 5]).length > 0);
  });

  it('every solution trace ends at exactly 24 and expressions have no duplicates', () => {
    for (const nums of [
      [4, 7, 3, 9],
      [3, 3, 8, 8],
      [1, 5, 5, 5],
      [6, 6, 6, 6],
      [13, 12, 11, 10],
    ]) {
      const solutions = solve24(nums);
      const expressions = solutions.map((s) => s.expression);
      assert.equal(
        new Set(expressions).size,
        expressions.length,
        `duplicate expressions for ${nums}`
      );
      for (const s of solutions) {
        assert.match(s.steps.at(-1)!, /= 24$/, `${s.expression}`);
      }
    }
  });

  it('integersOnly excludes fraction-intermediate solutions ([3, 3, 8, 8])', () => {
    // Solvable with exact fraction intermediates (8 ÷ (3 − 8 ÷ 3))…
    assert.ok(solve24([3, 3, 8, 8]).length > 0);
    // …but unsolvable under classic whole-number-intermediate rules.
    assert.equal(solve24([3, 3, 8, 8], 24, { integersOnly: true }).length, 0);
  });

  it('integersOnly keeps integer-intermediate solutions ([4, 7, 3, 9])', () => {
    const all = solve24([4, 7, 3, 9]);
    const classic = solve24([4, 7, 3, 9], 24, { integersOnly: true });
    assert.ok(classic.length > 0);
    assert.ok(classic.length <= all.length);
    // Every step of every classic solution lands on a whole number.
    for (const s of classic) {
      for (const step of s.steps) assert.doesNotMatch(step, /\d+\/\d+/);
    }
  });
});
