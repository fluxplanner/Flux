import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

/** Uncertainty propagation in the Lab report tool — hand-worked. */
const sandbox = { window: {}, setTimeout: () => 0 };
vm.createContext(sandbox);
vm.runInContext(readFileSync(new URL('../../public/js/flux-study-labreport.js', import.meta.url), 'utf8'), sandbox);
const L = sandbox.window.FluxLabReport;
const close = (a, b) => Math.abs(a - b) < 1e-9;

test('× and ÷ add percentage uncertainties', () => {
  const r = L.propagate('mul', '2.0', '0.1', '3.0', '0.3');      // 5% + 10% = 15% of 6.0
  assert.ok(close(r.value, 6) && close(r.pct, 15) && close(r.abs, 0.9));
  assert.equal(L.rounded(r.value, r.abs), '6.0 ± 0.9');
  const d = L.propagate('div', '10.0', '0.5', '2.0', '0.1');      // 5% + 5% of 5.0
  assert.ok(close(d.value, 5) && close(d.abs, 0.5));
});

test('+ and − add absolute uncertainties', () => {
  const r = L.propagate('add', '10.0', '0.2', '5.0', '0.1');
  assert.ok(close(r.value, 15) && close(r.abs, 0.3));
  assert.equal(L.rounded(r.value, r.abs), '15.0 ± 0.3');
  const s = L.propagate('sub', '10.0', '0.2', '5.0', '0.1');
  assert.ok(close(s.value, 5) && close(s.abs, 0.3), 'subtracting still adds the uncertainties');
});

test('powers multiply the percentage: squaring doubles it, a square root halves it', () => {
  const sq = L.propagate('pow', '2.00', '0.02', null, null, '2');   // 1% → 2% of 4.00
  assert.ok(close(sq.value, 4) && close(sq.pct, 2) && close(sq.abs, 0.08));
  assert.equal(L.rounded(sq.value, sq.abs), '4.00 ± 0.08');
  const rt = L.propagate('pow', '16', '0.8', null, null, '0.5');    // 5% → 2.5% of 4
  assert.ok(close(rt.value, 4) && close(rt.pct, 2.5) && close(rt.abs, 0.1));
  assert.equal(L.rounded(rt.value, rt.abs), '4.00 ± 0.10', 'an uncertainty starting with 1 keeps two figures');
});

test('results are rounded the way a lab report writes them', () => {
  assert.equal(L.rounded(9.8123, 0.0467), '9.81 ± 0.05');
  assert.equal(L.rounded(1234.5, 26), '1230 ± 30');
  assert.equal(L.rounded(0.004567, 0.00012), '0.00457 ± 0.00012');
});

test('it says what is missing instead of guessing', () => {
  assert.match(L.propagate('div', '1', '0.1', '0', '0.1').error, /cannot divide/);
  assert.match(L.propagate('mul', '1', '0.1', '', '').error, /value for B/);
  assert.match(L.propagate('pow', '', '', null, null, '2').error, /value for A/);
});
