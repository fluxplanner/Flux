/* ════════════════════════════════════════════════════════════════════════
   FLUX · Calculator entry line — flux-ti84-editor.js
   ------------------------------------------------------------------------
   MathPrint, the way the CE does it: ^ lifts the cursor into a raised box,
   n/d stacks a fraction, √ draws its bar over what you type, and Σ, d/dx,
   ∫ and log_b are templates with boxes to fill. Everything else is a
   token — "sin(" is one keypress and one thing to delete, as on the
   calculator — never loose letters.

   The line is a tree: a block is an array of nodes; a node is a token
   { t: 'tok', c: code, d: display } or a template { t: 'frac', b: [[…],[…]] }
   whose blocks hold more nodes. The cursor sits between nodes in one block.
   serialize() turns the tree into the engine's code (flux-ti84-engine.js);
   html() draws it.
   ════════════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  /** Templates: how many blocks, which block the cursor starts in, and how they serialize. */
  const TPL = {
    frac: { n: 2, focus: 0, ser: (b) => '((' + b[0] + ')/(' + b[1] + '))' },
    mixed: { n: 3, focus: 0, ser: (b) => '((' + b[0] + ')+(' + b[1] + ')/(' + b[2] + '))' },
    pow: { n: 1, focus: 0, ser: (b) => '^(' + b[0] + ')' },
    sqrt: { n: 1, focus: 0, ser: (b) => '√(' + b[0] + ')' },
    nroot: { n: 2, focus: 0, ser: (b) => '((' + b[0] + ')ˣ√(' + b[1] + '))' },
    abs: { n: 1, focus: 0, ser: (b) => 'abs(' + b[0] + ')' },
    logb: { n: 2, focus: 0, ser: (b) => 'logBASE(' + b[1] + ',' + b[0] + ')' },
    sum: { n: 4, focus: 0, ser: (b) => 'Σ(' + b[3] + ',' + b[0] + ',' + b[1] + ',' + b[2] + ')' },
    deriv: { n: 3, focus: 0, ser: (b) => 'nDeriv(' + b[1] + ',' + b[0] + ',' + b[2] + ')' },
    int: { n: 4, focus: 0, ser: (b) => 'fnInt(' + b[2] + ',' + b[3] + ',' + b[0] + ',' + b[1] + ')' },
    npr: { n: 2, focus: 0, ser: (b) => '((' + b[0] + ') nPr (' + b[1] + '))' },
    ncr: { n: 2, focus: 0, ser: (b) => '((' + b[0] + ') nCr (' + b[1] + '))' },
  };
  /** Which block ↑ and ↓ lead to, per template and block. */
  const VERT = {
    frac: { down: { 0: 1 }, up: { 1: 0 } },
    mixed: { down: { 1: 2 }, up: { 2: 1 } },
    sum: { down: { 2: 0, 3: 0 }, up: { 0: 2, 1: 2, 3: 2 } },
    int: { down: { 1: 0, 2: 0 }, up: { 0: 1, 2: 1 } },
  };

  /** How a token code is shown: most are shown as typed. */
  const SHOW = {
    '*': '*', '/': '/', '-': '−', '⁻': '⁻', '→': '→', ' nPr ': ' nPr ', ' nCr ': ' nCr ',
    ' and ': ' and ', ' or ': ' or ', ' xor ': ' xor ', 'ᴇ': 'ᴇ', '≠': '≠', '≥': '≥', '≤': '≤',
  };
  const SUPER = { '²': '2', '³': '3', '⁻¹': '-1', 'ᵀ': 'T' };

  function tok(code, disp) { return { t: 'tok', c: code, d: disp == null ? displayOf(code) : disp }; }
  function displayOf(code) {
    if (SHOW[code] != null) return SHOW[code];
    let m = /^⟦(.)⟧$/.exec(code);
    if (m) return '[' + m[1] + ']';
    m = /^⟨(.+)⟩$/.exec(code);
    if (m) return ({ tvmN: 'N' })[m[1]] || m[1];
    return code;
  }
  function tpl(type, pre) {
    const spec = TPL[type];
    const b = [];
    for (let k = 0; k < spec.n; k++) b.push(pre && pre[k] ? pre[k].slice() : []);
    return { t: type, b: b };
  }
  function clone(nodes) {
    return nodes.map((n) => (n.t === 'tok' ? Object.assign({}, n) : { t: n.t, b: n.b.map(clone) }));
  }

  function Editor(opts) {
    this.root = [];
    this.cur = { blk: this.root, i: 0 };
    this.mathprint = !opts || opts.mathprint !== false;
    this.overwrite = false;
  }

  /** The node holding a block, and where that node sits: { node, bi, blk, i } or null at the top. */
  Editor.prototype.parentOf = function (blk) {
    const walk = (b) => {
      for (let i = 0; i < b.length; i++) {
        const n = b[i];
        if (n.t === 'tok') continue;
        for (let bi = 0; bi < n.b.length; bi++) {
          if (n.b[bi] === blk) return { node: n, bi: bi, blk: b, i: i };
          const r = walk(n.b[bi]);
          if (r) return r;
        }
      }
      return null;
    };
    return blk === this.root ? null : walk(this.root);
  };

  Editor.prototype.isEmpty = function () { return this.root.length === 0; };
  Editor.prototype.clear = function () { this.root.length = 0; this.cur = { blk: this.root, i: 0 }; };
  Editor.prototype.load = function (nodes) {
    this.root = clone(nodes || []);
    this.cur = { blk: this.root, i: this.root.length };
  };
  Editor.prototype.snapshot = function () { return clone(this.root); };
  Editor.prototype.atTop = function () { return this.cur.blk === this.root; };

  /* ── Typing ─────────────────────────────────────────────────────────── */

  Editor.prototype.insertNode = function (n) {
    const c = this.cur;
    if (this.overwrite && c.i < c.blk.length && c.blk[c.i].t === 'tok' && n.t === 'tok') c.blk.splice(c.i, 1, n);
    else c.blk.splice(c.i, 0, n);
    c.i += 1;
  };
  Editor.prototype.insertTok = function (code, disp) { this.insertNode(tok(code, disp)); };
  /** Insert several tokens from a code string (a pasted answer, a menu item). */
  Editor.prototype.insertCode = function (code) {
    splitCode(code).forEach((c) => this.insertTok(c));
  };
  /** A template; the cursor goes into its first empty block (or the block named by focus). */
  Editor.prototype.insertTpl = function (type, pre, focus) {
    if (!this.mathprint) { this.insertCode(classicOf(type, pre)); return; }
    const n = tpl(type, pre);
    this.cur.blk.splice(this.cur.i, 0, n);
    this.cur.i += 1;
    let f = focus;
    if (f == null) { f = n.b.findIndex((b) => b.length === 0); if (f < 0) f = TPL[type].focus; }
    this.cur = { blk: n.b[f], i: n.b[f].length };
  };
  /** Insert a whole tree (a history entry being pasted). */
  /** True when the thing just before the cursor is a value an infix operator can follow (5, x, ), Ans, a template…). */
  Editor.prototype.afterValue = function () {
    const c = this.cur;
    if (c.i === 0) return false;
    const n = c.blk[c.i - 1];
    return n.t !== 'tok' || /[0-9A-Za-zθπ.)\]}²³¹!°′ʳᵀ⟧⟩₀-₉]$/.test(n.c);
  };
  Editor.prototype.insertNodes = function (nodes) { clone(nodes).forEach((n) => this.insertNode(n)); };

  /* ── Moving ─────────────────────────────────────────────────────────── */

  Editor.prototype.left = function () {
    const c = this.cur;
    if (c.i > 0) {
      const n = c.blk[c.i - 1];
      if (n.t !== 'tok') { const b = n.b[n.b.length - 1]; this.cur = { blk: b, i: b.length }; return true; }
      c.i -= 1;
      return true;
    }
    const p = this.parentOf(c.blk);
    if (!p) return false;
    if (p.bi > 0) { const b = p.node.b[p.bi - 1]; this.cur = { blk: b, i: b.length }; return true; }
    this.cur = { blk: p.blk, i: p.i };
    return true;
  };
  Editor.prototype.right = function () {
    const c = this.cur;
    if (c.i < c.blk.length) {
      const n = c.blk[c.i];
      if (n.t !== 'tok') { this.cur = { blk: n.b[0], i: 0 }; return true; }
      c.i += 1;
      return true;
    }
    const p = this.parentOf(c.blk);
    if (!p) return false;
    if (p.bi < p.node.b.length - 1) { this.cur = { blk: p.node.b[p.bi + 1], i: 0 }; return true; }
    this.cur = { blk: p.blk, i: p.i + 1 };
    return true;
  };
  /** ↑/↓ inside a fraction or a Σ/∫ template; false when there is nowhere to go (the caller may use it). */
  Editor.prototype.vertical = function (dir) {
    let blk = this.cur.blk;
    for (;;) {
      const p = this.parentOf(blk);
      if (!p) return false;
      const v = VERT[p.node.t];
      const to = v && v[dir] && v[dir][p.bi];
      if (to != null) {
        const b = p.node.b[to];
        this.cur = { blk: b, i: Math.min(this.cur.i, b.length) };
        return true;
      }
      blk = p.blk;
    }
  };
  Editor.prototype.home = function () { this.cur = { blk: this.root, i: 0 }; };
  Editor.prototype.end = function () { this.cur = { blk: this.root, i: this.root.length }; };

  /* ── Deleting ───────────────────────────────────────────────────────── */

  const isEmptyTpl = (n) => n.t !== 'tok' && n.b.every((b) => b.length === 0);
  /** Backspace: the thing before the cursor. A template with something in it is entered, not destroyed. */
  Editor.prototype.backspace = function () {
    const c = this.cur;
    if (c.i > 0) {
      const n = c.blk[c.i - 1];
      if (n.t === 'tok' || isEmptyTpl(n)) { c.blk.splice(c.i - 1, 1); c.i -= 1; return true; }
      const b = n.b[n.b.length - 1];
      this.cur = { blk: b, i: b.length };
      return true;
    }
    const p = this.parentOf(c.blk);
    if (!p) return false;
    if (isEmptyTpl(p.node)) { p.blk.splice(p.i, 1); this.cur = { blk: p.blk, i: p.i }; return true; }
    // At the start of a block with neighbours: step out to the left.
    if (p.bi > 0) { const b = p.node.b[p.bi - 1]; this.cur = { blk: b, i: b.length }; return true; }
    // The first block of a template: unwrap it, keeping what was typed inside (x² with the 2 deleted).
    if (p.node.t === 'pow' || p.node.t === 'sqrt' || p.node.t === 'abs') {
      const inner = p.node.b[0];
      p.blk.splice(p.i, 1, ...inner);
      this.cur = { blk: p.blk, i: p.i };
      return true;
    }
    this.cur = { blk: p.blk, i: p.i };
    return true;
  };
  /** DEL: the thing at (after) the cursor, or before it at the end of the line, as the calculator's cursor block does. */
  Editor.prototype.del = function () {
    const c = this.cur;
    if (c.i < c.blk.length) {
      const n = c.blk[c.i];
      if (n.t === 'tok' || isEmptyTpl(n)) { c.blk.splice(c.i, 1); return true; }
      this.cur = { blk: n.b[0], i: 0 };
      return true;
    }
    return this.backspace();
  };

  /* ── Output ─────────────────────────────────────────────────────────── */

  function serBlock(b) {
    return b.map((n) => {
      if (n.t === 'tok') return n.c;
      return TPL[n.t].ser(n.b.map(serBlock));
    }).join('');
  }
  Editor.prototype.serialize = function () { return serBlock(this.root); };
  Editor.serializeNodes = serBlock;
  /** True when a fraction template was typed — AUTO answers then come back as fractions. */
  Editor.hasFraction = function (nodes) {
    return (nodes || []).some((n) => n.t === 'frac' || n.t === 'mixed' || (n.t !== 'tok' && n.b.some((b) => Editor.hasFraction(b))));
  };

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  /**
   * HTML for a block. cur: the cursor ({ blk, i }) or null; mark: '2' / 'A' / '' for the
   * 2nd and alpha indicators the calculator shows in its cursor.
   */
  function htmlBlock(b, cur, mark, isRoot) {
    let out = '';
    const cursorHere = cur && cur.blk === b;
    const cursor = '<span class="t84c' + (mark ? ' t84c--' + (mark === '2' ? 'second' : 'alpha') : '') + '">' + (mark ? esc(mark) : '') + '</span>';
    if (!b.length && !isRoot) return '<span class="t84e">' + (cursorHere ? cursor : '') + '</span>';
    b.forEach((n, i) => {
      if (cursorHere && cur.i === i) out += cursor;
      out += htmlNode(n, cur, mark);
    });
    if (cursorHere && cur.i === b.length) out += cursor;
    return out;
  }
  function htmlNode(n, cur, mark) {
    if (n.t === 'tok') {
      if (SUPER[n.c] != null) return '<sup class="t84sup">' + esc(SUPER[n.c]) + '</sup>';
      return '<span class="t84t">' + esc(n.d) + '</span>';
    }
    const B = (k) => htmlBlock(n.b[k], cur, mark);
    switch (n.t) {
      case 'frac': return '<span class="t84fr"><span class="t84fr-n">' + B(0) + '</span><span class="t84fr-d">' + B(1) + '</span></span>';
      case 'mixed': return '<span class="t84mx">' + B(0) + '<span class="t84fr"><span class="t84fr-n">' + B(1) + '</span><span class="t84fr-d">' + B(2) + '</span></span></span>';
      case 'pow': return '<sup class="t84sup">' + B(0) + '</sup>';
      case 'sqrt': return '<span class="t84rt"><span class="t84rt-s">√</span><span class="t84rt-b">' + B(0) + '</span></span>';
      case 'nroot': return '<span class="t84rt"><sup class="t84rt-i">' + B(0) + '</sup><span class="t84rt-s">√</span><span class="t84rt-b">' + B(1) + '</span></span>';
      case 'abs': return '<span class="t84abs">|' + B(0) + '|</span>';
      case 'logb': return '<span class="t84t">log</span><sub class="t84sub">' + B(0) + '</sub><span class="t84t">(</span>' + B(1) + '<span class="t84t">)</span>';
      case 'sum': return '<span class="t84big"><span class="t84big-hi">' + B(2) + '</span><span class="t84big-op">Σ</span><span class="t84big-lo">' + B(0) + '<span class="t84t">=</span>' + B(1) + '</span></span><span class="t84t">(</span>' + B(3) + '<span class="t84t">)</span>';
      case 'deriv': return '<span class="t84fr t84fr--op"><span class="t84fr-n"><span class="t84t">d</span></span><span class="t84fr-d"><span class="t84t">d</span>' + B(0) + '</span></span><span class="t84t">(</span>' + B(1) + '<span class="t84t">)</span><span class="t84bar">|</span><sub class="t84sub">' + htmlBlock(n.b[0], null, '') + '<span class="t84t">=</span>' + B(2) + '</sub>';
      case 'int': return '<span class="t84big"><span class="t84big-hi">' + B(1) + '</span><span class="t84big-op t84big-op--int">∫</span><span class="t84big-lo">' + B(0) + '</span></span>' + B(2) + '<span class="t84t">d</span>' + B(3);
      case 'npr': return B(0) + '<span class="t84t"> nPr </span>' + B(1);
      case 'ncr': return B(0) + '<span class="t84t"> nCr </span>' + B(1);
      default: return '';
    }
  }
  Editor.prototype.html = function (mark, showCursor) {
    return htmlBlock(this.root, showCursor === false ? null : this.cur, mark || '', true);
  };
  Editor.htmlNodes = function (nodes) { return htmlBlock(nodes, null, '', true); };

  /** Plain one-line text of a tree (classic mode, program listings). */
  function textBlock(b) {
    return b.map((n) => {
      if (n.t === 'tok') return n.d;
      const t = n.b.map(textBlock);
      switch (n.t) {
        case 'frac': return t[0] + '/' + t[1];
        case 'mixed': return t[0] + '+' + t[1] + '/' + t[2];
        case 'pow': return '^(' + t[0] + ')';
        case 'sqrt': return '√(' + t[0] + ')';
        case 'nroot': return t[0] + 'ˣ√(' + t[1] + ')';
        case 'abs': return 'abs(' + t[0] + ')';
        case 'logb': return 'logBASE(' + t[1] + ',' + t[0] + ')';
        case 'sum': return 'Σ(' + t[3] + ',' + t[0] + ',' + t[1] + ',' + t[2] + ')';
        case 'deriv': return 'nDeriv(' + t[1] + ',' + t[0] + ',' + t[2] + ')';
        case 'int': return 'fnInt(' + t[2] + ',' + t[3] + ',' + t[0] + ',' + t[1] + ')';
        case 'npr': return t[0] + ' nPr ' + t[1];
        case 'ncr': return t[0] + ' nCr ' + t[1];
        default: return '';
      }
    }).join('');
  }
  Editor.textNodes = textBlock;

  /* ── Code ⇄ tokens ─────────────────────────────────────────────────── */

  /** Multi-character codes that are a single token, longest first. */
  let WORDS = null;
  function words() {
    if (WORDS) return WORDS;
    const FT = root.FluxTI;
    const list = FT ? Object.keys(FT.FN_ARITY).concat(FT.CMDS, FT.CONV, FT.YNAMES) : [];
    WORDS = list.concat(['Ans', 'rand', 'ˣ√', '⁻¹', ' nPr ', ' nCr ', ' and ', ' or ', ' xor ', 'L₁', 'L₂', 'L₃', 'L₄', 'L₅', 'L₆',
      'getKey', 'Pmt_End', 'Pmt_Bgn', '1-Var Stats', '2-Var Stats'])
      .sort((a, b) => b.length - a.length);
    return WORDS;
  }
  /** Split engine code into the tokens the keys would have typed. */
  function splitCode(code) {
    const s = String(code);
    const out = [];
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (c === '⟨') { const j = s.indexOf('⟩', i); if (j > 0) { out.push(s.slice(i, j + 1)); i = j + 1; continue; } }
      if (c === '⟦') { const j = s.indexOf('⟧', i); if (j > 0) { out.push(s.slice(i, j + 1)); i = j + 1; continue; } }
      const w = words().find((x) => s.startsWith(x, i));
      if (w) { out.push(w); i += w.length; continue; }
      out.push(c);
      i += 1;
    }
    return out;
  }
  Editor.splitCode = splitCode;
  /** Tokens for a code string, as a tree (no templates). */
  Editor.nodesFromCode = function (code) { return splitCode(code).map((c) => tok(c)); };
  Editor.tok = tok;
  Editor.tpl = tpl;
  Editor.displayOf = displayOf;

  /** What a template becomes in CLASSIC mode, where there are no boxes. */
  function classicOf(type, pre) {
    const p = (k) => (pre && pre[k] ? serBlock(pre[k]) : '');
    switch (type) {
      case 'frac': return '/';
      case 'mixed': return '+';
      case 'pow': return '^' + p(0);
      case 'sqrt': return '√(';
      case 'nroot': return p(0) + 'ˣ√';
      case 'abs': return 'abs(';
      case 'logb': return 'logBASE(';
      case 'sum': return 'Σ(';
      case 'deriv': return 'nDeriv(';
      case 'int': return 'fnInt(';
      case 'npr': return ' nPr ';
      case 'ncr': return ' nCr ';
      default: return '';
    }
  }

  root.FluxTIEditor = Editor;
})(typeof window !== 'undefined' ? window : globalThis);
