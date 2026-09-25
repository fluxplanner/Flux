import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * The grapher's points of interest — what Desmos shows when you click a curve
 * — and the document it saves.
 *
 * The expected values are the textbook answers (x² − 4 is zero at ±2, sin is
 * 1 at π/2), not numbers read back out of this code. The pole cases matter as
 * much as the easy ones: tan x changes sign at π/2 without being zero there,
 * and a zero that is really an asymptote would be marked on every tan graph.
 */

const w = {};
new Function('window', fs.readFileSync('public/js/flux-expr.js', 'utf8'))(w);
new Function('window', fs.readFileSync('public/js/flux-lab-fit.js', 'utf8'))(w);
new Function('window', fs.readFileSync('public/js/flux-grapher.js', 'utf8'))(w);
const T = w.FluxGrapher._test;
const f = (src) => w.FluxExpr.compile(src);

const near = (got, want, what, tol = 1e-6) =>
  assert.ok(Math.abs(got - want) < tol, `${what}: got ${got}, want ${want}`);
const find = (pts, type, x, tol = 1e-5) => pts.find((p) => p.types.includes(type) && Math.abs(p.x - x) < tol);

test('a parabola: two zeros, its minimum, and where it meets the y axis', () => {
  const pts = T.keyPoints(f('x^2 - 4'), -5, 5, 10);
  assert.ok(find(pts, 'zero', -2), 'no zero at x = −2');
  assert.ok(find(pts, 'zero', 2), 'no zero at x = 2');
  const min = find(pts, 'min', 0);
  assert.ok(min, 'no minimum at x = 0');
  near(min.y, -4, 'minimum value');
  assert.ok(min.types.includes('yint'), 'the y-intercept is the same point and should say so');
  assert.equal(pts.filter((p) => p.types.includes('zero')).length, 2, 'exactly two zeros');
});

test('a curve that touches zero without crossing still has its zero found', () => {
  // x² never changes sign, so a sign-change search alone misses it.
  const pts = T.keyPoints(f('x^2'), -3, 3, 6);
  const p = find(pts, 'zero', 0);
  assert.ok(p, 'x² has a zero at 0');
  assert.ok(p.types.includes('min'), 'and it is also the minimum');
});

test('sine: its maximum and minimum are 1 and −1 at π/2 and 3π/2', () => {
  const pts = T.keyPoints(f('sin(x)'), 0.5, 5.5, 2);
  const max = find(pts, 'max', Math.PI / 2);
  const min = find(pts, 'min', 3 * Math.PI / 2);
  assert.ok(max && min, 'turning points missing');
  near(max.y, 1, 'maximum');
  near(min.y, -1, 'minimum');
  assert.ok(find(pts, 'zero', Math.PI), 'zero at π');
});

test('tan x changes sign at its asymptotes, which are not zeros', () => {
  const pts = T.keyPoints(f('tan(x)'), -3, 3, 10);
  const zeros = pts.filter((p) => p.types.includes('zero'));
  assert.ok(find(pts, 'zero', 0), 'tan has a zero at 0');
  assert.ok(!zeros.some((p) => Math.abs(Math.abs(p.x) - Math.PI / 2) < 0.05),
    'an asymptote at ±π/2 was reported as a zero');
  assert.equal(zeros.length, 1, 'only x = 0 is a zero between −3 and 3');
});

test('1/x has no zero and no turning point, however it is sampled', () => {
  const pts = T.keyPoints(f('1/x'), -4, 4, 8);
  assert.equal(pts.length, 0, 'found ' + JSON.stringify(pts));
});

test('where two curves cross', () => {
  // x² = x + 2 at x = −1 (y = 1) and x = 2 (y = 4).
  const out = T.intersections(f('x^2'), f('x + 2'), -5, 5, 10);
  assert.equal(out.length, 2);
  near(out[0].x, -1, 'first crossing x');
  near(out[0].y, 1, 'first crossing y');
  near(out[1].x, 2, 'second crossing x');
  near(out[1].y, 4, 'second crossing y');
});

test('an uncertainty cell is a number or a percentage of its reading', () => {
  near(T.uncOf('0.5', 10), 0.5, 'absolute');
  near(T.uncOf('5%', 40), 2, '5% of 40');
  near(T.uncOf('-0.2', 1), 0.2, 'a bar length is never negative');
  assert.equal(T.uncOf('', 3), 0, 'blank means no bar');
});

test('a table plots the chosen columns with their own uncertainty columns', () => {
  const t = {
    cols: [
      { id: 'a', role: 'value' }, { id: 'b', role: 'value' },
      { id: 'u', role: 'unc', of: 'b' }, { id: 'c', role: 'value' },
    ],
    rows: [['1', '10', '2%', '100'], ['2', '', '0.1', '200'], ['3', '30', '0.5', '']],
    xCol: 'a', yCol: 'b',
  };
  const pts = T.tablePoints(t);
  assert.equal(pts.length, 2, 'a row with a blank y is skipped, not read as zero');
  near(pts[0].dy, 0.2, '2% of 10');
  near(pts[1].dy, 0.5, 'absolute');
  assert.equal(pts[0].dx, 0, 'no ± column for x means no x bar');
  // Plot a different pair: the ± column follows its own column, not "y".
  t.yCol = 'c';
  const q = T.tablePoints(t);
  assert.equal(q.length, 2);
  assert.equal(q[0].dy, 0, 'the ± column belongs to b, so c has no bars');
});

test('a graph saved by the first grapher still opens, uncertainties and all', () => {
  const v1 = {
    title: 'Pendulum', xLabel: 'Length', xUnit: 'm', yLabel: 'T²', yUnit: 's²',
    rows: [{ x: '0.2', y: '0.81' }, { x: '0.4', y: '1.62' }],
    ux: { mode: 'absolute', value: '0.01' }, uy: { mode: 'percent', value: '10' },
    fitKind: 'proportional', showMinMax: true,
  };
  const d = T.normaliseDoc(v1, 'data');
  assert.equal(d.title, 'Pendulum');
  const t = d.items[0];
  assert.equal(t.type, 'table');
  assert.equal(t.cols.filter((c) => c.role === 'unc').length, 2, 'both uncertainty rules become columns');
  // One fit then; a list of them now — the old choice carries over as the only one on.
  assert.deepEqual(t.fits, ['proportional']);
  assert.equal(t.minmax, true);
  const pts = T.tablePoints(t);
  near(pts[0].dx, 0.01, 'x uncertainty carried over');
  near(pts[1].dy, 0.162, '10% of 1.62');
});

test('a saved graph is untrusted: bad colours, dangling columns and junk are repaired', () => {
  const d = T.normaliseDoc({
    items: [
      { type: 'expr', src: 'x', colour: 'red; background:url(x)' },
      { type: 'table', cols: [{ id: 'p', role: 'value' }, { id: 'q', role: 'unc', of: 'gone' }], rows: [['1', '0.1']] },
      { type: 'script', src: 'alert(1)' },
      null,
    ],
    win: { xMin: 5, xMax: 1 },
    params: { a: { v: 2 }, 'bad key': { v: 1 } },
  }, 'data');
  assert.equal(d.items.length, 2, 'unknown item types are dropped');
  assert.match(d.items[0].colour, /^#[0-9a-f]{6}$/i, 'a colour must be a plain hex value');
  assert.equal(d.items[1].cols[1].of, 'p', 'a ± column pointing nowhere is reattached');
  assert.equal(d.win.xMin, 0, 'an inverted window falls back to the default');
  assert.deepEqual(Object.keys(d.params), ['a'], 'only single-letter slider names survive');
  assert.equal(T.normaliseDoc('nonsense', 'functions').items[0].src, 'x^2', 'garbage opens as a fresh graph');
});

test('equations: vertical lines, points, and helpful refusals', () => {
  const scope = {};
  assert.equal(T.parseExpr('x = 3', scope).kind, 'vline');
  assert.equal(T.parseExpr('(1, 2), (3, 4)', scope).pts.length, 2);
  assert.equal(T.parseExpr('y = 2x + 1', scope).kind, 'fn');
  assert.equal(T.parseExpr('f(x) = x^2', scope).kind, 'fn');
  assert.ok(T.parseExpr('x = x + 1', scope).error, 'x = x + 1 is not a vertical line');
  assert.ok(T.parseExpr('y > x', scope).error, 'inequalities are refused, not mis-drawn');
  assert.equal(T.parseExpr('', scope).kind, 'empty');
});

test('a calculated column carries the uncertainty through its formula', () => {
  /* T = 2.0 ± 0.1 s, so T² = 4.0 and u(T²) = 2T·u(T) = 0.4 — the rule every
     IB student learns as "double the percentage": 5% on T, 10% on T². */
  const t = {
    cols: [
      { id: 'L', name: 'L', role: 'value' }, { id: 'T', name: 'T', role: 'value' },
      { id: 'uT', role: 'unc', of: 'T' }, { id: 'T2', name: 'T2', role: 'calc', expr: 'T^2' },
      { id: 'g', name: 'g', role: 'calc', expr: '4 pi^2 L / T2' },
    ],
    rows: [['1.00', '2.0', '0.1', '', '']],
    xCol: 'L', yCol: 'T2',
  };
  const ct = T.computeTable(t);
  near(ct.rows[0].v.T2, 4, 'T²');
  near(ct.rows[0].u.T2, 0.4, 'u(T²) = 2T·u(T)', 1e-6);
  // A formula can use a calculated column to its left, and the uncertainty keeps flowing.
  const g = 4 * Math.PI ** 2 * 1 / 4;
  near(ct.rows[0].v.g, g, 'g = 4π²L/T²');
  near(ct.rows[0].u.g, g * 0.1, 'u(g)/g = u(T²)/T² = 10%', 1e-6);
  // And the plotted point takes the propagated bar.
  const pts = T.tablePoints(t);
  near(pts[0].dy, 0.4, 'the error bar on T² is the propagated one', 1e-6);
});

test('two uncertain inputs combine in quadrature, not by adding', () => {
  // f = a + b with u(a) = 0.3, u(b) = 0.4 → u(f) = 0.5, not 0.7.
  const t = {
    cols: [
      { id: 'a', name: 'a', role: 'value' }, { id: 'ua', role: 'unc', of: 'a' },
      { id: 'b', name: 'b', role: 'value' }, { id: 'ub', role: 'unc', of: 'b' },
      { id: 's', name: 's', role: 'calc', expr: 'a + b' },
    ],
    rows: [['1', '0.3', '2', '0.4', '']],
    xCol: 'a', yCol: 's',
  };
  near(T.computeTable(t).rows[0].u.s, 0.5, 'u(a + b)');
});

test('a formula that names a column that is not there says so', () => {
  const t = {
    cols: [{ id: 'x', name: 'x', role: 'value' }, { id: 'f', name: 'f', role: 'calc', expr: 'q * 2' }],
    rows: [['3', '']], xCol: 'x', yCol: 'f',
  };
  const ct = T.computeTable(t);
  assert.ok(ct.calc.f.error, 'an unknown column name must be an error, not a silent blank');
  assert.ok(Number.isNaN(ct.rows[0].v.f));
});

test('limits in braces draw a curve only where they allow', () => {
  const p = T.parseExpr('x^2 {0 < x < 3}', {});
  assert.equal(p.kind, 'fn');
  near(p.fn(2), 4, 'inside the limit');
  assert.ok(Number.isNaN(p.fn(-1)), 'left of the limit is not drawn');
  assert.ok(Number.isNaN(p.fn(3.5)), 'right of the limit is not drawn');
  const q = T.parseExpr('sin(x) {x ≥ 0}', {});
  assert.ok(Number.isNaN(q.fn(-0.1)) && Number.isFinite(q.fn(0.1)), 'a one-sided limit');
  const r = T.parseExpr('x {a > x}', { a: 2 });
  assert.ok(Number.isFinite(r.fn(1)) && Number.isNaN(r.fn(3)), 'a bound from a slider, written the other way round');
  assert.ok(T.parseExpr('x {y > 0}', {}).error, 'a limit without x is explained');
});
