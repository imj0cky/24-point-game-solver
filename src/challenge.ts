// Challenge-link (de)serialization for /play/{seed}. A challenge is a
// compact JSON payload — {"c":[3,3,8,8],"t":41} (c = cards, t = the
// challenger's seconds, optional) — encoded as unpadded base64url so the
// whole link is a single path segment. Pure and framework-free — pinned by
// challenge.test.ts.
//
// Tamper contract: decodeChallenge validates EVERYTHING about the shape
// (3-5 integers in 1..13, optional non-negative integer seconds) and
// returns null on anything else; the route turns null into a 404. The seed
// is not signed — a tampered seed only re-deals the tamperer's own bragging
// rights, which is acceptable by design (no server state, no leaderboard).

export interface Challenge {
  cards: number[];
  /** The challenger's solve time in whole seconds. */
  seconds?: number;
}

const MIN_CARDS = 3;
const MAX_CARDS = 5;
const MIN_CARD = 1;
const MAX_CARD = 13;
const MAX_SECONDS = 24 * 60 * 60;

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(seed: string): string | null {
  if (!seed || !/^[A-Za-z0-9_-]+$/.test(seed)) return null;
  const b64 = seed.replace(/-/g, '+').replace(/_/g, '/');
  try {
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

/**
 * Encodes a challenge into its base64url seed. `seconds` is omitted from
 * the payload when absent, so a no-clock challenge decodes back without it.
 */
export function encodeChallenge({ cards, seconds }: Challenge): string {
  const payload: { c: number[]; t?: number } = { c: [...cards] };
  if (seconds !== undefined) payload.t = seconds;
  return toBase64Url(JSON.stringify(payload));
}

/**
 * Decodes and validates a challenge seed. Returns null for anything that is
 * not exactly the expected shape: malformed base64, non-JSON, missing/extra
 * fields (extra fields are tolerated), wrong card count, non-integer or
 * out-of-range cards, or a non-integer/negative/out-of-range `t`.
 */
export function decodeChallenge(seed: string): Challenge | null {
  // Reject oversized seeds before decoding — a huge base64url payload would
  // otherwise be atob'd and parsed on every unauthenticated request.
  if (seed.length > 64) return null;
  const text = fromBase64Url(seed);
  if (text === null) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return null;
  }
  const obj = raw as Record<string, unknown>;

  if (!Array.isArray(obj.c)) return null;
  if (obj.c.length < MIN_CARDS || obj.c.length > MAX_CARDS) return null;
  // Strict type check first: Number('8') would silently coerce a string
  // card into a passing hand.
  if (obj.c.some((v) => typeof v !== 'number')) return null;
  const cards = obj.c;
  if (cards.some((n) => !Number.isInteger(n) || n < MIN_CARD || n > MAX_CARD)) {
    return null;
  }

  let seconds: number | undefined;
  if (obj.t !== undefined) {
    if (typeof obj.t !== 'number') return null;
    const t = obj.t;
    if (!Number.isInteger(t) || t < 0 || t > MAX_SECONDS) return null;
    seconds = t;
  }

  return seconds === undefined ? { cards } : { cards, seconds };
}
