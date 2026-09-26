/**
 * flux-formula-typeset.js — draws the formula sheet's plain-text formulas as
 * typeset maths: stacked fractions, radicals with a bar, real exponents and
 * subscripts, italic variables and upright function names.
 *
 * The sheet's data stays exactly as written ("x = (−b ± √(b² − 4ac)) / 2a"),
 * because search and the copy button use that text. This only changes how it
 * is shown, so there is no second copy of ~200 formulas to keep in step.
 *
 * What it understands, all taken from the data as it actually is:
 *   a / b        stacked, with the operands found the way a reader would —
 *                "Gm₁m₂/r²" is m₁m₂ over r², "a/sin A" is a over sin A,
 *                "(K−N)/K" drops the grouping brackets, "d/dx[sin x]" is
 *                d over dx with [sin x] after it
 *   √x, √(…)     a radical with its bar over the whole radicand
 *   x², aᵢ, x^(…), N_{t+1}, θ_rad   exponents and subscripts
 *   ½ ⅓ ¼ ¾      stacked
 *   ∫ₐᵇ, lim_{h→0}   limits placed on the operator
 *   [H⁺], [HA]   chemical species upright, brackets kept
 *   6.022 × 10²³ /mol   units upright and inline, never stacked
 *   "…   …"      three or more spaces, or a new line, start a new line
 *
 * UMD-ish like flux-tex.js: window.FluxFormulaTypeset in the browser,
 * module.exports for the unit tests.
 */
(function (global) {
  'use strict';

  var SUP = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
    '⁺': '+', '⁻': '−', '⁼': '=', '⁽': '(', '⁾': ')', 'ⁿ': 'n', 'ⁱ': 'i', 'ᵏ': 'k', 'ᵐ': 'm', 'ᵃ': 'a', 'ᵇ': 'b',
    'ᶜ': 'c', 'ᵈ': 'd', 'ᵉ': 'e', 'ᶠ': 'f', 'ᵍ': 'g', 'ʰ': 'h', 'ʲ': 'j', 'ˡ': 'l', 'ᵒ': 'o', 'ᵖ': 'p', 'ʳ': 'r',
    'ˢ': 's', 'ᵗ': 't', 'ᵘ': 'u', 'ᵛ': 'v', 'ʷ': 'w', 'ˣ': 'x', 'ʸ': 'y', 'ᶻ': 'z' };
  var SUB = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
    '₊': '+', '₋': '−', '₌': '=', '₍': '(', '₎': ')', 'ₐ': 'a', 'ₑ': 'e', 'ₒ': 'o', 'ₓ': 'x', 'ₕ': 'h', 'ₖ': 'k',
    'ₗ': 'l', 'ₘ': 'm', 'ₙ': 'n', 'ₚ': 'p', 'ₛ': 's', 'ₜ': 't', 'ᵢ': 'i', 'ⱼ': 'j', 'ᵣ': 'r', 'ᵤ': 'u', 'ᵥ': 'v',
    // Used in the data as "s sub y" (sᵧ/sₓ), though the character is a gamma.
    'ᵧ': 'y' };
  var VFRAC = { '½': ['1', '2'], '⅓': ['1', '3'], '⅔': ['2', '3'], '¼': ['1', '4'], '¾': ['3', '4'], '⅕': ['1', '5'], '⅛': ['1', '8'] };
  /* Functions are set upright. Only these swallow the argument after a
     space ("sin A", "log a") — lim, max and min apply to everything after. */
  var FN = { sin: 1, cos: 1, tan: 1, sec: 1, csc: 1, cot: 1, arcsin: 1, arccos: 1, arctan: 1, sinh: 1, cosh: 1, tanh: 1,
    log: 1, ln: 1, exp: 1, lim: 0, max: 0, min: 0, det: 0, mod: 0, gcd: 0 };
  /* Short letter runs that are words or names, not products of variables
     ("mgh" is m·g·h; "pH" and "BMI" are not). Runs of four or more letters
     are always words. */
  var UPRIGHT = { 'if': 1, or: 1, vs: 1, pH: 1, pOH: 1, pKa: 1, pKb: 1, KE: 1, PE: 1, GPE: 1, BMI: 1, MAP: 1, DP: 1,
    SP: 1, STP: 1, dB: 1, kg: 1, any: 1, and: 1, 'for': 1, rad: 1, deg: 1, VO: 1, CaO: 1, CvO: 1, SA: 1, LA: 1, net: 1 };
  var REL = { '=': 1, '≈': 1, '≠': 1, '≤': 1, '≥': 1, '<': 1, '>': 1, '→': 1, '←': 1, '↔': 1, '∝': 1, '~': 1, '∼': 1, '⇒': 1 };
  var BIN = { '+': 1, '−': 1, '±': 1, '∓': 1, '×': 1 };
  var UNIT = '(?:mol|kg|mg|g|mL|L|m|s|K|J|C|W|N|Pa|atm|V|A|Hz|eV|Ω)(?:⁻?[¹²³])?';
  var UNIT_RE = new RegExp('(\\d[\\d.]*(?:\\s*×\\s*10[⁻⁺]?[⁰¹²³⁴⁵⁶⁷⁸⁹]+)?)\\s+(\\/?' + UNIT + '(?:\\s*[·/]\\s*' + UNIT + ')*)(?=\\s*$|\\s*[,;)])', 'g');

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  var isLetter = function (c) { return /[A-Za-zÀ-ɏͰ-ϿℓŷȳŶ]/.test(c); };
  var isCombining = function (c) { return /[̀-ͯ]/.test(c); };
  var isUpperGreek = function (c) { return /[Α-Ω]/.test(c); };
  var OPEN = { '(': ')', '[': ']', '{': '}' };

  /* ── Lexing: text → atoms, with exponents, subscripts, primes and units
     hung on the atom they belong to. ──────────────────────────────────── */
  function lex(s, units) {
    var out = [];
    var i = 0;
    function last() { return out[out.length - 1]; }
    function decorate(key, val) {
      var a = last();
      if (!a || a.t === 'sp' || a.t === 'op') return false;
      (a[key] = a[key] || []).push(val);
      return true;
    }
    function matching(j) {
      var open = s[j], close = OPEN[open], depth = 0;
      for (var k = j; k < s.length; k++) {
        if (s[k] === open) depth++;
        else if (s[k] === close) { depth--; if (depth === 0) return k; }
      }
      return -1;
    }
    function pushWord(w) {
      if (Object.prototype.hasOwnProperty.call(FN, w)) { out.push({ t: 'fn', v: w, swallow: !!FN[w] }); return; }
      var letters = w.replace(/[̀-ͯ]/g, '');
      if (UPRIGHT[w] || letters.length >= 4) { out.push({ t: 'word', v: w }); return; }
      // Variables written side by side: one italic atom per letter.
      for (var k = 0; k < w.length; k++) {
        var ch = w[k];
        while (k + 1 < w.length && isCombining(w[k + 1])) ch += w[++k];
        out.push({ t: 'id', v: ch });
      }
    }
    while (i < s.length) {
      var c = s[i];
      var code = c.charCodeAt(0);
      if (code >= 0xE000 && code < 0xE100) { decorate('unit', units[code - 0xE000]); i++; continue; }
      if (/\s/.test(c)) {
        var j = i;
        while (j < s.length && /\s/.test(s[j])) j++;
        out.push({ t: 'sp', n: j - i });
        i = j;
        continue;
      }
      if (SUP[c] !== undefined || SUB[c] !== undefined) {
        var map = SUP[c] !== undefined ? SUP : SUB;
        var v = '';
        while (i < s.length && map[s[i]] !== undefined) v += map[s[i++]];
        if (!decorate(map === SUP ? 'sup' : 'sub', v)) out.push({ t: 'txt', v: v });
        continue;
      }
      if ((c === '^' || c === '_') && i + 1 < s.length) {
        var body, end;
        if (s[i + 1] === '{' || (c === '^' && s[i + 1] === '(')) {
          end = matching(i + 1);
          if (end < 0) end = s.length - 1;
          body = s.slice(i + 2, end);
          i = end + 1;
        } else {
          var m = /^[A-Za-z0-9]+/.exec(s.slice(i + 1));
          body = m ? m[0] : s[i + 1];
          i += 1 + body.length;
        }
        // "θ_rad", "P_total": a word as a subscript is a label, set upright.
        var label = c === '_' && /^[A-Za-z]{2,}$/.test(body);
        decorate(c === '^' ? 'sup' : 'sub', label ? { label: body } : body);
        continue;
      }
      if (c === "'" || c === '′') { decorate('post', '′'); i++; continue; }
      if (c === '!' || c === '°') { decorate('post', c); i++; continue; }
      if (c === '%' && last() && last().t !== 'sp' && last().t !== 'op') { decorate('post', '%'); i++; continue; }
      if (VFRAC[c]) { out.push({ t: 'vfrac', n: VFRAC[c][0], d: VFRAC[c][1] }); i++; continue; }
      if (OPEN[c]) {
        var close = matching(i);
        if (close < 0) { out.push({ t: 'txt', v: c }); i++; continue; }
        out.push({ t: 'grp', open: c, close: OPEN[c], body: s.slice(i + 1, close) });
        i = close + 1;
        continue;
      }
      if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(s[i + 1] || ''))) {
        var n = /^[0-9]*\.?[0-9]+/.exec(s.slice(i))[0];
        out.push({ t: 'num', v: n });
        i += n.length;
        continue;
      }
      if (isLetter(c)) {
        var w = '';
        while (i < s.length && (isLetter(s[i]) || (w && isCombining(s[i])))) w += s[i++];
        pushWord(w);
        continue;
      }
      if (c === '√') { out.push({ t: 'root' }); i++; continue; }
      if (c === '∫' || c === 'Σ' || c === '∑' || c === '∏') { out.push({ t: 'big', v: c === '∑' ? 'Σ' : c }); i++; continue; }
      if (c === '-') c = '−';
      if (c === '*') c = '·';
      if (REL[c] || BIN[c] || c === '/' || c === '·' || c === ',' || c === ';' || c === ':' || c === '|') {
        out.push({ t: 'op', v: c });
        i++;
        continue;
      }
      out.push({ t: 'txt', v: c });
      i++;
    }
    return out;
  }

  /* ── Grouping: atoms → runs (things written side by side), operators and
     spaces; then each "/" takes the run on either side as its operands. ── */
  function parse(atoms) {
    var items = [];
    var run = null;
    for (var i = 0; i < atoms.length; i++) {
      var a = atoms[i];
      if (a.t === 'sp' || a.t === 'op') {
        run = null;
        items.push(a);
      } else {
        if (!run) { run = { t: 'run', atoms: [] }; items.push(run); }
        run.atoms.push(a);
      }
    }
    // "sin A", "log a": a bare function name takes the argument after its space.
    for (var k = 0; k + 2 < items.length; k++) {
      var r = items[k];
      if (r.t === 'run' && r.atoms.length === 1 && r.atoms[0].t === 'fn' && r.atoms[0].swallow
          && items[k + 1].t === 'sp' && items[k + 2].t === 'run') {
        r.atoms = r.atoms.concat([{ t: 'sp', n: 1 }], items[k + 2].atoms);
        items.splice(k + 1, 2);
      }
    }
    // Fractions, left to right.
    for (var f = 0; f < items.length; f++) {
      var it = items[f];
      if (it.t !== 'op' || it.v !== '/') continue;
      var L = f - 1;
      if (L >= 0 && items[L].t === 'sp') L--;
      var R = f + 1;
      if (R < items.length && items[R].t === 'sp') R++;
      var left = items[L], right = items[R];
      if (!left || !right || (left.t !== 'run' && left.t !== 'frac') || right.t !== 'run') continue;
      var rest = null;
      /* d/dx[sin x]: the denominator is dx, and [sin x] is what it acts on. */
      var la = left.t === 'run' ? left.atoms : null;
      if (la && la.length === 1 && ((la[0].t === 'id' && la[0].v === 'd') || (la[0].t === 'txt' && la[0].v === '∂'))
          && right.atoms.length > 2 && right.atoms[0].t === 'id' && right.atoms[0].v === la[0].v && right.atoms[1].t === 'id') {
        rest = { t: 'run', atoms: right.atoms.slice(2) };
        right = { t: 'run', atoms: right.atoms.slice(0, 2) };
      }
      var frac = { t: 'frac', num: left, den: right };
      var repl = rest ? [frac, rest] : [frac];
      items.splice.apply(items, [L, R - L + 1].concat(repl));
      f = L;
    }
    return items;
  }

  /* ── Rendering ────────────────────────────────────────────────────── */
  function renderScript(v) {
    if (v && typeof v === 'object' && v.label) return '<span class="tx-up">' + esc(v.label) + '</span>';
    return render(String(v), true);
  }

  function decorations(a, html) {
    var sup = a.sup ? a.sup.map(renderScript).join('') : '';
    var sub = a.sub ? a.sub.map(renderScript).join('') : '';
    var post = a.post ? a.post.join('') : '';
    // A prime sits before the exponent (f′²), a factorial or % after it.
    var prime = post.replace(/[^′]/g, '');
    var after = post.replace(/′/g, '');
    html += prime;
    if (sup && sub) html += '<span class="tx-ss"><sup>' + sup + '</sup><sub>' + sub + '</sub></span>';
    else if (sup) html += '<sup>' + sup + '</sup>';
    else if (sub) html += '<sub>' + sub + '</sub>';
    html += esc(after);
    if (a.unit && a.unit.length) {
      html += '<span class="tx-unit">' + a.unit.map(function (u) {
        return esc(u).replace(/[⁻¹²³]+/g, function (m) { return '<sup>' + m.split('').map(function (ch) { return SUP[ch] || ch; }).join('') + '</sup>'; });
      }).join(' ') + '</span>';
    }
    return html;
  }

  function isChemical(body) {
    return /^[A-Z][A-Za-z0-9₀-₉⁺⁻⁰-⁹]*$/.test(body.replace(/\s/g, ''));
  }

  /** One atom, possibly taking the next atom along (a radical takes its radicand). */
  function atomHTML(atoms, i, ctx) {
    var a = atoms[i];
    var script = ctx.script;
    var html;
    if (a.t === 'id') html = isUpperGreek(a.v) ? esc(a.v) : '<i>' + esc(a.v) + '</i>';
    else if (a.t === 'word') html = '<span class="tx-up">' + esc(a.v) + '</span>';
    else if (a.t === 'fn') {
      if (a.v === 'lim' && a.sub && !script) {
        var lim = a.sub.map(renderScript).join('');
        return { html: '<span class="tx-limop"><span class="tx-up">lim</span><span class="tx-under">' + lim + '</span></span>', used: 1 };
      }
      html = '<span class="tx-up">' + esc(a.v) + '</span>';
    }
    else if (a.t === 'num' || a.t === 'txt') html = esc(a.v);
    else if (a.t === 'sp') html = ' ';
    else if (a.t === 'vfrac') {
      html = script ? esc(a.n + '/' + a.d)
        : '<span class="tx-frac tx-frac--small"><span class="tx-num">' + a.n + '</span><span class="tx-den">' + a.d + '</span></span>';
    }
    else if (a.t === 'big') {
      if (script) return { html: esc(a.v), used: 1 };
      var hi = a.sup ? a.sup.map(renderScript).join('') : '';
      var lo = a.sub ? a.sub.map(renderScript).join('') : '';
      return { html: '<span class="tx-big"><span class="tx-bigop">' + esc(a.v) + '</span>'
        + (hi || lo ? '<span class="tx-limits"><span>' + hi + '</span><span>' + lo + '</span></span>' : '') + '</span>', used: 1 };
    }
    else if (a.t === 'root') {
      var next = atoms[i + 1];
      if (!next) return { html: '√', used: 1 };
      var inner;
      if (next.t === 'grp' && !next.sup && !next.sub && !next.post) inner = render(next.body, script);
      else inner = atomHTML(atoms, i + 1, ctx).html;
      return { html: '<span class="tx-sqrt"><span class="tx-radic">√</span><span class="tx-sqrtbody">' + inner + '</span></span>', used: 2 };
    }
    else if (a.t === 'grp') {
      if (a.open === '[' && isChemical(a.body)) {
        html = '[<span class="tx-up">' + render(a.body, true, true) + '</span>]';
      } else {
        var bodyItems = parse(lex(a.body, ctx.units));
        var trimmed = bodyItems.filter(function (x) { return x.t !== 'sp'; });
        var inner2 = renderItems(bodyItems, ctx);
        var prev = atoms[i - 1];
        var calls = prev && (prev.t === 'fn' || prev.t === 'id' || prev.t === 'word');
        /* "(4/3)πr³", "z·(σ/√n)": brackets round nothing but one fraction
           add nothing once the fraction is stacked. A function's brackets
           ("log(a/b)") and ones carrying a prime or power stay. */
        if (!script && a.open === '(' && !calls && !a.sup && !a.sub && !a.post
            && trimmed.length === 1 && trimmed[0].t === 'frac') {
          html = inner2;
        } else {
          var tall = !script && /tx-frac|tx-big/.test(inner2);
          html = (tall ? '<span class="tx-delim">' + esc(a.open) + '</span>' : esc(a.open)) + inner2
            + (tall ? '<span class="tx-delim">' + esc(a.close) + '</span>' : esc(a.close));
        }
      }
    }
    else html = esc(a.v || '');
    return { html: decorations(a, html), used: 1 };
  }

  function runHTML(run, ctx, asOperand) {
    var atoms = run.atoms;
    // An operand that is nothing but "( … )" loses the brackets: the bar groups it.
    if (asOperand && atoms.length === 1 && atoms[0].t === 'grp' && atoms[0].open === '('
        && !atoms[0].sup && !atoms[0].sub && !atoms[0].post) {
      return render(atoms[0].body, ctx.script);
    }
    var html = '';
    for (var i = 0; i < atoms.length;) {
      var r = atomHTML(atoms, i, ctx);
      html += r.html;
      i += r.used;
    }
    return html;
  }

  function itemHTML(it, ctx) {
    if (it.t === 'run') return runHTML(it, ctx, false);
    if (it.t === 'frac') {
      var num = it.num.t === 'frac' ? itemHTML(it.num, ctx) : runHTML(it.num, ctx, true);
      var den = runHTML(it.den, ctx, true);
      if (ctx.script) return num + '/' + den;
      return '<span class="tx-frac"><span class="tx-num">' + num + '</span><span class="tx-den">' + den + '</span></span>';
    }
    if (it.t === 'op') {
      // Inside an exponent "n−1" is one small group, not an operator with room around it.
      if (ctx.script) return esc(it.v);
      if (REL[it.v]) return '<span class="tx-rel">' + esc(it.v) + '</span>';
      if (BIN[it.v]) return '<span class="tx-bin">' + esc(it.v) + '</span>';
      if (it.v === ',' || it.v === ';' || it.v === ':') return esc(it.v) + ' ';
      return esc(it.v);
    }
    if (it.t === 'sp') return it.n >= 2 ? '<span class="tx-gap"></span>' : ' ';
    return '';
  }

  function renderItems(items, ctx) {
    var html = '';
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (it.t === 'sp') {
        // Operators carry their own spacing; a space beside one would double it.
        var p = items[i - 1], n = items[i + 1];
        if (!p || !n) continue;
        if (((p.t === 'op') || (n.t === 'op')) && it.n < 2) continue;
      }
      html += itemHTML(it, ctx);
    }
    return html;
  }

  function render(src, script, upright) {
    var units = [];
    var s = String(src).replace(UNIT_RE, function (m, num, unit) {
      units.push(unit.trim());
      return num + String.fromCharCode(0xE000 + units.length - 1);
    });
    var ctx = { script: !!script, units: units };
    var html = renderItems(parse(lex(s, units)), ctx);
    // Chemical species inside [ ]: letters upright, not italic variables.
    if (upright) html = html.replace(/<i>([^<]*)<\/i>/g, '$1');
    return html;
  }

  /** Plain formula text → typeset HTML, one block per line of the formula. */
  function toHtml(src) {
    var text = String(src == null ? '' : src).trim();
    if (!text) return '';
    var lines = [];
    text.split(/\n/).forEach(function (line) {
      line.split(/\s{3,}/).forEach(function (part) { if (part.trim()) lines.push(part.trim()); });
    });
    return '<span class="tx tx-formula">' + lines.map(function (l) {
      var html;
      try { html = render(l, false); } catch (e) { html = esc(l); }
      return '<span class="tx-line">' + html + '</span>';
    }).join('') + '</span>';
  }

  /**
   * A formula is one line — breaking "log a − log b" after "log" is worse
   * than a slightly smaller formula. Each line that is wider than its box is
   * scaled down to fit, to no less than 70%; past that the box scrolls.
   */
  function fit(root) {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll('.tx-formula').forEach(function (f) {
      var box = f.parentElement;
      if (!box) return;
      var cs = global.getComputedStyle ? global.getComputedStyle(box) : null;
      var room = box.clientWidth - (cs ? parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) : 0);
      if (!(room > 0)) return;
      f.querySelectorAll('.tx-line').forEach(function (line) {
        line.style.fontSize = '';
        var w = line.scrollWidth;
        if (w > room) line.style.fontSize = Math.max(0.7, room / w).toFixed(3) + 'em';
      });
    });
  }

  var api = { toHtml: toHtml, fit: fit };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (global) global.FluxFormulaTypeset = api;
})(typeof window !== 'undefined' ? window : globalThis);
