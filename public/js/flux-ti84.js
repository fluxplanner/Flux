/* ════════════════════════════════════════════════════════════════════════
   FLUX · Calculator — flux-ti84.js
   ------------------------------------------------------------------------
   A TI-84 Plus body with a CE's colour screen: the keypad with 2nd and
   alpha, the home screen with its history, Ans and ENTRY recall, every
   menu, MODE, CATALOG, the Y= editor, the list and matrix editors, and the
   forms the tests and apps use. The maths is flux-ti84-engine.js; the
   graph screens are flux-ti84-graph.js; programs flux-ti84-prgm.js; the
   STAT tests, wizards, Finance and PlySmlt2 flux-ti84-apps.js.

   Screens stack: the home screen is always at the bottom, a menu or an
   editor opens on top, 2nd QUIT goes back to home. Every screen is an
   object with render() → html and key(code) → handled?.

   Memory (variables, lists, matrices, Y=, programs, mode, history) is kept
   in localStorage under one key, per browser, like the handheld's RAM.
   ════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.FluxTI84) return;

  const T = () => window.FluxTI;
  const Ed = () => window.FluxTIEditor;
  const MN = () => window.FluxTIMenus;
  const STORE = 'flux_ti84_v1';
  const HISTORY_MAX = 40;

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ── The keypad ─────────────────────────────────────────────────────── */

  const K = (id, main, sec, al, cls) => ({ id: id, main: main, sec: sec || '', al: al || '', cls: cls || 'fn' });
  const TOP = [K('yequ', 'y=', 'stat plot', 'f1', 'top'), K('window', 'window', 'tblset', 'f2', 'top'), K('zoom', 'zoom', 'format', 'f3', 'top'),
    K('trace', 'trace', 'calc', 'f4', 'top'), K('graph', 'graph', 'table', 'f5', 'top')];
  const MID = [[K('2nd', '2nd', '', '', 'second'), K('mode', 'mode', 'quit'), K('del', 'del', 'ins')],
    [K('alpha', 'alpha', 'A-lock', '', 'alpha'), K('xt', 'X,T,θ,n', 'link'), K('stat', 'stat', 'list')]];
  const ROWS = [
    [K('math', 'math', 'test', 'A'), K('apps', 'apps', 'angle', 'B'), K('prgm', 'prgm', 'draw', 'C'), K('vars', 'vars', 'distr'), K('clear', 'clear')],
    [K('inv', 'x⁻¹', 'matrix', 'D'), K('sin', 'sin', 'sin⁻¹', 'E'), K('cos', 'cos', 'cos⁻¹', 'F'), K('tan', 'tan', 'tan⁻¹', 'G'), K('pow', '^', 'π', 'H')],
    [K('sq', 'x²', '√', 'I'), K('comma', ',', 'EE', 'J'), K('lparen', '(', '{', 'K'), K('rparen', ')', '}', 'L'), K('div', '÷', 'e', 'M', 'op')],
    [K('log', 'log', '10ˣ', 'N'), K('7', '7', 'u', 'O', 'num'), K('8', '8', 'v', 'P', 'num'), K('9', '9', 'w', 'Q', 'num'), K('mul', '×', '[', 'R', 'op')],
    [K('ln', 'ln', 'eˣ', 'S'), K('4', '4', 'L4', 'T', 'num'), K('5', '5', 'L5', 'U', 'num'), K('6', '6', 'L6', 'V', 'num'), K('sub', '−', ']', 'W', 'op')],
    [K('sto', 'sto→', 'rcl', 'X'), K('1', '1', 'L1', 'Y', 'num'), K('2', '2', 'L2', 'Z', 'num'), K('3', '3', 'L3', 'θ', 'num'), K('add', '+', 'mem', '"', 'op')],
    [K('on', 'on', 'off'), K('0', '0', 'catalog', '␣', 'num'), K('dot', '.', 'i', ':', 'num'), K('neg', '(−)', 'ans', '?', 'num'), K('enter', 'enter', 'entry', 'solve', 'op')],
  ];
  const SEC = {
    yequ: 'statplot', window: 'tblset', zoom: 'format', trace: 'calc', graph: 'table', mode: 'quit', del: 'ins', xt: 'link', stat: 'list',
    math: 'test', apps: 'angle', prgm: 'draw', vars: 'distr', inv: 'matrix', sin: 'asin', cos: 'acos', tan: 'atan', pow: 'pi', sq: 'sqrt',
    comma: 'ee', lparen: 'lbrace', rparen: 'rbrace', div: 'econst', log: 'tenx', 7: 'u', 8: 'v', 9: 'w', mul: 'lbrack', ln: 'ex',
    4: 'L4', 5: 'L5', 6: 'L6', sub: 'rbrack', sto: 'rcl', 1: 'L1', 2: 'L2', 3: 'L3', add: 'mem', on: 'off', 0: 'catalog', dot: 'imag',
    neg: 'ans', enter: 'entry', clear: 'clear', up: 'up', down: 'down', left: 'left', right: 'right',
  };
  const ALPHA = {
    math: 'A', apps: 'B', prgm: 'C', inv: 'D', sin: 'E', cos: 'F', tan: 'G', pow: 'H', sq: 'I', comma: 'J', lparen: 'K', rparen: 'L',
    div: 'M', log: 'N', 7: 'O', 8: 'P', 9: 'Q', mul: 'R', ln: 'S', 4: 'T', 5: 'U', 6: 'V', sub: 'W', sto: 'X', 1: 'Y', 2: 'Z', 3: 'θ',
    add: '"', 0: ' ', dot: ':', neg: '?',
  };
  const ALPHA_TOP = { yequ: 'f1', window: 'f2', zoom: 'f3', trace: 'f4', graph: 'f5', enter: 'solve' };

  /** What a key types into an entry line. */
  const TYPES = {
    dot: '.', neg: '⁻', add: '+', sub: '-', mul: '*', div: '/', comma: ',', lparen: '(', rparen: ')', sq: '²', inv: '⁻¹', sto: '→',
    sin: 'sin(', cos: 'cos(', tan: 'tan(', log: 'log(', ln: 'ln(', asin: 'sin⁻¹(', acos: 'cos⁻¹(', atan: 'tan⁻¹(', pi: 'π', ee: 'ᴇ',
    lbrace: '{', rbrace: '}', econst: 'e', u: 'u', v: 'v', w: 'w', lbrack: '[', rbrack: ']', imag: 'i', ans: 'Ans',
    L1: 'L₁', L2: 'L₂', L3: 'L₃', L4: 'L₄', L5: 'L₅', L6: 'L₆',
  };
  for (let d = 0; d <= 9; d++) TYPES[String(d)] = String(d);
  /** Keys that, pressed first on an empty home line, start with Ans — as on the calculator. */
  const ANS_FIRST = new Set(['add', 'sub', 'mul', 'div', 'pow', 'sq', 'inv', 'sto']);
  const ANS_FIRST_CODES = new Set(['▶Frac', '▶Dec', '³', 'ˣ√', ' nPr ', ' nCr ', '!', '°', '′', 'ʳ', '▶DMS', '▶Rect', '▶Polar', 'ᵀ',
    '=', '≠', '>', '≥', '<', '≤', ' and ', ' or ', ' xor ', '▶n/d◀▶Un/d', '▶F◀▶D']);
  const MENU_KEYS = /^(math|test|angle|list|matrix|distr|draw|vars|stat|apps|prgm|mem|zoom|calc|mode|catalog|yequ|window|graph|trace|table|tblset|format|statplot|quit|f1|f2|f3|f4|f5)$/;

  /** Computer keys → calculator keys. */
  const KEYBOARD = {
    Enter: 'enter', Backspace: 'bs', Delete: 'del', Escape: 'clear', ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    '+': 'add', '-': 'sub', '*': 'mul', '/': 'div', '^': 'pow', '(': 'lparen', ')': 'rparen', ',': 'comma', '.': 'dot',
    '{': 'lbrace', '}': 'rbrace', '[': 'lbrack', ']': 'rbrack', '!': 'tok:!', '=': 'tok:=', '<': 'tok:<', '>': 'tok:>', '"': 'a:"', ':': 'a::',
    '?': 'a:?', ' ': 'a: ', '~': 'neg',
  };

  /* ── State ──────────────────────────────────────────────────────────── */

  const YCOLOURS = ['#1f6feb', '#e5484d', '#1b1b1f', '#c93eae', '#2da44e', '#f08c24', '#8b5a2b', '#1c3d8f', '#3fb2e6', '#d9b300'];
  function freshUI() {
    const yOn = {}, yCol = {};
    T().YNAMES.forEach((n, i) => { yOn[n] = true; yCol[n] = YCOLOURS[i]; });
    ['X₁ᴛ', 'Y₁ᴛ', 'X₂ᴛ', 'Y₂ᴛ', 'X₃ᴛ', 'Y₃ᴛ', 'X₄ᴛ', 'Y₄ᴛ', 'X₅ᴛ', 'Y₅ᴛ', 'X₆ᴛ', 'Y₆ᴛ'].forEach((n, i) => { yOn[n] = true; yCol[n] = YCOLOURS[Math.floor(i / 2)]; });
    ['r₁', 'r₂', 'r₃', 'r₄', 'r₅', 'r₆'].forEach((n, i) => { yOn[n] = true; yCol[n] = YCOLOURS[i]; });
    return {
      history: [], ynodes: {}, yOn: yOn, yCol: yCol, yStyle: {}, prgms: {},
      plots: [0, 1, 2].map(() => ({ on: false, type: 'scatter', x: 'L₁', y: 'L₂', f: '1', mark: '□', col: '#1f6feb' })),
      fmt: { coord: true, grid: 'off', axes: true, label: false, expr: true, detect: false, thick: true },
      wizards: true, zoomSto: null, zoomPrev: null, draw: [],
    };
  }
  function loadState() {
    let st = null;
    try { st = JSON.parse(localStorage.getItem(STORE) || 'null'); } catch (e) { st = null; }
    const fresh = T().freshState();
    if (!st || typeof st !== 'object') { fresh.ui = freshUI(); return fresh; }
    // Keep what was saved, fill in anything a newer version added.
    const out = Object.assign(T().freshState(), st);
    out.mode = Object.assign(fresh.mode, st.mode || {});
    out.win = Object.assign(fresh.win, st.win || {});
    out.tbl = Object.assign(fresh.tbl, st.tbl || {});
    out.tvm = Object.assign(fresh.tvm, st.tvm || {});
    out.y = Object.assign(fresh.y, st.y || {});
    out.lists = Object.assign(fresh.lists, st.lists || {});
    const ui = freshUI();
    out.ui = Object.assign(ui, st.ui || {});
    out.ui.fmt = Object.assign(freshUI().fmt, (st.ui && st.ui.fmt) || {});
    out.ui.yOn = Object.assign(freshUI().yOn, (st.ui && st.ui.yOn) || {});
    out.ui.yCol = Object.assign(freshUI().yCol, (st.ui && st.ui.yCol) || {});
    if (!Array.isArray(out.ui.history)) out.ui.history = [];
    if (!Array.isArray(out.seed) || out.seed.length !== 2) out.seed = [12345, 67890];
    return out;
  }

  /* ── The calculator ─────────────────────────────────────────────────── */

  function Calc(host, opts) {
    this.host = host;
    this.opts = opts || {};
    this.st = loadState();
    this.mod = '';          // '', '2nd', 'alpha'
    this.alock = false;
    this.stack = [];
    this.home = new Home(this);
    this.stack.push(this.home);
    this.build();
    this.render();
  }
  Calc.prototype.top = function () { return this.stack[this.stack.length - 1]; };
  Calc.prototype.push = function (app) { this.stack.push(app); if (app.onShow) app.onShow(); };
  Calc.prototype.pop = function () {
    if (this.stack.length > 1) { const a = this.stack.pop(); if (a.onHide) a.onHide(); }
  };
  Calc.prototype.quit = function () {
    while (this.stack.length > 1) { const a = this.stack.pop(); if (a.onHide) a.onHide(); }
  };
  /** Replace the top screen (a form opening its results). */
  Calc.prototype.replace = function (app) {
    if (this.stack.length > 1) { const a = this.stack.pop(); if (a.onHide) a.onHide(); }
    this.push(app);
  };

  Calc.prototype.save = function () {
    clearTimeout(this.saveTimer);
    const st = this.st;
    this.saveTimer = setTimeout(() => {
      try {
        const copy = Object.assign({}, st, { ui: Object.assign({}, st.ui, { history: st.ui.history.slice(-HISTORY_MAX) }) });
        localStorage.setItem(STORE, JSON.stringify(copy));
      } catch (e) { /* full storage: the calculator keeps working, it just forgets on reload */ }
    }, 300);
  };

  Calc.prototype.build = function () {
    const keyHTML = (k) => '<div class="t84k-cell">'
      + '<div class="t84k-lab">' + (k.sec ? '<span class="t84k-sec">' + esc(k.sec) + '</span>' : '<span></span>')
      + (k.al ? '<span class="t84k-al">' + esc(k.al) + '</span>' : '<span></span>') + '</div>'
      + '<button type="button" class="t84k t84k--' + k.cls + '" data-k="' + esc(k.id) + '" aria-label="' + esc(k.main) + '">'
      + esc(k.main) + '</button></div>';
    // The wrapper is the size container, so the body's own padding and corners scale with it too.
    this.host.innerHTML = '<div class="t84-wrap"><div class="t84" tabindex="0" aria-label="Graphing calculator. Click it, then type or use the keys.">'
      + '<div class="t84-brand"><span class="t84-brand-name">Flux<b>·84</b></span><span class="t84-brand-model">GRAPHING</span></div>'
      + '<div class="t84-bezel"><div class="t84-screen" role="application" aria-live="polite">'
      + '<div class="t84-status"></div><div class="t84-scr"></div></div></div>'
      + '<div class="t84-keys">'
      + '<div class="t84-row t84-row--top">' + TOP.map(keyHTML).join('') + '</div>'
      + '<div class="t84-mid"><div class="t84-mid-left">' + MID.map((r) => '<div class="t84-row t84-row--3">' + r.map(keyHTML).join('') + '</div>').join('') + '</div>'
      + '<div class="t84-arrows"><button type="button" class="t84a t84a--up" data-k="up" aria-label="Up"></button>'
      + '<button type="button" class="t84a t84a--left" data-k="left" aria-label="Left"></button>'
      + '<button type="button" class="t84a t84a--right" data-k="right" aria-label="Right"></button>'
      + '<button type="button" class="t84a t84a--down" data-k="down" aria-label="Down"></button></div></div>'
      + ROWS.map((r) => '<div class="t84-row">' + r.map(keyHTML).join('') + '</div>').join('')
      + '</div></div></div>';
    this.el = this.host.querySelector('.t84');
    this.scr = this.host.querySelector('.t84-scr');
    this.status = this.host.querySelector('.t84-status');
    const self = this;
    this.el.addEventListener('pointerdown', (e) => {
      const b = e.target.closest('[data-k]');
      if (!b) return;
      e.preventDefault();
      self.el.focus({ preventScroll: true });
      b.classList.add('is-down');
      setTimeout(() => b.classList.remove('is-down'), 120);
      self.press(b.dataset.k);
    });
    // A key reached by Tab and pressed with Enter or Space arrives as a click with no pointer.
    this.el.addEventListener('click', (e) => {
      if (e.detail !== 0) return;
      const b = e.target.closest('[data-k]');
      if (b) self.press(b.dataset.k);
    });
    this.el.addEventListener('keydown', (e) => self.keyboard(e));
    this.scr.addEventListener('pointerdown', () => self.el.focus({ preventScroll: true }));
  };

  /** Physical keyboard: digits, letters (as alpha), operators, arrows, Enter, Backspace, Escape. */
  Calc.prototype.keyboard = function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (this.off) return;
    const t = e.target;
    if (t && t !== this.el && t.closest && t.closest('button') == null && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
    // A focused key button keeps Enter/Space for itself.
    if (t && t !== this.el && t.closest && t.closest('[data-k]') && (e.key === 'Enter' || e.key === ' ')) return;
    let code = null;
    if (/^[0-9]$/.test(e.key)) code = e.key;
    else if (/^[a-zA-Z]$/.test(e.key)) code = 'a:' + e.key.toUpperCase();
    else if (KEYBOARD[e.key]) code = KEYBOARD[e.key];
    if (!code) return;
    e.preventDefault();
    if (this.runner && this.runner.keyboard(code)) return;
    this.mod = '';
    this.alock = false;
    this.dispatch(code);
  };

  /** A key on the keypad: resolve 2nd/alpha, then hand it to the screen on top. */
  Calc.prototype.press = function (id) {
    // Switched off, the only key that does anything is ON — as on the handheld.
    if (this.off) { if (id === 'on') this.power(true); return; }
    if (this.runner && this.runner.key(id, this.mod)) { this.mod = this.alock ? 'alpha' : ''; return; }
    if (id === '2nd') { this.mod = this.mod === '2nd' ? '' : '2nd'; this.render(); return; }
    if (id === 'alpha') {
      if (this.mod === '2nd') { this.alock = true; this.mod = 'alpha'; }
      else if (this.alock || this.mod === 'alpha') { this.alock = false; this.mod = ''; }
      else this.mod = 'alpha';
      this.render();
      return;
    }
    let code = id;
    if (this.mod === '2nd') code = SEC[id] || id;
    // alpha enter is SOLVE — but with A-lock on, enter is just enter (it ends a name or a line).
    else if (this.mod === 'alpha') code = this.alock && id === 'enter' ? 'enter' : ALPHA_TOP[id] || (ALPHA[id] != null ? 'a:' + ALPHA[id] : id);
    if (this.alock && this.mod === 'alpha' && ALPHA[id] != null) this.mod = 'alpha';
    else { this.mod = ''; this.alock = false; }
    if (code === 'off') { this.power(false); return; }
    this.dispatch(code);
  };
  /** 2nd OFF blanks the screen; ON brings back exactly what was on it. Not
      saved: a reload always opens switched on. */
  Calc.prototype.power = function (on) {
    this.off = !on;
    this.mod = '';
    this.alock = false;
    this.el.classList.toggle('is-off', this.off);
    this.render();
  };
  Calc.prototype.dispatch = function (code) {
    const app = this.top();
    try {
      const handled = app.key ? app.key(code) : false;
      // 2nd QUIT always ends on the home screen. The screen on top saw the key
      // first, so it has already stored what was being typed into it.
      if (code === 'quit') this.quit();
      else if (!handled) this.global(code);
    } catch (e) {
      if (e && e.ti) this.error(e.ti);
      else { console.error('[calculator]', e); this.error('INVALID'); }
    }
    this.render();
    this.save();
  };

  /** Keys every screen shares: the menus, the graph keys, 2nd QUIT. */
  Calc.prototype.global = function (code) {
    const M = {
      math: 'MATH', test: 'TEST', angle: 'ANGLE', list: 'LIST', matrix: 'MATRIX', distr: 'DISTR', draw: 'DRAW', vars: 'VARS',
      stat: 'STAT', apps: 'APPS', mem: 'MEM', zoom: 'ZOOM', calc: 'CALC', f1: 'F1', f2: 'F2', f4: 'F4', f3: 'MATRIX',
    };
    if (M[code]) {
      if (code === 'calc' && window.FluxTIGraph) { this.quit(); window.FluxTIGraph.graph(this, { calcMenu: true }); return; }
      this.openMenu(M[code]);
      return;
    }
    // Screens replace each other, as on the calculator, rather than piling up
    // (Y= → graph → Y= → graph would otherwise stack forever). Menus still
    // open over the screen they paste into.
    if (/^(mode|yequ|window|tblset|format|statplot|graph|trace|table)$/.test(code)) this.quit();
    const G = window.FluxTIGraph, P = window.FluxTIPrgm;
    switch (code) {
      case 'quit': this.quit(); return;
      case 'mode': this.push(new ModeApp(this)); return;
      case 'catalog': this.push(new CatalogApp(this, this.editorApp())); return;
      case 'prgm': if (P) P.menu(this); else this.openMenu('PRGM'); return;
      case 'yequ': this.push(new YEditApp(this)); return;
      case 'window': if (G) G.window(this); return;
      case 'tblset': if (G) G.tblset(this); return;
      case 'format': if (G) G.format(this); return;
      case 'statplot': if (G) G.statplots(this); return;
      case 'graph': if (G) G.graph(this); return;
      case 'trace': if (G) G.graph(this, { trace: true }); return;
      case 'table': if (G) G.table(this); return;
      default:
    }
  };
  Calc.prototype.openMenu = function (id, target, opts) {
    this.push(new MenuApp(this, id, target || this.editorApp(), opts));
  };
  /** The screen a menu pastes into: the top one if it takes typing, else the home screen. */
  Calc.prototype.editorApp = function () {
    const t = this.top();
    return t && t.editor && t.editor() ? t : this.home;
  };

  /** Type a key into an entry line. Returns true if it was an entry-line key. */
  Calc.prototype.typeInto = function (ed, code) {
    if (!ed) return false;
    ed.mathprint = this.st.mode.mathprint && ed.mathprint !== false;
    if (code === 'left') { ed.left(); return true; }
    if (code === 'right') { ed.right(); return true; }
    if (code === 'del') { ed.del(); return true; }
    if (code === 'bs') { ed.backspace(); return true; }
    if (code === 'ins') { ed.overwrite = !ed.overwrite; return true; }
    if (code === 'pow') { ed.insertTpl('pow'); return true; }
    if (code === 'sqrt') { ed.insertTpl('sqrt'); return true; }
    if (code === 'tenx') { if (ed.mathprint) { ed.insertTok('1'); ed.insertTok('0'); ed.insertTpl('pow'); } else ed.insertTok('10^('); return true; }
    if (code === 'ex') { if (ed.mathprint) { ed.insertTok('e'); ed.insertTpl('pow'); } else ed.insertTok('e^('); return true; }
    if (code === 'xt') {
      const g = this.st.mode.graph;
      ed.insertTok(g === 'par' ? 'T' : g === 'pol' ? 'θ' : g === 'seq' ? 'n' : 'X');
      return true;
    }
    if (code.indexOf('tok:') === 0) { ed.insertTok(code.slice(4)); return true; }
    if (code.indexOf('a:') === 0) { ed.insertTok(code.slice(2)); return true; }
    if (TYPES[code] != null) { ed.insertTok(TYPES[code]); return true; }
    return false;
  };
  /**
   * How many rows a list on the screen shows: base on the handheld's 4:3 screen, more when the
   * screen is taller (beside the keys on a laptop), so menus fill it instead of scrolling.
   */
  Calc.prototype.rows = function (base) {
    const s = this.scr && this.scr.closest('.t84-screen');
    if (!s || !s.clientWidth) return base;
    // A row is about one line of screen text (4.9% of the width at 1.3 line height), a little less to fill the screen.
    const extra = Math.floor((s.clientHeight - s.clientWidth * 0.75) / (s.clientWidth * 0.06));
    return extra > 0 ? base + extra : base;
  };
  /** Paste a menu item into an entry line. */
  Calc.prototype.insertItem = function (ed, item) {
    ed.mathprint = this.st.mode.mathprint && ed.mathprint !== false;
    // nPr/nCr: a number just typed becomes the first box (6 then nCr gives ₆C□); after anything else
    // that is a value, e.g. ")", they stay infix.
    if (item.tpl === 'npr' || item.tpl === 'ncr') {
      if (ed.mathprint && ed.takeNumber) {
        const num = ed.takeNumber();
        if (num.length) { ed.insertTpl(item.tpl, [num, []], 1); return; }
      }
      if (ed.afterValue()) { ed.insertCode(item.ins); return; }
    }
    // A function of two or more arguments gets a box for each, as MathPrint does: randInt(□,□).
    const ar = !item.tpl && ed.mathprint && window.FluxTI && window.FluxTI.FN_ARITY[item.ins];
    if (ar && ar[1] >= 2 && ed.insertFn) { ed.insertFn(item.ins, Math.max(ar[0], 2)); return; }
    if (item.tpl && ed.mathprint) {
      if (item.tpl === 'exp') { ed.insertTok('e'); ed.insertTpl('pow'); return; }
      const pre = item.pre ? [Ed().nodesFromCode(item.pre)] : null;
      ed.insertTpl(item.tpl, pre);
      return;
    }
    ed.insertCode(item.ins);
  };
  /** A chosen menu item: paste it, open its submenu, or do its action. */
  Calc.prototype.useItem = function (item, target) {
    if (item.sub) { this.push(new MenuApp(this, item.sub, target)); return; }
    if (item.act && !(item.ins && target !== this.home && target && target.editor && target.editor())) { this.action(item.act, target, item); return; }
    const A = window.FluxTIApps;
    if (item.wiz && target === this.home && this.st.ui.wizards !== false && A && A.wizard(this, item.wiz)) return;
    const ed = target && target.editor ? target.editor() : null;
    if (!ed || item.ins == null) return;
    if (target === this.home && ed.isEmpty() && ANS_FIRST_CODES.has(item.ins) && !((item.tpl === 'npr' || item.tpl === 'ncr') && this.st.mode.mathprint)) ed.insertTok('Ans');
    this.insertItem(ed, item);
  };
  Calc.prototype.action = function (act, target, item) {
    const i = act.indexOf(':');
    const name = i < 0 ? act : act.slice(0, i), arg = i < 0 ? '' : act.slice(i + 1);
    const G = window.FluxTIGraph, A = window.FluxTIApps, P = window.FluxTIPrgm;
    switch (name) {
      case 'solver': this.push(new SolverApp(this)); return;
      case 'listEditor': this.push(new ListEditApp(this)); return;
      case 'editMat': this.push(new MatEditApp(this, arg)); return;
      case 'test': if (A) A.test(this, arg); return;
      case 'tvm': if (A) A.tvm(this); return;
      case 'plysmlt': if (A) A.plysmlt(this); return;
      case 'zoom': if (G) G.zoom(this, arg, target === this.home && item && item.ins ? item.ins : null); return;
      case 'gcalc': if (G) G.graph(this, { calc: arg }); return;
      case 'prgmNew': if (P) P.create(this); return;
      case 'runPrgm': if (P) P.pasteRun(this, arg); return;
      case 'editPrgm': if (P) P.edit(this, arg); return;
      case 'about': this.push(new ReportApp(this, 'ABOUT', [
        ['Flux·84 Plus CE', ''], ['A TI-84 Plus CE-style calculator', ''], ['inside Flux Planner.', ''], ['', ''],
        ['Works to 14 digits, shows 10.', ''], ['Memory is saved in this browser.', ''],
      ])); return;
      case 'memmgmt': this.push(new MemApp(this)); return;
      case 'clearEntries': this.st.ui.history.forEach((h) => { h.in = null; }); this.st.ui.history = this.st.ui.history.filter((h) => h.out || h.report); this.home.back = 0; this.quit(); return;
      case 'resetAll': this.push(new ConfirmApp(this, 'RESET ALL RAM?', 'Erases every variable, list, matrix and program.', () => {
        this.st = T().freshState(); this.st.ui = freshUI(); this.home = new Home(this); this.stack = [this.home];
        this.home.msg = 'RAM cleared';
      })); return;
      case 'resetDefaults': this.push(new ConfirmApp(this, 'RESET DEFAULTS?', 'Mode, window and format go back to how they came.', () => {
        const f = T().freshState();
        this.st.mode = f.mode; this.st.win = f.win; this.st.tbl = f.tbl; this.st.ui.fmt = freshUI().fmt;
        this.quit(); this.home.msg = 'Defaults set';
      })); return;
      default:
    }
  };

  /** ERR: screen, as the calculator shows it: 1:Quit, 2:Goto. */
  Calc.prototype.error = function (kind, onGoto) { this.push(new ErrApp(this, kind, onGoto)); };

  /** Hooks the engine calls for commands that touch the screen. */
  Calc.prototype.hooks = function () {
    const self = this;
    return {
      clrHome: () => { self.st.ui.history = []; },
      command: (name, args, cx) => {
        const G = window.FluxTIGraph;
        if (G && G.command) return G.command(self, name, args, cx);
        return { done: true };
      },
      getKey: () => (self.runner ? self.runner.takeKey() : 0),
    };
  };

  Calc.prototype.statusText = function () {
    const m = this.st.mode;
    return [
      m.notation.toUpperCase(),
      m.digits === 'float' ? 'FLOAT' : 'FIX' + m.digits,
      m.answers === 'auto' ? 'AUTO' : m.answers === 'dec' ? 'DEC' : 'FRAC',
      m.complex === 'real' ? 'REAL' : m.complex === 'a+bi' ? 'a+bi' : 're^θi',
      m.angle === 'deg' ? 'DEGREE' : 'RADIAN',
      m.mathprint ? 'MP' : 'CL',
    ].join(' ');
  };
  Calc.prototype.renderStatus = function () {
    const mod = this.alock ? 'A-LOCK' : this.mod === '2nd' ? '2ND' : this.mod === 'alpha' ? 'ALPHA' : '';
    this.status.innerHTML = '<span class="t84-status-mode">' + esc(this.statusText()) + '</span>'
      + (mod ? '<span class="t84-status-mod t84-status-mod--' + (this.mod === '2nd' ? 'second' : 'alpha') + '">' + mod + '</span>' : '')
      + '<span class="t84-status-bat" aria-hidden="true"></span>';
  };
  Calc.prototype.cursorMark = function () {
    if (this.mod === '2nd') return '2';
    if (this.mod === 'alpha') return 'A';
    return '';
  };
  Calc.prototype.render = function () {
    this.renderStatus();
    const app = this.top();
    const html = app.render();
    if (html != null) this.scr.innerHTML = html;
    if (app.after) app.after(this.scr);
    this.el.classList.toggle('is-second', this.mod === '2nd');
    this.el.classList.toggle('is-alpha', this.mod === 'alpha');
  };
  Calc.prototype.destroy = function () {
    clearTimeout(this.saveTimer);
    try {
      const st = this.st;
      localStorage.setItem(STORE, JSON.stringify(Object.assign({}, st, { ui: Object.assign({}, st.ui, { history: st.ui.history.slice(-HISTORY_MAX) }) })));
    } catch (e) { /* ignore */ }
    if (this.runner) this.runner.stop();
    this.stack.forEach((a) => { if (a.onHide) a.onHide(); });
    this.host.innerHTML = '';
  };

  /* ── Showing values ─────────────────────────────────────────────────── */

  /** HTML for an engine display object ({ k: 'num' | 'frac' | 'list' | 'mat' | 'str' }). */
  function outHTML(d, mathprint) {
    switch (d.k) {
      case 'num': return '<span class="t84t">' + esc(d.text) + '</span>';
      case 'str': return '<span class="t84t t84t--str">' + esc(d.text) + '</span>';
      case 'done': return '<span class="t84t">Done</span>';
      case 'frac': {
        const sign = d.neg ? '<span class="t84t">⁻</span>' : '';
        const whole = d.whole ? '<span class="t84t">' + d.whole + '</span>' : '';
        if (!mathprint) return sign + '<span class="t84t">' + (d.whole ? d.whole + '⁺' : '') + d.p + '/' + d.q + '</span>';
        return sign + whole + '<span class="t84fr"><span class="t84fr-n"><span class="t84t">' + d.p + '</span></span><span class="t84fr-d"><span class="t84t">' + d.q + '</span></span></span>';
      }
      case 'list': return '<span class="t84t">{</span>' + d.items.map((x) => outHTML(x, mathprint)).join('<span class="t84t"> </span>') + '<span class="t84t">}</span>';
      case 'mat': return '<span class="t84mat"><span class="t84mat-g" style="grid-template-columns:repeat(' + d.rows[0].length + ',auto)">'
        + d.rows.map((r) => r.map((x) => '<span class="t84mat-c">' + outHTML(x, mathprint) + '</span>').join('')).join('') + '</span></span>';
      default: return '';
    }
  }
  /** A display object as the tokens that would type it (pasting an answer from the history). */
  function outNodes(d) {
    const E = Ed();
    switch (d.k) {
      case 'num': return E.nodesFromCode(d.text);
      case 'str': return E.nodesFromCode('"' + d.text + '"');
      case 'frac': {
        const n = [];
        if (d.neg) n.push(E.tok('⁻'));
        if (d.whole) n.push({ t: 'mixed', b: [E.nodesFromCode(String(d.whole)), E.nodesFromCode(String(d.p)), E.nodesFromCode(String(d.q))] });
        else n.push({ t: 'frac', b: [E.nodesFromCode(String(d.p)), E.nodesFromCode(String(d.q))] });
        return n;
      }
      case 'list': {
        const out = [E.tok('{')];
        d.items.forEach((x, i) => { if (i) out.push(E.tok(',')); outNodes(x).forEach((y) => out.push(y)); });
        out.push(E.tok('}'));
        return out;
      }
      case 'mat': {
        const out = [E.tok('[')];
        d.rows.forEach((r) => {
          out.push(E.tok('['));
          r.forEach((x, i) => { if (i) out.push(E.tok(',')); outNodes(x).forEach((y) => out.push(y)); });
          out.push(E.tok(']'));
        });
        out.push(E.tok(']'));
        return out;
      }
      default: return [];
    }
  }
  function fmt(v, mode) {
    if (v == null || (typeof v === 'number' && !Number.isFinite(v))) return 'undef';
    if (typeof v === 'string') return v;
    return T().textOf(v, mode);
  }

  /* ── Home screen ────────────────────────────────────────────────────── */

  function Home(c) {
    this.c = c;
    this.ed = new (Ed())({ mathprint: c.st.mode.mathprint });
    this.sel = -1;        // selected history item while scrolling back with ↑
    this.back = 0;        // how far 2nd ENTRY has gone back
    this.msg = '';
  }
  Home.prototype.editor = function () { return this.sel < 0 ? this.ed : null; };
  /** Every selectable thing in the history, oldest first. */
  Home.prototype.items = function () {
    const out = [];
    this.c.st.ui.history.forEach((h, i) => {
      if (h.in) out.push({ i: i, part: 'in' });
      if (h.out && h.out.k !== 'done') out.push({ i: i, part: 'out' });
    });
    return out;
  };
  Home.prototype.key = function (k) {
    const c = this.c, ed = this.ed;
    this.msg = '';
    if (this.sel >= 0) {
      const items = this.items();
      if (k === 'up') { this.sel = Math.max(0, this.sel - 1); return true; }
      if (k === 'down') { this.sel += 1; if (this.sel >= items.length) this.sel = -1; return true; }
      if (k === 'enter') {
        const it = items[this.sel];
        const h = c.st.ui.history[it.i];
        this.sel = -1;
        if (it.part === 'in') ed.insertNodes(h.in); else ed.insertNodes(outNodes(h.out));
        return true;
      }
      if (k === 'clear' || k === 'quit') { this.sel = -1; return true; }
      this.sel = -1;
    }
    if (k === 'enter') { this.exec(); return true; }
    if (k === 'clear') {
      if (ed.isEmpty()) c.st.ui.history = []; else ed.clear();
      this.back = 0;
      return true;
    }
    if (k === 'up') {
      if (ed.vertical('up')) return true;
      const items = this.items();
      if (items.length) this.sel = items.length - 1;
      return true;
    }
    if (k === 'down') { ed.vertical('down'); return true; }
    if (k === 'entry') {
      const ins = c.st.ui.history.filter((h) => h.in);
      if (!ins.length) return true;
      this.back = (this.back % ins.length) + 1;
      ed.load(ins[ins.length - this.back].in);
      return true;
    }
    if (k === 'rcl') { c.push(new RclApp(c, this)); return true; }
    if (k === 'solve' || k === 'on' || k === 'off' || k === 'link') return true;
    if (ed.isEmpty() && ed.atTop() && ANS_FIRST.has(k)) ed.insertTok('Ans');
    return c.typeInto(ed, k);
  };
  Home.prototype.exec = function () {
    const c = this.c, h = c.st.ui.history;
    let nodes = this.ed.snapshot();
    // ENTER on an empty line runs the last entry again, as on the calculator.
    if (!nodes.length) {
      const last = h.slice().reverse().find((e) => e.in);
      if (!last) return;
      nodes = last.in;
    }
    const code = Ed().serializeNodes(nodes);
    const P = window.FluxTIPrgm;
    const prg = /^prgm([A-Zθ][A-Z0-9θ]{0,7})$/.exec(code.trim());
    if (prg && P) { this.ed.clear(); P.run(c, prg[1], nodes); return; }
    const entry = { in: nodes };
    try {
      const r = T().run(code, c.st, c.hooks());
      if (r && r.clear) { c.st.ui.history = []; this.ed.clear(); return; }
      if (r && r.report) entry.report = r.report;
      else if (r && r.value !== undefined) entry.out = T().display(r.value, c.st.mode, { conv: r.conv, fracInput: Ed().hasFraction(nodes) });
      else entry.out = { k: 'done' };
      h.push(entry);
      if (h.length > HISTORY_MAX * 2) h.splice(0, h.length - HISTORY_MAX * 2);
      this.ed.clear();
      this.back = 0;
      if (r && r.show) { const G = window.FluxTIGraph; if (G) (r.show === 'table' ? G.table(c) : G.graph(c)); }
    } catch (e) {
      if (!(e && e.ti)) console.error('[calculator]', e);
      const self = this;
      this.ed.clear();
      c.error(e && e.ti ? e.ti : 'INVALID', () => { self.ed.load(nodes); });
    }
  };
  Home.prototype.render = function () {
    const c = this.c, mp = c.st.mode.mathprint;
    const items = this.items();
    const selIt = this.sel >= 0 ? items[this.sel] : null;
    const E = Ed();
    let html = '<div class="t84-home"><div class="t84-hist">';
    c.st.ui.history.forEach((h, i) => {
      if (h.in) {
        const on = selIt && selIt.i === i && selIt.part === 'in';
        html += '<div class="t84h-in' + (on ? ' is-sel' : '') + '">' + (mp ? E.htmlNodes(h.in) : '<span class="t84t">' + esc(E.textNodes(h.in)) + '</span>') + '</div>';
      }
      if (h.report) {
        html += '<div class="t84h-rep"><div class="t84h-rep-t">' + esc(h.report.title) + '</div>'
          + h.report.rows.map((r) => '<div class="t84h-rep-r">' + (r[0] ? '<span>' + esc(r[0]) + '=</span>' : '') + '<span>' + esc(fmt(r[1], c.st.mode)) + '</span></div>').join('') + '</div>';
      }
      // A program's screen comes before its Done.
      if (h.lines) {
        html += h.lines.map((l) => {
          if (typeof l === 'string') return '<div class="t84h-line">' + esc(l) + '</div>';
          if (l.k) return '<div class="t84h-line">' + outHTML(l, mp) + '</div>';
          return '<div class="t84h-line' + (l.r ? ' is-right' : '') + '">' + esc(l.t) + '</div>';
        }).join('');
      }
      if (h.out) {
        const on = selIt && selIt.i === i && selIt.part === 'out';
        html += '<div class="t84h-out' + (on ? ' is-sel' : '') + '">' + outHTML(h.out, mp) + '</div>';
      }
    });
    if (this.msg) html += '<div class="t84h-out"><span class="t84t">' + esc(this.msg) + '</span></div>';
    html += '</div><div class="t84-entry' + (this.sel >= 0 ? ' is-dim' : '') + (mp ? '' : ' is-classic') + '">'
      + this.ed.html(c.cursorMark(), this.sel < 0) + '</div></div>';
    return html;
  };
  Home.prototype.after = function (scr) {
    const box = scr.querySelector('.t84-home');
    if (!box) return;
    const sel = scr.querySelector('.is-sel');
    if (sel) sel.scrollIntoView({ block: 'nearest' });
    else box.scrollTop = box.scrollHeight;
  };

  /* ── Error screen ───────────────────────────────────────────────────── */

  const ERR_TEXT = {
    SYNTAX: 'Something in the entry is not written the way the calculator reads it.', DOMAIN: 'A value is outside what the function accepts.',
    'DIVIDE BY 0': 'Division by zero.', 'DIM MISMATCH': 'The lists or matrices are different sizes.',
    'INVALID DIM': 'That size or position is not valid.', 'DATA TYPE': 'That kind of value is not allowed here.',
    UNDEFINED: 'That has not been defined yet.', 'NONREAL ANSWERS': 'The answer is complex. Choose a+bi in MODE to see it.',
    OVERFLOW: 'The result is too large (1ᴇ100 or more).', ARGUMENT: 'The function has the wrong number of arguments.',
    'SINGULAR MAT': 'The matrix has no inverse.', STAT: 'Not enough data for this statistic.',
    'NO SIGN CHANGE': 'No solution was found in the interval.', 'TOL NOT MET': 'The accuracy asked for could not be reached.',
    INVALID: 'That cannot be done here.', INCREMENT: 'The step is zero or goes the wrong way.', LABEL: 'That label is not in the program.',
    MEMORY: 'Too many nested calls.', BREAK: 'The program was stopped.', 'WINDOW RANGE': 'Xmin must be less than Xmax, and Ymin less than Ymax.',
  };
  function ErrApp(c, kind, onGoto) { this.c = c; this.kind = kind; this.onGoto = onGoto; this.sel = 0; }
  ErrApp.prototype.render = function () {
    const opts = ['Quit'].concat(this.onGoto ? ['Goto'] : []);
    return '<div class="t84-err"><div class="t84-err-t">ERROR: ' + esc(this.kind) + '</div>'
      + '<div class="t84-err-d">' + esc(ERR_TEXT[this.kind] || '') + '</div>'
      + opts.map((o, i) => '<div class="t84m-i' + (i === this.sel ? ' is-sel' : '') + '"><span class="t84m-k">' + (i + 1) + ':</span>' + o + '</div>').join('')
      + '</div>';
  };
  ErrApp.prototype.key = function (k) {
    const n = this.onGoto ? 2 : 1;
    if (k === 'up' || k === 'down') { this.sel = (this.sel + (k === 'up' ? n - 1 : 1)) % n; return true; }
    let pick = null;
    if (k === '1') pick = 0;
    else if (k === '2' && this.onGoto) pick = 1;
    else if (k === 'enter') pick = this.sel;
    else if (k === 'clear' || k === 'quit') pick = 0;
    if (pick == null) return true;
    this.c.pop();
    if (pick === 1 && this.onGoto) this.onGoto();
    return true;
  };

  /* ── Menus ──────────────────────────────────────────────────────────── */

  const MENU_ROWS = 8;
  function MenuApp(c, id, target, opts) {
    this.c = c;
    this.id = id;
    this.target = target;
    this.tabs = (MN().MENUS[id] || []).map((t) => ({ name: t.name, items: t.dyn ? dynItems(c, t.dyn) : t.items }));
    this.tab = (opts && opts.tab) || 0;
    this.sel = 0;
    this.top0 = 0;
  }
  /** Menus whose items depend on what is stored: list names, matrices, programs. */
  function dynItems(c, which) {
    const st = c.st;
    const P = Object.keys(st.ui.prgms).sort();
    switch (which) {
      case 'listNames': return Object.keys(st.lists).sort((a, b) => ((a[0] === 'L') !== (b[0] === 'L') ? (a[0] === 'L' ? -1 : 1) : a < b ? -1 : 1)).map((n) => ({ l: n, ins: n }));
      case 'matNames': return MN().MATS.map((m) => { const M = st.mats[m]; return { l: '[' + m + ']' + (M ? '  ' + M.length + '×' + M[0].length : ''), ins: '⟦' + m + '⟧' }; });
      case 'matEdit': return MN().MATS.map((m) => { const M = st.mats[m]; return { l: '[' + m + ']' + (M ? '  ' + M.length + '×' + M[0].length : ''), act: 'editMat:' + m }; });
      case 'prgmExec': return P.map((n) => ({ l: n, act: 'runPrgm:' + n }));
      case 'prgmEdit': return P.map((n) => ({ l: n, act: 'editPrgm:' + n }));
      case 'prgmCall': return P.map((n) => ({ l: n, ins: 'prgm' + n }));
      default: return [];
    }
  }
  MenuApp.prototype.items = function () { return (this.tabs[this.tab] && this.tabs[this.tab].items) || []; };
  MenuApp.prototype.render = function () {
    const items = this.items();
    const MR = this.c.rows(MENU_ROWS);
    if (this.sel < this.top0) this.top0 = this.sel;
    if (this.sel >= this.top0 + MR) this.top0 = this.sel - MR + 1;
    let html = '<div class="t84m"><div class="t84m-tabs">'
      + this.tabs.map((t, i) => '<span class="t84m-tab' + (i === this.tab ? ' is-on' : '') + '">' + esc(t.name) + '</span>').join('') + '</div>';
    if (!items.length) html += '<div class="t84m-none">' + (/PRGM/.test(this.id) ? 'No programs yet — NEW ▸ Create New' : 'Empty') + '</div>';
    items.slice(this.top0, this.top0 + MR).forEach((it, j) => {
      const i = this.top0 + j;
      const more = j === MR - 1 && this.top0 + MR < items.length;
      const fewer = j === 0 && this.top0 > 0;
      html += '<div class="t84m-i' + (i === this.sel ? ' is-sel' : '') + '"><span class="t84m-k">' + MN().itemKey(i)
        + (more ? '↓' : fewer ? '↑' : ':') + '</span>' + esc(it.l) + '</div>';
    });
    return html + '</div>';
  };
  MenuApp.prototype.key = function (k) {
    const items = this.items();
    if (k === 'left' || k === 'right') {
      if (this.tabs.length > 1) { this.tab = (this.tab + (k === 'left' ? this.tabs.length - 1 : 1)) % this.tabs.length; this.sel = 0; this.top0 = 0; }
      return true;
    }
    if (k === 'up') { if (items.length) this.sel = (this.sel + items.length - 1) % items.length; return true; }
    if (k === 'down') { if (items.length) this.sel = (this.sel + 1) % items.length; return true; }
    if (k === 'clear' || k === 'quit') { this.c.pop(); return true; }
    let idx = null;
    if (/^[0-9]$/.test(k)) idx = k === '0' ? 9 : Number(k) - 1;
    else if (/^a:[A-Z]$/.test(k)) idx = 10 + k.charCodeAt(2) - 65;
    else if (k === 'enter') idx = this.sel;
    if (idx == null) {
      // Another menu key: close this one and open that, as on the calculator.
      if (MENU_KEYS.test(k)) { this.c.pop(); this.c.dispatch(k); }
      return true;
    }
    const it = items[idx];
    if (!it) return true;
    this.c.pop();
    this.c.useItem(it, this.target);
    return true;
  };

  /* ── CATALOG ────────────────────────────────────────────────────────── */

  function CatalogApp(c, target) { this.c = c; this.target = target; this.list = MN().catalog(); this.sel = 0; this.top0 = 0; }
  CatalogApp.prototype.render = function () {
    const MR = this.c.rows(MENU_ROWS);
    if (this.sel < this.top0) this.top0 = this.sel;
    if (this.sel >= this.top0 + MR) this.top0 = this.sel - MR + 1;
    return '<div class="t84m"><div class="t84m-tabs"><span class="t84m-tab is-on">CATALOG</span><span class="t84m-hint">letter keys jump</span></div>'
      + this.list.slice(this.top0, this.top0 + MR).map((it, j) => '<div class="t84m-i' + (this.top0 + j === this.sel ? ' is-sel' : '') + '"><span class="t84m-k">▸</span>' + esc(it.l) + '</div>').join('')
      + '</div>';
  };
  CatalogApp.prototype.key = function (k) {
    const n = this.list.length;
    if (k === 'up') { this.sel = (this.sel + n - 1) % n; return true; }
    if (k === 'down') { this.sel = (this.sel + 1) % n; return true; }
    if (k === 'clear' || k === 'quit') { this.c.pop(); return true; }
    if (k === 'enter') { const it = this.list[this.sel]; this.c.pop(); this.c.useItem(it, this.target); return true; }
    // In CATALOG the keys type letters without ALPHA, as on the calculator.
    let letter = null;
    if (/^a:[A-Zθ]$/.test(k)) letter = k.slice(2);
    else if (ALPHA[k] && /^[A-Z]$/.test(ALPHA[k])) letter = ALPHA[k];
    if (letter) {
      const i = this.list.findIndex((it) => it.l.replace(/^[^A-Za-z0-9]+/, '').toUpperCase().startsWith(letter));
      if (i >= 0) { this.sel = i; this.top0 = i; }
    }
    return true;
  };

  /* ── MODE ───────────────────────────────────────────────────────────── */

  function ModeApp(c) { this.c = c; this.row = 0; this.col = 0; }
  ModeApp.prototype.rows = function () {
    const st = this.c.st;
    const digits = [['FLOAT', 'float']];
    for (let d = 0; d <= 9; d++) digits.push([String(d), d]);
    return [
      { get: () => st.mode.mathprint, set: (v) => { st.mode.mathprint = v; }, opts: [['MATHPRINT', true], ['CLASSIC', false]] },
      { get: () => st.mode.notation, set: (v) => { st.mode.notation = v; }, opts: [['NORMAL', 'normal'], ['SCI', 'sci'], ['ENG', 'eng']] },
      { get: () => st.mode.digits, set: (v) => { st.mode.digits = v; }, opts: digits },
      { get: () => st.mode.angle, set: (v) => { st.mode.angle = v; }, opts: [['RADIAN', 'rad'], ['DEGREE', 'deg']] },
      { get: () => st.mode.graph, set: (v) => { st.mode.graph = v; }, opts: [['FUNCTION', 'func'], ['PARAMETRIC', 'par'], ['POLAR', 'pol']] },
      { get: () => st.ui.fmt.thick, set: (v) => { st.ui.fmt.thick = v; }, opts: [['THICK', true], ['THIN', false]] },
      { get: () => st.mode.complex, set: (v) => { st.mode.complex = v; }, opts: [['REAL', 'real'], ['a+bi', 'a+bi'], ['re^(θi)', 're^θi']] },
      { label: 'FRACTION TYPE:', get: () => st.mode.fracType, set: (v) => { st.mode.fracType = v; }, opts: [['n/d', 'n/d'], ['Un/d', 'Un/d']] },
      { label: 'ANSWERS:', get: () => st.mode.answers, set: (v) => { st.mode.answers = v; }, opts: [['AUTO', 'auto'], ['DEC', 'dec'], ['FRAC-APPROX', 'frac']] },
      { label: 'STAT DIAGNOSTICS:', get: () => st.mode.statDiag, set: (v) => { st.mode.statDiag = v; }, opts: [['OFF', false], ['ON', true]] },
      { label: 'STAT WIZARDS:', get: () => st.ui.wizards !== false, set: (v) => { st.ui.wizards = v; }, opts: [['ON', true], ['OFF', false]] },
    ];
  };
  ModeApp.prototype.render = function () {
    const rows = this.rows();
    return '<div class="t84-mode">' + rows.map((r, ri) => '<div class="t84-mode-r' + (ri === this.row ? ' is-row' : '') + '">'
      + (r.label ? '<span class="t84-mode-l">' + esc(r.label) + '</span>' : '')
      + r.opts.map((o, oi) => '<span class="t84-mode-o' + (r.get() === o[1] ? ' is-set' : '') + (ri === this.row && oi === this.col ? ' is-cur' : '') + '">' + esc(o[0]) + '</span>').join('')
      + '</div>').join('') + '</div>';
  };
  ModeApp.prototype.key = function (k) {
    const rows = this.rows();
    const r = rows[this.row];
    if (k === 'up') { this.row = (this.row + rows.length - 1) % rows.length; this.col = Math.min(this.col, rows[this.row].opts.length - 1); return true; }
    if (k === 'down') { this.row = (this.row + 1) % rows.length; this.col = Math.min(this.col, rows[this.row].opts.length - 1); return true; }
    if (k === 'left') { this.col = (this.col + r.opts.length - 1) % r.opts.length; return true; }
    if (k === 'right') { this.col = (this.col + 1) % r.opts.length; return true; }
    if (k === 'enter') { r.set(r.opts[this.col][1]); this.c.home.ed.mathprint = this.c.st.mode.mathprint; return true; }
    if (k === 'clear' || k === 'mode') { this.c.pop(); return true; }
    return false;
  };

  /* ── Forms: a list of fields, used by WINDOW, the tests, the apps ───── */

  /**
   * rows: { label, type: 'num'|'expr'|'list'|'choice'|'action'|'text', get(), set(v), opts: [[label, value]], run(), solve() }
   * opts.title, opts.onClose, opts.footer
   */
  function FormApp(c, rows, opts) {
    this.c = c;
    this.rowsSpec = rows;
    this.o = opts || {};
    this.row = this.firstRow();
    this.col = 0;
    this.ed = null;          // the field being edited
    this.top0 = 0;
    this.syncCol();
  }
  FormApp.prototype.rows = function () { return typeof this.rowsSpec === 'function' ? this.rowsSpec() : this.rowsSpec; };
  FormApp.prototype.firstRow = function () { const r = this.rows(); const i = r.findIndex((x) => x.type !== 'text'); return i < 0 ? 0 : i; };
  FormApp.prototype.syncCol = function () {
    const r = this.rows()[this.row];
    if (r && r.type === 'choice') { const cur = r.opts.findIndex((o) => o[1] === r.get()); this.col = cur < 0 ? 0 : cur; } else this.col = 0;
  };
  FormApp.prototype.editor = function () {
    const r = this.rows()[this.row];
    if (!r || !/^(num|expr|list)$/.test(r.type)) return null;
    if (!this.ed) this.startEdit(false);
    return this.ed;
  };
  FormApp.prototype.startEdit = function (keep) {
    const r = this.rows()[this.row];
    this.ed = new (Ed())({ mathprint: this.c.st.mode.mathprint && r.type === 'expr' });
    if (keep) {
      const v = r.get();
      if (r.type === 'expr') this.ed.load(r.nodes ? r.nodes() : Ed().nodesFromCode(v || ''));
      else if (r.type === 'list') this.ed.load(Ed().nodesFromCode(v || ''));
      else if (v != null && v !== '' && typeof v === 'number') this.ed.load(Ed().nodesFromCode(T().numCode(v)));
    }
  };
  /** Store what is being typed into the field. Throws the engine's errors. */
  FormApp.prototype.commit = function () {
    if (!this.ed) return;
    const r = this.rows()[this.row];
    const code = this.ed.serialize();
    const nodes = this.ed.snapshot();
    this.ed = null;
    if (!code.trim()) {
      // An optional list (a Freq list) can be emptied again; anything else keeps its value.
      if (r.type === 'list' && r.optional) r.set('');
      return;
    }
    if (r.type === 'num') {
      const v = T().evaluate(code, this.c.st);
      if (typeof v !== 'number') T().fail('DATA TYPE');
      r.set(v);
    } else if (r.type === 'list') {
      const c2 = code.trim();
      // Freq:1 means every value counts once — the same as no frequency list.
      if (r.optional && c2 === '1') { r.set(''); return; }
      if (!/^(L[₁-₆]|ʟ[A-Zθ][A-Z0-9θ]{0,4}|[A-Zθ][A-Z0-9θ]{0,4})$/.test(c2)) T().fail('DATA TYPE');
      // A bare name typed with alpha is a custom list: ʟNAME.
      r.set(/^[A-Zθ]/.test(c2) ? 'ʟ' + c2 : c2);
    } else r.set(code, nodes);
  };
  FormApp.prototype.move = function (d) {
    const rows = this.rows();
    this.commit();
    let i = this.row;
    for (let n = 0; n < rows.length; n++) {
      i = (i + d + rows.length) % rows.length;
      if (rows[i].type !== 'text') break;
    }
    this.row = i;
    this.syncCol();
  };
  FormApp.prototype.key = function (k) {
    const rows = this.rows();
    const r = rows[this.row];
    if (!r) return false;
    if (k === 'up') { if (this.ed && this.ed.vertical('up')) return true; this.move(-1); return true; }
    if (k === 'down') { if (this.ed && this.ed.vertical('down')) return true; this.move(1); return true; }
    if (k === 'quit') { this.ed = null; if (this.o.onClose) this.o.onClose(); this.c.pop(); return true; }
    if (k === 'solve') { this.commit(); if (r.solve) r.solve(); return true; }
    if (r.type === 'choice') {
      if (k === 'left') { this.col = (this.col + r.opts.length - 1) % r.opts.length; return true; }
      if (k === 'right') { this.col = (this.col + 1) % r.opts.length; return true; }
      if (k === 'enter') { r.set(r.opts[this.col][1]); return true; }
      if (k === 'clear') { if (this.o.onClose) this.o.onClose(); this.c.pop(); return true; }
      return false;
    }
    if (r.type === 'action') {
      if (k === 'enter') { r.run(); return true; }
      if (k === 'clear') { if (this.o.onClose) this.o.onClose(); this.c.pop(); return true; }
      return false;
    }
    if (/^(num|expr|list)$/.test(r.type)) {
      if (k === 'enter') { this.commit(); if (r.enter) r.enter(); else this.move(1); return true; }
      if (k === 'clear') {
        if (!this.ed && this.o.clearCloses) { if (this.o.onClose) this.o.onClose(); this.c.pop(); return true; }
        this.startEdit(false);
        return true;
      }
      if (!this.ed) {
        // Moving along a stored value starts editing it; typing replaces it.
        if (k === 'left' || k === 'right' || k === 'del' || k === 'bs' || k === 'ins') this.startEdit(true);
        else if (!MENU_KEYS.test(k)) this.startEdit(false);
      }
      if (this.ed && this.c.typeInto(this.ed, k)) return true;
    }
    return false;
  };
  FormApp.prototype.render = function () {
    const rows = this.rows();
    const mark = this.c.cursorMark();
    const VISIBLE = this.c.rows(this.o.title ? 8 : 9);
    if (this.row < this.top0) this.top0 = this.row;
    if (this.row >= this.top0 + VISIBLE) this.top0 = this.row - VISIBLE + 1;
    const cursor = '<span class="t84c' + (mark ? ' t84c--' + (mark === '2' ? 'second' : 'alpha') : '') + '">' + esc(mark) + '</span>';
    let html = '<div class="t84f">' + (this.o.title ? '<div class="t84f-title">' + esc(this.o.title) + '</div>' : '');
    rows.slice(this.top0, this.top0 + VISIBLE).forEach((r, j) => {
      const i = this.top0 + j, on = i === this.row;
      html += '<div class="t84f-r t84f-r--' + r.type + (on ? ' is-row' : '') + '">';
      if (r.label) html += '<span class="t84f-l">' + esc(r.label) + '</span>';
      if (r.type === 'choice') {
        html += r.opts.map((o, oi) => '<span class="t84f-o' + (r.get() === o[1] ? ' is-set' : '') + (on && oi === this.col ? ' is-cur' : '') + '">' + esc(o[0]) + '</span>').join('');
      } else if (r.type === 'action') {
        html += '<span class="t84f-act' + (on ? ' is-cur' : '') + '">' + esc(r.text || 'Calculate') + '</span>';
      } else if (r.type === 'text') {
        html += '<span class="t84f-txt">' + esc(typeof r.text === 'function' ? r.text() : r.text || '') + '</span>';
      } else if (on && this.ed) {
        html += '<span class="t84f-v t84f-v--edit">' + this.ed.html(mark) + '</span>';
      } else {
        const v = r.get();
        let inner;
        if (r.type === 'expr' && r.nodes) inner = Ed().htmlNodes(r.nodes());
        else if (r.type === 'num') inner = esc(v == null || v === '' ? '' : fmt(v, this.c.st.mode));
        else inner = esc(v || '');
        html += '<span class="t84f-v' + (on ? ' is-cur' : '') + '">' + inner + (on ? cursor : '') + '</span>';
      }
      html += '</div>';
    });
    if (this.o.footer) html += '<div class="t84f-foot">' + esc(this.o.footer) + '</div>';
    return html + '</div>';
  };

  /** Results the way the calculator lists them: a title, then name=value lines. */
  function ReportApp(c, title, rows, opts) { this.c = c; this.title = title; this.rowsData = rows; this.o = opts || {}; this.top0 = 0; }
  ReportApp.prototype.render = function () {
    const VIS = this.c.rows(9);
    const rows = this.rowsData;
    return '<div class="t84r"><div class="t84f-title">' + esc(this.title) + '</div>'
      + rows.slice(this.top0, this.top0 + VIS).map((r, j) => {
        const more = j === VIS - 1 && this.top0 + VIS < rows.length;
        const v = r[1];
        const text = v === '' || v == null ? '' : typeof v === 'string' ? v : fmt(v, this.c.st.mode);
        return '<div class="t84r-r">' + (more ? '<span class="t84r-more">↓</span>' : '') + '<span class="t84r-k">' + esc(r[0]) + (text !== '' && r[0] ? '=' : '') + '</span><span class="t84r-v">' + esc(text) + '</span></div>';
      }).join('') + '</div>';
  };
  ReportApp.prototype.key = function (k) {
    if (k === 'up') { this.top0 = Math.max(0, this.top0 - 1); return true; }
    if (k === 'down') { this.top0 = Math.min(Math.max(0, this.rowsData.length - this.c.rows(9)), this.top0 + 1); return true; }
    if (k === 'clear' || k === 'quit' || k === 'enter') { this.c.pop(); if (this.o.onClose) this.o.onClose(); return true; }
    return false;
  };

  function ConfirmApp(c, title, text, onYes) { this.c = c; this.title = title; this.text = text; this.onYes = onYes; this.sel = 0; }
  ConfirmApp.prototype.render = function () {
    return '<div class="t84f"><div class="t84f-title">' + esc(this.title) + '</div><div class="t84f-txt">' + esc(this.text) + '</div>'
      + ['No', 'Yes'].map((o, i) => '<div class="t84m-i' + (i === this.sel ? ' is-sel' : '') + '"><span class="t84m-k">' + (i + 1) + ':</span>' + o + '</div>').join('') + '</div>';
  };
  ConfirmApp.prototype.key = function (k) {
    if (k === 'up' || k === 'down') { this.sel = 1 - this.sel; return true; }
    let pick = null;
    if (k === '1') pick = 0; else if (k === '2') pick = 1; else if (k === 'enter') pick = this.sel; else if (k === 'clear' || k === 'quit') pick = 0;
    if (pick == null) return true;
    this.c.pop();
    if (pick === 1) this.onYes();
    return true;
  };

  /** 2nd RCL: type a variable name, and its contents are pasted into the line. */
  function RclApp(c, home) { this.c = c; this.home = home; this.ed = new (Ed())({ mathprint: false }); }
  RclApp.prototype.editor = function () { return this.ed; };
  RclApp.prototype.render = function () {
    const base = this.home.render();
    const i = base.lastIndexOf('<div class="t84-entry');
    return base.slice(0, i) + '<div class="t84-entry">' + this.home.ed.html('', false) + '</div><div class="t84-entry t84-entry--rcl"><span class="t84t">Rcl </span>' + this.ed.html(this.c.cursorMark()) + '</div></div>';
  };
  RclApp.prototype.key = function (k) {
    if (k === 'enter') {
      const code = this.ed.serialize();
      this.c.pop();
      if (!code) return true;
      const st = this.c.st;
      if (/^Y[₀-₉]$/.test(code)) { this.home.ed.insertNodes(st.ui.ynodes[code] || Ed().nodesFromCode(st.y[code] || '')); return true; }
      const v = T().evaluate(code, st);
      this.home.ed.insertNodes(outNodes(T().display(v, st.mode)));
      return true;
    }
    if (k === 'clear' || k === 'quit') { this.c.pop(); return true; }
    return this.c.typeInto(this.ed, k) || true;
  };

  /* ── Y= editor ──────────────────────────────────────────────────────── */

  function yNames(st) {
    if (st.mode.graph === 'par') return ['X₁ᴛ', 'Y₁ᴛ', 'X₂ᴛ', 'Y₂ᴛ', 'X₃ᴛ', 'Y₃ᴛ', 'X₄ᴛ', 'Y₄ᴛ', 'X₅ᴛ', 'Y₅ᴛ', 'X₆ᴛ', 'Y₆ᴛ'];
    if (st.mode.graph === 'pol') return ['r₁', 'r₂', 'r₃', 'r₄', 'r₅', 'r₆'];
    return T().YNAMES.slice();
  }
  const STYLES = ['thick', 'thin', 'dot', 'above', 'below'];
  function YEditApp(c) {
    this.c = c;
    this.line = 1;          // 0 is the Plot row
    this.part = 'text';     // 'text' | 'eq' | 'style'
    this.plot = 0;
    this.eds = {};
    this.top0 = 0;
  }
  YEditApp.prototype.names = function () { return yNames(this.c.st); };
  YEditApp.prototype.edFor = function (name) {
    if (!this.eds[name]) {
      const st = this.c.st;
      const ed = new (Ed())({ mathprint: st.mode.mathprint });
      ed.load(st.ui.ynodes[name] || Ed().nodesFromCode(st.y[name] || ''));
      this.eds[name] = ed;
    }
    return this.eds[name];
  };
  YEditApp.prototype.editor = function () {
    if (this.line === 0) return null;
    return this.edFor(this.names()[this.line - 1]);
  };
  YEditApp.prototype.sync = function (name) {
    const ed = this.eds[name];
    if (!ed) return;
    const st = this.c.st;
    st.y[name] = ed.serialize();
    st.ui.ynodes[name] = ed.snapshot();
  };
  YEditApp.prototype.key = function (k) {
    const names = this.names(), st = this.c.st;
    const name = this.line > 0 ? names[this.line - 1] : null;
    if (k === 'up' || k === 'down') {
      const ed = name && this.part === 'text' ? this.edFor(name) : null;
      if (ed && ed.vertical(k)) return true;
      if (name) this.sync(name);
      this.line = Math.max(0, Math.min(names.length, this.line + (k === 'up' ? -1 : 1)));
      this.part = 'text';
      if (this.line > 0) this.edFor(names[this.line - 1]).end();
      return true;
    }
    if (this.line === 0) {
      if (k === 'left') { this.plot = (this.plot + 2) % 3; return true; }
      if (k === 'right') { this.plot = (this.plot + 1) % 3; return true; }
      if (k === 'enter') { st.ui.plots[this.plot].on = !st.ui.plots[this.plot].on; return true; }
      if (k === 'clear' || k === 'quit') { this.c.pop(); return true; }
      return false;
    }
    const ed = this.edFor(name);
    if (this.part === 'text') {
      if (k === 'left' && ed.atTop() && ed.cur.i === 0) { this.part = 'eq'; return true; }
      if (k === 'enter') { this.sync(name); this.line = Math.min(names.length, this.line + 1); this.edFor(names[this.line - 1]).end(); return true; }
      if (k === 'clear') { ed.clear(); this.sync(name); return true; }
      if (k === 'quit') { this.sync(name); this.c.pop(); return true; }
      if (this.c.typeInto(ed, k)) { this.sync(name); return true; }
      return false;
    }
    if (k === 'right') { this.part = this.part === 'style' ? 'eq' : 'text'; if (this.part === 'text') ed.home(); return true; }
    if (k === 'left') { this.part = 'style'; return true; }
    if (k === 'enter') {
      if (this.part === 'eq') st.ui.yOn[name] = !(st.ui.yOn[name] !== false);
      else { const s = st.ui.yStyle[name] || 'thick'; st.ui.yStyle[name] = STYLES[(STYLES.indexOf(s) + 1) % STYLES.length]; }
      return true;
    }
    if (k === 'clear' || k === 'quit') { this.c.pop(); return true; }
    // Typing on the = goes back into the line.
    if (this.c.typeInto(ed, k)) { this.part = 'text'; this.sync(name); return true; }
    return false;
  };
  YEditApp.prototype.render = function () {
    const st = this.c.st, names = this.names(), mark = this.c.cursorMark();
    const VIS = this.c.rows(8);
    if (this.line - 1 < this.top0) this.top0 = Math.max(0, this.line - 1);
    if (this.line - 1 >= this.top0 + VIS) this.top0 = this.line - VIS;
    let html = '<div class="t84y"><div class="t84y-plots' + (this.line === 0 ? ' is-row' : '') + '">'
      + [0, 1, 2].map((i) => '<span class="t84y-plot' + (st.ui.plots[i].on ? ' is-on' : '') + (this.line === 0 && this.plot === i ? ' is-cur' : '') + '">Plot' + (i + 1) + '</span>').join('')
      + '</div>';
    names.slice(this.top0, this.top0 + VIS).forEach((n, j) => {
      const li = this.top0 + j + 1;
      const on = st.ui.yOn[n] !== false;
      const colour = st.ui.yCol[n] || YCOLOURS[j % YCOLOURS.length];
      const style = st.ui.yStyle[n] || 'thick';
      const cur = this.line === li;
      html += '<div class="t84y-r' + (cur ? ' is-row' : '') + '">'
        + '<span class="t84y-style t84y-style--' + style + (cur && this.part === 'style' ? ' is-cur' : '') + '" style="--c:' + colour + '"></span>'
        + '<span class="t84y-name">' + esc(n) + '<span class="t84y-eq' + (on ? ' is-on' : '') + (cur && this.part === 'eq' ? ' is-cur' : '') + '" style="--c:' + colour + '">=</span></span>'
        + '<span class="t84y-ex">' + (cur && this.part === 'text' ? this.edFor(n).html(mark) : Ed().htmlNodes(st.ui.ynodes[n] || Ed().nodesFromCode(st.y[n] || ''))) + '</span></div>';
    });
    return html + '</div>';
  };
  YEditApp.prototype.onHide = function () { Object.keys(this.eds).forEach((n) => this.sync(n)); this.c.save(); };

  /* ── List editor (STAT ▸ EDIT) ──────────────────────────────────────── */

  function ListEditApp(c) {
    this.c = c;
    this.col = 0;
    this.row = 0;            // −1 is the header
    this.left0 = 0;
    this.top0 = 0;
    this.ed = null;
  }
  ListEditApp.prototype.cols = function () {
    const st = this.c.st;
    const std = ['L₁', 'L₂', 'L₃', 'L₄', 'L₅', 'L₆'];
    std.forEach((n) => { if (!st.lists[n]) st.lists[n] = []; });
    return std.concat(Object.keys(st.lists).filter((n) => std.indexOf(n) < 0).sort());
  };
  ListEditApp.prototype.editor = function () { return this.row >= 0 ? (this.ed || (this.ed = new (Ed())({ mathprint: false }))) : null; };
  ListEditApp.prototype.commit = function () {
    if (!this.ed) return;
    const code = this.ed.serialize();
    this.ed = null;
    if (!code.trim()) return;
    const name = this.cols()[this.col];
    const v = T().evaluate(code, this.c.st);
    if (!(typeof v === 'number' || T().isCx(v))) T().fail('DATA TYPE');
    const l = this.c.st.lists[name];
    if (this.row > l.length) this.row = l.length;
    l[this.row] = v;
  };
  ListEditApp.prototype.key = function (k) {
    const cols = this.cols(), name = cols[this.col], st = this.c.st, l = st.lists[name];
    const move = (dc, dr) => {
      this.commit();
      this.col = Math.max(0, Math.min(cols.length - 1, this.col + dc));
      const len = st.lists[cols[this.col]].length;
      this.row = Math.max(-1, Math.min(len, this.row + dr));
    };
    if (k === 'up') { move(0, -1); return true; }
    if (k === 'down') { move(0, 1); return true; }
    if (k === 'left' && !this.ed) { move(-1, 0); return true; }
    if (k === 'right' && !this.ed) { move(1, 0); return true; }
    if (k === 'enter') { if (this.ed) { this.commit(); this.row = Math.min(st.lists[name].length, this.row + 1); } return true; }
    if (k === 'quit') { this.commit(); this.c.pop(); return true; }
    if (this.row === -1) {
      if (k === 'clear') { st.lists[name] = []; return true; }
      return MENU_KEYS.test(k) ? false : true;
    }
    if ((k === 'del' || k === 'bs') && !this.ed) { if (this.row < l.length) l.splice(this.row, 1); return true; }
    if (k === 'ins' && !this.ed) { l.splice(this.row, 0, 0); return true; }
    if (k === 'clear') { this.ed = null; return true; }
    if (MENU_KEYS.test(k) && !/^(math|test|angle|list|vars|distr)$/.test(k)) return false;
    return this.c.typeInto(this.editor(), k);
  };
  ListEditApp.prototype.render = function () {
    const st = this.c.st, cols = this.cols(), mark = this.c.cursorMark();
    const VISC = 3, VISR = this.c.rows(7);
    if (this.col < this.left0) this.left0 = this.col;
    if (this.col >= this.left0 + VISC) this.left0 = this.col - VISC + 1;
    const r0 = Math.max(0, this.row);
    if (r0 < this.top0) this.top0 = r0;
    if (r0 >= this.top0 + VISR) this.top0 = r0 - VISR + 1;
    const shown = cols.slice(this.left0, this.left0 + VISC);
    let html = '<div class="t84le"><div class="t84le-g" style="grid-template-columns:repeat(' + shown.length + ',1fr)">';
    shown.forEach((n, j) => { html += '<div class="t84le-h' + (this.row === -1 && this.left0 + j === this.col ? ' is-sel' : '') + '">' + esc(n) + '</div>'; });
    for (let r = this.top0; r < this.top0 + VISR; r++) {
      shown.forEach((n, j) => {
        const l = st.lists[n];
        const sel = this.row === r && this.left0 + j === this.col;
        const v = r < l.length ? fmtShort(l[r], st.mode) : '';
        html += '<div class="t84le-c' + (sel ? ' is-sel' : '') + (r > l.length ? ' is-void' : '') + '">' + esc(v) + '</div>';
      });
    }
    html += '</div>';
    const name = cols[this.col];
    const l = st.lists[name];
    let bottom;
    if (this.row === -1) bottom = esc(name) + '={' + l.slice(0, 4).map((v) => esc(fmt(v, st.mode))).join(',') + (l.length > 4 ? '…' : '') + '}';
    else if (this.ed) bottom = esc(name) + '(' + (this.row + 1) + ')=' + this.ed.html(mark);
    else bottom = esc(name) + '(' + (this.row + 1) + ')=' + (this.row < l.length ? esc(fmt(l[this.row], st.mode)) : '');
    return html + '<div class="t84le-b">' + bottom + '</div></div>';
  };
  function fmtShort(v, mode) {
    const s = fmt(v, mode);
    if (s.length <= 7) return s;
    if (typeof v === 'number') {
      const t = T().fmtReal(v, { notation: 'normal', digits: 'float' });
      return /ᴇ/.test(t) ? T().fmtReal(+v.toPrecision(2), mode) : t.slice(0, 7);
    }
    return s.slice(0, 6) + '…';
  }

  /* ── Matrix editor (MATRIX ▸ EDIT) ──────────────────────────────────── */

  function MatEditApp(c, name) {
    this.c = c;
    this.name = name;
    if (!c.st.mats[name]) c.st.mats[name] = [[0]];
    this.row = -1;           // −1 is the dimensions line; col 0 = rows, col 1 = columns
    this.col = 0;
    this.ed = null;
    this.top0 = 0;
    this.left0 = 0;
  }
  MatEditApp.prototype.editor = function () { return this.ed || (this.ed = new (Ed())({ mathprint: false })); };
  MatEditApp.prototype.commit = function () {
    if (!this.ed) return;
    const code = this.ed.serialize();
    this.ed = null;
    if (!code.trim()) return;
    const v = T().evaluate(code, this.c.st);
    if (typeof v !== 'number') T().fail('DATA TYPE');
    const M = this.c.st.mats[this.name];
    if (this.row === -1) {
      const n = Math.floor(v);
      if (n < 1 || n > 99) T().fail('INVALID DIM');
      const rows = this.col === 0 ? n : M.length, cols = this.col === 1 ? n : M[0].length;
      this.c.st.mats[this.name] = Array.from({ length: rows }, (_, i) => Array.from({ length: cols }, (_, j) => (M[i] && M[i][j] != null ? M[i][j] : 0)));
    } else M[this.row][this.col] = v;
  };
  MatEditApp.prototype.key = function (k) {
    const move = (dr, dc) => {
      this.commit();
      const R = this.c.st.mats[this.name];
      if (this.row === -1) {
        if (dr > 0) { this.row = 0; this.col = 0; return; }
        this.col = Math.max(0, Math.min(1, this.col + dc));
        return;
      }
      this.row = Math.max(-1, Math.min(R.length - 1, this.row + dr));
      if (this.row === -1) { this.col = 0; return; }
      this.col = Math.max(0, Math.min(R[0].length - 1, this.col + dc));
    };
    if (k === 'up') { move(-1, 0); return true; }
    if (k === 'down') { move(1, 0); return true; }
    if (k === 'left' && !this.ed) { move(0, -1); return true; }
    if (k === 'right' && !this.ed) { move(0, 1); return true; }
    if (k === 'enter') {
      this.commit();
      const R = this.c.st.mats[this.name];
      if (this.row >= 0) { this.col += 1; if (this.col >= R[0].length) { this.col = 0; this.row = Math.min(R.length - 1, this.row + 1); } }
      else if (this.col === 0) this.col = 1;
      else { this.row = 0; this.col = 0; }
      return true;
    }
    if (k === 'quit' || (k === 'clear' && !this.ed)) { this.commit(); this.c.pop(); return true; }
    if (k === 'clear') { this.ed = null; return true; }
    if (MENU_KEYS.test(k)) return false;
    return this.c.typeInto(this.editor(), k);
  };
  MatEditApp.prototype.render = function () {
    const st = this.c.st, M = st.mats[this.name], mark = this.c.cursorMark();
    const VISR = 6, VISC = 3;
    if (this.row >= 0) {
      if (this.row < this.top0) this.top0 = this.row;
      if (this.row >= this.top0 + VISR) this.top0 = this.row - VISR + 1;
      if (this.col < this.left0) this.left0 = this.col;
      if (this.col >= this.left0 + VISC) this.left0 = this.col - VISC + 1;
    }
    const dim = (i) => (this.row === -1 && this.col === i && this.ed ? this.ed.html(mark)
      : '<span class="' + (this.row === -1 && this.col === i ? 'is-cur' : '') + '">' + (i === 0 ? M.length : M[0].length) + '</span>');
    let html = '<div class="t84me"><div class="t84me-t">MATRIX[' + esc(this.name) + '] ' + dim(0) + ' ×' + dim(1) + '</div>'
      + '<div class="t84me-g" style="grid-template-columns:repeat(' + Math.min(VISC, M[0].length) + ',1fr)">';
    for (let r = this.top0; r < Math.min(M.length, this.top0 + VISR); r++) {
      for (let cI = this.left0; cI < Math.min(M[0].length, this.left0 + VISC); cI++) {
        const sel = this.row === r && this.col === cI;
        html += '<div class="t84me-c' + (sel ? ' is-sel' : '') + '">' + esc(fmtShort(M[r][cI], st.mode)) + '</div>';
      }
    }
    html += '</div>';
    if (this.row >= 0) html += '<div class="t84le-b">[' + esc(this.name) + '](' + (this.row + 1) + ',' + (this.col + 1) + ')=' + (this.ed ? this.ed.html(mark) : esc(fmt(M[this.row][this.col], st.mode))) + '</div>';
    return html + '</div>';
  };

  /* ── Solver (MATH ▸ B:Solver…) ──────────────────────────────────────── */

  function SolverApp(c) {
    this.c = c;
    this.stage = 'eqn';
    this.ed = new (Ed())({ mathprint: c.st.mode.mathprint });
    if (c.st.ui.solverEq) this.ed.load(c.st.ui.solverEq);
    this.form = null;
    this.bound = [-1e99, 1e99];
    this.leftRt = null;
    this.solved = '';
  }
  SolverApp.prototype.editor = function () { return this.stage === 'eqn' ? this.ed : this.form.editor(); };
  /** The equation as "left − (right)" — the Solver finds where it is zero. */
  SolverApp.prototype.expr = function () {
    const code = this.ed.serialize();
    const parts = code.split('=');
    if (parts.length > 2) T().fail('SYNTAX');
    return parts.length === 2 ? '(' + parts[0] + ')-(' + parts[1] + ')' : code;
  };
  SolverApp.prototype.vars = function () {
    const seen = [];
    T().tokenize(this.ed.serialize()).forEach((t) => { if (t.k === 'var' && seen.indexOf(t.v) < 0) seen.push(t.v); });
    return seen;
  };
  SolverApp.prototype.key = function (k) {
    const c = this.c;
    if (this.stage === 'eqn') {
      if (k === 'enter' || k === 'down') {
        if (!this.ed.serialize().trim()) return true;
        c.st.ui.solverEq = this.ed.snapshot();
        T().parseExpr(this.expr());
        if (!this.vars().length) T().fail('INVALID');
        this.stage = 'vars';
        this.makeForm();
        return true;
      }
      if (k === 'clear') { this.ed.clear(); return true; }
      if (k === 'quit') { c.pop(); return true; }
      return c.typeInto(this.ed, k);
    }
    if (k === 'up' && this.form.row === 0 && !this.form.ed) { this.stage = 'eqn'; return true; }
    if (k === 'quit' || (k === 'clear' && !this.form.ed && this.form.rows()[this.form.row].type !== 'num')) { c.pop(); return true; }
    return this.form.key(k);
  };
  SolverApp.prototype.makeForm = function () {
    const c = this.c, st = c.st, self = this;
    const rows = this.vars().map((v) => ({
      label: v + '=', type: 'num',
      get: () => (st.vars[v] == null ? 0 : st.vars[v]),
      set: (x) => { st.vars[v] = x; },
      solve: () => self.solveFor(v),
    }));
    rows.push({ label: 'bound=', type: 'text', text: '{' + T().fmtReal(this.bound[0]) + ',' + T().fmtReal(this.bound[1]) + '}' });
    rows.push({ label: 'left−rt=', type: 'text', text: this.leftRt == null ? '' : T().fmtReal(this.leftRt) });
    const row = this.form ? this.form.row : 0;
    this.form = new FormApp(c, rows, { footer: 'Put the cursor on the unknown, press alpha then enter (SOLVE).' });
    this.form.row = Math.min(row, rows.length - 1);
  };
  SolverApp.prototype.solveFor = function (v) {
    const st = this.c.st;
    const node = T().parseExpr(this.expr());
    const f = (x) => {
      const locals = {}; locals[v] = x;
      const r = T().evalNode(node, st, null, locals);
      if (typeof r !== 'number') T().fail('DATA TYPE');
      return r;
    };
    const guess = typeof st.vars[v] === 'number' ? st.vars[v] : 0;
    const x = T().solveRoot(f, guess, this.bound[0], this.bound[1]);
    st.vars[v] = +x.toPrecision(14);
    this.leftRt = f(st.vars[v]);
    this.solved = v;
    this.makeForm();
  };
  SolverApp.prototype.render = function () {
    const mark = this.c.cursorMark();
    if (this.stage === 'eqn') {
      return '<div class="t84f"><div class="t84f-title">EQUATION SOLVER</div><div class="t84f-txt">An equation (= is in 2nd TEST), or an expression equal to 0.</div>'
        + '<div class="t84f-r is-row"><span class="t84f-l">eqn: 0=</span><span class="t84f-v t84f-v--edit">' + this.ed.html(mark) + '</span></div>'
        + '<div class="t84f-foot">Press enter for the variables.</div></div>';
    }
    const top = '<div class="t84f-r t84f-r--eq"><span class="t84f-v">' + Ed().htmlNodes(this.ed.snapshot()) + '</span></div>';
    return this.form.render().replace('<div class="t84f">', '<div class="t84f">' + top + (this.solved ? '<div class="t84-solved">▪ ' + esc(this.solved) + ' solved</div>' : ''));
  };

  /* ── Mem Management/Delete ──────────────────────────────────────────── */

  function MemApp(c) { this.c = c; this.sel = 0; this.top0 = 0; }
  MemApp.prototype.items = function () {
    const st = this.c.st, out = [];
    Object.keys(st.vars).sort().forEach((n) => out.push({ l: n, kind: T().isCx(st.vars[n]) ? 'Cplx' : 'Real', del: () => { delete st.vars[n]; } }));
    Object.keys(st.lists).sort().forEach((n) => out.push({ l: n, kind: 'List ' + st.lists[n].length, del: () => { if (/^L[₁-₆]$/.test(n)) st.lists[n] = []; else delete st.lists[n]; } }));
    Object.keys(st.mats).sort().forEach((n) => out.push({ l: '[' + n + ']', kind: 'Matrix', del: () => { delete st.mats[n]; } }));
    Object.keys(st.strs).sort().forEach((n) => out.push({ l: n, kind: 'String', del: () => { delete st.strs[n]; } }));
    Object.keys(st.ui.prgms).sort().forEach((n) => out.push({ l: 'prgm' + n, kind: 'Program', del: () => { delete st.ui.prgms[n]; } }));
    return out;
  };
  MemApp.prototype.render = function () {
    const items = this.items();
    if (this.sel >= items.length) this.sel = Math.max(0, items.length - 1);
    const MR = this.c.rows(MENU_ROWS);
    if (this.sel < this.top0) this.top0 = this.sel;
    if (this.sel >= this.top0 + MR) this.top0 = this.sel - MR + 1;
    return '<div class="t84m"><div class="t84m-tabs"><span class="t84m-tab is-on">MEMORY</span><span class="t84m-hint">del deletes</span></div>'
      + (items.length ? '' : '<div class="t84m-none">Nothing stored</div>')
      + items.slice(this.top0, this.top0 + MR).map((it, j) => '<div class="t84m-i' + (this.top0 + j === this.sel ? ' is-sel' : '') + '"><span class="t84m-k">▸</span>' + esc(it.l) + '<span class="t84m-kind">' + esc(it.kind) + '</span></div>').join('')
      + '</div>';
  };
  MemApp.prototype.key = function (k) {
    const items = this.items();
    if (k === 'up') { this.sel = Math.max(0, this.sel - 1); return true; }
    if (k === 'down') { this.sel = Math.min(items.length - 1, this.sel + 1); return true; }
    if (k === 'del' || k === 'bs') { const it = items[this.sel]; if (it) it.del(); return true; }
    if (k === 'clear' || k === 'quit') { this.c.pop(); return true; }
    return true;
  };

  /* ── Mounting ───────────────────────────────────────────────────────── */

  /** Put a calculator into host. Returns the instance; destroy() takes it out. */
  function mount(host, opts) {
    if (!host || !T() || !Ed() || !MN()) return null;
    if (host._fluxTI84) host._fluxTI84.destroy();
    const c = new Calc(host, opts);
    host._fluxTI84 = c;
    return c;
  }

  window.FluxTI84 = {
    mount: mount,
    core: {
      Calc: Calc, FormApp: FormApp, ReportApp: ReportApp, MenuApp: MenuApp, ConfirmApp: ConfirmApp,
      esc: esc, fmt: fmt, outHTML: outHTML, outNodes: outNodes, YCOLOURS: YCOLOURS, yNames: yNames, MENU_KEYS: MENU_KEYS,
    },
  };
})();
