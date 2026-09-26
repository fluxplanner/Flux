import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * Desmos-style regressions: lists, list literals in a regression, and a
 * fitter that finds sine and logistic curves instead of settling in the
 * wrong valley from its first guess. Truth values are the numbers the data
 * was made from, not ones read back out of this code.
 */

const w = {};
for (const f of ['flux-expr.js', 'flux-lab-fit.js', 'flux-grapher.js']) new Function('window', fs.readFileSync('public/js/' + f, 'utf8'))(w);
const T = w.FluxGrapher._test, F = w.FluxLabFit, E = w.FluxExpr;

function fit(src, gen, xs) {
  const sc = {};
  const r = E.tryCompile(src, 'x', { params: true, scope: sc });
  const model = (q, x) => { r.params.forEach((n, i) => { sc[n] = q[i]; }); return r.fn(x); };
  const res = T.fitManyStarts(F, r.params, model, xs, xs.map(gen), /sin|cos/.test(src));
  const out = {};
  r.params.forEach((n, i) => { out[n] = res.values[i]; });
  return { res, v: out, model: (x) => model(res.values, x) };
}
const xs = [...Array(15)].map((_, i) => i * 0.7);

test('a sine is found from nothing — the single all-ones start used to give R² ≈ 0', () => {
  const g = (x) => 2 * Math.sin(1.7 * x + 0.4) + 1;
  const { res, model } = fit('a sin(b x + c) + d', g, xs);
  assert.ok(res.r2 > 0.99999, 'R² ' + res.r2);
  // Any equivalent (a, b, c) is right if the curve matches; check the curve.
  for (const x of [0.3, 2.2, 5.1]) assert.ok(Math.abs(model(x) - g(x)) < 1e-4, `at ${x}`);
});

test('logistic, decay to an offset, and a bell curve all land on their true values', () => {
  const lg = fit('c / (1 + a e^(-k x))', (x) => 10 / (1 + 20 * Math.exp(-1.1 * x)), xs).v;
  assert.ok(Math.abs(lg.c - 10) < 1e-3 && Math.abs(lg.a - 20) < 1e-2 && Math.abs(lg.k - 1.1) < 1e-4, JSON.stringify(lg));
  const cool = fit('a e^(-k x) + c', (x) => 60 * Math.exp(-0.35 * x) + 22, xs).v;
  assert.ok(Math.abs(cool.c - 22) < 1e-3 && Math.abs(cool.k - 0.35) < 1e-5, JSON.stringify(cool));
  const bell = fit('a e^(-(x-b)^2/c)', (x) => 4 * Math.exp(-((x - 5) ** 2) / 3), xs).v;
  assert.ok(Math.abs(bell.b - 5) < 1e-4 && Math.abs(bell.c - 3) < 1e-4, JSON.stringify(bell));
});

test('a list is numbers only, and says which entry is wrong', () => {
  assert.deepEqual(T.parseListBody('1, 2.5, −3, 4e2').values, [1, 2.5, -3, 400]);
  assert.match(T.parseListBody('1, two, 3').error, /"two"/);
  assert.match(T.parseListBody('').error, /needs numbers/);
});

test('rows: lists, list literals straight in a regression, and (x1, y1) points', () => {
  const ctx = { columns: {}, lists: { x1: [1, 2, 3], y1: [2, 4, 6] }, fns: {} };
  const list = T.parseExpr('x1 = [1, 2, 3]', {}, ctx);
  assert.equal(list.kind, 'list');
  assert.deepEqual(list.values, [1, 2, 3]);
  assert.equal(T.parseExpr('y1 ~ m x1 + b', {}, ctx).kind, 'regression');
  const inline = T.parseExpr('[2, 4, 6] ~ m[1, 2, 3] + b', {}, { columns: {}, lists: {}, fns: {} });
  assert.equal(inline.kind, 'regression', inline.error);
  assert.deepEqual(Object.values(inline.inline), [[2, 4, 6], [1, 2, 3]]);
  assert.equal(T.parseExpr('(x1, y1)', {}, ctx).kind, 'series');
  assert.match(T.parseExpr('x = [1, 2]', {}, ctx).error || '', /something other than x or y|vertical|number/i);
});

test('the fitted equation reads naturally: signs folded in, function names kept', () => {
  const p = { rhs: 'm x1 + b', xName: 'x1', yName: 'y1' };
  assert.equal(T.fittedEquation(p, { names: ['m', 'b'], values: [1.99, -0.05] }), 'y1 = 1.99 x1 − 0.05');
  const s = { rhs: 'a sin(b x1 + c) + d', xName: 'x1', yName: 'y1' };
  assert.equal(T.fittedEquation(s, { names: ['a', 'b', 'c', 'd'], values: [2, 1.7, 0.4, 1] }), 'y1 = 2 sin(1.7 x1 + 0.4) + 1');
});
