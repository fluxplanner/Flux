import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * The grapher's expression parser, and the Desmos-style sliders it grew.
 *
 * The slider rules are the part worth pinning: a letter the parser does not
 * know becomes an adjustable number, but only when the caller asks for that —
 * and "ax^2" must mean a·x², not (a·x)², or every parabola with a slider on it
 * is quietly the wrong shape.
 */

const src = fs.readFileSync('public/js/flux-expr.js', 'utf8');
const w = {};
new Function('window', src)(w);
const E = w.FluxExpr;

const close = (got, want, what) =>
  assert.ok(Math.abs(got - want) < 1e-12, `${what}: got ${got}, want ${want}`);

test('ordinary expressions still evaluate as written', () => {
  close(E.compile('2x^2 - 3x + 1')(2), 3, '2·4 − 6 + 1');
  close(E.compile('3(x+1)')(1), 6, 'number times bracket');
  close(E.compile('2sin(x)')(Math.PI / 2), 2, 'number times function');
  close(E.compile('2^3^2')(0), 512, 'powers are right-associative');
});

test('a variable next to a bracket multiplies instead of failing', () => {
  // Used to be 'I do not know the function "x"'.
  close(E.compile('x(x+1)')(3), 12, 'x(x+1) at 3');
});

test('without sliders switched on, an unknown letter is still an error', () => {
  const r = E.tryCompile('a*x');
  assert.ok(r.error, 'a stray letter must not silently become 1');
});

test('sliders: unknown letters become numbers read from the scope', () => {
  const scope = { a: 2, b: 3 };
  const r = E.tryCompile('a*sin(b*x)', 'x', { params: true, scope });
  assert.ok(!r.error, r.error);
  assert.deepEqual(r.params, ['a', 'b']);
  close(r.fn(Math.PI / 6), 2 * Math.sin(Math.PI / 2), 'a·sin(bx)');
  // Read at call time: moving a slider needs no recompile.
  scope.a = 5;
  close(r.fn(Math.PI / 6), 5, 'after moving the a slider');
});

test('"ax^2" is a·x², because the power belongs to the last letter', () => {
  const r = E.tryCompile('ax^2', 'x', { params: true, scope: { a: 3 } });
  assert.ok(!r.error, r.error);
  close(r.fn(2), 12, '3·2² is 12 — (3·2)² would be 36');
});

test('letters run together multiply one by one, and functions still work after them', () => {
  const r = E.tryCompile('kxsin(x)', 'x', { params: true, scope: { k: 2 } });
  assert.ok(!r.error, r.error);
  close(r.fn(Math.PI / 2), 2 * (Math.PI / 2) * 1, 'k·x·sin(x)');
});

test('an unset slider reads as 1, not NaN', () => {
  const r = E.tryCompile('m*x + c', 'x', { params: true, scope: {} });
  close(r.fn(4), 5, '1·4 + 1');
});

test('constants are not mistaken for sliders', () => {
  const r = E.tryCompile('2pix + e', 'x', { params: true, scope: {} });
  assert.ok(!r.error, r.error);
  assert.deepEqual(r.params, [], 'π and e must not grow sliders');
  close(r.fn(1), 2 * Math.PI + Math.E, '2πx + e at 1');
});

test('a function written without brackets is explained, not split into sliders', () => {
  const r = E.tryCompile('sinx', 'x', { params: true });
  assert.ok(r.error, '"sinx" must not become s·i·n·x');
  assert.match(r.error, /sin\(/);
  assert.match(E.tryCompile('cos', 'x', { params: true }).error, /brackets/i);
});

test('a space separates words: "a sin(x)" is a·sin(x), not the arcsine', () => {
  /* Stripping spaces up front turned "a sin(x)" into "asin(x)" — a stub of
     arcsine between −1 and 1 instead of a sine wave with a slider. */
  const r = E.tryCompile('a sin(x) + 1', 'x', { params: true, scope: { a: 3 } });
  assert.ok(!r.error, r.error);
  assert.deepEqual(r.params, ['a']);
  close(r.fn(Math.PI / 2), 4, '3·sin(π/2) + 1');
  close(E.compile('sin (x)')(Math.PI / 2), 1, 'a space before the bracket');
  close(E.compile('2 x ^ 2')(3), 18, 'spaces around every token');
  close(E.compile('x (x + 1)')(2), 6, 'variable, space, bracket');
});

test('y cannot appear on the right-hand side', () => {
  assert.ok(E.tryCompile('y+1', 'x', { params: true }).error);
});
