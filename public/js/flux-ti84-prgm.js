/* ════════════════════════════════════════════════════════════════════════
   FLUX · Calculator programs — flux-ti84-prgm.js
   ------------------------------------------------------------------------
   PRGM ▸ NEW / EDIT / EXEC and a TI-BASIC interpreter:
     If/Then/Else/End, For(, While, Repeat, Lbl/Goto, IS>(, DS<(, Menu(,
     Pause, Stop, Return, prgm calls, Disp, Input, Prompt, Output(,
     ClrHome, getKey — everything else on a line goes to the engine, so
     any expression, store, list, matrix, stat, draw or zoom command works
     in a program exactly as it does on the home screen.
   The program screen is the CE's 10 rows × 26 columns. A running program
   yields to the page every few milliseconds, so getKey loops see key
   presses and the ON key always breaks (ERR:BREAK, with 2:Goto into the
   editor at the line that was running).
   ════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.FluxTIPrgm) return;

  const T = () => window.FluxTI;
  const Ed = () => window.FluxTIEditor;
  const core = () => window.FluxTI84.core;
  const esc = (s) => core().esc(s);
  const ROWS = 10, COLS = 26;
  const NAME_RE = /^[A-Zθ][A-Z0-9θ]{0,7}$/;

  /** getKey's codes: row × 10 + column on the keypad. */
  const KEYCODES = {
    yequ: 11, window: 12, zoom: 13, trace: 14, graph: 15, '2nd': 21, mode: 22, del: 23, left: 24, up: 25, right: 26,
    alpha: 31, xt: 32, stat: 33, down: 34, math: 41, apps: 42, prgm: 43, vars: 44, clear: 45,
    inv: 51, sin: 52, cos: 53, tan: 54, pow: 55, sq: 61, comma: 62, lparen: 63, rparen: 64, div: 65,
    log: 71, 7: 72, 8: 73, 9: 74, mul: 75, ln: 81, 4: 82, 5: 83, 6: 84, sub: 85,
    sto: 91, 1: 92, 2: 93, 3: 94, add: 95, 0: 102, dot: 103, neg: 104, enter: 105,
  };
  /** A letter typed on the computer is the key that letter is on. */
  const LETTER_KEY = {
    A: 'math', B: 'apps', C: 'prgm', D: 'inv', E: 'sin', F: 'cos', G: 'tan', H: 'pow', I: 'sq', J: 'comma', K: 'lparen',
    L: 'rparen', M: 'div', N: 'log', O: '7', P: '8', Q: '9', R: 'mul', S: 'ln', T: '4', U: '5', V: '6', W: 'sub',
    X: 'sto', Y: '1', Z: '2', 'θ': '3', '"': 'add', ' ': '0', ':': 'dot', '?': 'neg',
  };

  /* ── Programs in memory ─────────────────────────────────────────────── */

  function progLines(c, name) {
    const P = c.st.ui.prgms;
    let p = P[name];
    if (typeof p === 'string') p = P[name] = p.split('\n');
    if (!Array.isArray(p)) return null;
    if (!p.length) p.push('');
    return p;
  }

  /* ── Compiling: lines → statements, with the blocks matched ─────────── */

  /** Statements on a line are separated by colons outside strings. */
  function splitStmts(line) {
    const out = [];
    let cur = '', q = false;
    for (const ch of String(line)) {
      if (ch === '"') q = !q;
      else if (ch === '→' && q) q = false;           // an unclosed string ends at →
      if (ch === ':' && !q) { out.push(cur); cur = ''; continue; }
      cur += ch;
    }
    out.push(cur);
    return out.map((s) => s.trim()).filter((s) => s.length);
  }
  /** Arguments at the top level, up to the closing bracket (which a program may leave off). */
  function splitArgs(s) {
    const out = [];
    let cur = '', depth = 0, q = false, i = 0;
    for (; i < s.length; i++) {
      const ch = s[i];
      if (ch === '"') q = !q;
      if (!q) {
        if (ch === '(' || ch === '{' || ch === '[') depth++;
        else if (ch === ')' || ch === '}' || ch === ']') {
          if (depth === 0) { i++; break; }
          depth--;
        } else if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
      }
      cur += ch;
    }
    if (s.slice(i).trim()) T().fail('SYNTAX');
    if (cur.trim() || out.length) out.push(cur.trim());
    return out;
  }
  const word = (text, w) => text === w || text.startsWith(w + ' ') || (text.startsWith(w) && /^[^A-Za-z0-9θ]/.test(text.slice(w.length)));
  const rest = (text, w) => text.slice(w.length).trim();

  /** What a statement does. Expressions inside are parsed when first run, so errors come at run time, as on the calculator. */
  function classify(text, line) {
    const s = { text: text, line: line, op: 'eval' };
    let m;
    if (word(text, 'If')) { s.op = 'if'; s.cond = rest(text, 'If'); }
    else if (text === 'Then') s.op = 'then';
    else if (text === 'Else') s.op = 'else';
    else if (text === 'End') s.op = 'end';
    else if (word(text, 'While')) { s.op = 'while'; s.cond = rest(text, 'While'); }
    else if (word(text, 'Repeat')) { s.op = 'repeat'; s.cond = rest(text, 'Repeat'); }
    else if (text.startsWith('For(')) { s.op = 'for'; s.argText = text.slice(4); }
    else if ((m = /^Lbl\s*([A-Z0-9θ]{1,2})$/.exec(text))) { s.op = 'lbl'; s.name = m[1]; }
    else if ((m = /^Goto\s*([A-Z0-9θ]{1,2})$/.exec(text))) { s.op = 'goto'; s.name = m[1]; }
    else if (text.startsWith('Menu(')) { s.op = 'menu'; s.argText = text.slice(5); }
    else if ((m = /^prgm([A-Zθ][A-Z0-9θ]{0,7})$/.exec(text))) { s.op = 'call'; s.name = m[1]; }
    else if (text === 'Return') s.op = 'return';
    else if (text === 'Stop') s.op = 'stop';
    else if (word(text, 'Pause')) { s.op = 'pause'; s.argText = rest(text, 'Pause'); }
    else if (word(text, 'Disp')) { s.op = 'disp'; s.argText = rest(text, 'Disp'); }
    else if (word(text, 'Input')) { s.op = 'input'; s.argText = rest(text, 'Input'); }
    else if (word(text, 'Prompt')) { s.op = 'prompt'; s.argText = rest(text, 'Prompt'); }
    else if (text.startsWith('Output(')) { s.op = 'output'; s.argText = text.slice(7); }
    else if (text.startsWith('IS>(')) { s.op = 'is'; s.argText = text.slice(4); }
    else if (text.startsWith('DS<(')) { s.op = 'ds'; s.argText = text.slice(4); }
    else if (text === 'ClrHome') s.op = 'clrhome';
    return s;
  }
  function compile(lines) {
    const stmts = [];
    lines.forEach((line, li) => splitStmts(line).forEach((t) => stmts.push(classify(t, li))));
    const endOf = {}, elseOf = {}, elseOwner = {}, openerOf = {}, labels = {};
    const stack = [];
    stmts.forEach((s, i) => {
      if (s.op === 'then' || s.op === 'while' || s.op === 'repeat' || s.op === 'for') stack.push(i);
      else if (s.op === 'else') {
        const top = stack[stack.length - 1];
        if (top != null && stmts[top].op === 'then') { elseOf[top] = i; elseOwner[i] = top; }
      } else if (s.op === 'end') {
        const top = stack.pop();
        if (top != null) { endOf[top] = i; openerOf[i] = top; }
      } else if (s.op === 'lbl' && !(s.name in labels)) labels[s.name] = i;
    });
    return { stmts: stmts, endOf: endOf, elseOf: elseOf, elseOwner: elseOwner, openerOf: openerOf, labels: labels };
  }

  /* ── The program screen ─────────────────────────────────────────────── */

  function Screen() { this.clear(); this.cleared = false; }
  Screen.prototype.clear = function () {
    this.rows = Array.from({ length: ROWS }, () => ' '.repeat(COLS));
    this.cur = 0;
    this.used = 0;
    this.cleared = true;
  };
  Screen.prototype.scrollFor = function () {
    if (this.cur < ROWS) return;
    this.rows.shift();
    this.rows.push(' '.repeat(COLS));
    this.cur = ROWS - 1;
  };
  /** Disp: text on the next line, numbers to the right, as the calculator lays them out. */
  Screen.prototype.line = function (text, right) {
    let t = String(text);
    if (t.length > COLS) t = t.slice(0, COLS - 1) + '…';
    this.scrollFor();
    this.rows[this.cur] = right ? t.padStart(COLS) : t.padEnd(COLS);
    this.cur++;
    this.used = Math.max(this.used, this.cur);
  };
  /** Output(row, col, text): written in place, running on to the next rows. */
  Screen.prototype.put = function (r, c, text) {
    let i = r * COLS + c;
    for (const ch of String(text)) {
      if (i >= ROWS * COLS) break;
      const rr = Math.floor(i / COLS), cc = i % COLS;
      this.rows[rr] = this.rows[rr].slice(0, cc) + ch + this.rows[rr].slice(cc + 1);
      i++;
    }
    this.used = Math.max(this.used, Math.floor(Math.max(0, i - 1) / COLS) + 1);
  };
  /**
   * The rows as the home screen shows them: a row that runs to the right edge
   * from blanks (a number from Disp) is right-aligned; anything else keeps its
   * spacing from the left. The screen's own font isn't fixed-width, so the
   * alignment is kept rather than the spaces.
   */
  const rowOf = (r) => (r[0] === ' ' && r[COLS - 1] !== ' ' ? { t: r.trim(), r: true } : { t: r.replace(/\s+$/, '') });
  Screen.prototype.lines = function () { return this.rows.slice(0, this.used).map(rowOf); };

  /* ── Running ────────────────────────────────────────────────────────── */

  /** Run a little later without the timer throttling a background tab applies. */
  const soon = (() => {
    if (typeof MessageChannel === 'undefined') return (f) => setTimeout(f, 0);
    const q = [];
    const ch = new MessageChannel();
    ch.port1.onmessage = () => { const f = q.shift(); if (f) f(); };
    return (f) => { q.push(f); ch.port2.postMessage(0); };
  })();

  function Runner(c, name, entryNodes) {
    this.c = c;
    this.name = name;
    this.entryNodes = entryNodes || Ed().nodesFromCode('prgm' + name);
    this.frames = [];
    this.screen = new Screen();
    this.screen.cleared = false;
    this.state = 'running';     // running | input | pause | menu | done
    this.view = 'home';         // home | graph | table
    this.lastKey = 0;
    this.lastValue = undefined;
    this.cur = null;
    this.progs = {};
    this.app = new RunApp(c, this);
    const self = this;
    this.hooks = Object.assign(c.hooks(), { clrHome: () => { self.screen.clear(); } });
  }
  Runner.prototype.prog = function (name) {
    const lines = progLines(this.c, name);
    if (!lines) T().fail('UNDEFINED');
    // Compiled once per run; a program can't change while it runs.
    return this.progs[name] || (this.progs[name] = compile(lines));
  };
  Runner.prototype.start = function () {
    this.frames.push({ name: this.name, prog: this.prog(this.name), pc: 0 });
    this.tick();
  };
  Runner.prototype.tick = function () {
    if (this.state !== 'running') return;
    // The calculator was closed (another study tool opened): stop, don't spin in the background.
    if (!this.c.host.isConnected) { this.stop(); return; }
    const t0 = Date.now();
    this.dirty = false;
    try {
      for (let n = 0; this.state === 'running' && n < 4000 && Date.now() - t0 < 12; n++) this.step();
    } catch (e) { this.fail(e); return; }
    if (this.state === 'done') return;
    if (this.dirty || this.state !== 'running') this.c.render();
    if (this.state === 'running') soon(() => this.tick());
  };
  Runner.prototype.step = function () {
    const f = this.frames[this.frames.length - 1];
    if (!f) { this.finish(); return; }
    if (f.pc >= f.prog.stmts.length) {
      this.frames.pop();
      if (!this.frames.length) this.finish();
      return;
    }
    const s = f.prog.stmts[f.pc];
    this.cur = { name: f.name, line: s.line };
    f.pc++;
    this.exec(s, f, f.pc - 1);
  };
  Runner.prototype.expr = function (text) {
    if (!text) T().fail('SYNTAX');
    return T().parseExpr(text);
  };
  Runner.prototype.value = function (node) { return T().evalNode(node, this.c.st, this.hooks); };
  Runner.prototype.truth = function (s) {
    if (!s.node) s.node = this.expr(s.cond);
    const v = this.value(s.node);
    if (typeof v !== 'number') T().fail('DATA TYPE');
    return v !== 0;
  };
  Runner.prototype.num = function (node) {
    const v = this.value(node);
    if (typeof v !== 'number') T().fail('DATA TYPE');
    return v;
  };
  /** Where a block's End is; a block without one is a syntax error when it's needed. */
  const endOf = (f, i) => { const e = f.prog.endOf[i]; if (e == null) T().fail('SYNTAX'); return e; };

  Runner.prototype.exec = function (s, f, i) {
    const st = this.c.st;
    switch (s.op) {
      case 'if': {
        const nxt = f.prog.stmts[i + 1];
        const yes = this.truth(s);
        if (nxt && nxt.op === 'then') {
          if (yes) { f.pc = i + 2; return; }
          const e = f.prog.elseOf[i + 1];
          f.pc = (e != null ? e : endOf(f, i + 1)) + 1;
          return;
        }
        if (!yes) f.pc = i + 2;            // a one-line If skips the next statement
        return;
      }
      case 'then': case 'lbl': case 'repeat': return;
      case 'else': f.pc = endOf(f, f.prog.elseOwner[i]) + 1; return;
      case 'end': {
        const o = f.prog.openerOf[i];
        if (o == null) T().fail('SYNTAX');
        const op = f.prog.stmts[o];
        if (op.op === 'while') f.pc = o;
        else if (op.op === 'repeat') { if (!this.truth(op)) f.pc = o + 1; }
        else if (op.op === 'for') {
          const k = this.forArgs(op);
          const step = k.step ? this.num(k.step) : 1;
          const v = this.num(k.v) + step;
          T().store(k.name, v, st);
          const end = this.num(k.end);
          if (step > 0 ? v <= end : v >= end) f.pc = o + 1;
        }
        return;
      }
      case 'while': if (!this.truth(s)) f.pc = endOf(f, i) + 1; return;
      case 'for': {
        const k = this.forArgs(s);
        const start = this.num(k.start), end = this.num(k.end);
        const step = k.step ? this.num(k.step) : 1;
        if (step === 0) T().fail('INCREMENT');
        T().store(k.name, start, st);
        if (step > 0 ? start > end : start < end) f.pc = endOf(f, i) + 1;
        return;
      }
      case 'goto': {
        const L = f.prog.labels[s.name];
        if (L == null) T().fail('LABEL');
        f.pc = L + 1;
        return;
      }
      case 'call': {
        if (this.frames.length > 60) T().fail('MEMORY');
        this.frames.push({ name: s.name, prog: this.prog(s.name), pc: 0 });
        return;
      }
      case 'return': this.frames.pop(); if (!this.frames.length) this.finish(); return;
      case 'stop': this.finish(); return;
      case 'clrhome': this.screen.clear(); this.view = 'home'; this.dirty = true; return;
      case 'disp': {
        this.view = 'home';
        this.dirty = true;
        if (!s.args) s.args = s.argText ? splitArgs(s.argText).map((a) => this.expr(a)) : [];
        s.args.forEach((n) => this.show(this.value(n)));
        return;
      }
      case 'output': {
        if (!s.args) s.args = splitArgs(s.argText).map((a) => this.expr(a));
        if (s.args.length !== 3) T().fail('ARGUMENT');
        const r = this.num(s.args[0]), col = this.num(s.args[1]);
        if (r < 1 || r > ROWS || col < 1 || col > COLS || r !== Math.floor(r) || col !== Math.floor(col)) T().fail('DOMAIN');
        this.screen.put(r - 1, col - 1, this.text(this.value(s.args[2])));
        this.view = 'home';
        this.dirty = true;
        return;
      }
      case 'pause': {
        if (s.argText) { if (!s.node) s.node = this.expr(s.argText); this.view = 'home'; this.show(this.value(s.node)); }
        this.state = 'pause';
        return;
      }
      case 'input': {
        const a = s.argText ? splitArgs(s.argText) : [];
        if (!a.length) return;                  // Input alone moves a cursor on the graph; nothing to read here
        let prompt = '?';
        if (a.length > 1) { const p = this.value(this.expr(a[0])); prompt = this.text(p); }
        this.ask([{ prompt: prompt, target: a[a.length - 1] }]);
        return;
      }
      case 'prompt': this.ask(splitArgs(s.argText).map((t) => ({ prompt: t + '=?', target: t }))); return;
      case 'is': case 'ds': {
        if (!s.args) s.args = splitArgs(s.argText);
        if (s.args.length !== 2) T().fail('ARGUMENT');
        const name = s.args[0];
        if (!/^[A-Zθ]$/.test(name)) T().fail('SYNTAX');
        const v = this.num(this.expr(name)) + (s.op === 'is' ? 1 : -1);
        T().store(name, v, st);
        const lim = this.num(this.expr(s.args[1]));
        if (s.op === 'is' ? v > lim : v < lim) f.pc = i + 2;
        return;
      }
      case 'menu': {
        const a = splitArgs(s.argText);
        if (a.length < 3 || a.length % 2 === 0 || a.length > 15) T().fail('ARGUMENT');
        const items = [];
        for (let k = 1; k < a.length; k += 2) {
          const lbl = a[k + 1].trim();
          if (!(lbl in f.prog.labels)) T().fail('LABEL');
          items.push({ text: this.text(this.value(this.expr(a[k]))), label: lbl });
        }
        this.menu = { title: this.text(this.value(this.expr(a[0]))), items: items, sel: 0, frame: f };
        this.state = 'menu';
        return;
      }
      default: {
        const r = T().run(s.text, st, this.hooks);
        if (!r) return;
        if (r.show) { this.view = r.show; this.dirty = true; }
        if (r.clear) { this.screen.clear(); this.dirty = true; }
        if (r.report) {
          this.view = 'home';
          this.show(r.report.title, true);
          r.report.rows.forEach((row) => this.show((row[0] ? row[0] + '=' : '') + this.text(row[1]), true));
          this.dirty = true;
        }
        this.lastValue = r.value !== undefined && !r.stored ? r.value : undefined;
      }
    }
  };
  Runner.prototype.forArgs = function (s) {
    if (s.k) return s.k;
    const a = splitArgs(s.argText);
    if (a.length < 3 || a.length > 4 || !/^[A-Zθ]$/.test(a[0])) T().fail('SYNTAX');
    s.k = { name: a[0], v: this.expr(a[0]), start: this.expr(a[1]), end: this.expr(a[2]), step: a[3] ? this.expr(a[3]) : null };
    return s.k;
  };
  Runner.prototype.text = function (v) {
    if (typeof v === 'string') return v;
    if (T().isStr(v)) return v.v;
    return T().textOf(v, this.c.st.mode);
  };
  Runner.prototype.show = function (v, left) {
    const isText = left || typeof v === 'string' || T().isStr(v);
    this.screen.line(this.text(v), !isText);
    this.dirty = true;
  };

  /** Input and Prompt: one question at a time on the program screen. */
  Runner.prototype.ask = function (qs) {
    this.questions = qs;
    this.nextQuestion();
  };
  Runner.prototype.nextQuestion = function () {
    const q = this.questions.shift();
    if (!q) { this.state = 'running'; return; }
    this.view = 'home';
    this.screen.scrollFor();
    this.q = q;
    this.ed = new (Ed())({ mathprint: false });
    this.state = 'input';
  };
  Runner.prototype.submit = function () {
    const st = this.c.st, q = this.q;
    const code = this.ed.serialize();
    this.screen.line(q.prompt + Ed().textNodes(this.ed.snapshot()));
    if (/^Str[0-9]$/.test(q.target)) st.strs[q.target] = code;
    else T().store(q.target, T().evaluate(code.trim() ? code : '0', st, this.hooks), st);
    this.ed = null;
    this.nextQuestion();
    if (this.state === 'running') soon(() => this.tick());
  };
  Runner.prototype.resume = function () {
    this.state = 'running';
    soon(() => this.tick());
  };
  Runner.prototype.pick = function (idx) {
    const m = this.menu, it = m && m.items[idx];
    if (!it) return;
    m.frame.pc = m.frame.prog.labels[it.label] + 1;
    this.menu = null;
    this.resume();
  };

  /** Keys while a program runs: ON breaks; otherwise remember the key for getKey. */
  Runner.prototype.key = function (id) {
    if (id === 'on') { this.fail({ ti: 'BREAK' }); return true; }
    if (this.state !== 'running') return false;
    if (KEYCODES[id]) this.lastKey = KEYCODES[id];
    return true;
  };
  Runner.prototype.keyboard = function (code) {
    if (this.state !== 'running') return false;
    let id = code;
    if (/^a:/.test(code)) id = LETTER_KEY[code.slice(2)];
    else if (code === 'bs') id = 'del';
    if (id && KEYCODES[id]) this.lastKey = KEYCODES[id];
    return true;
  };
  Runner.prototype.takeKey = function () { const k = this.lastKey; this.lastKey = 0; return k; };
  Runner.prototype.stop = function () { this.state = 'done'; this.done = true; };

  /** The program ended: its screen goes into the home history, then Done (or the last value). */
  Runner.prototype.finish = function (failed) {
    if (this.done) return;
    this.done = true;
    this.state = 'done';
    const c = this.c;
    if (c.runner === this) c.runner = null;
    const at = c.stack.indexOf(this.app);
    if (at > 0) c.stack.splice(at, 1);
    // ClrHome in a program clears the home screen too.
    if (this.screen.cleared) c.st.ui.history = [];
    const entry = { in: this.entryNodes, lines: this.screen.lines() };
    if (!failed) entry.out = this.lastValue !== undefined ? T().display(this.lastValue, c.st.mode) : { k: 'done' };
    c.st.ui.history.push(entry);
    c.render();
    c.save();
  };
  Runner.prototype.fail = function (e) {
    if (this.done) return;
    const kind = e && e.ti ? e.ti : 'INVALID';
    if (!(e && e.ti)) console.error('[calculator program]', e);
    const where = this.cur;
    const c = this.c;
    this.finish(true);
    c.error(kind, where ? () => edit(c, where.name, where.line) : null);
    c.render();
  };

  /* ── The screen a running program shows ─────────────────────────────── */

  function RunApp(c, r) { this.c = c; this.r = r; this.g = null; this.tb = null; }
  RunApp.prototype.editor = function () { return this.r.state === 'input' ? this.r.ed : null; };
  RunApp.prototype.sub = function () {
    const r = this.r, G = window.FluxTIGraph;
    if (!G || r.state === 'input' || r.state === 'menu') return null;
    if (r.view === 'graph') return this.g || (this.g = new G.GraphApp(this.c));
    if (r.view === 'table' && G.TableApp) return this.tb || (this.tb = new G.TableApp(this.c));
    return null;
  };
  RunApp.prototype.key = function (k) {
    const r = this.r;
    if (r.state === 'input') {
      if (k === 'enter') { r.submit(); return true; }
      if (k === 'clear') { r.ed.clear(); return true; }
      if (k === 'quit') { r.finish(false); return true; }
      if (this.c.typeInto(r.ed, k)) return true;
      // The paste menus work while typing an answer; other screens wait until the program ends.
      return !/^(math|test|angle|list|matrix|distr|vars|catalog)$/.test(k);
    }
    if (r.state === 'pause') {
      if (k === 'enter') r.resume();
      return true;
    }
    if (r.state === 'menu') {
      const m = r.menu, n = m.items.length;
      if (k === 'up') m.sel = (m.sel + n - 1) % n;
      else if (k === 'down') m.sel = (m.sel + 1) % n;
      else if (k === 'enter') r.pick(m.sel);
      else if (/^[1-7]$/.test(k)) r.pick(Number(k) - 1);
      return true;
    }
    return true;
  };
  RunApp.prototype.render = function () {
    const r = this.r;
    const sub = this.sub();
    if (sub) return sub.render().replace(/<\/div>$/, (r.state === 'running' ? '<span class="t84p-busy"></span>' : r.state === 'pause' ? '<span class="t84p-busy is-pause"></span>' : '') + '</div>');
    if (r.state === 'menu') {
      const m = r.menu;
      return '<div class="t84m"><div class="t84m-tabs"><span class="t84m-tab is-on">' + esc(m.title) + '</span></div>'
        + m.items.map((it, i) => '<div class="t84m-i' + (i === m.sel ? ' is-sel' : '') + '"><span class="t84m-k">' + (i + 1) + ':</span>' + esc(it.text) + '</div>').join('')
        + '</div>';
    }
    const busy = r.state === 'running' ? '<span class="t84p-busy"></span>' : r.state === 'pause' ? '<span class="t84p-busy is-pause"></span>' : '';
    let html = '<div class="t84p-run">' + busy + '<div class="t84p-lines">';
    r.screen.rows.forEach((l, i) => {
      if (r.state === 'input' && i === r.screen.cur) {
        html += '<div class="t84p-line">' + esc(r.q.prompt) + r.ed.html(this.c.cursorMark()) + '</div>';
        return;
      }
      const row = rowOf(l);
      html += '<div class="t84p-line' + (row.r ? ' is-right' : '') + '">' + esc(row.t) + '</div>';
    });
    return html + '</div></div>';
  };
  RunApp.prototype.after = function (scr) { const sub = this.sub(); if (sub && sub.after) sub.after(scr); };

  /* ── PRGM ▸ NEW: the name prompt ────────────────────────────────────── */

  function NameApp(c) { this.c = c; this.ed = new (Ed())({ mathprint: false }); }
  NameApp.prototype.editor = function () { return this.ed; };
  NameApp.prototype.key = function (k) {
    const c = this.c, ed = this.ed;
    if (k === 'enter') {
      const name = ed.serialize().trim();
      if (!name) return true;
      if (!NAME_RE.test(name)) T().fail('INVALID');
      c.alock = false;
      c.mod = '';
      c.pop();
      if (!c.st.ui.prgms[name]) c.st.ui.prgms[name] = [''];
      c.push(new EditApp(c, name, 0));
      return true;
    }
    if (k === 'clear' || k === 'quit') { c.alock = false; c.mod = ''; c.pop(); return true; }
    const len = ed.serialize().length;
    if (/^a:[A-Zθ]$/.test(k)) { if (len < 8) ed.insertTok(k.slice(2)); return true; }
    if (/^[0-9]$/.test(k)) { if (len > 0 && len < 8) ed.insertTok(k); return true; }
    if (/^(left|right|del|bs)$/.test(k)) return c.typeInto(ed, k);
    return true;
  };
  NameApp.prototype.render = function () {
    return '<div class="t84p"><div class="t84p-t">PROGRAM</div><div class="t84f-r is-row"><span class="t84f-l">Name=</span>'
      + '<span class="t84f-v t84f-v--edit">' + this.ed.html(this.c.cursorMark()) + '</span></div>'
      + '<div class="t84f-foot">Up to 8 letters and numbers, starting with a letter. Alpha is locked on.</div></div>';
  };

  /* ── PRGM ▸ EDIT: the program editor ────────────────────────────────── */

  const VIS = 9;
  function EditApp(c, name, line) {
    this.c = c;
    this.name = name;
    this.lines = progLines(c, name) || (c.st.ui.prgms[name] = ['']);
    this.line = Math.max(0, Math.min(line || 0, this.lines.length - 1));
    this.ed = null;
    this.top0 = Math.max(0, this.line - VIS + 1);
  }
  EditApp.prototype.editor = function () {
    if (!this.ed) {
      this.ed = new (Ed())({ mathprint: false });
      this.ed.load(Ed().nodesFromCode(this.lines[this.line] || ''));
      this.ed.end();
    }
    return this.ed;
  };
  EditApp.prototype.sync = function () { if (this.ed) this.lines[this.line] = this.ed.serialize(); };
  EditApp.prototype.go = function (i) {
    this.sync();
    this.ed = null;
    this.line = Math.max(0, Math.min(this.lines.length - 1, i));
  };
  EditApp.prototype.key = function (k) {
    const c = this.c;
    if (k === 'up') { this.go(this.line - 1); return true; }
    if (k === 'down') { this.go(this.line + 1); return true; }
    if (k === 'enter') {
      this.sync();
      this.lines.splice(this.line + 1, 0, '');
      this.go(this.line + 1);
      return true;
    }
    if (k === 'clear') { this.editor().clear(); this.sync(); return true; }
    if (k === 'quit') { this.sync(); c.pop(); c.save(); return true; }
    const ed = this.editor();
    if ((k === 'del' || k === 'bs') && ed.isEmpty() && this.lines.length > 1) {
      // Deleting on an empty line removes the line.
      this.lines.splice(this.line, 1);
      this.ed = null;
      if (k === 'bs' || this.line >= this.lines.length) this.line = Math.max(0, this.line - (k === 'bs' ? 1 : 0));
      this.line = Math.min(this.line, this.lines.length - 1);
      return true;
    }
    if (this.c.typeInto(ed, k)) { this.sync(); return true; }
    return false;
  };
  EditApp.prototype.render = function () {
    const mark = this.c.cursorMark();
    if (this.line < this.top0) this.top0 = this.line;
    if (this.line >= this.top0 + this.c.rows(VIS)) this.top0 = this.line - this.c.rows(VIS) + 1;
    let html = '<div class="t84p"><div class="t84p-t">PROGRAM:' + esc(this.name) + '</div>';
    this.lines.slice(this.top0, this.top0 + this.c.rows(VIS)).forEach((code, j) => {
      const i = this.top0 + j, on = i === this.line;
      html += '<div class="t84p-l' + (on ? ' is-row' : '') + '">'
        + (on ? this.editor().html(mark) : Ed().htmlNodes(Ed().nodesFromCode(code))) + '</div>';
    });
    return html + '</div>';
  };
  EditApp.prototype.onHide = function () { this.sync(); };

  /* ── What the calculator calls ──────────────────────────────────────── */

  function menu(c) {
    const top = c.top();
    if (top instanceof EditApp) { c.openMenu('PRGMED', top); return; }
    c.openMenu('PRGM', c.home);
  }
  function create(c) {
    c.push(new NameApp(c));
    c.alock = true;
    c.mod = 'alpha';
  }
  function edit(c, name, line) {
    if (!c.st.ui.prgms[name]) { c.error('UNDEFINED'); return; }
    c.push(new EditApp(c, name, line || 0));
  }
  function pasteRun(c, name) {
    c.quit();
    c.home.ed.insertCode('prgm' + name);
  }
  function run(c, name, nodes) {
    if (!progLines(c, name)) { c.error('UNDEFINED'); return; }
    if (c.runner) c.runner.stop();
    const r = new Runner(c, name, nodes);
    c.runner = r;
    c.push(r.app);
    try { r.start(); } catch (e) { r.fail(e); }
  }

  window.FluxTIPrgm = {
    menu: menu, create: create, edit: edit, pasteRun: pasteRun, run: run,
    _test: { compile: compile, splitStmts: splitStmts, splitArgs: splitArgs, Screen: Screen, KEYCODES: KEYCODES },
  };
})();
