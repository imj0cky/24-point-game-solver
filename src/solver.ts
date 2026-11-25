// 24-point solver: exhaustive search over all ways to combine the input
// numbers with + - * /, using exact rational arithmetic. Returns every
// mathematically distinct solution (commutative/associative equivalents
// are deduplicated via a canonical form).

import {
  fadd,
  fdiv,
  feq,
  fmtFrac,
  fmul,
  frac,
  fsub,
  type Frac,
} from './fraction';

export interface Solution {
  /** Display form with minimal parentheses, e.g. "8 ÷ (3 − 8 ÷ 3)" */
  expression: string;
  /** Merge trace, e.g. ["8 ÷ 3 = 8/3", "3 − 8/3 = 1/3", "8 ÷ 1/3 = 24"] */
  steps: string[];
}

type Op = '+' | '-' | '*' | '/';

const OP_SYMBOL: Record<Op, string> = {
  '+': '+',
  '-': '−',
  '*': '×',
  '/': '÷',
};

const PREC: Record<Op, number> = { '+': 1, '-': 1, '*': 2, '/': 2 };

interface Node {
  kind: 'num' | 'op';
  value: Frac;
  op?: Op;
  left?: Node;
  right?: Node;
  literal?: string;
  steps: string[];
}

function leaf(n: number): Node {
  return { kind: 'num', value: frac(n), literal: String(n), steps: [] };
}

/** Operand as shown in the step trace: its face value (number) or computed value. */
function face(n: Node): string {
  return n.kind === 'num' ? n.literal! : fmtFrac(n.value);
}

function combine(a: Node, b: Node, op: Op, integersOnly: boolean): Node | null {
  let value: Frac;
  try {
    value =
      op === '+'
        ? fadd(a.value, b.value)
        : op === '-'
          ? fsub(a.value, b.value)
          : op === '*'
            ? fmul(a.value, b.value)
            : fdiv(a.value, b.value);
  } catch {
    return null; // division by zero
  }
  // Classic card-room rules: every intermediate must be a whole number.
  // The fractions toggle lifts this (8 ÷ (3 − 8 ÷ 3) needs 8/3 and 1/3).
  if (integersOnly && value.d !== 1) return null;
  const step = `${face(a)} ${OP_SYMBOL[op]} ${face(b)} = ${fmtFrac(value)}`;
  return {
    kind: 'op',
    op,
    left: a,
    right: b,
    value,
    steps: [...a.steps, ...b.steps, step],
  };
}

/**
 * Canonical key for dedup. Additive chains treat subtraction as negation and
 * multiplicative chains treat division as inversion, then flatten + sort, so
 * a−(b−c) ≡ a+c−b and a÷(b÷c) ≡ a×c÷b collapse to one entry.
 */
function canonical(node: Node): string {
  const terms: string[] = [];
  addTerms(node, '+', terms);
  terms.sort();
  return terms.join('');
}

function addTerms(n: Node, sign: '+' | '-', out: string[]) {
  if (n.kind === 'op' && n.op === '+') {
    addTerms(n.left!, sign, out);
    addTerms(n.right!, sign, out);
  } else if (n.kind === 'op' && n.op === '-') {
    addTerms(n.left!, sign, out);
    addTerms(n.right!, sign === '+' ? '-' : '+', out);
  } else if (n.kind === 'num') {
    out.push(sign + n.literal!);
  } else {
    out.push(sign + mulKey(n));
  }
}

function mulKey(n: Node): string {
  const factors: string[] = [];
  mulFactors(n, '', factors);
  factors.sort();
  return factors.join('');
}

function mulFactors(n: Node, inv: '' | '~', out: string[]) {
  if (n.kind === 'op' && n.op === '*') {
    mulFactors(n.left!, inv, out);
    mulFactors(n.right!, inv, out);
  } else if (n.kind === 'op' && n.op === '/') {
    mulFactors(n.left!, inv, out);
    mulFactors(n.right!, inv === '' ? '~' : '', out);
  } else if (n.kind === 'num') {
    out.push(inv + n.literal!);
  } else {
    out.push(inv + canonical(n));
  }
}

/** Prints with parentheses only where precedence/associativity requires them. */
function printNode(node: Node): string {
  const go = (n: Node, ctxPrec: number, rightOf?: Op): string => {
    if (n.kind === 'num') return n.literal!;
    const prec = PREC[n.op!];
    const needParen =
      prec < ctxPrec ||
      ((rightOf === '-' || rightOf === '/') && prec === ctxPrec);
    const inner = `${go(n.left!, prec)} ${OP_SYMBOL[n.op!]} ${go(n.right!, prec, n.op)}`;
    return needParen ? `(${inner})` : inner;
  };
  return go(node, 0);
}

/**
 * Finds every distinct way to make `target` from `input` numbers
 * (each used exactly once). Typically input is 4 numbers in 1..13.
 * `integersOnly` restricts every intermediate result to whole numbers
 * (classic rules); the default allows exact fraction intermediates.
 */
export function solve24(
  input: number[],
  target = 24,
  options?: { integersOnly?: boolean }
): Solution[] {
  return searchAll(
    input,
    target,
    Number.POSITIVE_INFINITY,
    options?.integersOnly ?? false
  );
}

/**
 * Early-exit variant of solve24: stops after `limit` distinct solutions.
 * Same search, same dedup — just truncated. The worksheet generator uses it
 * because "solvable" / "at least N solutions" checks must not pay for full
 * enumeration (a 5-number deal costs ~800ms to enumerate exhaustively).
 * Note the returned solutions are the first found, not the shortest overall.
 */
export function solve24UpTo(
  input: number[],
  target: number,
  limit: number,
  options?: { integersOnly?: boolean }
): Solution[] {
  return searchAll(
    input,
    target,
    Math.max(1, Math.floor(limit)),
    options?.integersOnly ?? false
  );
}

function searchAll(
  input: number[],
  target: number,
  limit: number,
  integersOnly: boolean
): Solution[] {
  const t = frac(target);
  const solutions: Solution[] = [];
  const seen = new Set<string>();

  /** Returns true when the limit is hit and the whole search should stop. */
  function search(nodes: Node[]): boolean {
    if (nodes.length === 1) {
      const n = nodes[0];
      if (feq(n.value, t)) {
        const key = canonical(n);
        if (!seen.has(key)) {
          seen.add(key);
          solutions.push({ expression: printNode(n), steps: n.steps });
          if (solutions.length >= limit) return true;
        }
      }
      return false;
    }
    for (let i = 0; i < nodes.length; i++) {
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        const rest = nodes.filter((_, k) => k !== i && k !== j);
        for (const op of ['+', '-', '*', '/'] as const) {
          const merged = combine(nodes[i], nodes[j], op, integersOnly);
          if (merged && search([...rest, merged])) return true;
        }
      }
    }
    return false;
  }

  search(input.map(leaf));
  solutions.sort((a, b) => a.expression.length - b.expression.length);
  return solutions;
}
