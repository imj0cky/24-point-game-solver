import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { decodeChallenge, encodeChallenge } from './challenge';

describe('challenge seed encoding', () => {
  it('round-trips cards with and without a time', () => {
    const withTime = encodeChallenge({ cards: [3, 3, 8, 8], seconds: 41 });
    assert.deepEqual(decodeChallenge(withTime), {
      cards: [3, 3, 8, 8],
      seconds: 41,
    });

    const noTime = encodeChallenge({ cards: [1, 2, 3] });
    assert.deepEqual(decodeChallenge(noTime), { cards: [1, 2, 3] });
  });

  it('produces a single URL-safe path segment (base64url, unpadded)', () => {
    // Force padding/+/_ candidates: search seeds until the raw base64
    // would contain them, then assert the seed itself never does.
    for (let seconds = 0; seconds < 500; seconds++) {
      const seed = encodeChallenge({ cards: [3, 3, 8, 8], seconds });
      assert.match(seed, /^[A-Za-z0-9_-]+$/);
      assert.ok(!seed.includes('='));
      assert.ok(!seed.includes('+'));
      assert.ok(!seed.includes('/'));
    }
  });

  it('accepts 3- and 5-card challenges (the play surface supports them)', () => {
    assert.deepEqual(decodeChallenge(encodeChallenge({ cards: [4, 5, 6] })), {
      cards: [4, 5, 6],
    });
    assert.deepEqual(
      decodeChallenge(encodeChallenge({ cards: [1, 2, 3, 4, 5], seconds: 90 })),
      { cards: [1, 2, 3, 4, 5], seconds: 90 }
    );
  });

  it('rejects oversized seeds before decoding', () => {
    assert.equal(decodeChallenge('A'.repeat(65)), null);
    assert.equal(decodeChallenge(`${'A'.repeat(100)}!!!`), null);
  });

  it('rejects tampered and malformed seeds', () => {
    assert.equal(decodeChallenge(''), null);
    assert.equal(decodeChallenge('!!!not-base64!!!'), null);
    assert.equal(decodeChallenge('aGVsbG8'), null); // valid b64url, not JSON
    // Flip a character inside an otherwise-valid seed.
    const seed = encodeChallenge({ cards: [3, 3, 8, 8], seconds: 41 });
    const tampered = seed.startsWith('A') ? `B${seed.slice(1)}` : `A${seed}`;
    // The tampered seed must either decode to something different or fail —
    // never silently pass through as the original challenge.
    const decoded = decodeChallenge(tampered);
    if (decoded) {
      assert.notDeepEqual(decoded, { cards: [3, 3, 8, 8], seconds: 41 });
    }
  });

  it('rejects wrong shapes', () => {
    const cases: unknown[] = [
      { c: '3,3,8,8' }, // cards not an array
      { c: [3, 3] }, // too few cards
      { c: [1, 2, 3, 4, 5, 6] }, // too many cards
      { c: [0, 3, 8, 8] }, // card below range
      { c: [3, 3, 8, 14] }, // card above range
      { c: [3, 3, 8, 8.5] }, // non-integer card
      { c: [3, 3, 8, '8'] }, // non-numeric card
      { c: [3, 3, 8, 8], t: -1 }, // negative time
      { c: [3, 3, 8, 8], t: 41.5 }, // non-integer time
      { c: [3, 3, 8, 8], t: '41' }, // non-numeric time
      [3, 3, 8, 8], // top-level array
      null,
      '3,3,8,8',
    ];
    for (const c of cases) {
      const seed = toSeed(c);
      assert.equal(decodeChallenge(seed), null, `should reject ${seed}`);
    }
  });

  it('tolerates extra unknown fields (forward compatibility)', () => {
    const seed = toSeed({ c: [3, 3, 8, 8], t: 41, v: 2 });
    assert.deepEqual(decodeChallenge(seed), {
      cards: [3, 3, 8, 8],
      seconds: 41,
    });
  });
});

/** JSON-encode + base64url a raw payload the same way the module does. */
function toSeed(raw: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(raw));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
