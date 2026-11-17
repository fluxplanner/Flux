import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

/**
 * flux-composer.js clefs: where a note sits on the staff in treble, alto and
 * bass clef, mid-staff clef changes, and the saved Keyboard piece.
 * Positions are standard notation: 0 = bottom line, 4 = middle line, 8 = top line.
 */
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(readFileSync(new URL('../../public/js/flux-composer.js', import.meta.url), 'utf8'), sandbox);
const C = sandbox.window.FluxComposer;
const n = (l, oct, a = 0) => ({ l, a, oct }); // l: 0 = C … 6 = B

test('middle C: ledger below treble, middle line of alto, ledger above bass', () => {
  assert.equal(C.staffPos(n(0, 4), 'treble'), -2);
  assert.equal(C.staffPos(n(0, 4), 'alto'), 4);
  assert.equal(C.staffPos(n(0, 4), 'bass'), 10);
});

test('alto clef lines read F A C E G', () => {
  assert.deepEqual([n(3, 3), n(5, 3), n(0, 4), n(2, 4), n(4, 4)].map((p) => C.staffPos(p, 'alto')), [0, 2, 4, 6, 8]);
});

test('accidentals do not move a note; playback pitch is the same in every clef', () => {
  assert.equal(C.staffPos(n(3, 4, 1), 'alto'), C.staffPos(n(3, 4), 'alto'));
  assert.equal(C.midiOf(n(0, 4)), 60);
});

test('staffSVG draws the alto C clef, and a small clef where the clef changes', () => {
  const alto = C.staffSVG({ notes: [n(0, 4)], clef: 'alto' });
  assert.match(alto, /fc-clef--alto/);
  assert.doesNotMatch(alto, /fc-clef--treble|scale\(0\.72\)/);
  const mixed = C.staffSVG({ notes: [Object.assign(n(0, 5), { clef: 'treble' }), Object.assign(n(0, 4), { clef: 'alto' }), Object.assign(n(0, 3), { clef: 'bass' })] });
  assert.match(mixed, /fc-clef--treble/);
  assert.equal((mixed.match(/scale\(0\.72\)/g) || []).length, 2);
});

test('the alto middle-C notehead sits on the middle line', () => {
  const svg = C.staffSVG({ notes: [n(0, 4)], clef: 'alto' });
  const lines = [...svg.matchAll(/<line x1="6"[^>]*y1="([\d.]+)"/g)].map((m) => +m[1]);
  const head = +/<ellipse cx="[\d.]+" cy="([\d.]+)"/.exec(svg)[1];
  assert.equal(head, lines[2]);
});

test('saved Keyboard is cleaned: bad notes and clefs dropped, clefs stay with their notes', () => {
  const kb = C.cleanKb({ from: 48, played: [60, 'x', 62, 200, 65], clefs: ['alto', 'treble', 'nope', null, 'bass'], flat: true, clef: 'alto' });
  assert.deepEqual(Array.from(kb.played), [60, 62, 65]);
  assert.deepEqual(Array.from(kb.clefs), ['alto', null, 'bass']);
  assert.equal(kb.clef, 'alto');
  assert.equal(kb.flat, true);
  const bad = C.cleanKb({ from: 7, clef: 'tenorish', played: 'no' });
  assert.equal(bad.from, 48);
  assert.equal(bad.clef, 'auto');
  assert.deepEqual(Array.from(bad.played), []);
});
