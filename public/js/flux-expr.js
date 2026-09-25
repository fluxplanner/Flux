/* ============================================================================
   FLUX EXPR  ·  flux-expr.js
   A small, safe expression evaluator: "2x^2 - sin(x)/3" → a function of x.

   WHY A SHARED FILE RATHER THAN A THIRD COPY
   ------------------------------------------
   Two parsers already exist — compileExpr in flux-toolbox.js and compile in
   flux-study-math.js — but neither is reachable from grapher.html, which
   deliberately loads no bundles so it works on its own. The tempting move is
   to tuck a private copy inside the grapher; that would be a third
   implementation of the same grammar in one repo, and the copy nobody looks at
   is always the one that drifts.

   So this is the shared one: standalone as a plain script in the grapher,
   bundled in the planner. The other two should fold into it.

   NO eval, NO Function()
   ----------------------
   A recursive-descent parser over a whitelist. Students paste expressions from
   anywhere, and a graphing box that reaches eval() is a graphing box that runs
   whatever a classmate sent them.
   ========================================================================== */
(function () {
  'use strict';

  var CONSTS = { pi: Math.PI, 'π': Math.PI, e: Math.E, tau: Math.PI * 2 };

  /* Whitelisted only. Anything absent is a syntax error rather than a property
     lookup that might reach somewhere interesting. */
  var FNS = {
    sin: Math.sin, cos: Math.cos, tan: Math.tan,
    asin: Math.asin, acos: Math.acos, atan: Math.atan,
    sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
    ln: Math.log, log: function (v) { return Math.log(v) / Math.LN10; },
    log2: function (v) { return Math.log(v) / Math.LN2; },
    sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs,
    exp: Math.exp, sign: Math.sign,
    floor: Math.floor, ceil: Math.ceil, round: Math.round,
    min: Math.min, max: Math.max, atan2: Math.atan2, pow: Math.pow,
  };

  /**
   * Compile to a function of one variable. Throws on bad input with a message
   * worth showing — "Missing a closing bracket" beats a silently absent curve.
   *
   * opts.params: let unknown letters stand for adjustable numbers, the way
   *   "a·sin(bx)" works in Desmos — each becomes a slider. Off by default, so a
   *   typo in any other caller is still an error rather than a silent 1.
   *   Every letter of an unknown name counts separately: "ax" is a·x.
   * opts.scope: where those numbers are read from, at call time, so dragging
   *   a slider does not need a recompile.
   * opts.names: an object whose keys are whole words to read from the scope
   *   (a table's column names). A name not in the scope reads as NaN.
   *
   * The returned function carries .params — the letters it used, in order.
   */
  function compile(src, varName, opts) {
    var v = (varName || 'x').toLowerCase();
    /* Spaces are kept as separators rather than deleted. Deleting them made
       "a sin(x)" into "asin(x)" — the arcsine — which drew a short stub
       between −1 and 1 instead of a sine wave with a slider. */
    var S = String(src == null ? '' : src).replace(/\s+/g, ' ').trim();
    var i = 0;
    var o = opts || {};
    var found = [];

    function fail(msg) { throw new Error(msg); }
    function ws() { while (S[i] === ' ') i++; }
    function eat(ch) { ws(); if (S[i] === ch) { i++; return true; } return false; }

    /* Implicit multiplication — "2x", "3(x+1)", "2sin(x)" all read naturally
       to a student and would be syntax errors without it. */
    function canImplicitMult() {
      ws();
      if (i >= S.length) return false;
      var c = S[i];
      return c === '(' || /[a-zπ]/i.test(c) || /[0-9.]/.test(c);
    }

    function parseExpr() {
      var left = parseTerm();
      for (;;) {
        if (eat('+')) left = add(left, parseTerm());
        else if (eat('-')) left = sub(left, parseTerm());
        else return left;
      }
    }
    function parseTerm() {
      var left = parseUnary();
      for (;;) {
        if (eat('*')) left = mul(left, parseUnary());
        else if (eat('/')) left = div(left, parseUnary());
        else if (eat('%')) left = mod(left, parseUnary());
        else if (canImplicitMult() && !/[+\-*/^%),]/.test(S[i])) left = mul(left, parseUnary());
        else return left;
      }
    }
    function parseUnary() {
      if (eat('-')) { var n = parseUnary(); return function (x) { return -n(x); }; }
      if (eat('+')) return parseUnary();
      return parsePower();
    }
    function parsePower() {
      var base = parseAtom();
      // Right-associative: 2^3^2 is 2^(3^2), the way it is written on paper.
      if (eat('^')) { var ex = parseUnary(); return function (x) { return Math.pow(base(x), ex(x)); }; }
      return base;
    }
    function parseAtom() {
      if (eat('(')) {
        var inner = parseExpr();
        if (!eat(')')) fail('Missing a closing bracket.');
        return inner;
      }
      ws();
      var numMatch = /^[0-9]*\.?[0-9]+(?:[eE][+-]?[0-9]+)?/.exec(S.slice(i));
      if (numMatch) {
        i += numMatch[0].length;
        var val = parseFloat(numMatch[0]);
        return function () { return val; };
      }
      var nameMatch = /^[a-zA-Zπα-ωΑ-Ω][a-zA-Z0-9α-ωΑ-Ω_]*/.exec(S.slice(i));
      if (nameMatch) {
        var name = nameMatch[0];
        var start = i;
        i += name.length;
        var lower = name.toLowerCase();
        var afterName = i;
        /* opts.names: whole words that read from the scope — a table's column
           names in a calculated column ("L / T^2"). Checked before anything
           else so a column called "e" or "a" means the column, exactly as
           the person who named it expects. */
        if (o.names && Object.prototype.hasOwnProperty.call(o.names, name)) {
          if (found.indexOf(name) < 0) found.push(name);
          return function () {
            var sc = o.scope;
            var n = sc && sc[name];
            return typeof n === 'number' ? n : NaN;
          };
        }
        ws();
        if (S[i] === '(' && Object.prototype.hasOwnProperty.call(FNS, lower)) {
          i++;
          var args = [parseExpr()];
          while (eat(',')) args.push(parseExpr());
          if (!eat(')')) fail('Missing a closing bracket after ' + name + '(.');
          var fn = FNS[lower];
          return function (x) {
            var vals = [];
            for (var k = 0; k < args.length; k++) vals.push(args[k](x));
            return fn.apply(null, vals);
          };
        }
        /* Not a function call. "x(x+1)" and "a(x−2)" are a value next to a
           bracket, which the implicit multiplication in parseTerm picks up —
           they used to fail as 'I do not know the function "x"'. */
        i = afterName;
        var val = nameValue(name, start);
        if (val) return val;
        ws();
        if (S[i] === '(') fail('I do not know the function "' + name + '".');
        fail('I do not know "' + name + '".');
      }
      if (i >= S.length) fail('The expression stops early.');
      fail('Unexpected "' + S[i] + '".');
    }

    function constFn(c) { return function () { return c; }; }
    function X(x) { return x; }

    /** A bare name as a value: the variable, a constant, or slider letters. */
    function nameValue(name, start) {
      var lower = name.toLowerCase();
      if (lower === v) return X;
      if (Object.prototype.hasOwnProperty.call(CONSTS, lower)) return constFn(CONSTS[lower]);
      if (Object.prototype.hasOwnProperty.call(CONSTS, name)) return constFn(CONSTS[name]);
      if (Object.prototype.hasOwnProperty.call(FNS, lower)) {
        fail('Put brackets after ' + name + ' — like ' + name + '(x).');
      }
      /* "sinx" would otherwise split into s·i·n·x and quietly grow three
         sliders. Nobody typing that meant it, so say what they did mean. */
      for (var fname in FNS) {
        if (Object.prototype.hasOwnProperty.call(FNS, fname) && fname.length > 1
          && lower.indexOf(fname) === 0) {
          fail('Write ' + fname + '(…) with brackets, like ' + fname + '(x).');
        }
      }
      if (!o.params || !/^[a-zA-Z]+$/.test(name)) return null;
      /* Take one letter and hand the rest back to the parser. Returning the
         whole run as one product would make "ax^2" mean (a·x)², when everyone
         reads it as a·x² — the power belongs to the last letter only. The
         implicit multiplication in parseTerm picks the remaining letters up
         one at a time, so each gets its own exponent. */
      if (lower.indexOf('pi') === 0) {             // "2pix" is 2·π·x, not p·i·x
        i = start + 2;
        return constFn(Math.PI);
      }
      i = start + 1;
      var ch = name[0];
      if (ch.toLowerCase() === v) return X;
      if (ch === 'e') return constFn(Math.E);
      if (ch === 'y') fail('y is what is being drawn, so it cannot appear on the right.');
      return param(ch);
    }

    function param(ch) {
      if (found.indexOf(ch) < 0) found.push(ch);
      return function () {
        var sc = o.scope;
        var n = sc && sc[ch];
        return typeof n === 'number' && Number.isFinite(n) ? n : 1;
      };
    }

    function add(a, b) { return function (x) { return a(x) + b(x); }; }
    function sub(a, b) { return function (x) { return a(x) - b(x); }; }
    function mul(a, b) { return function (x) { return a(x) * b(x); }; }
    function div(a, b) { return function (x) { return a(x) / b(x); }; }
    function mod(a, b) { return function (x) { return a(x) % b(x); }; }

    if (!S) fail('Nothing to plot yet.');
    var f = parseExpr();
    ws();
    if (i < S.length) fail('I got stuck at "' + S.slice(i, i + 8) + '".');
    var wrapped = function (x) { return f(x); };
    wrapped.params = found.slice();
    return wrapped;
  }

  /** Compile without throwing: { fn, params } or { error }. */
  function tryCompile(src, varName, opts) {
    try {
      var fn = compile(src, varName, opts);
      return { fn: fn, params: fn.params };
    } catch (e) { return { error: e && e.message ? e.message : 'That expression did not parse.' }; }
  }

  window.FluxExpr = { compile: compile, tryCompile: tryCompile, FNS: FNS, CONSTS: CONSTS };
})();
