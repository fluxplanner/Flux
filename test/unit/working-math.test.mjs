import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

/**
 * flux-working-math.js: plugging numbers into formula-sheet formulas.
 * Expected answers are worked by hand from the formula, not read back.
 */
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(readFileSync(new URL('../../public/js/flux-working-math.js', import.meta.url), 'utf8'), sandbox);
const W = sandbox.window.FluxWorkingMath;
const syms = (f) => Array.from(W.analyse(f).symbols || []);

test('symbols are read the way the sheets write them', () => {
  assert.deepEqual(syms('v = u + at'), ['v', 'u', 'a', 't']);
  assert.deepEqual(syms('F = G·m₁m₂/r²'), ['F', 'G', 'm₁', 'm₂', 'r']);
  assert.deepEqual(syms('a_c = v²/r'), ['a_c', 'v', 'r']);
  assert.deepEqual(syms('Q = mcΔT'), ['Q', 'm', 'c', 'ΔT']);
  assert.deepEqual(syms('KE = ½mv²'), ['KE', 'm', 'v']);
  assert.deepEqual(syms('pH + pOH = 14'), ['pH', 'pOH']);
});

test('the substituted line keeps the numbers as typed, bracketed where they touch', () => {
  const r = W.plugIn('v = u + at', { u: '3.0', a: '9.81', t: '2.0' });
  assert.equal(r.substituted, 'v = 3.0 + (9.81)(2.0)');
  assert.equal(r.answer, 'v = 22.6');                 // 3.0 + 19.62 = 22.62 → 3 s.f.
  const k = W.plugIn('KE = ½mv²', { m: '2', v: '3' });
  assert.equal(k.substituted, 'KE = ½(2)(3)²');
  assert.equal(k.answer, 'KE = 9.00');
});

test('the unknown can be anywhere: solving for t in s = ut + ½at²', () => {
  const r = W.plugIn('s = ut + ½at²', { s: '10', u: '0', a: '9.81' });
  assert.equal(r.unknown, 't');
  assert.ok(Math.abs(r.value - Math.sqrt(20 / 9.81)) < 1e-9, `t = ${r.value}`);   // the positive root
  assert.equal(r.answer, 't = 1.43');
  assert.equal(r.substituted, '10 = (0)t + ½(9.81)t²');
});

test('solving inside a fraction and a power: r in Newton\'s law of gravitation', () => {
  // r² = G·m₁m₂/F = 6.67e-11 × 50 / 3.335e-10 = 10
  const r = W.plugIn('F = G·m₁m₂/r²', { F: '3.335e-10', G: '6.67e-11', 'm₁': '5', 'm₂': '10' });
  assert.ok(Math.abs(r.value - Math.sqrt(10)) < 1e-9);
  assert.equal(r.answer, 'r = 3.16');
});

test('logs, trig in degrees, and scientific notation', () => {
  assert.equal(W.plugIn('β = 10·log₁₀(I/I₀)', { I: '1e-6', 'I₀': '1e-12' }).answer, 'β = 60.0');
  assert.equal(W.plugIn('W = F·d·cos θ', { F: '10', d: '2', 'θ': '60' }).answer, 'W = 10.0');
  assert.equal(W.plugIn('Q = mcΔT', { m: '0.5', c: '4180', 'ΔT': '20' }).answer, 'Q = 4.18 × 10⁴');
  // V = nRT/P = 8.314 × 273 / 101325 = 0.0224
  assert.equal(W.plugIn('PV = nRT', { P: '101325', n: '1', R: '8.314', T: '273' }).answer, 'V = 0.0224');
  assert.equal(W.plugIn('v = u + at', { u: '3.0', a: '9.81', t: '2.0' }, { sf: 4 }).answer, 'v = 22.62');
});

test('typed values can be written like a calculator or like a textbook', () => {
  assert.equal(W.readNumber('3.0×10⁸'), 3e8);
  assert.equal(W.readNumber('3 x 10^8'), 3e8);
  assert.equal(W.readNumber('-4.2'), -4.2);
  assert.ok(Number.isNaN(W.readNumber('fast')));
  const r = W.plugIn('F = ma', { m: '2.0', a: '-3' });
  assert.equal(r.substituted, 'F = (2.0)(-3)');
  assert.equal(r.answer, 'F = -6.00');
});

test('it refuses what it cannot read, and says what is missing', () => {
  assert.equal(W.analyse("f' = f · (v ± v_o)/(v ∓ v_s)").ok, false);
  assert.equal(W.analyse('% yield = actual/theoretical × 100').ok, false);
  assert.equal(W.analyse('pH = −log[H⁺]').ok, false);
  assert.equal(W.analyse('c = 2.998 × 10⁸ m/s').ok, false, 'a constant with units has nothing to plug in');
  assert.match(W.plugIn('v = u + at', { u: '1' }).error, /a, t are still blank|v, a, t/);
  assert.match(W.plugIn('v = u + at', { v: '1', u: '1', a: '1', t: '1' }).error, /blank/);
});

test('units, lists of identities and rates are handled honestly', () => {
  assert.deepEqual(syms('n = V / 22.4 L'), ['n', 'V'], 'L is litres, not a symbol');
  assert.equal(W.plugIn('n = V / 22.4 L', { V: '44.8' }).answer, 'n = 2.00');
  assert.equal(W.analyse('log(ab)=log a+log b   log(a/b)=log a−log b').ok, false);
  assert.equal(W.analyse('dN/dt = rN').ok, false);
});
