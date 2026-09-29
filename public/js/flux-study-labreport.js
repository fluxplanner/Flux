/* ============================================================================
   FLUX STUDY HUB · Lab report (Science toolkit)

   One tool for writing up a practical, beside the Measurements grapher in
   Science toolkit — the subject every science shares.

     Structure      every section of a lab report: what goes in it, and the
                    mistakes that cost marks
     Plan yours     fill in the question, variables and method; copy a
                    skeleton with every heading ready to write under
     IB criteria    the four DP internal-assessment criteria, and MYP B and C
     Uncertainties  the propagation rules, and a calculator that shows its
                    working line by line

   The criteria are described in our own words. The plan is saved on this
   device (window.save, per signed-in user).
   ========================================================================== */
(function () {
  'use strict';

  function fmt(v) {
    if (!Number.isFinite(v)) return String(v);
    const a = Math.abs(v);
    if (a !== 0 && (a >= 1e6 || a < 1e-3)) return v.toExponential(3).replace(/\.?0+e/, 'e');
    return String(Number(v.toPrecision(4)));
  }

  /* ── Uncertainty propagation (pure; tested in test/unit/lab-report.test.mjs) ──
     The rules IB and most school courses use:
       + and −        add the absolute uncertainties
       × and ÷        add the percentage uncertainties
       Aⁿ             multiply the percentage uncertainty by |n|
     Returns { value, abs, pct, steps[] } or { error }. */
  function propagate(op, A, dA, B, dB, n) {
    const a = Number(A), da = Math.abs(Number(dA) || 0), b = Number(B), db = Math.abs(Number(dB) || 0);
    if (A === '' || A == null || !Number.isFinite(a)) return { error: 'Enter a value for A.' };
    const pctOf = (v, d) => (v === 0 ? null : Math.abs(d / v) * 100);
    if (op === 'pow') {
      const p = Number(n);
      if (n === '' || n == null || !Number.isFinite(p)) return { error: 'Enter the power n.' };
      const value = Math.pow(a, p);
      const pa = pctOf(a, da);
      if (pa == null) return { error: 'A is zero, so it has no percentage uncertainty to scale.' };
      const pct = Math.abs(p) * pa;
      return { value, pct, abs: Math.abs(value) * pct / 100, steps: [
        `% uncertainty in A = ${fmt(da)} ÷ ${fmt(Math.abs(a))} × 100 = ${fmt(pa)}%`,
        `Raising to the power ${fmt(p)} multiplies it by ${fmt(Math.abs(p))}: ${fmt(pct)}%`,
      ] };
    }
    if (B === '' || B == null || !Number.isFinite(b)) return { error: 'Enter a value for B.' };
    if (op === 'add' || op === 'sub') {
      const value = op === 'add' ? a + b : a - b;
      const abs = da + db;
      return { value, abs, pct: pctOf(value, abs), steps: [
        `${op === 'add' ? 'Adding' : 'Subtracting'}: add the absolute uncertainties — ${fmt(da)} + ${fmt(db)} = ${fmt(abs)}`,
      ] };
    }
    if (op === 'mul' || op === 'div') {
      if (op === 'div' && b === 0) return { error: 'B is zero — you cannot divide by it.' };
      const value = op === 'mul' ? a * b : a / b;
      const pa = pctOf(a, da), pb = pctOf(b, db);
      if (pa == null || pb == null) return { error: 'A value of zero has no percentage uncertainty.' };
      const pct = pa + pb;
      return { value, pct, abs: Math.abs(value) * pct / 100, steps: [
        `% uncertainty in A = ${fmt(pa)}%,  in B = ${fmt(pb)}%`,
        `${op === 'mul' ? 'Multiplying' : 'Dividing'}: add the percentages — ${fmt(pa)}% + ${fmt(pb)}% = ${fmt(pct)}%`,
      ] };
    }
    return { error: 'Choose an operation.' };
  }
  /**
   * Round a result the way a lab report writes it: the uncertainty to one
   * significant figure (two when it starts with a 1), and the value to the
   * same decimal place. 9.8123 ± 0.0467 → "9.81 ± 0.05".
   */
  function rounded(value, abs) {
    if (!Number.isFinite(value) || !Number.isFinite(abs) || abs <= 0) return fmt(value);
    const exp = Math.floor(Math.log10(abs));
    const lead = Math.floor(abs / Math.pow(10, exp) + 1e-9);
    const place = lead === 1 ? exp - 1 : exp;             // decimal position of the last kept digit
    const unit = Math.pow(10, place);
    const ru = Math.round(abs / unit) * unit;
    const rv = Math.round(value / unit) * unit;
    const dp = Math.max(0, -place);
    return rv.toFixed(dp) + ' ± ' + ru.toFixed(dp);
  }

  window.FluxLabReport = { propagate, rounded };

  function boot() {
    const H = window.fluxStudyHub;
    if (!H || !H.register) { return setTimeout(boot, 60); }
    const esc = H.helpers.esc;

    const SECTIONS = [
      ['Research question', 'A focused question you can answer with your data, naming the independent and dependent variables, their units and the range you will test.', ['Names both variables, with units', 'States the range of the independent variable', 'Could be answered by one experiment, not a whole topic'], 'How does the length of a pendulum (0.20–1.00 m) affect its period of oscillation?'],
      ['Background', 'The science behind the investigation: the theory, the equation you will test, and why the question is worth asking. Cite your sources.', ['Explains the relationship you expect, and why', 'Includes any equation you will use to process the data', 'Sources are cited, not just listed'], ''],
      ['Hypothesis', 'A prediction with a scientific reason. Required in MYP; in DP it is optional, but a clear expected relationship helps your conclusion.', ['Says what will change and in which direction', 'Gives the scientific reason'], ''],
      ['Variables', 'Independent (what you change — its values and how you measure them), dependent (what you measure, and with what), and controlled (what you keep the same, why it matters, and how you keep it constant).', ['At least five values of the independent variable', 'Instrument and resolution for the dependent variable', 'Each controlled variable has a "why" and a "how"'], ''],
      ['Method', 'Numbered steps someone else could follow exactly, a list of apparatus with each instrument\'s resolution, and a labelled diagram or photo.', ['Repeats — at least three trials per value', 'Enough detail to reproduce the results', 'Safety, ethical and environmental points'], ''],
      ['Raw data', 'A table of everything you measured, with headings, units and uncertainties, and every value to the precision of the instrument. Add qualitative observations.', ['Units and ± uncertainty in each heading', 'Consistent decimal places, matching the instrument', 'Observations noted, not just numbers'], ''],
      ['Processed data', 'How the raw data became the result: one worked sample calculation for each step, means, and uncertainties carried through.', ['A sample calculation for every step', 'Uncertainty propagated to the final value', 'Processed table with units'], ''],
      ['Graph', 'The independent variable on x, the dependent on y, labelled axes with units, error bars, and a line of best fit. The gradient\'s uncertainty from steepest and shallowest lines.', ['Axis titles and units', 'Error bars on the points', 'Best-fit line, plus max/min lines for the gradient'], ''],
      ['Conclusion', 'Answer the research question with numbers and their uncertainty, compare with the accepted or theoretical value, and explain the result scientifically.', ['States the result with its uncertainty', 'Compares % error with % uncertainty', 'Links back to the background science'], ''],
      ['Evaluation', 'Strengths and weaknesses of the method, sorted into random and systematic errors, with the effect each had on the result — then specific, realistic improvements and an extension.', ['Weaknesses are specific to this experiment', 'Says how each error affected the result', 'Improvements are realistic in a school lab'], ''],
      ['References', 'Every source you used, in one consistent citation style.', ['One style throughout (e.g. APA or MLA)', 'In-text citations match the list'], ''],
    ];
    const MISTAKES = [
      'A research question that is really a topic ("the effect of temperature on enzymes") instead of a measurable question with a range.',
      'Controlled variables listed without saying why they matter or how they were kept constant.',
      'Raw data with no units, no uncertainties, or more decimal places than the instrument can give.',
      'A graph without error bars, or a best-fit line forced through the origin when theory does not say it should.',
      'Evaluation that says "human error" or "more trials" without saying which error, how big, and in which direction.',
      'A conclusion that only restates the hypothesis instead of quoting the result with its uncertainty.',
    ];
    const DP = [
      ['Research design', 6, 'A focused question set in scientific context; a method that is appropriate, repeatable and explained, including how data will be collected and controlled.'],
      ['Data analysis', 6, 'Clear recording and processing of the data, with uncertainties handled correctly and graphs that show the relationship.'],
      ['Conclusion', 6, 'A conclusion justified by the data and the uncertainties, and related to the accepted scientific context.'],
      ['Evaluation', 6, 'The method\'s weaknesses and limitations identified and explained, with realistic, relevant improvements.'],
    ];
    const MYP = [
      ['B · Inquiring and designing', 8, 'A testable question and hypothesis, variables and how they are controlled, and a safe, logical method.'],
      ['C · Processing and evaluating', 8, 'Data presented and processed, results interpreted, the hypothesis and method evaluated, and improvements suggested.'],
    ];

    // ── Saved plan ─────────────────────────────────────────────────────────
    const KEY = 'flux_lab_report_v1';
    const blank = () => ({ title: '', rq: '', iv: '', ivRange: '', dv: '', dvHow: '', cvs: '', hyp: '', method: '', trials: '', safety: '' });
    const loadPlan = () => {
      try { const v = typeof window.load === 'function' ? window.load(KEY, null) : JSON.parse(localStorage.getItem(KEY) || 'null'); return Object.assign(blank(), v || {}); }
      catch (_) { return blank(); }
    };
    const savePlan = (p) => {
      try { if (typeof window.save === 'function') window.save(KEY, p); else localStorage.setItem(KEY, JSON.stringify(p)); } catch (_) { /* private window */ }
    };
    function skeleton(p) {
      const line = (h, v, hint) => `## ${h}\n${v && v.trim() ? v.trim() : '[' + hint + ']'}\n`;
      const cvs = p.cvs.trim()
        ? p.cvs.trim().split(/\n+/).map((l) => '- ' + l.trim()).join('\n')
        : '- [variable — why it matters — how you kept it constant]';
      return [
        '# ' + (p.title.trim() || '[Title]'),
        '',
        line('Research question', p.rq, 'How does … (range, units) affect … ?'),
        line('Background', '', 'the theory, the equation you will test, and why it matters — with citations'),
        line('Hypothesis', p.hyp, 'prediction + scientific reason'),
        '## Variables',
        `Independent: ${p.iv.trim() || '[what you change]'}${p.ivRange.trim() ? ' — ' + p.ivRange.trim() : ''}`,
        `Dependent: ${p.dv.trim() || '[what you measure]'}${p.dvHow.trim() ? ' — ' + p.dvHow.trim() : ''}`,
        'Controlled:',
        cvs,
        '',
        line('Method', p.method, 'numbered steps, apparatus with resolutions, diagram'),
        `Trials per value: ${p.trials.trim() || '[at least 3]'}`,
        '',
        line('Safety, ethics and environment', p.safety, 'risks and how you managed them'),
        line('Raw data', '', 'table with units and ± uncertainties; observations'),
        line('Processed data', '', 'sample calculations; propagated uncertainties; processed table'),
        line('Graph', '', 'axes with units, error bars, best-fit line, max/min gradient'),
        line('Conclusion', '', 'result ± uncertainty; % error vs % uncertainty; scientific explanation'),
        line('Evaluation', '', 'strengths; random and systematic errors and their effect; improvements; extension'),
        line('References', '', 'one consistent style'),
      ].join('\n');
    }

    const opSym = { add: '+', sub: '−', mul: '×', div: '÷', pow: '^' };
    function calcOut(calc) {
      const r = calc.A !== '' ? propagate(calc.op, calc.A, calc.dA, calc.B, calc.dB, calc.n) : null;
      if (!r) return '<p class="fsh-note">Enter values to see the working.</p>';
      if (r.error) return `<div class="ffw-err">${esc(r.error)}</div>`;
      return `<ol class="fsh-lab-steps">${r.steps.map((s) => `<li>${esc(s)}</li>`).join('')}<li>Absolute uncertainty = ${esc(fmt(r.abs))}${r.pct != null ? ` (${esc(fmt(r.pct))}%)` : ''}</li></ol>
        <div class="fsh-out"><span class="big" style="font-size:20px">${esc(rounded(r.value, r.abs))}</span></div>`;
    }

    let tab = 'structure';
    const calc = { op: 'mul', A: '', dA: '', B: '', dB: '', n: '2' };
    function render(body) {
      const tabs = [['structure', 'Structure'], ['plan', 'Plan yours'], ['criteria', 'IB criteria'], ['unc', 'Uncertainties']];
      let inner = '';
      if (tab === 'structure') {
        inner = `<div class="fsh-lab-secs">${SECTIONS.map((s, i) => `<details class="fsh-lab-sec"${i === 0 ? ' open' : ''}><summary><span class="fsh-lab-n">${i + 1}</span>${esc(s[0])}</summary>
            <p>${esc(s[1])}</p>${s[3] ? `<div class="fsh-respelled"><b>Example:</b> ${esc(s[3])}</div>` : ''}
            <ul class="fsh-checks">${s[2].map((c) => `<li>${esc(c)}</li>`).join('')}</ul></details>`).join('')}</div>
          <div class="fsh-gloss-h">Mistakes that cost marks</div><ul class="fsh-bullets">${MISTAKES.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>`;
      } else if (tab === 'plan') {
        const p = loadPlan();
        const f = (k, label, ph, area) => `<label class="fsh-plan-f"><span>${esc(label)}</span>${area
          ? `<textarea class="fsh-input fsh-lab-ta" data-k="${k}" rows="3" placeholder="${esc(ph)}">${esc(p[k])}</textarea>`
          : `<input class="fsh-input" data-k="${k}" placeholder="${esc(ph)}" value="${esc(p[k])}">`}</label>`;
        inner = `<div class="fsh-plan" id="labPlan">
            ${f('title', 'Title', 'e.g. Pendulum length and period')}
            ${f('rq', 'Research question', 'How does … (range, units) affect … ?')}
            <div class="fsh-plan-p"><div class="fsh-plan-n">Variables</div>
              ${f('iv', 'Independent — what you change', 'e.g. length of the pendulum (m)')}
              ${f('ivRange', 'Its values', 'e.g. 0.20, 0.40, 0.60, 0.80, 1.00 m')}
              ${f('dv', 'Dependent — what you measure', 'e.g. period (s)')}
              ${f('dvHow', 'How you measure it', 'e.g. time 10 swings with a stopwatch (±0.01 s)')}</div>
            ${f('cvs', 'Controlled variables — one per line: variable — why — how', 'mass of the bob — affects… — same 50 g bob throughout', true)}
            ${f('hyp', 'Hypothesis', 'what you expect, and the science behind it', true)}
            ${f('method', 'Method', '1. …\n2. …', true)}
            ${f('trials', 'Trials per value', 'e.g. 3')}
            ${f('safety', 'Safety, ethics, environment', 'risks and how you manage them', true)}
            <div><button type="button" class="fsh-btn" id="labCopy">Copy report skeleton</button> <span class="fsh-note" id="labCopied">Saved on this device as you type.</span></div>
          </div>`;
      } else if (tab === 'criteria') {
        const rows = (list) => list.map(([n, max, d]) => `<div class="fsh-lab-crit"><div class="fsh-lab-crit-h"><b>${esc(n)}</b><span>${max} marks</span></div><p>${esc(d)}</p></div>`).join('');
        inner = `<div class="fsh-gloss-h">IB Diploma — scientific investigation</div>
          <p class="fsh-note" style="margin-top:0">Four criteria, 6 marks each (24 in total). The report is at most 3,000 words and is worth 20% of the final grade.</p>
          ${rows(DP)}
          <div class="fsh-gloss-h">IB MYP sciences — the lab report criteria</div>
          ${rows(MYP)}
          <p class="fsh-note">These are summaries in our own words. Your teacher has the official descriptors and the details for your exam year — check against those.</p>`;
      } else {
        inner = `<div class="fsh-lab-rules">
            <div class="fsh-lab-rule"><b>Reading an instrument</b><span>Analogue scale: ± half the smallest division. Digital display: ± one in the last digit.</span></div>
            <div class="fsh-lab-rule"><b>Repeated readings</b><span>Uncertainty of the mean ≈ half the range: (largest − smallest) ÷ 2.</span></div>
            <div class="fsh-lab-rule"><b>Adding or subtracting</b><span>Add the absolute uncertainties.</span></div>
            <div class="fsh-lab-rule"><b>Multiplying or dividing</b><span>Add the percentage uncertainties.</span></div>
            <div class="fsh-lab-rule"><b>Powers</b><span>Multiply the percentage uncertainty by the power — squaring doubles it, a square root halves it.</span></div>
            <div class="fsh-lab-rule"><b>From a graph</b><span>Gradient uncertainty = (steepest − shallowest gradient) ÷ 2. The Measurements grapher draws both lines (max/min).</span></div>
            <div class="fsh-lab-rule"><b>Writing it down</b><span>Round the uncertainty to 1 significant figure (2 if it starts with 1), then the value to the same decimal place: 9.81 ± 0.05.</span></div>
          </div>
          <div class="fsh-gloss-h">Work one out</div>
          <div class="fsh-lab-calc" id="labCalc">
            <label class="fsh-plan-f"><span>A</span><input class="fsh-input" data-c="A" inputmode="decimal" value="${esc(calc.A)}" placeholder="value"></label>
            <label class="fsh-plan-f"><span>± A</span><input class="fsh-input" data-c="dA" inputmode="decimal" value="${esc(calc.dA)}" placeholder="uncertainty"></label>
            <label class="fsh-plan-f"><span>Operation</span><select class="fsh-input" data-c="op">${Object.keys(opSym).map((k) => `<option value="${k}"${k === calc.op ? ' selected' : ''}>A ${opSym[k]} ${k === 'pow' ? 'n' : 'B'}</option>`).join('')}</select></label>
            ${calc.op === 'pow'
              ? `<label class="fsh-plan-f"><span>n</span><input class="fsh-input" data-c="n" inputmode="decimal" value="${esc(calc.n)}"></label>`
              : `<label class="fsh-plan-f"><span>B</span><input class="fsh-input" data-c="B" inputmode="decimal" value="${esc(calc.B)}" placeholder="value"></label>
                 <label class="fsh-plan-f"><span>± B</span><input class="fsh-input" data-c="dB" inputmode="decimal" value="${esc(calc.dB)}" placeholder="uncertainty"></label>`}
          </div>
          <div class="fsh-lab-out" id="labOut">${calcOut(calc)}</div>`;
      }
      body.innerHTML = `<div class="fsh-card" style="padding:20px"><h3 style="margin:0 0 4px;font-size:16px">Lab report</h3>
        <p class="sub" style="color:var(--fsh-mut);font-size:12px;margin:0 0 14px">How to write up a practical — for IB DP internal assessments, MYP sciences, or any lab report.</p>
        <div class="fsh-seg" id="labTabs" style="margin-bottom:14px">${tabs.map(([id, l]) => `<button type="button" data-tab="${id}" class="${id === tab ? 'active' : ''}">${esc(l)}</button>`).join('')}</div>
        ${inner}</div>`;
      body.querySelector('#labTabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (!b) return; tab = b.dataset.tab; render(body); });
      const plan = body.querySelector('#labPlan');
      if (plan) {
        plan.addEventListener('input', (e) => { const el = e.target.closest('[data-k]'); if (!el) return; const p = loadPlan(); p[el.dataset.k] = el.value; savePlan(p); });
        body.querySelector('#labCopy').addEventListener('click', async () => {
          const note = body.querySelector('#labCopied');
          try { await navigator.clipboard.writeText(skeleton(loadPlan())); note.textContent = 'Copied — paste it into your document.'; }
          catch (_) { note.textContent = 'Copying is blocked here.'; }
        });
      }
      const c = body.querySelector('#labCalc');
      if (c) {
        c.addEventListener('input', (e) => {
          const el = e.target.closest('[data-c]');
          if (!el || el.tagName === 'SELECT') return;
          calc[el.dataset.c] = el.value;
          body.querySelector('#labOut').innerHTML = calcOut(calc);
        });
        c.addEventListener('change', (e) => { const el = e.target.closest('select[data-c]'); if (!el) return; calc.op = el.value; render(body); });
      }
    }

    H.register('labgraph', [
      { id: 'lab-report', name: 'Lab report', icon: '🧾', desc: 'lab report write up internal assessment ia research question variables method evaluation conclusion uncertainty propagation criteria myp', render, ai: { name: 'uncertaintyPropagate', description: 'Propagate an uncertainty. Arg: "A dA op B dB" with op one of + - * /, or "A dA ^ n".', params: { expr: 'string' }, run: (a) => { const m = String(a).trim().split(/\s+/); const ops = { '+': 'add', '-': 'sub', '*': 'mul', '×': 'mul', '/': 'div', '÷': 'div', '^': 'pow' }; const op = ops[m[2]]; const r = op === 'pow' ? propagate('pow', m[0], m[1], null, null, m[3]) : propagate(op, m[0], m[1], m[3], m[4]); return r.error ? r : { result: rounded(r.value, r.abs), steps: r.steps }; } } },
    ]);
  }
  boot();
})();
