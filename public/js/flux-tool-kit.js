/* ============================================================================
   FLUX TOOLS  ·  flux-tool-kit.js
   The small shared parts of the standalone tool pages (paper.html, units.html,
   cite.html … see public/data/products.json, groups science/writing/tools).
   Each page is built like periodic.html: no bundles, no Supabase, no sign-in,
   nothing fetched, so it opens offline on any school computer.
   Here: escaping, element building, saving to this device, copy and download,
   a toast, tabs, and a safe arithmetic parser (no eval) that several of the
   tools share for formulas typed by students.
   ========================================================================== */
(function () {
  'use strict';
  /* The same escape as FluxHub.esc, kept local so it never depends on what
     another script put on window (and so code scanning can see it). */
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return [].slice.call((root || document).querySelectorAll(sel)); };

  /* Saved on this device only. Blocked storage (private windows) just forgets. */
  function load(key, fallback) {
    try { var v = JSON.parse(localStorage.getItem(key) || 'null'); return v == null ? fallback : v; } catch (e) { return fallback; }
  }
  function save(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* blocked */ } }

  function toast(text) {
    var t = document.createElement('div');
    t.className = 'ft-toast'; t.setAttribute('role', 'status'); t.textContent = text;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2200);
  }
  function copy(text, done) {
    var ok = function () { toast(done || 'Copied'); };
    try { navigator.clipboard.writeText(text).then(ok, function () { window.prompt('Copy this:', text); }); }
    catch (e) { window.prompt('Copy this:', text); }
  }
  function download(name, data, type) {
    var blob = data instanceof Blob ? data : new Blob([data], { type: type || 'text/plain;charset=utf-8' });
    var a = document.createElement('a');
    // A file name, not markup: only letters, digits, dot, dash and underscore.
    a.href = URL.createObjectURL(blob); a.download = String(name).replace(/[^\w.-]+/g, '-') || 'flux-file';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }

  /* Tabs: buttons [role=tab][aria-controls] inside [role=tablist]; arrow keys
     move between them, as on the Suite. Remembers the open tab per page. */
  function tabs(list, key) {
    var ts = $$('[role="tab"]', list);
    var pick = function (t, focus) {
      ts.forEach(function (x) {
        var on = x === t;
        x.setAttribute('aria-selected', String(on)); x.tabIndex = on ? 0 : -1;
        document.getElementById(x.getAttribute('aria-controls')).hidden = !on;
      });
      if (focus) t.focus();
      if (key) save(key, t.id);
      list.dispatchEvent(new CustomEvent('ft-tab', { detail: t.id }));
    };
    ts.forEach(function (t, i) {
      t.addEventListener('click', function () { pick(t); });
      t.addEventListener('keydown', function (e) {
        var n = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (n) { e.preventDefault(); pick(ts[(i + n + ts.length) % ts.length], true); }
      });
    });
    var saved = key && load(key, '');
    pick(ts.filter(function (t) { return t.id === saved; })[0] || ts[0]);
    return pick;
  }

  /* ── Arithmetic without eval ───────────────────────────────────────────
     compile('u + a*t') → { vars: ['u','a','t'], fn(scope) }. Numbers (1e-3),
     names (Greek and subscripts allowed: v_0, λ), + - * / ^, ×, ÷, ², ³,
     brackets, and sqrt sin cos tan asin acos atan ln log exp abs, pi, e.
     Implicit multiplication between a number and a name or bracket (2a, 3(x)).
     Throws Error with a plain message on anything else. */
  var FUNCS = { sqrt: Math.sqrt, sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
    ln: Math.log, log: Math.log10, exp: Math.exp, abs: Math.abs };
  var CONSTS = { pi: Math.PI, π: Math.PI, e: Math.E };
  function lex(src) {
    var s = String(src).replace(/×|·/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/²/g, '^2').replace(/³/g, '^3').replace(/√/g, 'sqrt');
    var out = [], i = 0, m;
    while (i < s.length) {
      var rest = s.slice(i);
      if ((m = /^\s+/.exec(rest))) { i += m[0].length; continue; }
      if ((m = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(rest))) { out.push({ t: 'n', v: parseFloat(m[0]) }); i += m[0].length; continue; }
      if ((m = /^[A-Za-zα-ωΑ-Ω_][A-Za-z0-9α-ωΑ-Ω_]*/.exec(rest))) { out.push({ t: 'id', v: m[0] }); i += m[0].length; continue; }
      if ('+-*/^(),'.indexOf(s[i]) >= 0) { out.push({ t: s[i] }); i++; continue; }
      throw new Error('“' + s[i] + '” is not something the calculator understands.');
    }
    // implicit ×: 2a, 2(…), )( , )a
    var withMul = [];
    out.forEach(function (tk, k) {
      var prev = withMul[withMul.length - 1];
      if (prev && (prev.t === 'n' || prev.t === ')' || (prev.t === 'id' && !FUNCS[prev.v])) && (tk.t === 'id' || tk.t === '(' || (tk.t === 'n' && prev.t !== 'n'))) {
        if (!(prev.t === 'id' && tk.t === '(')) withMul.push({ t: '*' });
      }
      withMul.push(tk);
    });
    return withMul;
  }
  function compile(src) {
    var tk = lex(src), p = 0, vars = [];
    var peek = function () { return tk[p]; };
    var eat = function (t) { if (!tk[p] || tk[p].t !== t) throw new Error('Expected “' + t + '”.'); return tk[p++]; };
    function expr() {
      var a = term();
      while (peek() && (peek().t === '+' || peek().t === '-')) { var op = tk[p++].t, l = a, r = term(); a = op === '+' ? (function (l, r) { return function (s) { return l(s) + r(s); }; })(l, r) : (function (l, r) { return function (s) { return l(s) - r(s); }; })(l, r); }
      return a;
    }
    function term() {
      var a = unary();
      while (peek() && (peek().t === '*' || peek().t === '/')) { var op = tk[p++].t, l = a, r = unary(); a = op === '*' ? (function (l, r) { return function (s) { return l(s) * r(s); }; })(l, r) : (function (l, r) { return function (s) { return l(s) / r(s); }; })(l, r); }
      return a;
    }
    function unary() {
      if (peek() && peek().t === '-') { p++; var u = unary(); return function (s) { return -u(s); }; }
      if (peek() && peek().t === '+') { p++; return unary(); }
      return power();
    }
    function power() {
      var b = atom();
      if (peek() && peek().t === '^') { p++; var e = unary(); return function (s) { return Math.pow(b(s), e(s)); }; }
      return b;
    }
    function atom() {
      var t = tk[p++];
      if (!t) throw new Error('The formula ends too soon.');
      if (t.t === 'n') return function () { return t.v; };
      if (t.t === '(') { var e = expr(); eat(')'); return e; }
      if (t.t === 'id') {
        if (FUNCS[t.v] && peek() && peek().t === '(') { p++; var arg = expr(); eat(')'); var f = FUNCS[t.v]; return function (s) { return f(arg(s)); }; }
        if (CONSTS[t.v] != null && vars.indexOf(t.v) < 0) { var c = CONSTS[t.v]; return function (s) { return t.v in s ? s[t.v] : c; }; }
        if (vars.indexOf(t.v) < 0) vars.push(t.v);
        return function (s) { if (!(t.v in s)) throw new Error('No value for ' + t.v + '.'); return s[t.v]; };
      }
      throw new Error('Unexpected “' + t.t + '”.');
    }
    var fn = expr();
    if (p < tk.length) throw new Error('Unexpected “' + (tk[p].v || tk[p].t) + '”.');
    return { vars: vars, fn: fn };
  }

  /* Solve f(x) = 0 near a guess: secant steps, then bisection on a found
     sign change. Returns NaN when there is no answer it can trust. */
  function solve(f, guess) {
    var g = isFinite(guess) && guess !== 0 ? guess : 1;
    var x0 = g, x1 = g * 1.1 + 0.1;
    for (var i = 0; i < 80; i++) {
      var f0 = f(x0), f1 = f(x1);
      if (!isFinite(f0) || !isFinite(f1)) break;
      if (Math.abs(f1) < 1e-12) return x1;
      var x2 = x1 - f1 * (x1 - x0) / (f1 - f0);
      if (!isFinite(x2)) break;
      x0 = x1; x1 = x2;
    }
    if (isFinite(x1) && Math.abs(f(x1)) < 1e-9 * Math.max(1, Math.abs(x1))) return x1;
    // scan for a sign change
    var span = [1e-6, 1e-3, 1, 1e3, 1e6, 1e9];
    for (var k = 0; k < span.length; k++) {
      var lo = -span[k], hi = span[k], flo = f(lo), fhi = f(hi);
      if (isFinite(flo) && isFinite(fhi) && flo * fhi < 0) {
        for (var j = 0; j < 200; j++) { var mid = (lo + hi) / 2, fm = f(mid); if (flo * fm <= 0) { hi = mid; } else { lo = mid; flo = fm; } }
        return (lo + hi) / 2;
      }
    }
    return NaN;
  }

  /* Significant figures. */
  function sigFigsOf(str) {
    var s = String(str).trim().replace(/^[-+]/, '').toLowerCase().split('e')[0];
    if (!/^\d*\.?\d*$/.test(s) || !/\d/.test(s)) return 0;
    if (s.indexOf('.') >= 0) return s.replace('.', '').replace(/^0+/, '').length || 1;
    return s.replace(/^0+/, '').replace(/0+$/, '').length || 1;
  }
  function toSig(n, sf) {
    if (!isFinite(n)) return '—';
    if (n === 0) return '0';
    var v = Number(n).toPrecision(Math.max(1, Math.min(21, sf)));
    var a = Math.abs(n);
    // toPrecision switches to e-notation for 1234 at 3 s.f.; show 1230 there.
    if (v.indexOf('e') >= 0 && a >= 1e-4 && a < 1e6) return String(Number(v));
    return v;
  }
  function fmt(n, d) {
    if (!isFinite(n)) return '—';
    var a = Math.abs(n);
    if (a !== 0 && (a < 1e-4 || a >= 1e9)) return n.toExponential(d == null ? 4 : d);
    return String(Math.round(n * 1e6) / 1e6);
  }

  /* A table that scrolls sideways must be reachable by keyboard (axe:
     scrollable-region-focusable): every .ft-table-wrap, now or later, gets
     tabindex=0 and a name. */
  function focusableTables() {
    $$('.ft-table-wrap:not([tabindex])').forEach(function (w) {
      w.tabIndex = 0; w.setAttribute('role', 'region');
      if (!w.hasAttribute('aria-label')) w.setAttribute('aria-label', 'Table, scrolls sideways');
    });
  }
  if (document.body) {
    focusableTables();
    try { new MutationObserver(focusableTables).observe(document.body, { childList: true, subtree: true }); } catch (e) { /* old browser */ }
  }

  window.FluxTool = { esc: esc, $: $, $$: $$, load: load, save: save, toast: toast, copy: copy, download: download, tabs: tabs, compile: compile, solve: solve, sigFigsOf: sigFigsOf, toSig: toSig, fmt: fmt };
})();
