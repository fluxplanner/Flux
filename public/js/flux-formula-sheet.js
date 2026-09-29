/* ════════════════════════════════════════════════════════════════════════
   FLUX · FORMULA SHEET
   One sheet per subject, split into the same units the subject already has.

   Before this, a subject's formulas were scattered across three shapes in
   three files, and which one you got depended on where you clicked:

     flux-toolbox.js         FORMULA_SHEET   Physics · Chemistry · Biology,
                                             grouped by its own titles
     flux-reference-tools.js MATH_FORMULAS   Maths, behind a modal opened
                                             from a reference tool — the
                                             subject with the most formulas
                                             was the one where they were
                                             hardest to find
     flux-study-econ.js      F               Economics, name/formula pairs

   Nothing is retyped here. Both tables are read from the globals their own
   files export, and this module only decides which unit each group belongs
   under. A second copy of ~200 formulas would be a second copy to keep
   right, and the one that drifts is always the copy nobody is looking at.

   The unit names below are not invented: they are the labels from UNITS in
   flux-study-hub.js, so the sheet's sections line up with the tabs the
   student already navigates. Where a group has no unit to belong to —
   Thermodynamics has no physics unit, Constants belong to the whole subject
   — it gets a section rather than being forced somewhere it does not fit or,
   worse, dropped.
   ════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* Which source groups make up each unit, in display order. A group named
     here that no longer exists upstream is skipped, so a retitled group
     leaves a smaller sheet rather than a broken one. */
  const PHYSICS = [
    { unit: 'Mechanics', groups: ['Kinematics', 'Dynamics', 'Energy & Work', 'Circular & Gravitation'] },
    { unit: 'Waves & electricity', groups: ['Waves & Sound', 'Electricity & Magnetism'] },
    /* Physics has no thermodynamics unit in the tool list. A section of its
       own is honest about that; filing it under Mechanics would put PV = nRT
       somewhere nobody would look for it. */
    { unit: 'Thermodynamics', groups: ['Thermodynamics'] },
    { unit: 'Constants', groups: ['Constants'] },
  ];
  const CHEMISTRY = [
    { unit: 'Ions & compounds', groups: ['Acids & Bases'] },
    { unit: 'Reactions & amounts', groups: ['Stoichiometry', 'Kinetics & Equilibrium'] },
    { unit: 'Solutions & gases', groups: ['Gas Laws'] },
    { unit: 'Energy & electrochemistry', groups: ['Thermochemistry', 'Electrochemistry'] },
  ];
  const BIOLOGY = [
    { unit: 'Cells & microscopy', groups: ['Cell & Molecular'] },
    { unit: 'Genetics', groups: ['Genetics'] },
    { unit: 'Data & disease', groups: ['Ecology'] },
    { unit: 'Body & homeostasis', groups: ['Body & Homeostasis'] },
  ];
  /* Maths comes from the other table, so it is keyed by that table's section
     names rather than by group titles. Trig rides with Algebra & graphing: it
     has no unit of its own in the tool list, and beside the graphing tools is
     where someone reaching for the unit circle looks. */
  const MATHS = [
    { unit: 'Algebra & graphing', sections: ['algebra', 'trig'] },
    { unit: 'Calculus', sections: ['calculus'] },
    { unit: 'Statistics', sections: ['stats'] },
  ];

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  /* Shown as typeset maths (stacked fractions, real exponents); the text
     itself is unchanged, and it is what search and the copy button use. */
  const typeset = (f) => (window.FluxFormulaTypeset
    ? '<div class="ffs-math">' + window.FluxFormulaTypeset.toHtml(f) + '</div>'
    : '<code>' + esc(f) + '</code>');

  /** One FORMULA_SHEET row as {f, note}. The gravity row is a placeholder
      resolved from the student's programme (DP 9.8, MYP 10) — copied as it
      stood, it was an empty card in Constants. */
  function item(it) {
    let row = it;
    if (it.gravity) {
      row = typeof window.fluxGravityRow === 'function' ? window.fluxGravityRow()
        : { f: 'g = 9.8 m/s²  (MYP: 10)', vars: ['gravitational field strength — DP uses 9.8, MYP rounds to 10'] };
    }
    return { f: row.f, note: (row.vars || []).join(' · ') };
  }

  /** Groups from FLUX_FORMULA_DATA, normalised to {f, note}. */
  function fromToolbox(subject, plan) {
    const src = (window.FLUX_FORMULA_DATA || {})[subject] || [];
    const byTitle = new Map(src.map((g) => [g.title, g]));
    const used = new Set();
    const out = plan.map((p) => {
      const items = [];
      for (const title of p.groups) {
        const g = byTitle.get(title);
        if (!g) continue;
        used.add(title);
        for (const it of g.items || []) items.push(item(it));
      }
      return { unit: p.unit, items };
    });
    /* Anything the plan forgot still has to appear. A formula vanishing
       because a group was renamed upstream is the exact failure this sheet
       exists to end. */
    const orphans = [];
    for (const g of src) {
      if (used.has(g.title)) continue;
      for (const it of g.items || []) orphans.push(item(it));
    }
    if (orphans.length) out.push({ unit: 'Also in this subject', items: orphans });
    return out.filter((s) => s.items.length);
  }

  /** Sections from FLUX_MATH_FORMULA_DATA, normalised the same way. */
  function fromMaths(plan) {
    const src = window.FLUX_MATH_FORMULA_DATA || {};
    const used = new Set();
    const out = plan.map((p) => {
      const items = [];
      for (const key of p.sections) {
        for (const it of src[key] || []) {
          used.add(key);
          items.push({
            f: it.eq, name: it.name,
            note: it.vars && it.vars !== '-' ? it.vars : '',
            ex: it.ex && it.ex !== '-' ? it.ex : '',
          });
        }
      }
      return { unit: p.unit, items };
    });
    const orphans = [];
    for (const key of Object.keys(src)) {
      if (used.has(key)) continue;
      for (const it of src[key]) orphans.push({ f: it.eq, name: it.name, note: it.vars });
    }
    if (orphans.length) out.push({ unit: 'Also in this subject', items: orphans });

    /* Geometry lives outside MATH_FORMULAS — it is the shapes tool's own data,
       kept there because each entry carries an SVG. The formulas still belong
       in a sheet that claims to hold everything, so they are flattened in
       here: "Circle · Area" rather than a diagram. The shapes tool keeps the
       drawings; this keeps the equations findable by search. */
    const geo = window.FLUX_GEO_FORMULA_DATA || [];
    const geoItems = [];
    for (const g of geo) {
      for (const pair of (g.formulas || [])) {
        geoItems.push({ f: pair[1], name: g.name + ' · ' + pair[0], note: g.kind === '3D' ? '3D solid' : '2D shape' });
      }
    }
    if (geoItems.length) out.push({ unit: 'Geometry', items: geoItems });

    return out.filter((s) => s.items.length);
  }

  /* ── Your working ──────────────────────────────────────────────────────
     Drag a formula (or tap its +) into the pad and it becomes a line you can
     edit — change a subscript, rename a symbol, put numbers in. "Plug in
     values" does the routine part of showing working: fill in what you know,
     leave the one you want blank, and it writes the substituted line and the
     answer underneath (flux-working-math.js does the reading and solving).
     Every line stays editable, so the working ends up in the student's own
     notation. Saved per subject on this device. */
  const PAD_KEY = 'flux_formula_working_v1';
  const PAD_MAX = 80;
  function loadPad() {
    try {
      if (typeof window.load === 'function') return window.load(PAD_KEY, {}) || {};
      return JSON.parse(localStorage.getItem(PAD_KEY) || '{}') || {};
    } catch (_) { return {}; }
  }
  function savePad(all) {
    try {
      if (typeof window.save === 'function') window.save(PAD_KEY, all);
      else localStorage.setItem(PAD_KEY, JSON.stringify(all));
    } catch (_) { /* full or private storage: the working still shows until the page closes */ }
  }
  function padShell() {
    return `<aside class="ffw" aria-label="Your working">
      <div class="ffw-h"><div><b>Your working</b><span class="ffw-sub">Drag a formula here or tap its +. Every line is editable — type _ for a subscript (v_1), ^ for a power.</span></div>
        <div class="ffw-acts"><button type="button" class="ffw-btn" data-ffw="copy" title="Copy all your working">Copy</button><button type="button" class="ffw-btn" data-ffw="clear" title="Clear your working">Clear</button></div></div>
      <div class="ffw-lines"></div>
      <button type="button" class="ffw-btn ffw-blank" data-ffw="blank">+ Blank line</button>
    </aside>`;
  }
  function mountPad(sid, el, sheet) {
    const all = loadPad();
    let lines = Array.isArray(all[sid]) ? all[sid].filter((l) => l && typeof l.text === 'string').slice(0, PAD_MAX) : [];
    let open = -1;                              // the line whose plug-in panel is showing
    const M = () => window.FluxWorkingMath;
    /* "m_1v_1" is how people type m₁v₁, but to the typesetter _1v_1 is one
       subscript label. Digits after _ become real subscript digits for the
       preview and for plugging in; the line keeps what was typed. */
    const SUBD = '₀₁₂₃₄₅₆₇₈₉';
    const norm = (t) => String(t).replace(/_(\d+)/g, (m, d) => d.split('').map((c) => SUBD[+c]).join(''));
    const show = (t) => (String(t).trim() ? typeset(norm(t)) : '<span class="ffw-empty">empty line</span>');
    const persist = () => { all[sid] = lines; savePad(all); };
    const lineHTML = (l, i) => {
      const a = M() && l.kind !== 'ans' ? M().analyse(norm(l.text)) : { ok: false };
      const plug = open === i && a.ok
        ? `<div class="ffw-plug"><div class="ffw-plug-h">Fill in what you know — leave the one to find blank.</div>
            <div class="ffw-syms">${a.symbols.map((n) => `<label class="ffw-sym"><span>${typeset(n)}</span><input class="ffw-val" data-sym="${esc(n)}" inputmode="decimal" placeholder="?" spellcheck="false" aria-label="Value of ${esc(n)}"></label>`).join('')}</div>
            <div class="ffw-plug-go"><label class="ffw-sf">Sig figs <select class="ffw-sfsel">${[2, 3, 4, 5].map((n) => `<option${n === 3 ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
              <button type="button" class="ffw-btn ffw-btn--go" data-ffw="write" data-i="${i}">Write it out</button></div>
            <div class="ffw-err" role="status"></div>
            ${/(sin|cos|tan)/.test(l.text) ? '<div class="ffw-hint">Angles are in degrees.</div>' : ''}</div>`
        : '';
      return `<div class="ffw-line ffw-line--${esc(l.kind || 'note')}" data-i="${i}">
        <div class="ffw-math">${show(l.text)}</div>
        <div class="ffw-row"><input class="ffw-in" data-i="${i}" value="${esc(l.text)}" spellcheck="false" aria-label="Edit this line">
          ${a.ok ? `<button type="button" class="ffw-btn ffw-btn--plug" data-ffw="plug" data-i="${i}" aria-expanded="${open === i}" title="Plug in values — fill in what you know, leave one blank">Plug in</button>` : ''}
          <button type="button" class="ffw-x" data-ffw="del" data-i="${i}" aria-label="Remove this line" title="Remove">✕</button></div>
        ${plug}</div>`;
    };
    const draw = () => {
      const box = el.querySelector('.ffw-lines');
      box.innerHTML = lines.length
        ? lines.map(lineHTML).join('')
        : '<div class="ffw-drop-hint">Drop a formula here to start showing your working.</div>';
      el.classList.toggle('has-lines', lines.length > 0);
      if (window.FluxFormulaTypeset && window.FluxFormulaTypeset.fit) window.FluxFormulaTypeset.fit(el);
    };
    const api = {
      add(text, kind, fromButton) {
        if (lines.length >= PAD_MAX) { if (window.showToast) window.showToast('Your working is full — clear some lines first.', 'warning'); return; }
        lines.push({ text: String(text || ''), kind: kind || 'formula' });
        open = -1;
        persist(); draw();
        // On a narrow screen the pad sits above the sheet, out of sight.
        const r = el.getBoundingClientRect();
        if (fromButton && (r.bottom < 0 || r.top > (window.innerHeight || 800))) {
          if (window.showToast) window.showToast('Added to your working', 'success');
        }
        el.classList.remove('is-flash'); void el.offsetWidth; el.classList.add('is-flash');
      },
    };

    el.addEventListener('input', (e) => {
      const inp = e.target.closest('.ffw-in');
      if (!inp) return;
      const i = +inp.dataset.i;
      lines[i].text = inp.value;
      persist();
      const math = inp.closest('.ffw-line').querySelector('.ffw-math');
      math.innerHTML = show(inp.value);
    });
    // Whether "Plug in values" applies can change as a line is edited; settle it when editing ends.
    el.addEventListener('change', (e) => { if (e.target.closest('.ffw-in')) draw(); });
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-ffw]');
      if (!b) return;
      const act = b.dataset.ffw, i = +b.dataset.i;
      if (act === 'del') { lines.splice(i, 1); if (open === i) open = -1; persist(); draw(); return; }
      if (act === 'plug') { open = open === i ? -1 : i; draw(); const f = el.querySelector('.ffw-val'); if (f) f.focus(); return; }
      if (act === 'blank') { api.add('', 'note'); const ins = el.querySelectorAll('.ffw-in'); if (ins.length) ins[ins.length - 1].focus(); return; }
      if (act === 'clear') { if (!lines.length || window.confirm('Clear all your working for this subject?')) { lines = []; open = -1; persist(); draw(); } return; }
      if (act === 'copy') {
        const text = lines.map((l) => l.text).join('\n');
        try { navigator.clipboard.writeText(text); b.textContent = 'Copied'; setTimeout(() => { b.textContent = 'Copy'; }, 1200); }
        catch (_) { if (window.showToast) window.showToast('Copying is blocked here.', 'warning'); }
        return;
      }
      if (act === 'write') {
        const panel = b.closest('.ffw-plug');
        const texts = {};
        panel.querySelectorAll('.ffw-val').forEach((inp) => { texts[inp.dataset.sym] = inp.value; });
        const sf = +panel.querySelector('.ffw-sfsel').value || 3;
        const r = M().plugIn(norm(lines[i].text), texts, { sf: sf });
        if (r.error) { panel.querySelector('.ffw-err').textContent = r.error; return; }
        lines.splice(i + 1, 0, { text: r.substituted, kind: 'sub' }, { text: r.answer, kind: 'ans' });
        lines = lines.slice(0, PAD_MAX);
        open = -1;
        persist(); draw();
      }
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.closest('.ffw-val')) {
        e.preventDefault();
        const go = e.target.closest('.ffw-plug').querySelector('[data-ffw="write"]');
        if (go) go.click();
      }
    });

    // Drag from the sheet onto the pad.
    sheet.addEventListener('dragstart', (e) => {
      const item = e.target.closest && e.target.closest('.ffs-item');
      if (!item || !e.dataTransfer) return;
      e.dataTransfer.setData('text/plain', item.dataset.f);
      e.dataTransfer.setData('application/x-flux-formula', item.dataset.f);
      e.dataTransfer.effectAllowed = 'copy';
      el.classList.add('is-target');
    });
    sheet.addEventListener('dragend', () => el.classList.remove('is-target', 'is-over'));
    el.addEventListener('dragover', (e) => {
      if (!e.dataTransfer) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      el.classList.add('is-over');
    });
    el.addEventListener('dragleave', (e) => { if (!el.contains(e.relatedTarget)) el.classList.remove('is-over'); });
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.classList.remove('is-target', 'is-over');
      const f = e.dataTransfer && (e.dataTransfer.getData('application/x-flux-formula') || e.dataTransfer.getData('text/plain'));
      if (f) api.add(f, 'formula');
    });

    draw();
    return api;
  }

  function sheetFor(sid) {
    if (sid === 'math') return fromMaths(MATHS);
    if (sid === 'physics') return fromToolbox('Physics', PHYSICS);
    if (sid === 'chemistry') return fromToolbox('Chemistry', CHEMISTRY);
    if (sid === 'biology') return fromToolbox('Biology', BIOLOGY);
    return [];
  }

  function render(sid, body) {
    const units = sheetFor(sid);
    if (!units.length) {
      body.innerHTML = '<div class="fsh-card" style="padding:24px">'
        + 'Formulas for this subject are still being written up.</div>';
      return;
    }
    const total = units.reduce((n, u) => n + u.items.length, 0);
    body.innerHTML = `<div class="ffs-wrap">${padShell()}<div class="ffs">
      <div class="ffs-head">
        <div>
          <h3 class="ffs-title">Formula sheet</h3>
          <p class="ffs-sub">${total} formulas, grouped the same way as the units above.</p>
        </div>
        <input type="search" class="ffs-search" placeholder="Find a formula…" aria-label="Find a formula">
      </div>
      <nav class="ffs-jump" aria-label="Jump to a unit">
        ${units.map((u, i) => `<button type="button" class="ffs-jump-btn" data-go="${i}">${esc(u.unit)}</button>`).join('')}
      </nav>
      ${units.map((u, i) => `
        <section class="ffs-unit" data-unit="${i}">
          <h4 class="ffs-unit-h"><span class="ffs-unit-n">${i + 1}</span>${esc(u.unit)}<span class="ffs-unit-c">${u.items.length}</span></h4>
          <div class="ffs-items">
            ${u.items.map((it) => `
              <div class="ffs-item" draggable="true" data-f="${esc(it.f)}" data-hay="${esc(((it.name || '') + ' ' + it.f + ' ' + (it.note || '')).toLowerCase())}">
                ${it.name ? `<div class="ffs-name">${esc(it.name)}</div>` : ''}
                <div class="ffs-f">${typeset(it.f)}
                  <span class="ffs-f-acts"><button type="button" class="ffs-add" data-add="${esc(it.f)}" aria-label="Add to your working" title="Add to your working">+</button><button type="button" class="ffs-copy" data-copy="${esc(it.f)}" aria-label="Copy formula" title="Copy">⧉</button></span>
                </div>
                ${it.note ? `<div class="ffs-note">${esc(it.note)}</div>` : ''}
                ${it.ex ? `<div class="ffs-ex">${esc(it.ex)}</div>` : ''}
              </div>`).join('')}
          </div>
        </section>`).join('')}
      <p class="ffs-empty" hidden>Nothing matches that.</p>
    </div></div>`;

    const root = body.querySelector('.ffs');
    const pad = mountPad(sid, body.querySelector('.ffw'), root);
    const fit = () => { if (window.FluxFormulaTypeset && window.FluxFormulaTypeset.fit) window.FluxFormulaTypeset.fit(root); };
    requestAnimationFrame(fit);
    // Cards change width with the window and the sidebar; refit when they do.
    if (window.ResizeObserver) {
      let t = 0;
      const ro = new ResizeObserver(() => { clearTimeout(t); t = setTimeout(() => { if (!root.isConnected) { ro.disconnect(); return; } fit(); }, 80); });
      ro.observe(root);
    }
    root.addEventListener('click', (e) => {
      const jump = e.target.closest('.ffs-jump-btn');
      if (jump) {
        const sec = root.querySelector(`.ffs-unit[data-unit="${jump.dataset.go}"]`);
        if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      const add = e.target.closest('.ffs-add');
      if (add) { pad.add(add.dataset.add, 'formula', true); return; }
      const copy = e.target.closest('.ffs-copy');
      if (copy) {
        try {
          navigator.clipboard.writeText(copy.dataset.copy);
          copy.textContent = '✓';
          setTimeout(() => { copy.textContent = '⧉'; }, 1200);
        } catch (_) { /* clipboard blocked — the formula is still on screen */ }
      }
    });

    const search = root.querySelector('.ffs-search');
    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      let shown = 0;
      root.querySelectorAll('.ffs-item').forEach((el) => {
        const hit = !q || el.dataset.hay.includes(q);
        el.hidden = !hit;
        if (hit) shown++;
      });
      // A unit heading with every formula filtered out is just a stray title.
      root.querySelectorAll('.ffs-unit').forEach((sec) => {
        sec.hidden = !sec.querySelector('.ffs-item:not([hidden])');
      });
      root.querySelector('.ffs-jump').hidden = !!q;
      root.querySelector('.ffs-empty').hidden = shown > 0;
    });
  }

  /* Registered last so it lands at the end of every subject, which is where
     the owner asked for it: "at the end of the units, put the formula sheet
     for EVERYTHING". */
  /* Only maths and physics are registered here. Chemistry and Biology already
     own a tool called Formulas — a CHEM_TAB and a registered tool
     respectively, both pointing at the old ungrouped renderer — so adding one
     would leave those two subjects with two formula sheets one tab apart,
     which is the arrangement this is meant to end. Those two are repointed at
     render() where they are defined instead. */
  function boot() {
    const H = window.fluxStudyHub;
    if (!H || typeof H.register !== 'function') { setTimeout(boot, 400); return; }
    for (const sid of ['math', 'physics']) {
      H.register(sid, [{
        id: 'formula-sheet',
        name: 'Formula sheet',
        icon: '∑',
        desc: 'formula sheet equations reference all formulas ' + sid,
        render: (b) => render(sid, b),
      }]);
    }
  }
  boot();

  window.FluxFormulaSheet = { sheetFor, render };
})();
