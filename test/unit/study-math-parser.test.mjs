/*
 * Unit test — flux-study-math's expression parser (`compile`).
 *
 * This locks in the 60-input differential set that was verified one-off in a
 * previous session, so parser regressions fail CI instead of shipping. The old
 * `eval`-based reference implementation is gone, so expectations here are
 * INDEPENDENT numeric values (literal constants or the Node `Math` oracle) —
 * not a comparison against the old evaluator.
 *
 * The parser lives inside a boot() closure in a classic browser IIFE
 * (public/js/flux-study-math.js), so it can't be imported. Rather than copy it
 * (a copy rots — it would keep passing after the shipped parser breaks), we
 * extract the actual FNS/CONSTS/compile block from source and rebuild `compile`
 * via new Function. If the source is refactored so the block can't be found,
 * this test fails loudly, which is the correct signal. No runtime deps.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..', '..', 'public', 'js', 'flux-study-math.js',
);

function extractCompile() {
  const src = fs.readFileSync(SRC, 'utf8');
  const fnsStart = src.indexOf('const FNS = Object.assign');
  const compileStart = src.indexOf('function compile(src)', fnsStart);
  assert.ok(fnsStart >= 0 && compileStart > fnsStart,
    'could not locate FNS/compile block in flux-study-math.js — parser refactored?');
  // brace-match the compile function body
  let depth = 0, end = -1;
  for (let j = src.indexOf('{', compileStart); j < src.length; j++) {
    const c = src[j];
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) { end = j + 1; break; }
  }
  assert.ok(end > compileStart, 'could not brace-match compile()');
  const preamble = src.slice(fnsStart, compileStart);   // FNS + CONSTS decls
  const compileSrc = src.slice(compileStart, end);       // function compile(){...}
  return new Function(`"use strict";${preamble}\n${compileSrc}\nreturn compile;`)();
}

const compile = extractCompile();
const evalAt = (expr, x) => compile(expr)(x);

// [expression, x, expected] — expected values are derived independently of the
// parser (literals, or Math.* as the oracle for transcendental cases).
const CASES = [
  // ── number formats & literals (incl. the fixed "5." / ".5" / "1e3") ──
  ['5.', 0, 5],
  ['.5', 0, 0.5],
  ['1e3', 0, 1000],
  ['2E2', 0, 200],
  ['1.5e-2', 0, 0.015],
  ['0.25', 0, 0.25],
  ['42', 0, 42],
  ['3.14159', 0, 3.14159],
  ['.75', 0, 0.75],

  // ── arithmetic & precedence / associativity ──
  ['2 + 3', 0, 5],            // whitespace stripped
  ['2+3*4', 0, 14],           // * before +
  ['(2+3)*4', 0, 20],         // parens
  ['10-4-3', 0, 3],           // left-assoc subtraction
  ['2*3+4*5', 0, 26],
  ['20/4/5', 0, 1],           // left-assoc division
  ['2^3', 0, 8],
  ['2^3^2', 0, 512],          // right-assoc exponent
  ['-2^2', 0, -4],            // unary minus binds looser than ^ → -(2^2)
  ['-3+5', 0, 2],
  ['7-10', 0, -3],
  ['100/8', 0, 12.5],

  // ── x expressions (incl. the fixed "-x^2") ──
  ['x', 7, 7],
  ['x*x', 5, 25],
  [' x ^ 2 ', 3, 9],          // whitespace around x and ^
  ['-x^2', 3, -9],            // -(x^2)
  ['x^2+2*x+1', 3, 16],
  ['2*x+1', 4, 9],
  ['1/x', 4, 0.25],
  ['x-x', 9, 0],
  ['(x+1)*(x-1)', 5, 24],     // x^2 - 1
  ['x/2+x/3', 6, 5],
  ['3*x^2', 2, 12],           // 3*(x^2)
  ['x^3', 3, 27],

  // ── functions, single-arg (incl. the fixed "ln(x)") ──
  ['sin(x)', 0, 0],
  ['cos(x)', 0, 1],
  ['sin(x)', 1, Math.sin(1)],
  ['cos(pi)', 0, -1],
  ['tan(x)', 0, 0],
  ['sqrt(x)', 16, 4],
  ['abs(x)', -5, 5],
  ['abs(-x)', 5, 5],
  ['exp(x)', 0, 1],
  ['ln(x)', Math.E, 1],       // ln === Math.log
  ['log(x)', 100, 2],         // log === Math.log10
  ['floor(x)', 2.7, 2],
  ['ceil(x)', 2.1, 3],
  ['round(x)', 2.5, 3],
  ['atan(x)', 1, Math.atan(1)],
  ['sign(-x)', 5, -1],

  // ── multi-arg functions, constants & nesting ──
  ['pow(x,3)', 2, 8],
  ['max(x,3)', 5, 5],
  ['min(x,3)', 5, 3],
  ['max(1,2,3)', 0, 3],
  ['min(4,2,10)', 0, 2],
  ['pow(2,10)', 0, 1024],
  ['pi', 0, Math.PI],
  ['2*pi', 0, 2 * Math.PI],
  ['sqrt(x^2+9)', 4, 5],
  ['ln(exp(x))', 3, 3],
  ['sin(cos(x))', 0, Math.sin(1)],
];

test('60-input differential set has exactly 60 cases', () => {
  assert.equal(CASES.length, 60);
});

for (const [expr, x, expected] of CASES) {
  test(`compile(${JSON.stringify(expr)})(${x}) ≈ ${expected}`, () => {
    const got = evalAt(expr, x);
    assert.ok(Number.isFinite(got), `expected finite number, got ${got}`);
    assert.ok(
      Math.abs(got - expected) <= 1e-9,
      `compile(${JSON.stringify(expr)})(${x}) = ${got}, expected ${expected}`,
    );
  });
}

// The parser is a security boundary (whitelist tokenizer, null-proto tables,
// no new Function / eval). Lock in that non-whitelisted input is rejected.
const REJECTS = ['constructor', 'alert(x)', 'window', '1;2', 'x=1', '__proto__', 'x**2', ''];
for (const expr of REJECTS) {
  test(`compile(${JSON.stringify(expr)}) throws`, () => {
    assert.throws(() => compile(expr));
  });
}
