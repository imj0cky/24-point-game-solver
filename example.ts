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
