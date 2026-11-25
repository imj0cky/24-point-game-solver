// Exact rational arithmetic for the 24-point solver.
// Division-heavy puzzles like 8/(3-8/3) can't be checked reliably with floats,
// so every value is kept as a normalized fraction: d > 0, gcd(|n|, d) = 1.

export interface Frac {
  n: number;
  d: number;
}

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    [a, b] = [b, a % b];
  }
  return a || 1;
}

export function frac(n: number, d = 1): Frac {
  if (d === 0) throw new Error('division by zero');
  if (d < 0) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}

export const fadd = (a: Frac, b: Frac): Frac =>
  frac(a.n * b.d + b.n * a.d, a.d * b.d);

export const fsub = (a: Frac, b: Frac): Frac =>
  frac(a.n * b.d - b.n * a.d, a.d * b.d);

export const fmul = (a: Frac, b: Frac): Frac => frac(a.n * b.n, a.d * b.d);

export const fdiv = (a: Frac, b: Frac): Frac => frac(a.n * b.d, a.d * b.n);

export const feq = (a: Frac, b: Frac): boolean => a.n === b.n && a.d === b.d;

export function fmtFrac(a: Frac): string {
  return a.d === 1 ? String(a.n) : `${a.n}/${a.d}`;
}
