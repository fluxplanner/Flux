import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * Relations in x and y — Desmos's implicit curves. x² + y² = 25 is read as
 * F(x, y) = x² + y² − 25 and drawn where F changes sign; y > x² is drawn with
 * the region where it holds shaded. The geometry is checked against the
 * circle it should be, not against numbers read back out of this code.
 */

const w = {};
for (const f of ['flux-expr.js', 'flux-lab-fit.js', 'flux-grapher.js']) new Function('window', fs.readFileSync('public/js/' + f, 'utf8'))(w);
const T = w.FluxGrapher._test;
const parse = (src, scope) => T.parseExpr(src, scope || {}, {});

test('a comparison of two sides in x and y is a relation', () => {
  const c = parse('x^2 + y^2 = 25');
  assert.equal(c.kind, 'implicit');
  assert.equal(c.op, '=');
  assert.equal(c.F(3, 4), 0);
  assert.equal(c.F(0, 0), -25);
  assert.equal(parse('xy = 1').F(2, 0.5), 0);
  assert.equal(parse('x = y^2').kind, 'implicit', 'x = y² is a parabola on its side');
  assert.equal(parse('y^2 = x').F(4, 2), 0);
  assert.equal(parse('y = x + y/2').kind, 'implicit', 'y on both sides');
  const ineq = parse('y > x^2');
  assert.equal(ineq.kind, 'implicit');
  assert.equal(ineq.op, '>');
  assert.equal(parse('x^2 + y^2 ≤ 9').op, '<=');
  assert.equal(parse('x > 2').kind, 'implicit', 'a half-plane');
});

test('what was already a function, a line or a number stays one', () => {
  assert.equal(parse('y = x^2').kind, 'fn');
  assert.equal(parse('x^2').kind, 'fn');
  assert.equal(parse('x = 3').kind, 'vline');
  assert.equal(parse('a = 4').kind, 'def');
  assert.equal(parse('2 + 3').kind, 'value');
  assert.equal(parse('f(x) = x^2').kind, 'fn');
  assert.equal(parse('y =').kind, 'empty');
});

test('half-typed relations say what is missing', () => {
  assert.match(parse('x^2 + y^2').error, /= and a number/);
  assert.match(parse('x^2 + y^2 =').error, /both sides/);
  assert.match(parse('0 < x < 3').error, /one =, < or >/);
  assert.match(parse('x != 2').error, /cannot be drawn/);
  assert.match(parse('2 = 3').error, /no x or y/);
});

test('sliders reach into a relation', () => {
  const scope = { r: 2 };
  const c = parse('x^2 + y^2 = r^2', scope);
  assert.deepEqual([...c.params], ['r']);
  assert.equal(c.F(2, 0), 0);
  scope.r = 3;
  assert.equal(c.F(3, 0), 0);
});

test('a limit in braces applies to a relation too', () => {
  const c = parse('x^2 + y^2 = 25 {x > 0}');
  assert.equal(c.kind, 'implicit');
  assert.ok(Number.isNaN(c.F(-3, 4)), 'the left half is outside the limit');
  assert.equal(c.F(3, 4), 0);
});

// A 600 × 600 plot of −10…10 each way: 30 px to a unit.
const v = { xLo: -10, xHi: 10, yLo: -10, yHi: 10 };
const fr = { pw: 600, ph: 600, L: 0, T: 0 };
const m = { sx: (x) => (x + 10) * 30, sy: (y) => (10 - y) * 30 };
const toMath = (X, Y) => [X / 30 - 10, 10 - Y / 30];
function linePoints(svg) {
  const d = /<path d="([^"]+)" fill="none"/.exec(svg);
  assert.ok(d, 'no curve was drawn');
  return d[1].split(/[ML]/).filter(Boolean).map((s) => s.trim().split(/\s+/).map(Number));
}

test('x² + y² = 25 is drawn as the circle of radius 5, in one closed line', () => {
  const c = parse('x^2 + y^2 = 25');
  const svg = T.implicitSVG(c.F, c.op, m, v, fr, '#f00', 'stroke="#f00"');
  const pts = linePoints(svg);
  assert.ok(pts.length > 100, 'too few points for a smooth circle: ' + pts.length);
  for (const [X, Y] of pts) {
    const [x, y] = toMath(X, Y);
    assert.ok(Math.abs(Math.hypot(x, y) - 5) < 0.02, `(${x}, ${y}) is not on the circle`);
  }
  // Joined all the way round: one M, and it ends where it began.
  assert.equal((svg.match(/M/g) || []).length, 1, 'the circle came out in pieces');
  const first = pts[0], last = pts[pts.length - 1];
  assert.ok(Math.hypot(first[0] - last[0], first[1] - last[1]) < 0.01);
  assert.ok(!/flg-region/.test(svg), '= is a curve, not a region');
});

test('y > x² shades above the parabola and nowhere below it', () => {
  const c = parse('y > x^2');
  const svg = T.implicitSVG(c.F, c.op, m, v, fr, '#0f0', 'stroke="#0f0"');
  const region = /class="flg-region" d="([^"]+)"/.exec(svg);
  assert.ok(region, 'the region was not shaded');
  const nums = region[1].split(/[MLHVZ]/).filter(Boolean).map((s) => s.trim().split(/\s+/).map(Number));
  // Every vertex of the shading is on or above the curve (to within a cell).
  const cellUnits = 20 / Math.ceil(600 / Math.max(4, Math.sqrt(600 * 600 / 60000)));
  for (const d of region[1].matchAll(/[ML]([\d.]+) ([\d.]+)/g)) {
    const [x, y] = toMath(+d[1], +d[2]);
    assert.ok(y >= x * x - 2 * cellUnits * (1 + Math.abs(2 * x)), `(${x}, ${y}) is shaded but below y = x²`);
  }
  assert.ok(nums.length > 10);
});

test('1/x has no line joining its two halves across the pole', () => {
  const c = parse('xy = 1');
  const svg = T.implicitSVG(c.F, c.op, m, v, fr, '#00f', 'stroke="#00f"');
  for (const [X, Y] of linePoints(svg)) {
    const [x, y] = toMath(X, Y);
    assert.ok(Math.abs(x * y - 1) < 0.05, `(${x}, ${y}) is not on xy = 1`);
  }
});
