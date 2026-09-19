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
        for (const it of g.items || []) items.push({ f: it.f, note: (it.vars || []).join(' · ') });
      }
      return { unit: p.unit, items };
    });
    /* Anything the plan forgot still has to appear. A formula vanishing
       because a group was renamed upstream is the exact failure this sheet
       exists to end. */
    const orphans = [];
    for (const g of src) {
      if (used.has(g.title)) continue;
      for (const it of g.items || []) orphans.push({ f: it.f, note: (it.vars || []).join(' · ') });
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
    return out.filter((s) => s.items.length);
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
    body.innerHTML = `<div class="ffs">
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
              <div class="ffs-item" data-hay="${esc(((it.name || '') + ' ' + it.f + ' ' + (it.note || '')).toLowerCase())}">
                ${it.name ? `<div class="ffs-name">${esc(it.name)}</div>` : ''}
                <div class="ffs-f"><code>${esc(it.f)}</code>
                  <button type="button" class="ffs-copy" data-copy="${esc(it.f)}" aria-label="Copy formula" title="Copy">⧉</button>
                </div>
                ${it.note ? `<div class="ffs-note">${esc(it.note)}</div>` : ''}
                ${it.ex ? `<div class="ffs-ex">${esc(it.ex)}</div>` : ''}
              </div>`).join('')}
          </div>
        </section>`).join('')}
      <p class="ffs-empty" hidden>Nothing matches that.</p>
    </div>`;

    const root = body.querySelector('.ffs');
    root.addEventListener('click', (e) => {
      const jump = e.target.closest('.ffs-jump-btn');
      if (jump) {
        const sec = root.querySelector(`.ffs-unit[data-unit="${jump.dataset.go}"]`);
        if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
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
