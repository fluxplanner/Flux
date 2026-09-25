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
   */
  function compile(src, varName) {
    var v = (varName || 'x').toLowerCase();
    var S = String(src == null ? '' : src).replace(/\s+/g, '');
    var i = 0;

    function fail(msg) { throw new Error(msg); }
    function eat(ch) { if (S[i] === ch) { i++; return true; } return false; }

    /* Implicit multiplication — "2x", "3(x+1)", "2sin(x)" all read naturally
       to a student and would be syntax errors without it. */
    function canImplicitMult() {
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
      var numMatch = /^[0-9]*\.?[0-9]+(?:[eE][+-]?[0-9]+)?/.exec(S.slice(i));
      if (numMatch) {
        i += numMatch[0].length;
        var val = parseFloat(numMatch[0]);
        return function () { return val; };
      }
      var nameMatch = /^[a-zA-Zπ][a-zA-Z0-9]*/.exec(S.slice(i));
      if (nameMatch) {
        var name = nameMatch[0];
        i += name.length;
        var lower = name.toLowerCase();
        if (eat('(')) {
          var args = [parseExpr()];
          while (eat(',')) args.push(parseExpr());
          if (!eat(')')) fail('Missing a closing bracket after ' + name + '(.');
          var fn = FNS[lower];
          if (!fn) fail('I do not know the function "' + name + '".');
          return function (x) {
            var vals = [];
            for (var k = 0; k < args.length; k++) vals.push(args[k](x));
            return fn.apply(null, vals);
          };
        }
        if (lower === v) return function (x) { return x; };
        if (Object.prototype.hasOwnProperty.call(CONSTS, lower)) {
          var cv = CONSTS[lower];
          return function () { return cv; };
        }
        if (Object.prototype.hasOwnProperty.call(CONSTS, name)) {
          var cv2 = CONSTS[name];
          return function () { return cv2; };
        }
        fail('I do not know "' + name + '".');
      }
      if (i >= S.length) fail('The expression stops early.');
      fail('Unexpected "' + S[i] + '".');
    }

    function add(a, b) { return function (x) { return a(x) + b(x); }; }
    function sub(a, b) { return function (x) { return a(x) - b(x); }; }
    function mul(a, b) { return function (x) { return a(x) * b(x); }; }
    function div(a, b) { return function (x) { return a(x) / b(x); }; }
    function mod(a, b) { return function (x) { return a(x) % b(x); }; }

    if (!S) fail('Nothing to plot yet.');
    var f = parseExpr();
    if (i < S.length) fail('I got stuck at "' + S.slice(i, i + 8) + '".');
    return f;
  }

  /** Compile without throwing: { fn } or { error }. */
  function tryCompile(src, varName) {
    try { return { fn: compile(src, varName) }; }
    catch (e) { return { error: e && e.message ? e.message : 'That expression did not parse.' }; }
  }

  window.FluxExpr = { compile: compile, tryCompile: tryCompile, FNS: FNS, CONSTS: CONSTS };
})();
