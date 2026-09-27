/* ════════════════════════════════════════════════════════════════════════
   FLUX · Periodic Table tools — flux-ptable-tools.js
   ------------------------------------------------------------------------
   The Tools view of the Flux Periodic Table: molar mass, a mole calculator,
   an equation balancer, empirical and molecular formulas, ionic compounds
   and ion configurations, and side-by-side comparison. Each works beside
   the table: the elements in play light up, and clicking an element types
   its symbol into the tool. The chemistry is flux-chem.js.
   ════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.FluxPTableTools) return;

  const C = () => window.FluxChem;
  const core = () => window.FluxPTable.core;
  const esc = (s) => core().esc(s);
  const TOOLS = [['molar', 'Molar mass'], ['moles', 'Moles'], ['balance', 'Balance'], ['empirical', 'Empirical'], ['ions', 'Ions'], ['compare', 'Compare']];

  /** Each tool's inputs, kept while you move between tools. */
  const S = {
    formula: 'H2SO4', dp2: false,
    eq: 'Fe + O2 -> Fe2O3',
    emp: { mode: 'pct', rows: [['C', '40.0'], ['H', '6.7'], ['O', '53.3']], M: '180' },
    moles: { formula: 'CaCO3', n: 0.5, cond: 'stp', vol: '' },
    ion: { cat: 'Fe|3', an: 'SO4|-2', el: 'Fe', q: 2 },
  };

  function msg(e) { return '<div class="fpt-err">' + esc(e && e.chem ? e.message : 'That could not be worked out.') + '</div>'; }
  const n2 = (v) => (Math.round(v * 100 + 1e-7) / 100).toFixed(2);
  const massHL = (app, atoms, label) => {
    const ns = Object.keys(atoms || {}).map((s) => { const e = app.bySym(s); return e && e.n; }).filter(Boolean);
    app.highlight(ns.length ? ns : null, label);
  };
  /** "6.02×10^23", "6.02e23", "6,02" → a number (NaN if unreadable, null if blank). */
  function readNum(s) {
    const t = String(s == null ? '' : s).trim().replace(/,/g, '.').replace(/\s/g, '').replace(/[×x*]10\^?([−-]?\d+)/i, 'e$1').replace('−', '-');
    if (!t) return null;
    const v = Number(t);
    return Number.isFinite(v) ? v : NaN;
  }
  const show = (v, sig) => {
    if (v == null || !Number.isFinite(v)) return '';
    if (v !== 0 && (Math.abs(v) >= 1e6 || Math.abs(v) < 1e-3)) return v.toExponential((sig || 4) - 1).replace('e+', 'e');
    return String(+v.toPrecision(sig || 4));
  };

  function render(app, host) {
    const tool = TOOLS.some((t) => t[0] === app.st.tool) ? app.st.tool : 'molar';
    if (app.st.toolInput) {
      if (tool === 'balance') S.eq = app.st.toolInput;
      else if (tool === 'molar') S.formula = app.st.toolInput;
      app.st.toolInput = null;
    }
    host.innerHTML = '<div class="fpt-tools"><div class="fpt-tnav" role="tablist">'
      + TOOLS.map((t) => '<button type="button" role="tab" class="fpt-tbtn' + (t[0] === tool ? ' is-on' : '') + '" aria-selected="' + (t[0] === tool) + '" data-act="tool" data-tool="' + t[0] + '">' + t[1] + '</button>').join('')
      + '</div><div class="fpt-tool" data-tool="' + tool + '"></div></div>';
    const el = host.querySelector('.fpt-tool');
    ({ molar: molar, moles: moles, balance: balance, empirical: empirical, ions: ions, compare: compare })[tool](app, el);
  }
  function action(app, act, el) {
    if (act === 'ex') {
      const inp = app.side.querySelector('.fpt-main-in');
      if (inp) { inp.value = el.dataset.v; inp.dispatchEvent(new Event('input')); inp.focus(); }
    }
  }
  /** Clicking an element types it into the field, at the cursor. */
  function typeInto(input, app, n) {
    const e = app.byN(n);
    const a = input.selectionStart != null ? input.selectionStart : input.value.length;
    const b = input.selectionEnd != null ? input.selectionEnd : a;
    input.value = input.value.slice(0, a) + e.s + input.value.slice(b);
    input.dispatchEvent(new Event('input'));
    input.focus();
    try { input.setSelectionRange(a + e.s.length, a + e.s.length); } catch (err) { /* not a text field */ }
  }
  const examples = (list) => '<div class="fpt-examples">' + list.map((v) => '<button type="button" class="fpt-ex" data-act="ex" data-v="' + esc(v) + '">' + esc(v) + '</button>').join('') + '</div>';

  /* ── Molar mass ─────────────────────────────────────────────────────── */

  function molar(app, el) {
    el.innerHTML = '<h3>Molar mass</h3><p>Type a formula — brackets, hydrates (CuSO4·5H2O or CuSO4.5H2O) and ions all work. Click an element in the table to add it.</p>'
      + '<label class="fpt-field">Formula<input class="fpt-in fpt-big-in fpt-main-in" value="' + esc(S.formula) + '" spellcheck="false" autocomplete="off" aria-label="Formula"></label>'
      + examples(['H2O', 'CO2', 'NaCl', 'CaCO3', 'C6H12O6', 'Ca(OH)2', '(NH4)2SO4', 'CuSO4·5H2O'])
      + '<label class="fpt-check"><input type="checkbox"' + (S.dp2 ? ' checked' : '') + '> Use masses to 2 decimal places, as exam data booklets do</label>'
      + '<div class="fpt-out"></div>';
    const inp = el.querySelector('input.fpt-main-in'), box = el.querySelector('input[type=checkbox]'), out = el.querySelector('.fpt-out');
    const run = () => {
      S.formula = inp.value;
      S.dp2 = box.checked;
      if (!inp.value.trim()) { out.innerHTML = ''; app.highlight(null); return; }
      let r;
      try { r = C().molarMass(inp.value, { dp2: S.dp2 }); } catch (e) { out.innerHTML = msg(e); return; }
      const pretty = C().pretty(inp.value);
      out.innerHTML = '<div class="fpt-result"><div class="fpt-big">' + n2(r.total) + ' <small>g/mol</small></div><div class="fpt-note">M(' + esc(pretty) + ') = '
        + r.parts.map((p) => (p.n > 1 ? p.n + ' × ' : '') + p.ar).join(' + ') + ' = ' + (Math.round(r.total * 1000) / 1000) + '</div></div>'
        + '<table class="fpt-tbl"><thead><tr><th>Element</th><th>Atoms</th><th>A<sub>r</sub></th><th>Mass</th><th>% by mass</th></tr></thead><tbody>'
        + r.parts.map((p) => '<tr><td>' + esc(p.s) + '</td><td>' + p.n + '</td><td>' + p.ar + '</td><td>' + n2(p.mass) + '</td><td><span class="fpt-meter" style="--c:' + core().CAT[app.bySym(p.s).cat].colour + '"><i style="width:' + p.pct.toFixed(1) + '%"></i></span> ' + p.pct.toFixed(2) + '%</td></tr>').join('')
        + '</tbody></table>'
        + '<p class="fpt-note"><button type="button" class="fpt-link" data-act="tool" data-tool="moles">Convert grams and moles of ' + esc(pretty) + ' →</button></p>';
      S.moles.formula = inp.value;
      massHL(app, r.atoms, pretty);
    };
    inp.addEventListener('input', run);
    box.addEventListener('change', run);
    app.cellClick = (n) => typeInto(inp, app, n);
    run();
  }

  /* ── Moles ──────────────────────────────────────────────────────────── */

  const COND = { stp: ['22.7', '0 °C and 100 kPa (STP, IB)'], rtp: ['24.0', '25 °C and 100 kPa (RTP)'], stp1atm: ['22.4', '0 °C and 1 atm (older STP)'] };
  function moles(app, el) {
    const M0 = S.moles;
    el.innerHTML = '<h3>Moles</h3><p>Type any one amount and the rest follow: n = m ÷ M, particles = n × N<sub>A</sub>, gas volume = n × V<sub>m</sub>, and for a solution n = c × V.</p>'
      + '<label class="fpt-field">Substance<input class="fpt-in fpt-big-in fpt-main-in" value="' + esc(M0.formula) + '" spellcheck="false" autocomplete="off" aria-label="Formula"></label>'
      + '<div class="fpt-mm fpt-note"></div>'
      + '<div class="fpt-rowf">'
      + '<label class="fpt-field">Mass (g)<input class="fpt-in" data-k="m" inputmode="decimal"></label>'
      + '<label class="fpt-field">Amount (mol)<input class="fpt-in" data-k="n" inputmode="decimal"></label>'
      + '<label class="fpt-field">Particles<input class="fpt-in" data-k="N" inputmode="decimal"></label>'
      + '</div>'
      + '<div class="fpt-rowf"><label class="fpt-field">Gas volume (dm³)<input class="fpt-in" data-k="V" inputmode="decimal"></label>'
      + '<label class="fpt-field">Gas at<select class="fpt-in fpt-cond">' + Object.keys(COND).map((k) => '<option value="' + k + '"' + (M0.cond === k ? ' selected' : '') + '>' + COND[k][1] + '</option>').join('') + '</select></label></div>'
      + '<div class="fpt-sub">As a solution</div><div class="fpt-rowf">'
      + '<label class="fpt-field">Volume (cm³)<input class="fpt-in" data-k="sv" inputmode="decimal" value="' + esc(M0.vol) + '"></label>'
      + '<label class="fpt-field">Concentration (mol/dm³)<input class="fpt-in" data-k="c" inputmode="decimal"></label></div>'
      + '<p class="fpt-note">N<sub>A</sub> = 6.022 × 10²³ mol⁻¹. The gas volume assumes an ideal gas.</p>';
    const f = el.querySelector('.fpt-main-in'), mm = el.querySelector('.fpt-mm'), cond = el.querySelector('.fpt-cond');
    const field = (k) => el.querySelector('[data-k="' + k + '"]');
    let M = null;
    const fill = (except) => {
      const n = M0.n;
      const Vm = +COND[cond.value][0];
      const put = (k, v) => { if (k !== except) field(k).value = v == null || !Number.isFinite(v) ? '' : show(v); };
      put('n', n);
      put('m', M && n != null ? n * M : null);
      put('N', n != null ? n * C().NA : null);
      put('V', n != null ? n * Vm : null);
      const sv = readNum(field('sv').value);
      put('c', n != null && sv > 0 ? n / (sv / 1000) : null);
    };
    const setFormula = () => {
      M0.formula = f.value;
      try {
        const r = C().molarMass(f.value);
        M = r.total;
        mm.innerHTML = 'M(' + esc(C().pretty(f.value)) + ') = <b>' + n2(M) + ' g/mol</b>';
        massHL(app, r.atoms, C().pretty(f.value));
      } catch (e) { M = null; mm.innerHTML = f.value.trim() ? '<span class="fpt-bad">' + esc(e.chem ? e.message : 'Unreadable formula') + '</span>' : ''; }
      fill(null);
    };
    f.addEventListener('input', setFormula);
    cond.addEventListener('change', () => { M0.cond = cond.value; fill(null); });
    el.querySelectorAll('[data-k]').forEach((inp) => {
      inp.addEventListener('input', () => {
        const k = inp.dataset.k, v = readNum(inp.value);
        const Vm = +COND[cond.value][0];
        if (k === 'sv') { M0.vol = inp.value; fill('sv'); return; }
        if (v == null || Number.isNaN(v)) return;
        if (k === 'n') M0.n = v;
        else if (k === 'm') { if (!M) return; M0.n = v / M; }
        else if (k === 'N') M0.n = v / C().NA;
        else if (k === 'V') M0.n = v / Vm;
        else if (k === 'c') { const sv = readNum(field('sv').value); if (!(sv > 0)) return; M0.n = v * sv / 1000; }
        fill(k);
      });
    });
    app.cellClick = (n) => typeInto(f, app, n);
    setFormula();
  }

  /* ── Balance ────────────────────────────────────────────────────────── */

  function balance(app, el) {
    el.innerHTML = '<h3>Balance an equation</h3><p>Use -> (or =) for the arrow. Ions and electrons balance too: MnO4- + Fe2+ + H+ -> … Numbers you type in front are checked.</p>'
      + '<label class="fpt-field">Equation<input class="fpt-in fpt-big-in fpt-main-in" value="' + esc(S.eq) + '" spellcheck="false" autocomplete="off" aria-label="Equation"></label>'
      + examples(['Fe + O2 -> Fe2O3', 'C3H8 + O2 -> CO2 + H2O', 'Al + CuSO4 -> Al2(SO4)3 + Cu', 'Cu + HNO3 -> Cu(NO3)2 + NO + H2O', 'MnO4- + Fe2+ + H+ -> Mn2+ + Fe3+ + H2O'])
      + '<div class="fpt-out"></div>';
    const inp = el.querySelector('.fpt-main-in'), out = el.querySelector('.fpt-out');
    const run = () => {
      S.eq = inp.value;
      if (!inp.value.trim()) { out.innerHTML = ''; app.highlight(null); return; }
      let r;
      try { r = C().balance(inp.value); } catch (e) { out.innerHTML = msg(e); return; }
      out.innerHTML = '<div class="fpt-result"><div class="fpt-eq">' + esc(r.text) + '</div>'
        + (r.type ? '<div class="fpt-note">' + esc(r.type) + (r.type === 'Ionic' ? ' equation — the charge balances as well as the atoms' : ' reaction') + '</div>' : '')
        + (r.givenCorrect === true ? '<div class="fpt-ok">✓ Your coefficients were right.</div>' : r.givenCorrect === false ? '<div class="fpt-bad">Your coefficients do not balance — the balanced version is above.</div>' : '')
        + '</div><table class="fpt-tbl"><thead><tr><th>Count</th><th>Left</th><th>Right</th><th></th></tr></thead><tbody>'
        + r.check.map((c) => '<tr><td>' + (c.e === 'charge' ? 'Charge' : esc(c.e)) + '</td><td>' + c.left + '</td><td>' + c.right + '</td><td class="' + (c.left === c.right ? 'fpt-ok' : 'fpt-bad') + '">' + (c.left === c.right ? '✓' : '✗') + '</td></tr>').join('')
        + '</tbody></table>';
      const atoms = {};
      r.check.forEach((c) => { if (c.e !== 'charge') atoms[c.e] = 1; });
      massHL(app, atoms, 'this equation');
    };
    inp.addEventListener('input', run);
    app.cellClick = (n) => typeInto(inp, app, n);
    run();
  }

  /* ── Empirical formula ──────────────────────────────────────────────── */

  function empirical(app, el) {
    const E = S.emp;
    const rowsHTML = () => E.rows.map((r, i) => '<div class="fpt-rowf fpt-emprow" data-i="' + i + '"><label class="fpt-field">Element<input class="fpt-in" data-f="s" value="' + esc(r[0]) + '" maxlength="2" autocomplete="off" spellcheck="false"></label>'
      + '<label class="fpt-field">' + (E.mode === 'pct' ? 'Percent (%)' : 'Mass (g)') + '<input class="fpt-in" data-f="v" value="' + esc(r[1]) + '" inputmode="decimal"></label></div>').join('');
    el.innerHTML = '<h3>Empirical formula</h3><p>From the percentage of each element, or the grams of each in a sample. Add the molar mass to get the molecular formula too. Clicking the table fills the next element box.</p>'
      + '<div class="fpt-seg">' + [['pct', 'Percentages'], ['g', 'Grams']].map((m) => '<button type="button" class="fpt-chip' + (E.mode === m[0] ? ' is-on' : '') + '" data-emp="' + m[0] + '">' + m[1] + '</button>').join('') + '</div>'
      + '<div class="fpt-emprows">' + rowsHTML() + '</div>'
      + '<p class="fpt-note"><button type="button" class="fpt-link" data-emp="add">+ Add an element</button> · <button type="button" class="fpt-link" data-emp="clear">Clear</button></p>'
      + '<label class="fpt-field">Molar mass (optional, g/mol)<input class="fpt-in fpt-empM" value="' + esc(E.M) + '" inputmode="decimal"></label>'
      + '<div class="fpt-out"></div>';
    const out = el.querySelector('.fpt-out');
    const read = () => {
      E.rows = [...el.querySelectorAll('.fpt-emprow')].map((r) => [r.querySelector('[data-f=s]').value.trim(), r.querySelector('[data-f=v]').value.trim()]);
      E.M = el.querySelector('.fpt-empM').value;
    };
    const run = () => {
      read();
      const amounts = E.rows.filter((r) => r[0] && r[1]).map((r) => ({ s: r[0].charAt(0).toUpperCase() + r[0].slice(1).toLowerCase(), v: readNum(r[1]) }));
      if (!amounts.length) { out.innerHTML = ''; app.highlight(null); return; }
      let warn = '';
      if (E.mode === 'pct') {
        const sum = amounts.reduce((a, x) => a + (x.v || 0), 0);
        if (Math.abs(sum - 100) > 1.5) warn = '<div class="fpt-note fpt-bad">The percentages add up to ' + sum.toFixed(1) + '%, not 100%. If the rest is oxygen, add it.</div>';
      }
      let r;
      try { r = C().empirical(amounts, { M: readNum(E.M) || 0 }); } catch (e) { out.innerHTML = msg(e); return; }
      out.innerHTML = '<div class="fpt-result"><div class="fpt-big">' + esc(r.pretty) + '</div><div class="fpt-note">Empirical formula · ' + n2(r.M) + ' g/mol'
        + (r.molecular ? ' · molecular formula <b>' + esc(r.molecular.pretty) + '</b> (× ' + r.molecular.n + ')' : '') + '</div>' + warn + '</div>'
        + '<table class="fpt-tbl"><thead><tr><th></th><th>' + (E.mode === 'pct' ? '%' : 'g') + '</th><th>÷ A<sub>r</sub> = mol</th><th>÷ smallest</th>' + (r.multiplier > 1 ? '<th>× ' + r.multiplier + '</th>' : '') + '</tr></thead><tbody>'
        + r.steps.map((s) => '<tr><td>' + esc(s.s) + '</td><td>' + s.v + '</td><td>' + s.v + ' ÷ ' + s.ar + ' = ' + show(s.mol, 4) + '</td><td>' + show(s.ratio, 3) + '</td>' + (r.multiplier > 1 ? '<td>' + s.whole + '</td>' : '') + '</tr>').join('')
        + '</tbody></table>';
      const atoms = {};
      r.steps.forEach((s) => { atoms[s.s] = 1; });
      massHL(app, atoms, r.pretty);
    };
    el.addEventListener('input', run);
    el.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-emp]');
      if (!b) return;
      read();
      const k = b.dataset.emp;
      if (k === 'pct' || k === 'g') E.mode = k;
      else if (k === 'add') { if (E.rows.length < 6) E.rows.push(['', '']); }
      else if (k === 'clear') { E.rows = [['', ''], ['', '']]; E.M = ''; }
      empirical(app, el);
    });
    app.cellClick = (n) => {
      let target = [...el.querySelectorAll('[data-f=s]')].find((b) => !b.value.trim());
      if (!target) {
        if (E.rows.length >= 6) return;
        read();
        E.rows.push(['', '']);
        empirical(app, el);
        target = [...el.querySelectorAll('[data-f=s]')].pop();
      }
      target.value = app.byN(n).s;
      target.closest('.fpt-emprow').querySelector('[data-f=v]').focus();
      run();
    };
    run();
  }

  /* ── Ions ───────────────────────────────────────────────────────────── */

  function ions(app, el) {
    const I = C().ions(), T = S.ion;
    const label = (x) => C().toSub(x.f) + C().toSup((Math.abs(x.charge) > 1 ? Math.abs(x.charge) : '') + (x.charge > 0 ? '+' : '-'));
    const key = (x) => x.f + '|' + x.charge;
    const opt = (list, cur) => {
      const o = (x) => '<option value="' + esc(key(x)) + '"' + (key(x) === cur ? ' selected' : '') + '>' + esc(label(x)) + ' — ' + esc(x.name) + '</option>';
      return '<optgroup label="Polyatomic">' + list.filter((x) => x.poly).map(o).join('') + '</optgroup><optgroup label="From one element">' + list.filter((x) => !x.poly).map(o).join('') + '</optgroup>';
    };
    el.innerHTML = '<h3>Ionic compounds</h3><p>Pick a positive and a negative ion: the charges cross over to give the formula, and the name follows.</p>'
      + '<div class="fpt-rowf"><label class="fpt-field">Positive ion<select class="fpt-in fpt-cat">' + opt(I.cations, T.cat) + '</select></label>'
      + '<label class="fpt-field">Negative ion<select class="fpt-in fpt-an">' + opt(I.anions, T.an) + '</select></label></div>'
      + '<div class="fpt-out1"></div>'
      + '<div class="fpt-sub">Electron configuration of an ion</div>'
      + '<div class="fpt-rowf"><label class="fpt-field">Element (or click the table)<input class="fpt-in fpt-ionel" value="' + esc(T.el) + '" maxlength="3" autocomplete="off" spellcheck="false"></label>'
      + '<label class="fpt-field">Charge<select class="fpt-in fpt-ionq">' + [-3, -2, -1, 1, 2, 3, 4].map((q) => '<option value="' + q + '"' + (q === T.q ? ' selected' : '') + '>' + (q > 0 ? '+' + q : q) + '</option>').join('') + '</select></label></div>'
      + '<div class="fpt-out2"></div>';
    const cs = el.querySelector('.fpt-cat'), as = el.querySelector('.fpt-an'), o1 = el.querySelector('.fpt-out1');
    const find = (list, v) => list.find((x) => key(x) === v);
    const run1 = () => {
      T.cat = cs.value; T.an = as.value;
      const c = find(I.cations, cs.value), a = find(I.anions, as.value);
      if (!c || !a) { o1.innerHTML = ''; return; }
      let r;
      try { r = C().ionic(c, a); } catch (e) { o1.innerHTML = msg(e); return; }
      o1.innerHTML = '<div class="fpt-result"><div class="fpt-big">' + esc(r.pretty) + '</div><div class="fpt-note">' + esc(r.name) + ' · ' + r.ratio[0] + ' × (+' + c.charge + ') + ' + r.ratio[1] + ' × (' + a.charge + ') = 0</div></div>';
    };
    const ie = el.querySelector('.fpt-ionel'), iq = el.querySelector('.fpt-ionq'), o2 = el.querySelector('.fpt-out2');
    const run2 = () => {
      T.el = ie.value.trim(); T.q = +iq.value;
      const e = app.bySym(T.el);
      if (!e) { o2.innerHTML = T.el ? '<div class="fpt-err">There is no element "' + esc(T.el) + '".</div>' : ''; return; }
      let r;
      try { r = C().ionConfig(e.ec, e.n, T.q); } catch (err) { o2.innerHTML = msg(err); return; }
      const lab = e.s + C().toSup((Math.abs(T.q) > 1 ? Math.abs(T.q) : '') + (T.q > 0 ? '+' : '-'));
      const orb = C().orbitals(r.occ);
      o2.innerHTML = '<div class="fpt-result"><div class="fpt-note">' + esc(lab) + ' · ' + (e.n - T.q) + ' electrons</div><div class="fpt-config-t">' + esc(r.text.short) + '</div>'
        + '<div class="fpt-orbs fpt-orbs--ion">' + orb.map((o) => '<div class="fpt-orb"><div class="fpt-boxes">' + o.boxes.map((b) => '<span class="fpt-box">' + (b === 2 ? '↑↓' : b === 1 ? '↑' : '') + '</span>').join('') + '</div><span>' + o.sub + '</span></div>').join('') + '</div>'
        + (T.q > 0 && core().block(e) === 'd' ? '<p class="fpt-note">The outer s electrons go first, then d.</p>' : '') + '</div>';
      app.highlight([e.n], lab);
    };
    cs.addEventListener('change', run1);
    as.addEventListener('change', run1);
    ie.addEventListener('input', run2);
    iq.addEventListener('change', run2);
    app.cellClick = (n) => { ie.value = app.byN(n).s; run2(); };
    run1();
    run2();
  }

  /* ── Compare ────────────────────────────────────────────────────────── */

  function compare(app, el) {
    const pins = app.st.pins;
    const K = core();
    const els = pins.map((n) => app.byN(n));
    let h = '<h3>Compare elements</h3><p>Click up to four elements in the table (or ⇄ on an element) to set them side by side. The largest in each row is highlighted.</p>';
    if (!els.length) {
      h += '<div class="fpt-result fpt-note">Nothing picked yet — click elements in the table.</div>';
    } else {
      const rows = [
        ['Atomic number', (e) => e.n, (v) => v],
        ['Atomic mass', (e) => e.mass, (v) => (v === Math.round(v) ? '[' + v + ']' : (Math.round(v * 100 + 1e-7) / 100).toFixed(2))],
        ['Electronegativity', K.PROP.en.get, (v) => v.toFixed(2)],
        ['1st ionization (kJ/mol)', K.PROP.ie.get, (v) => Math.round(v)],
        ['Electron affinity (kJ/mol)', K.PROP.ea.get, (v) => Math.round(v)],
        ['Atomic radius (pm)', K.PROP.rc.get, (v) => v],
        ['Melting point', K.mpK, (v) => app.tempText(v)],
        ['Boiling point', K.bpK, (v) => app.tempText(v)],
        ['Density (g/cm³)', K.PROP.d.get, (v) => K.fmt(v, 4)],
        ['Outer electrons', K.PROP.outer.get, (v) => v],
      ];
      h += '<table class="fpt-cmp"><thead><tr><th></th>' + els.map((e) => '<th style="color:' + K.CAT[e.cat].colour + '">' + esc(e.s) + '</th>').join('') + '</tr></thead><tbody>';
      rows.forEach((r) => {
        const vals = els.map((e) => { const v = r[1](e); return v == null || !Number.isFinite(v) ? null : v; });
        const have = vals.filter((v) => v != null);
        const max = have.length ? Math.max.apply(null, have) : null;
        h += '<tr><td>' + r[0] + '</td>' + vals.map((v) => '<td' + (v != null && v === max && have.length > 1 ? ' class="is-max"' : '') + '>' + (v == null ? '—' : esc(String(r[2](v)))) + '</td>').join('') + '</tr>';
      });
      h += '<tr><td>Configuration</td>' + els.map((e) => { let t; try { t = C().configText(C().occupancy(e.ec)).short; } catch (err) { t = '—'; } return '<td class="fpt-cmp-ec">' + esc(t) + '</td>'; }).join('') + '</tr>';
      h += '</tbody></table><p class="fpt-note"><button type="button" class="fpt-link fpt-cmpclear">Clear</button></p>';
    }
    el.innerHTML = h;
    const clear = el.querySelector('.fpt-cmpclear');
    if (clear) clear.addEventListener('click', () => { app.st.pins = []; app.save(); compare(app, el); });
    app.highlight(pins.length ? pins.slice() : null, pins.length ? 'the comparison' : '');
    app.cellClick = (n) => {
      const i = pins.indexOf(n);
      if (i >= 0) pins.splice(i, 1);
      else { pins.push(n); if (pins.length > 4) pins.shift(); }
      app.save();
      compare(app, el);
    };
  }

  window.FluxPTableTools = { render: render, action: action, TOOLS: TOOLS };
})();
