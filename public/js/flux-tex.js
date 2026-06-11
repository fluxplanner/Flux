/**
 * flux-tex.js — tiny dependency-free LaTeX-to-HTML renderer for AI chat.
 *
 * Turns the $...$ / $$...$$ / \(..\) / \[..\] math the models emit into real
 * stacked fractions, exponents, roots, and symbols (ChatGPT-style) without
 * shipping KaTeX (~1.3MB with fonts). Handles the constructs models actually
 * use: \frac, \sqrt[n]{}, ^ _, \cdot, \boxed, \text, \left( \right), greek,
 * comparison operators. Unknown commands degrade to their plain name.
 *
 * UMD-ish: window.FluxTex in the browser, module.exports for the extension
 * bundle (esbuild CJS interop) and node unit tests.
 *
 *   const { extract, restore } = FluxTex;
 *   const ex = extract(rawModelText);   // math → \u0000n\u0000 placeholders
 *   let html = yourMarkdownPipeline(ex.text);
 *   html = restore(html, ex.slots);     // placeholders → rendered math HTML
 */
(function (global) {
  'use strict';

  var SYM = {
    cdot: '·', times: '×', div: '÷', pm: '±', mp: '∓',
    leq: '≤', le: '≤', geq: '≥', ge: '≥', neq: '≠', ne: '≠', approx: '≈', sim: '∼', equiv: '≡',
    infty: '∞', degree: '°', circ: '∘', bullet: '•', ldots: '…', cdots: '⋯', dots: '…',
    rightarrow: '→', to: '→', leftarrow: '←', Rightarrow: '⇒', Leftarrow: '⇐', leftrightarrow: '↔', implies: '⇒', iff: '⇔', mapsto: '↦',
    alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ', eta: 'η',
    theta: 'θ', vartheta: 'ϑ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ',
    pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', upsilon: 'υ', phi: 'φ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
    Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
    sum: '∑', prod: '∏', int: '∫', partial: '∂', nabla: '∇',
    in: '∈', notin: '∉', subset: '⊂', subseteq: '⊆', cup: '∪', cap: '∩', emptyset: '∅', setminus: '∖',
    forall: '∀', exists: '∃', neg: '¬', land: '∧', lor: '∨',
    angle: '∠', triangle: '△', perp: '⊥', parallel: '∥', cong: '≅', propto: '∝',
    because: '∵', therefore: '∴', prime: '′', star: '⋆', ast: '∗',
    quad: '&nbsp;&nbsp;', qquad: '&nbsp;&nbsp;&nbsp;&nbsp;',
  };

  var FN = { sin: 1, cos: 1, tan: 1, sec: 1, csc: 1, cot: 1, arcsin: 1, arccos: 1, arctan: 1, sinh: 1, cosh: 1, tanh: 1, log: 1, ln: 1, lg: 1, exp: 1, lim: 1, max: 1, min: 1, det: 1, gcd: 1, mod: 1, deg: 1 };

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /** Read a balanced {...} group starting at s[i]==='{'. → [content, nextIndex] */
  function readGroup(s, i) {
    var depth = 0, j = i;
    for (; j < s.length; j++) {
      var ch = s[j];
      if (ch === '\\') { j++; continue; }
      if (ch === '{') depth++;
      else if (ch === '}') { depth--; if (depth === 0) return [s.slice(i + 1, j), j + 1]; }
    }
    return [s.slice(i + 1), s.length];
  }

  /** Read one argument: a {...} group, a \command, or a single char. */
  function readArg(s, i) {
    while (s[i] === ' ') i++;
    if (s[i] === '{') return readGroup(s, i);
    if (s[i] === '\\') {
      var m = /^\\[a-zA-Z]+/.exec(s.slice(i));
      if (m) return [m[0], i + m[0].length];
      return [s.slice(i, i + 2), i + 2];
    }
    return [s[i] || '', i + 1];
  }

  function walk(s) {
    var out = '', i = 0;
    while (i < s.length) {
      var c = s[i];
      if (c === '\\') {
        var m = /^\\([a-zA-Z]+)/.exec(s.slice(i));
        if (!m) {
          var n = s[i + 1] || '';
          if (n === '\\') out += '<br>';
          else if (n === ',' || n === ';' || n === ' ') out += '&#8201;';
          else out += esc(n);
          i += 2;
          continue;
        }
        var cmd = m[1];
        i += m[0].length;
        var a, b, r;
        if (cmd === 'frac' || cmd === 'dfrac' || cmd === 'tfrac') {
          r = readArg(s, i); a = r[0]; i = r[1];
          r = readArg(s, i); b = r[0]; i = r[1];
          out += '<span class="tx-frac"><span class="tx-num">' + walk(a) + '</span><span class="tx-den">' + walk(b) + '</span></span>';
        } else if (cmd === 'sqrt') {
          var idx = '';
          if (s[i] === '[') { var e = s.indexOf(']', i); if (e > 0) { idx = s.slice(i + 1, e); i = e + 1; } }
          r = readArg(s, i); a = r[0]; i = r[1];
          out += (idx ? '<sup class="tx-rootidx">' + walk(idx) + '</sup>' : '') +
            '<span class="tx-sqrt">√<span class="tx-sqrtbody">' + walk(a) + '</span></span>';
        } else if (cmd === 'boxed') {
          r = readArg(s, i); a = r[0]; i = r[1];
          out += '<span class="tx-boxed">' + walk(a) + '</span>';
        } else if (cmd === 'text' || cmd === 'textbf' || cmd === 'textit' || cmd === 'mathrm' || cmd === 'mathbf' || cmd === 'operatorname') {
          r = readArg(s, i); a = r[0]; i = r[1];
          out += '<span class="tx-up">' + esc(a) + '</span>';
        } else if (cmd === 'left' || cmd === 'right') {
          if (s[i] === '\\') {
            r = readArg(s, i); i = r[1];
            out += walk(r[0]);
          } else {
            if (s[i] && s[i] !== '.') out += esc(s[i]);
            i += 1;
          }
        } else if (cmd === 'begin' || cmd === 'end') {
          r = readArg(s, i); i = r[1]; // swallow {env}
        } else if (FN[cmd]) {
          out += '<span class="tx-up">' + cmd + '</span>';
        } else if (Object.prototype.hasOwnProperty.call(SYM, cmd)) {
          out += SYM[cmd];
        } else {
          out += esc(cmd);
        }
      } else if (c === '^' || c === '_') {
        var ra = readArg(s, i + 1);
        out += (c === '^' ? '<sup>' : '<sub>') + walk(ra[0]) + (c === '^' ? '</sup>' : '</sub>');
        i = ra[1];
      } else if (c === '{') {
        var rg = readGroup(s, i);
        out += walk(rg[0]);
        i = rg[1];
      } else if (c === '}') {
        i++;
      } else if (/[a-zA-Z]/.test(c)) {
        out += '<i>' + c + '</i>';
        i++;
      } else if (c === '-') {
        out += '−';
        i++;
      } else if (c === '*') {
        out += '·';
        i++;
      } else {
        out += esc(c);
        i++;
      }
    }
    return out;
  }

  function texToHtml(src, display) {
    return '<span class="tx' + (display ? ' tx-block' : '') + '">' + walk(String(src)) + '</span>';
  }

  /** Cheap heuristic so "$5 to $10" prose doesn't get mathified. */
  function isMathy(s) {
    if (/[\\^_]/.test(s)) return true;
    if (/^[^\s]{1,12}$/.test(s) && /[a-zA-Z0-9]/.test(s)) return true;
    return false;
  }

  /** Replace math segments with \u0000n\u0000 placeholders + rendered slots. */
  function extract(text) {
    var slots = [];
    var t = String(text == null ? '' : text);
    function push(tex, display) {
      slots.push(texToHtml(tex, display));
      return '\u0000' + (slots.length - 1) + '\u0000';
    }
    t = t.replace(/\$\$([\s\S]+?)\$\$/g, function (_, m) { return push(m, true); });
    t = t.replace(/\\\[([\s\S]+?)\\\]/g, function (_, m) { return push(m, true); });
    t = t.replace(/\\\(([\s\S]+?)\\\)/g, function (_, m) { return push(m, false); });
    t = t.replace(/\$([^$\n]+?)\$/g, function (m0, m) { return isMathy(m) ? push(m, false) : m0; });
    t = extractBare(t, push);
    // Last resort: stray LaTeX spacing macros that escaped extraction.
    t = t.replace(/\\[;,!]/g, ' ');
    return { text: t, slots: slots };
  }

  var BARE_CMD = /\\(?:(?:frac|tfrac|dfrac|sqrt|boxed|cdot|times|div|pm|leq|geq|neq|approx|infty|pi|theta|alpha|beta|gamma|lambda|mu|sigma|omega|sum|prod|int|left|right|text|sin|cos|tan|log|ln)(?![a-zA-Z])|[;,!:])/;

  /**
   * Models routinely emit LaTeX with no $...$ delimiters at all. Find runs
   * around a known \command and mathify just the run: expand left over
   * non-letter math chars (so prose words aren't eaten), right over math
   * chars, stopping at sentence punctuation, newlines, or words >3 letters.
   */
  function extractBare(t, push) {
    var out = '', i = 0;
    for (;;) {
      var m = BARE_CMD.exec(t.slice(i));
      if (!m) { out += t.slice(i); return out; }
      var start = i + m.index;
      var L = start;
      while (L > i && /[0-9=+\-*/^_ ({[−≈×·÷±≤≥≠|]/.test(t[L - 1])) L--;
      while (L < start && t[L] === ' ') L++;
      var R = start, depth = 0;
      while (R < t.length) {
        var c = t[R];
        if (c === '\n') break;
        if (c === '{') { depth++; R++; continue; }
        if (c === '}') { depth--; R++; continue; }
        if (depth > 0) { R++; continue; }
        if (c === '\\' && /[;,!:]/.test(t[R + 1] || '')) { R += 2; continue; }
        if (/[.,;:!?]/.test(c) && (R + 1 >= t.length || /\s/.test(t[R + 1]))) break;
        if (/[a-zA-Z]/.test(c) && t[R - 1] !== '\\' && !/[a-zA-Z\\]/.test(t[R - 1] || '')) {
          // start of a letter run in open math — bail before prose words
          var run = /^[a-zA-Z]+/.exec(t.slice(R))[0];
          if (run.length > 3) break;
        }
        if (!/[0-9a-zA-Z\\{}()\[\]^_+\-=*/ .,|'−≈×·÷±≤≥≠°]/.test(c)) break;
        R++;
      }
      while (R > start && t[R - 1] === ' ') R--;
      out += t.slice(i, L) + push(t.slice(L, R), false);
      i = R;
    }
  }

  function restore(html, slots) {
    return String(html).replace(/\u0000(\d+)\u0000/g, function (_, n) { return slots[+n] || ''; });
  }

  var api = { texToHtml: texToHtml, extract: extract, restore: restore };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (global) global.FluxTex = api;
})(typeof window !== 'undefined' ? window : globalThis);
