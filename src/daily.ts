// Daily puzzle generator: same date → same puzzle for everyone.
// The seed drives a deterministic PRNG; candidates are re-rolled until the
// solver confirms at least one solution exists. "Today" is defined by the
// CALLER: getTodayPuzzle uses UTC (server/SSR), getLocalTodayPuzzle uses
// the player's local midnight (the product contract for /daily and the
// homepage first round).

import { solve24 } from './solver';

export interface DailyPuzzle {
  /** YYYY-MM-DD calendar date (timezone is the caller's choice) */
  date: string;
  /** e.g. [4, 7, 3, 9] — values in 1..13 */
  numbers: number[];
  solutionCount: number;
}

export function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}

export function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic puzzle for a given UTC date string ("2026-07-24"). */
export function getPuzzleForDate(date: string, count = 4): DailyPuzzle {
  const rng = mulberry32(hashCode(date));
  for (let attempt = 0; attempt < 1000; attempt++) {
    const numbers = Array.from(
      { length: count },
      () => 1 + Math.floor(rng() * 13)
    );
    // Skip puzzles whose plain sum is 24 — trivially solvable, no challenge.
    if (numbers.reduce((a, b) => a + b, 0) === 24) continue;
    const solutions = solve24(numbers);
    if (solutions.length > 0) {
      return { date, numbers, solutionCount: solutions.length };
    }
  }
  throw new Error(`getPuzzleForDate: no solvable puzzle found for ${date}`);
}

/** Today's puzzle, keyed on the UTC date. */
export function getTodayPuzzle(now = new Date()): DailyPuzzle {
  return getPuzzleForDate(now.toISOString().slice(0, 10));
}

/** Local calendar date ("2026-07-25") — the player's "today", not UTC's. */
export function localDateString(d = new Date()): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

/**
 * Today's puzzle keyed on the PLAYER's local midnight (Wordle contract:
 * retention is anchored to "your tomorrow", not to UTC). Server-side code
 * cannot know the client's timezone — call this on the client. Memoized
 * per calendar day so client-side navigation (home → /daily) never
 * recomputes or flashes a skeleton mid-session.
 */
let localTodayCache: { date: string; puzzle: DailyPuzzle } | null = null;
export function getLocalTodayPuzzle(now = new Date()): DailyPuzzle {
  const date = localDateString(now);
  if (localTodayCache?.date !== date) {
    localTodayCache = { date, puzzle: getPuzzleForDate(date) };
  }
  return localTodayCache.puzzle;
}

/**
 * Day #1 of the daily challenge. Aligned with the puzzle archive's first
 * month (MIN_MONTH in puzzle-archive.tsx) — the archive backfills real,
 * deterministic puzzles from this date, so Day #N and the calendar agree.
 */
export const DAILY_LAUNCH_DATE = '2026-01-01';

/** 1-based puzzle number since launch — the community's common language ("#47"). */
export function dayNumber(date: string): number {
  const ms =
    Date.parse(`${date}T00:00:00Z`) -
    Date.parse(`${DAILY_LAUNCH_DATE}T00:00:00Z`);
  return Math.floor(ms / 86_400_000) + 1;
}
