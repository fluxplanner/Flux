import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * The lab grapher's maths, against hand-worked numbers.
 *
 * Every figure expected below was computed by hand from the definitions, not
 * read back out of this implementation — otherwise the test only proves the
 * code agrees with itself. The arithmetic is written into each case so the
 * next person can check the expectation rather than trust it.
 *
 * This matters more than most tests here: a gradient goes straight into a lab
 * report and gets marked, and a wrong one looks exactly like a right one.
 */

const src = fs.readFileSync('public/js/flux-lab-fit.js', 'utf8');
const w = {};
new Function('window', src)(w);
const F = w.FluxLabFit;

const close = (got, want, tol, what) =>
  assert.ok(Math.abs(got - want) < tol, `${what}: got ${got}, want ${want} (±${tol})`);

test('a straight line through exact points is recovered exactly', () => {
  // (1,3) (2,5) (3,7) lie precisely on y = 2x + 1.
  const r = F.fit('linear', [{ x: 1, y: 3 }, { x: 2, y: 5 }, { x: 3, y: 7 }]).fit;
  close(r.m, 2, 1e-12, 'gradient');
  close(r.c, 1, 1e-12, 'intercept');
  close(r.r2, 1, 1e-12, 'R²');
  // No scatter, so the standard errors are zero rather than absent.
  close(r.um, 0, 1e-12, 'u(m)');
});

test('a line with scatter matches the hand-worked standard errors', () => {
  /* Points (1,2) (2,3) (3,5) (4,4) (5,6):
       x̄ = 3, ȳ = 4
       Sxx = 4+1+0+1+4 = 10
       Sxy = 4+1+0+0+4 = 9        → m = 0.9,  c = 4 − 0.9·3 = 1.3
       fitted 2.2 3.1 4.0 4.9 5.8; residuals −0.2 −0.1 1.0 −0.9 0.2
       Σresid² = 1.90             → s² = 1.90/3 = 0.633333
       u(m) = √(s²/Sxx)           = √0.0633333 = 0.2516611
       u(c) = √(s²(1/n + x̄²/Sxx)) = √(0.633333·1.1) = 0.8346662
       Syy = 10                   → R² = 1 − 1.90/10 = 0.81            */
  const pts = [{ x: 1, y: 2 }, { x: 2, y: 3 }, { x: 3, y: 5 }, { x: 4, y: 4 }, { x: 5, y: 6 }];
  const r = F.fit('linear', pts).fit;
  close(r.m, 0.9, 1e-12, 'gradient');
  close(r.c, 1.3, 1e-12, 'intercept');
  close(r.r2, 0.81, 1e-12, 'R²');
  /* Written as the formula applied to the hand-derived sums above
     (Σresid² = 1.9, Sxx = 10, n = 5, x̄ = 3) rather than as decimal literals.
     My first attempt used a rounded s² = 0.63333 and the expectation was wrong
     in the seventh decimal — which would have meant "fixing" correct code. */
  const s2 = 1.9 / 3;
  close(r.um, Math.sqrt(s2 / 10), 1e-12, 'u(m)');
  close(r.uc, Math.sqrt(s2 * (1 / 5 + 9 / 10)), 1e-12, 'u(c)');
});

test('two points give a line but no uncertainty, because there is no scatter to measure', () => {
  const r = F.fit('linear', [{ x: 0, y: 0 }, { x: 2, y: 4 }]).fit;
  close(r.m, 2, 1e-12, 'gradient');
  // n − 2 = 0 degrees of freedom. Null is the honest answer; NaN is not.
  assert.equal(r.um, null, 'u(m) should be absent, not NaN');
  assert.equal(r.uc, null, 'u(c) should be absent, not NaN');
});

test('through-the-origin is a different fit, not the line with c dropped', () => {
  // m = Σxy/Σx² = 28/14 = 2 exactly for (1,2) (2,4) (3,6).
  const exact = F.fit('proportional', [{ x: 1, y: 2 }, { x: 2, y: 4 }, { x: 3, y: 6 }]).fit;
  close(exact.m, 2, 1e-12, 'gradient');
  assert.equal(exact.c, 0, 'a proportional fit must pass through zero');

  /* They genuinely disagree when the data does not head for the origin.
     (1,3) (2,4) (3,6): Σxy = 29, Σx² = 14 → m = 2.0714, while the free line
     gives 1.5. Forcing it through zero is a real constraint, not cosmetic. */
  const off = [{ x: 1, y: 3 }, { x: 2, y: 4 }, { x: 3, y: 6 }];
  close(F.fit('proportional', off).fit.m, 29 / 14, 1e-12, 'proportional gradient');
  close(F.fit('linear', off).fit.m, 1.5, 1e-12, 'free-line gradient');
});

test('a quadratic through three points recovers the curve exactly', () => {
  // (0,1) (1,2) (2,5) lie on y = x² + 1.
  const r = F.fit('quadratic', [{ x: 0, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 5 }]).fit;
  close(r.a, 1, 1e-9, 'a');
  close(r.b, 0, 1e-9, 'b');
  close(r.c, 1, 1e-9, 'c');
  close(r.r2, 1, 1e-9, 'R²');
});

test('power and exponential recover their own parameters', () => {
  // y = 2x³ sampled at x = 1,2,3.
  const p = F.fit('power', [{ x: 1, y: 2 }, { x: 2, y: 16 }, { x: 3, y: 54 }]).fit;
  close(p.a, 2, 1e-9, 'power a');
  close(p.b, 3, 1e-9, 'power b');

  // y = 3e^(2x) sampled at x = 0,1,2.
  const e = F.fit('exponential', [
    { x: 0, y: 3 },
    { x: 1, y: 3 * Math.pow(Math.E, 2) },
    { x: 2, y: 3 * Math.pow(Math.E, 4) },
  ]).fit;
  close(e.a, 3, 1e-9, 'exp a');
  close(e.b, 2, 1e-9, 'exp b');
});

test('R² is reported against the real readings, not the straightened ones', () => {
  /* Scattered data that is roughly a power law. The fit happens on logs, where
     agreement always looks better; reporting that figure would overstate how
     well the curve describes what was actually measured. */
  const pts = [{ x: 1, y: 2.2 }, { x: 2, y: 15 }, { x: 3, y: 56 }, { x: 4, y: 120 }];
  const r = F.fit('power', pts).fit;
  const predicted = pts.map((p) => r.predict(p.x));
  close(r.r2, F.rSquared(pts.map((p) => p.y), predicted), 1e-12, 'R² on raw y');
  assert.ok(typeof r.r2Transformed === 'number', 'the log-space R² is still reported separately');
});

test('a log fit refuses impossible data instead of dropping the awkward rows', () => {
  const withZero = [{ x: 0, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 4 }];
  const r = F.fit('power', withZero);
  assert.ok(r.error, 'a power fit with x = 0 must refuse');
  assert.match(r.error, /above zero/i);
  assert.match(r.error, /row 1/, 'the message should name the offending row');

  const negY = [{ x: 1, y: -2 }, { x: 2, y: 4 }, { x: 3, y: 9 }];
  assert.ok(F.fit('exponential', negY).error, 'an exponential fit with y < 0 must refuse');
});

test('too little data, or a vertical line, is explained rather than guessed at', () => {
  assert.match(F.fit('linear', [{ x: 1, y: 1 }]).error, /two points/i);
  // Every x the same: infinitely many lines fit, so there is no gradient.
  assert.ok(F.fit('linear', [{ x: 2, y: 1 }, { x: 2, y: 5 }, { x: 2, y: 9 }]).error);
  // Rows not filled in yet are ignored, not read as zero.
  const r = F.fit('linear', [
    { x: 1, y: 3 }, { x: NaN, y: NaN }, { x: 2, y: 5 }, { x: 3, y: 7 },
  ]).fit;
  close(r.m, 2, 1e-12, 'blank rows must not drag the gradient');
});

test('max and min gradient come from the corners of the end error bars', () => {
  /* (1,2) ±(0.1,0.2) and (5,10) ±(0.1,0.2):
       steepest   run = (5−0.1) − (1+0.1) = 3.8
                  rise = (10+0.2) − (2−0.2) = 8.4   → 2.210526
       shallowest run = (5+0.1) − (1−0.1) = 4.2
                  rise = (10−0.2) − (2+0.2) = 7.6   → 1.809524
       uncertainty = half the difference            → 0.200501          */
  const g = F.minMaxGradient([
    { x: 1, y: 2, dx: 0.1, dy: 0.2 },
    { x: 3, y: 6, dx: 0.1, dy: 0.2 },
    { x: 5, y: 10, dx: 0.1, dy: 0.2 },
  ]);
  close(g.mMax, 8.4 / 3.8, 1e-12, 'steepest gradient');
  close(g.mMin, 7.6 / 4.2, 1e-12, 'shallowest gradient');
  close(g.uncertainty, Math.abs(8.4 / 3.8 - 7.6 / 4.2) / 2, 1e-12, 'gradient uncertainty');
  // It uses the extremes by x, so the order rows were typed in cannot matter.
  const shuffled = F.minMaxGradient([
    { x: 5, y: 10, dx: 0.1, dy: 0.2 },
    { x: 1, y: 2, dx: 0.1, dy: 0.2 },
    { x: 3, y: 6, dx: 0.1, dy: 0.2 },
  ]);
  close(shuffled.mMax, g.mMax, 1e-12, 'order must not change the answer');
});

test('error bars wide enough to overlap give no gradient rather than an infinity', () => {
  // The end bars cross in x, so "steepest" and "shallowest" stop meaning anything.
  const g = F.minMaxGradient([
    { x: 1, y: 2, dx: 5, dy: 0.1 },
    { x: 2, y: 4, dx: 5, dy: 0.1 },
  ]);
  assert.equal(g, null, 'overlapping x bars should return nothing, not Infinity');
});

test('column uncertainty rules resolve to absolute values', () => {
  close(F.resolveUncertainty(50, { mode: 'absolute', value: 0.5 }), 0.5, 1e-12, 'absolute');
  close(F.resolveUncertainty(50, { mode: 'percent', value: 2 }), 1, 1e-12, '2% of 50');
  assert.equal(F.resolveUncertainty(50, { mode: 'none' }), 0, 'none means zero');
  assert.equal(F.resolveUncertainty(50, null), 0, 'a missing rule means zero');
  // A percentage of a negative reading is still a positive bar length.
  close(F.resolveUncertainty(-50, { mode: 'percent', value: 2 }), 1, 1e-12, 'negative reading');
});
