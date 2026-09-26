import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

/**
 * The formula sheet's typesetting. The data is plain text; these pin how it
 * is read — which operands a "/" stacks, which brackets go, what is italic —
 * because a wrong reading is a wrong formula, not just an ugly one.
 */

const require = createRequire(import.meta.url);
const T = require('../../public/js/flux-formula-typeset.js');

/** Compact readable form: {num|den}, √[..], ^(..), _(..), italic letters bare, upright «..». */
function read(html) {
  let s = html.replace(/<span class="tx-up">([^<]*)<\/span>/g, '«$1»');
  for (let i = 0; i < 6; i++) {
    s = s.replace(/<span class="tx-frac[^"]*"><span class="tx-num">((?:(?!<span class="tx-frac)[\s\S])*?)<\/span><span class="tx-den">((?:(?!<span class="tx-frac)[\s\S])*?)<\/span><\/span>/g, '{$1|$2}');
  }
  return s
    .replace(/<span class="tx-sqrt"><span class="tx-radic">√<\/span><span class="tx-sqrtbody">([\s\S]*?)<\/span><\/span>/g, '√[$1]')
    .replace(/<span class="tx-line">/g, '¶')
    .replace(/<sup>/g, '^(').replace(/<\/sup>/g, ')')
    .replace(/<sub>/g, '_(').replace(/<\/sub>/g, ')')
    .replace(/<i>([^<]*)<\/i>/g, '$1')
    .replace(/<span class="tx-up">([^<]*)<\/span>/g, '«$1»')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

test('the quadratic formula: the whole numerator over 2a, with the radical bar over b² − 4ac', () => {
  const r = read(T.toHtml('x = (−b ± √(b² − 4ac)) / 2a'));
  assert.equal(r, '¶x={−b±√[b^(2)−4ac]|2a}');
});

test('operands are what a reader would take: products, function arguments, bracketed groups', () => {
  assert.equal(read(T.toHtml('F = G·m₁m₂/r²')), '¶F=G·{m_(1)m_(2)|r^(2)}', 'G stays outside — · separates it');
  assert.equal(read(T.toHtml('a/sin A = b/sin B')), '¶{a|«sin» A}={b|«sin» B}', '"sin A" is one denominator');
  assert.equal(read(T.toHtml('dN/dt = rN · (K−N)/K')), '¶{dN|dt}=rN·{K−N|K}', 'grouping brackets go once the bar groups');
  assert.equal(read(T.toHtml('χ² = Σ (O − E)² / E')), '¶χ^(2)=Σ {(O−E)^(2)|E}', 'the sum is outside the fraction');
});

test('d/dx acts on what follows it, instead of swallowing it into the denominator', () => {
  assert.equal(read(T.toHtml('d/dx[sin x]=cos x')), '¶{d|dx}[«sin» x]=«cos» x');
});

test('brackets that only hold one fraction are dropped; a function\'s brackets are kept', () => {
  assert.equal(read(T.toHtml('V = (4/3)πr³')), '¶V={4|3}πr^(3)');
  assert.equal(read(T.toHtml('log(a/b)=log a−log b')), '¶«log»({a|b})=«log» a−«log» b');
});

test('an exponent keeps its fraction on one line', () => {
  assert.equal(read(T.toHtml('k = A·e^(−Eₐ/RT)')), '¶k=A·e^(−E_(a)/RT)');
});

test('units stay upright and inline — m/s is not m over s', () => {
  const r = read(T.toHtml('c = 2.998 × 10⁸ m/s'));
  assert.ok(!r.includes('{'), r);
  assert.match(r, /m\/s$/);
  assert.equal(read(T.toHtml('n = V / 22.4 L')), '¶n={V|22.4L}', 'a number with its unit is one denominator');
});

test('chemical species are upright and keep their square brackets', () => {
  const html = T.toHtml('pH = pKa + log([A⁻]/[HA])');
  assert.ok(!/<i>H<\/i>|<i>A<\/i>/.test(html), 'H and A in [HA] are an acid, not variables');
  assert.match(read(html), /\{\[.*\]\|\[.*\]\}/);
});

test('words are upright, letters written together are separate italic variables', () => {
  assert.equal(read(T.toHtml('PE = mgh')), '¶«PE»=mgh');
  assert.match(T.toHtml('PE = mgh'), /<i>m<\/i><i>g<\/i><i>h<\/i>/);
  assert.equal(read(T.toHtml('S/V ratio = surface/volume')), '¶{S|V} «ratio»={«surface»|«volume»}');
});

test('three spaces or a new line start a new line; limits sit on their operator', () => {
  assert.equal((T.toHtml('aᵐ·aⁿ = aᵐ⁺ⁿ   (aᵐ)ⁿ = aᵐⁿ\na⁰ = 1').match(/tx-line/g) || []).length, 3);
  assert.match(T.toHtml("f'(x) = lim_{h→0} [f(x+h) − f(x)]/h"), /tx-limop[\s\S]*tx-under"><i>h<\/i>→0/);
  assert.match(T.toHtml('∫ₐᵇ f(x) dx'), /tx-limits"><span><i>b<\/i><\/span><span><i>a<\/i><\/span>/);
});

test('nothing in the real sheets throws or loses text', () => {
  const samples = ['', '   ', 'Q vs. K determines shift', 'Normal: ±1σ: 68%   ±2σ: 95%', '|x| = x if x≥0; −x if x<0',
    'r = Σ[(xᵢ−x̄)(yᵢ−ȳ)] / √[Σ(xᵢ−x̄)² · Σ(yᵢ−ȳ)²]', 'A = √(s(s−a)(s−b)(s−c)), s = (a+b+c)/2', 'N_A = 6.022 × 10²³ /mol'];
  for (const f of samples) {
    const html = T.toHtml(f);
    const text = html.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s/g, '');
    const want = f.replace(/\s/g, '').replace(/[\/_^{}()]/g, '');
    for (const ch of want) if (!/[⁰-⁹¹²³ᵢₐ-ₜ₀-₉ⁿ⁺⁻]/.test(ch)) assert.ok(text.includes(ch === '-' ? '−' : ch), `"${f}" lost "${ch}"`);
  }
});
