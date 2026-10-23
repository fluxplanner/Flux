import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * Flux Pixel's ruler, protractor and set square (public/js/flux-pixel-instruments.js).
 * A line drawn along a turned ruler has to stay on its edge, and a line from
 * the protractor's centre has to read a whole number of degrees, or the
 * drawing does not match the instrument a student is looking at.
 */

const w = {};
new Function('window', fs.readFileSync('public/js/flux-pixel-instruments.js', 'utf8'))(w);
const I = w.FluxPixelInstruments;
const close = (got, want, what, tol = 1e-9) => assert.ok(Math.abs(got - want) <= tol, `${what}: got ${got}, want ${want}`);

test('1 cm is one big square of the graph paper, and the ruler is 15 cm', () => {
  assert.equal(I.CM, 40);
  const [[a, b]] = I.edges('ruler', { on: true, x: 100, y: 200, rot: 0 });
  close(b[0] - a[0], 15 * 40 + 28, 'edge length, with a little either side of 0 and 15');
  close(a[1], 200, 'edge along the top');
});

test('a turned ruler turns its edge with it', () => {
  const [[a, b]] = I.edges('ruler', { on: true, x: 0, y: 0, rot: 90 });
  close(a[0], 0, 'x stays', 1e-9);
  close(b[1] - a[1], 15 * 40 + 28, 'runs down the page', 1e-9);
});

test('a point near an edge snaps onto it, and onLine keeps it on that line past the end', () => {
  const segs = I.edges('ruler', { on: true, x: 0, y: 100, rot: 0 });
  const hit = I.snapEdge([50, 108], segs, 12);
  assert.ok(hit);
  close(hit.q[1], 100, 'on the edge');
  assert.equal(I.snapEdge([50, 140], segs, 12), null, 'too far: no snap');
  close(I.onLine([900, 130], hit.seg)[1], 100, 'beyond the ruler, still on its line');
});

test('a line from the protractor centre is a whole number of degrees, at any turn', () => {
  for (const rot of [0, 30, 147]) {
    const pro = { on: true, x: 500, y: 400, rot };
    const want = 35.4, len = 200, base = -rot * Math.PI / 180;
    const ang = base + want * Math.PI / 180;
    const end = [500 + len * Math.cos(ang), 400 - len * Math.sin(ang)];
    const r = I.protractorLine(pro, [500, 400], end);
    assert.equal(r.deg, 35, `turned ${rot}°`);
    close(Math.hypot(r.end[0] - 500, r.end[1] - 400), len, 'same length', 1e-6);
  }
  assert.equal(I.protractorLine({ on: true, x: 0, y: 0, rot: 0 }, [5, 5], [100, 0]), null, 'only from the centre');
});

test('the set square has three edges, 45° or 30°–60°', () => {
  const sq = { on: true, x: 0, y: 0, rot: 0, kind: '45' };
  assert.equal(I.edges('square', sq).length, 3);
  const [a, b] = I.squareLegs({ ...sq, kind: '30' });
  close(Math.atan2(b, a) * 180 / Math.PI, 30, '30° at the far corner', 1e-9);
  assert.equal(I.svg('square', { ...sq, on: false }), '', 'put away: nothing drawn');
  assert.match(I.svg('square', sq), /data-inst="square"/);
});
