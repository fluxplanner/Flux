import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * Rows typed or pasted into the grapher the way a worksheet writes them, and
 * lab tables pasted from a spreadsheet. Each case here was an error, or a
 * wrong graph, before the grapher read rows through FluxExpr.tidy.
 */

const w = {};
for (const f of ['flux-expr.js', 'flux-lab-fit.js', 'flux-grapher.js', 'flux-grapher-import.js']) {
  new Function('window', fs.readFileSync('public/js/' + f, 'utf8'))(w);
}
const T = w.FluxGrapher._test;
const parse = (src) => T.parseExpr(src, {}, {});
const close = (got, want, what) => assert.ok(Math.abs(got - want) < 1e-9, `${what}: got ${got}, want ${want}`);
const at = (src, x) => { const p = parse(src); assert.equal(p.kind, 'fn', src + ': ' + (p.error || p.kind)); return p.fn(x); };

test('rows read the way they are written on paper', () => {
  close(at('y = |x - 2|', -1), 3, '|x − 2|');
  close(at('y = sin x', Math.PI / 2), 1, 'sin x');
  close(at('ln x', Math.E), 1, 'ln x');
  close(at('y = 2√x', 9), 6, '2√x');
  close(at('f(x) = x² − 4', 3), 5, 'x² − 4');
  close(at('y = 3 − 2x', 1), 1, 'a real minus');
  assert.equal(parse('|x| + |y| = 1').kind, 'implicit');
  assert.equal(parse('y ≥ x²').op, '>=');
});

test('a straight line in any form is solved for y, so it has intercepts', () => {
  close(at('2x + 3y = 6', 3), 0, '2x + 3y = 6 at x = 3');
  close(at('2x + 3y = 6', 0), 2, '2x + 3y = 6 at x = 0');
  close(at('y - 2 = 3(x - 1)', 2), 5, 'point-slope form');
  close(at('3y = 6', 7), 2, 'y alone');
  // Still relations: y on both sides, a slope in y that changes sign, a slider, a curve.
  assert.equal(parse('y = x + y/2').kind, 'implicit');
  assert.equal(parse('xy = 1').kind, 'implicit');
  assert.equal(parse('x + ay = 1').kind, 'implicit');
  assert.equal(parse('x^2 + y^2 = 25').kind, 'implicit');
  assert.equal(parse('2x + 3y > 6').kind, 'implicit', 'an inequality is still shaded');
});

test('limits in words or after a comma, as well as in { }', () => {
  for (const src of ['y = x^2 for 0 < x < 3', 'y = x^2, 0 < x < 3', 'y = x^2 {0 < x and x < 3}', 'y = x^2 when 0 <= x <= 3']) {
    const p = parse(src);
    assert.equal(p.kind, 'fn', src + ': ' + p.error);
    assert.equal(p.fn(2), 4, src);
    assert.ok(Number.isNaN(p.fn(-1)), src + ' is cut off below 0');
  }
  assert.ok(Number.isNaN(parse('y = √x, x ≥ 4').fn(1)));
  assert.equal(parse('y = 5 − x {−2 < x < 4}').fn(1), 4, 'a real minus inside the braces');
  // Commas that are not limits are left alone.
  assert.equal(parse('(1, 2), (3, 4)').kind, 'points');
  assert.equal(parse('max(x, 2)').kind, 'fn');
});

test('a pasted table keeps a missing reading in its place and reads lab-book numbers', () => {
  const p = T.pastedGrid('Time (s)\tDistance (m)\n1\t2,1\n2\t\n3\t6.2\n\t7');
  assert.deepEqual(p.heads, ['Time (s)', 'Distance (m)']);
  assert.deepEqual(p.grid, [['1', '2.1'], ['2', ''], ['3', '6.2'], ['', '7']]);
  assert.deepEqual(T.pastedGrid('0,5;1,2\n1,0;2,4').grid, [['0.5', '1.2'], ['1.0', '2.4']], 'semicolons with decimal commas');
  assert.deepEqual(T.pastedGrid('0.1\t3.2 × 10⁻³').grid, [['0.1', '3.2e-3']]);
  assert.deepEqual(T.pastedGrid('1 2\n3 4').grid, [['1', '2'], ['3', '4']], 'columns lined up with spaces');
});

test('a typed cell reads like an imported one', () => {
  const t = { xCol: 'a', yCol: 'b', cols: [{ id: 'a', name: 'x', role: 'value' }, { id: 'b', name: 'y', role: 'value' }], rows: [['−4,5', '2.35 ± 0.05'], ['3.2 × 10⁻³', '']] };
  const pts = T.tablePoints(t);
  assert.ok(pts.length >= 1, 'readings were dropped');
  close(pts[0].x, -4.5, '−4,5');
  close(pts[0].y, 2.35, 'the value of 2.35 ± 0.05');
});
