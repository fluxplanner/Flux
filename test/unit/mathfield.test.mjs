import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

/**
 * The grapher's maths fields show MathQuill (typed like Desmos) but the
 * grapher reads plain text. flux-mathfield.js translates both ways, and the
 * one thing it must never do is change what an equation means: "1/2x" in the
 * old text box is (1/2)·x, so it has to come back as ½x and not 1/(2x).
 */

const sandbox = { window: {}, console };
vm.createContext(sandbox);
vm.runInContext(readFileSync(new URL('../../public/js/flux-expr.js', import.meta.url), 'utf8'), sandbox);
vm.runInContext(readFileSync(new URL('../../public/js/flux-mathfield.js', import.meta.url), 'utf8'), sandbox);
const { toPlain, toLatex } = sandbox.window.FluxMathField;
const E = sandbox.window.FluxExpr;

const scope = { a: 1.7, b: -0.6, c: 2.2, m: 2.3, k: 0.4 };
const XS = [-2.3, -0.7, 0.4, 1.9, 3.1];
/** The two texts work out to the same numbers wherever either is defined. */
function sameMaths(p, q) {
  const f = E.compile(p.replace(/^\s*y\s*=/, ''), 'x', { params: true, scope });
  const g = E.compile(q.replace(/^\s*y\s*=/, ''), 'x', { params: true, scope });
  for (const x of XS) {
    const u = f(x), v = g(x);
    if (Number.isNaN(u) && Number.isNaN(v)) continue;
    assert.ok(Math.abs(u - v) <= 1e-9 * Math.max(1, Math.abs(u)), `${p} → ${q}: ${u} ≠ ${v} at x = ${x}`);
  }
}

test('what MathQuill holds reads back as the text the grapher understands', () => {
  const cases = [
    ['y=x^2+3', 'y=x^2+3'],
    ['x^2+y^2=25', 'x^2+y^2=25'],
    ['e^{-x}', 'e^(-x)'],
    ['y_1\\sim ax_1^2+bx_1+c', 'y1~ax1^2+bx1+c'],
    ['y=\\sin\\left(x\\right)', 'y=sin(x)'],
    ['y=\\frac{1}{2x}', 'y=(1/(2x))'],
    ['y=\\frac{\\left(x+1\\right)}{x-2}', 'y=(((x+1))/(x-2))'],
    ['y=2^x\\cdot3', 'y=2^x*3'],
    ['y=x^{10}', 'y=x^(10)'],
    ['y=\\left|x\\right|', 'y=abs(x)'],
    ['x\\le3', 'x<=3'],
    ['y\\ge x', 'y>=x'],
    ['y=\\log2\\left(x\\right)', 'y=log2(x)'],
    ['y=\\log_2\\left(x\\right)', 'y=log2(x)'],
    ['y=\\pi\\cdot r', 'y=pi*r'],
    ['y=2\\pi x', 'y=2 pi x'],
    ['f\\left(x\\right)=x^2', 'f(x)=x^2'],
    ["f'\\left(x\\right)", "f'(x)"],
    ['y=a\\ \\sin\\left(x\\right)', 'y=a sin(x)'],
    ['y=a\\sin\\left(x\\right)', 'y=a sin(x)'],
    ['y=\\operatorname{abs}\\left(x\\right)', 'y=abs(x)'],
    ['y=\\arcsin\\left(x\\right)', 'y=asin(x)'],
    ['y=\\sin x', 'y=sin(x)'],
    ['y=\\sin 2x+1', 'y=sin(2x)+1'],
    ['y=\\sin^{-1}\\left(x\\right)', 'y=asin(x)'],
    ['y=\\sin^2\\left(x\\right)', 'y=(sin(x))^2'],
    ['y=\\sqrt{x+1}', 'y=sqrt(x+1)'],
    ['y=\\sqrt[3]{x}', 'y=cbrt(x)'],
    ['y=x\\left\\{0<x<3\\right\\}', 'y=x{0<x<3}'],
    ['L_1=\\left[1,2,3\\right]', 'L1=[1,2,3]'],
    ['\\left(1,2\\right)', '(1,2)'],
    ['y=x^2\\cdot x', 'y=x^2*x'],
    ['y=x^2x', 'y=x^2 x'],
    ['y=\\theta', 'y=θ'],
    ['y=x\\%3', 'y=x%3'],
    ['', ''],
  ];
  for (const [latex, plain] of cases) assert.equal(toPlain(latex), plain, latex);
});

test('what is typed into MathQuill means what it shows', () => {
  // The fraction bar holds what is above and below it, whatever follows.
  sameMaths(toPlain('y=\\frac{1}{2x}'), '1/(2x)');
  sameMaths(toPlain('y=\\frac{1}{2}x'), 'x/2');
  // A raised power stays raised: 2^x·3 is 3·2^x, and x^{2x} is x to the 2x.
  sameMaths(toPlain('y=2^x\\cdot3'), '3*2^x');
  sameMaths(toPlain('y=x^{2x}'), 'x^(2*x)');
  sameMaths(toPlain('y=e^{-x^2}'), 'exp(-(x*x))');
  sameMaths(toPlain('y=2\\pi x'), '2*pi*x');
  sameMaths(toPlain('y=a\\sin\\left(bx\\right)+c'), 'a*sin(b*x)+c');
});

test('plain text shown in MathQuill and read back means the same thing', () => {
  const texts = [
    'x^2+3', '1/2x', '(x+1)/(x-2)+x^2', 'x^ab', '2^3^2', 'e^-x^2', 'e^(-x^2)', 'a sin(x)', 'sin(x)*3',
    '3x+1+sin(x)', 'x/a/2', '-2x/3', 'sqrt(x+1)', 'cbrt(x)', 'abs(x-1)', '2pix', 'pi x', 'log2(x)',
    'ln(x)/ln(2)', 'x%3', 'asin(x/4)', 'x^(1/2)', '2^x*3', '10^-x', 'x^-2', '3(x+1)', 'x(x+1)', 'tau x',
    '4.5e2 x', 'max(x,1)', 'floor(x)', 'a^2x', 'x^2x', 'sin(x)^2', '2 3x', 'x 2', 'm x + b', 'k/x^2',
    'sqrt(abs(x))/(1+x^2)', 'exp(-x)cos(3x)', '(x-1)(x+2)/4',
  ];
  for (const t of texts) sameMaths(t, toPlain(toLatex(t)));
});

test('the reading is laid out the way it is worked out', () => {
  assert.equal(toLatex('y=x^2+3'), 'y=x^{2}+3');
  assert.equal(toLatex('1/2x'), '\\frac{1}{2}x');
  assert.equal(toLatex('(x+1)/(x-2)'), '\\frac{x+1}{x-2}');
  assert.equal(toLatex('x^ab'), 'x^{a}b');
  assert.equal(toLatex('e^(-x^2)'), 'e^{-x^{2}}');
  assert.equal(toLatex('y1 ~ m x1 + b'), 'y_{1}\\sim mx_{1}+b');
  assert.equal(toLatex('a sin(x)'), 'a\\sin\\left(x\\right)');
  assert.equal(toLatex('sqrt(x)'), '\\sqrt{x}');
  assert.equal(toLatex('x <= 3'), 'x\\le 3');
  assert.equal(toLatex("f'(x)"), "f'\\left(x\\right)");
  assert.equal(toLatex('x^2 {0 < x < 3}'), 'x^{2}\\left\\{0<x<3\\right\\}');
  assert.equal(toLatex('(1, 2), (3, 4)'), '\\left(1,2\\right),\\left(3,4\\right)');
  assert.equal(toLatex('x1 = [1, 2, 3]'), 'x_{1}=\\left[1,2,3\\right]');
});

test('half-typed text is shown as it is, never dropped', () => {
  // An unclosed bracket stays a plain bracket — \left( with no \right) would not show at all.
  assert.equal(toLatex('sin('), 'sin(');
  assert.equal(toLatex('(x+1'), '(x+1');
  assert.equal(toLatex('x^'), 'x^{}');
  assert.equal(toLatex('2+'), '2+');
  for (const t of ['((', '))', '^2', '~', '{', '}', '[1,', '=', ',,', '*', 'x^^2']) {
    assert.equal(typeof toLatex(t), 'string', t);
    assert.equal(typeof toPlain(toLatex(t)), 'string', t);
  }
});
