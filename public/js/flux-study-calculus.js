/* ============================================================================
   FLUX STUDY HUB · Calculus (AP Calculus AB)

   Registers extra tabs onto the existing `math` subject rather than taking a
   pill of its own — calculus is a course, not a subject, and Mathematics
   already holds that rail slot. H.register concatenates, so this adds to
   flux-study-math.js without touching it.

   Deliberately does NOT restate the basic rules. flux-toolbox-dp.js already
   carries a derivative/integral table (MATH_RULES, opened by
   openMathAnalysisReference and surfaced as the legacy "Analysis & calculus"
   tab), and a second copy would drift out of step with the first. What that
   sheet has no room for is everything below: limits, the four named theorems,
   the applications that most AB questions are actually built from, and any way
   at all to practise — it is a static reference behind a modal.

   Scope is AB. No series, no polar or parametric, no integration by parts:
   listing BC material on an AB sheet costs the reader twice, once reading it
   and once revising something that will not be examined.

   No storage. The drill's score is per session.
   ========================================================================== */
(function () {
  'use strict';
  function boot() {
    const H = window.fluxStudyHub;
    if (!H || !H.register) { return setTimeout(boot, 60); }
    const esc = H.helpers.esc;

    const card = (title, sub, inner) =>
      `<div class="fsh-card" style="padding:20px"><h3 style="margin:0 0 4px;font-size:16px">${esc(title)}</h3>`
      + (sub ? `<p class="sub" style="color:var(--fsh-mut);font-size:12px;margin:0 0 14px">${esc(sub)}</p>` : '')
      + inner + '</div>';
    /* [expression, name, note?] — the expression leads because it is the thing
       being scanned for; the name is the label already half-remembered. */
    const refList = (rows) => `<div class="fsh-formula-list">${rows.map((r) =>
      `<div class="fsh-formula"><div class="fx">${esc(r[0])}</div>`
      + `<div class="nm" style="margin-top:3px">${esc(r[1])}</div>`
      + (r[2] ? `<div class="nm" style="color:var(--fsh-ink-2)">${esc(r[2])}</div>` : '')
      + '</div>').join('')}</div>`;

    // ── Limits ───────────────────────────────────────────────────────────────
    const L_FORMS = [
      ['0/0  or  ∞/∞', 'Indeterminate — keep working', 'It does not mean the limit fails to exist. Factor, rationalise, or use L’Hôpital.'],
      ['c/0,  c ≠ 0', 'Not indeterminate', 'A vertical asymptote. Check the sign from each side separately.'],
      ['0·∞,  ∞ − ∞,  1^∞', 'Also indeterminate', 'Rewrite as a quotient first — L’Hôpital only accepts 0/0 and ∞/∞.'],
    ];
    const L_TOOLS = [
      ['lim f/g = lim f′/g′', 'L’Hôpital’s rule', 'Derivative of the top over derivative of the bottom — not the quotient rule. Only for 0/0 and ∞/∞, and check the form again before repeating it.'],
      ['Compare degrees', 'Rational function as x → ∞', 'Top degree lower → 0. Equal → ratio of leading coefficients. Higher → ±∞.'],
      ['lim(x→0) sin x / x = 1', 'Standard limit', 'Worth memorising; it is the one that makes d/dx[sin x] = cos x true.'],
      ['lim(x→0) (1 − cos x) / x = 0', 'Standard limit'],
      ['g(x) ≤ f(x) ≤ h(x)', 'Squeeze theorem', 'If the outer two share a limit at c, f is trapped into the same one.'],
    ];
    const L_CONT = [
      ['f(c) exists · lim f exists · they are equal', 'Continuity at c', 'All three. Most "is it continuous" questions fail on the third.'],
      ['Differentiable ⇒ continuous', 'One direction only', 'The converse is false: |x| is continuous at 0 and has no derivative there.'],
      ['Removable · jump · infinite', 'Kinds of discontinuity', 'Removable is the hole a limit still sees through.'],
    ];

    function renderLimits(body) {
      body.innerHTML =
        card('What the form is telling you', 'Read the form first, then choose the method.', refList(L_FORMS))
        + card('Ways through', 'The tools that resolve the forms above.', refList(L_TOOLS))
        + card('Continuity', 'The definition marks are awarded for.', refList(L_CONT));
    }

    // ── Theorems ─────────────────────────────────────────────────────────────
    const T_ROWS = [
      ['f continuous on [a, b]', 'Intermediate Value Theorem', 'f takes every value between f(a) and f(b) somewhere inside. This is what proves a root exists.'],
      ['f continuous on a closed [a, b]', 'Extreme Value Theorem', 'f attains an absolute maximum and an absolute minimum. Both "closed" and "continuous" are load-bearing.'],
      ['Continuous on [a, b], differentiable on (a, b)', 'Mean Value Theorem', 'Some c has f′(c) = (f(b) − f(a))/(b − a) — the instantaneous rate equals the average rate at least once.'],
      ['MVT with f(a) = f(b)', 'Rolle’s Theorem', 'Then f′(c) = 0 somewhere between.'],
      ['d/dx ∫ₐˣ f(t) dt = f(x)', 'Fundamental Theorem, part 1', 'Differentiating an integral undoes it. With an upper limit like x², the chain rule comes too: f(x²)·2x.'],
      ['∫ₐᵇ f(x) dx = F(b) − F(a)', 'Fundamental Theorem, part 2', 'No +C on a definite integral.'],
    ];
    function renderTheorems(body) {
      body.innerHTML = card('The named theorems',
        'Each one earns its mark only with the hypotheses stated, not just the conclusion.', refList(T_ROWS));
    }

    // ── Applications ─────────────────────────────────────────────────────────
    const A_SHAPE = [
      ['f′(c) = 0 or undefined', 'Critical point', 'A candidate only — not automatically a maximum or a minimum.'],
      ['f′ goes + → −', 'Local maximum', 'First derivative test: read the sign change, not the value.'],
      ['f′ goes − → +', 'Local minimum'],
      ['f″ > 0 concave up · f″ < 0 concave down', 'Concavity'],
      ['f″ changes sign', 'Inflection point', 'f″ = 0 on its own is not enough — it must actually change sign.'],
      ['Compare critical points and both endpoints', 'Absolute extrema on [a, b]', 'The endpoints are where these are most often lost.'],
    ];
    const A_MOTION = [
      ['s(t) → v(t) = s′(t) → a(t) = v′(t)', 'Position, velocity, acceleration'],
      ['speed = |v(t)|', 'Speed is not velocity', 'Speeding up exactly when v and a share a sign.'],
      ['∫ₐᵇ v(t) dt', 'Displacement', 'Net change in position — it can be zero on a long journey.'],
      ['∫ₐᵇ |v(t)| dt', 'Total distance', 'Split the integral at every t where v changes sign.'],
      ['dy/dt = (dy/dx)·(dx/dt)', 'Related rates', 'Differentiate the relationship with respect to t, then substitute. Substituting first throws away the variable being differentiated.'],
    ];
    const A_INT = [
      ['u = g(x), du = g′(x) dx', 'u-substitution', 'On a definite integral either change the limits to u, or convert back to x before evaluating — not neither.'],
      ['(1/(b − a))·∫ₐᵇ f(x) dx', 'Average value of f', 'Not the average of the two endpoint values.'],
      ['π∫ₐᵇ [R(x)]² dx', 'Volume — disk', 'Region rotated about an axis it touches.'],
      ['π∫ₐᵇ ([R(x)]² − [r(x)]²) dx', 'Volume — washer', 'Outer squared minus inner squared. Never (R − r)².'],
      ['∫ₐᵇ (top − bottom) dx', 'Area between curves', 'If the curves cross, split at the crossing.'],
    ];

    function renderApplications(body) {
      body.innerHTML =
        card('Shape of a graph', 'What f′ and f″ let you say about f.', refList(A_SHAPE))
        + card('Motion and related rates', 'The two contexts derivatives are usually dressed in.', refList(A_MOTION))
        + card('What integrals are for', 'Beyond evaluating them.', refList(A_INT));
    }

    // ── Drill ────────────────────────────────────────────────────────────────
    /* Multiple choice rather than free text: "2x", "2·x" and "2 x" are the same
       answer, and a drill that marks a student wrong on notation has taught
       them nothing about calculus. */
    const QS = [
      ['d/dx [ x⁵ ]', '5x⁴', ['x⁶/6', '5x⁵', '4x⁵']],
      ['d/dx [ cos x ]', '−sin x', ['sin x', '−cos x', 'csc x']],
      ['d/dx [ tan x ]', 'sec²x', ['sec x·tan x', '−csc²x', 'cot x']],
      ['d/dx [ ln x ]', '1/x', ['ln x / x', 'x', '−1/x²']],
      ['d/dx [ x·sin x ]', 'sin x + x·cos x', ['cos x', 'x·cos x', 'sin x − x·cos x']],
      ['d/dx [ sin(3x) ]', '3·cos(3x)', ['cos(3x)', '3·sin(3x)', '−3·cos(3x)']],
      ['d/dx [ (2x + 1)⁴ ]', '8(2x + 1)³', ['4(2x + 1)³', '(2x + 1)³', '8(2x + 1)⁴']],
      ['∫ x³ dx', 'x⁴/4 + C', ['3x² + C', 'x⁴ + C', 'x²/2 + C']],
      ['∫ (1/x) dx', 'ln|x| + C', ['1/x² + C', 'x⁻² + C', 'ln x² + C']],
      ['∫ sin x dx', '−cos x + C', ['cos x + C', 'sin x + C', '−sin x + C']],
      ['∫ sec²x dx', 'tan x + C', ['sec x + C', 'cot x + C', '2·sec x + C']],
      ['lim(x→0) sin x / x', '1', ['0', '∞', 'Does not exist']],
      ['lim(x→∞) (3x² + 1)/(5x² − x)', '3/5', ['0', '∞', '3']],
      ['d/dx ∫₀ˣ cos(t) dt', 'cos x', ['sin x', '−sin x', 'cos x − 1']],
      ['∫₀¹ 2x dx', '1', ['2', '1/2', 'x²']],
      ['If f′ changes − to + at c, then c is a', 'local minimum', ['local maximum', 'inflection point', 'vertical asymptote']],
      ['Total distance from v(t) on [a,b]', '∫ₐᵇ |v(t)| dt', ['∫ₐᵇ v(t) dt', 'v(b) − v(a)', '∫ₐᵇ a(t) dt']],
    ];
    let qi = 0, score = 0, asked = 0, answered = false, opts = [];
    function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
    function pick() { qi = Math.floor(Math.random() * QS.length); opts = shuffle([QS[qi][1]].concat(QS[qi][2])); answered = false; }

    function renderDrill(body) {
      if (!opts.length) pick();
      const q = QS[qi];
      body.innerHTML = card('Calculus drill', 'Rules only — nothing here needs a calculator.',
        `<div class="fsh-out" style="margin-bottom:12px"><span class="big" style="font-size:21px">${esc(q[0])}</span></div>`
        + `<div id="calcOpts" style="display:grid;gap:8px">${opts.map((o) =>
          `<button type="button" class="fsh-btn fsh-btn--ghost" data-opt="${esc(o)}" style="justify-content:flex-start;text-align:left;min-height:44px">${esc(o)}</button>`).join('')}</div>`
        + '<div id="calcFb" style="margin-top:12px;font-size:13px;min-height:22px"></div>'
        + '<div style="display:flex;gap:10px;align-items:center;margin-top:10px;flex-wrap:wrap">'
        + '<button type="button" class="fsh-btn" id="calcNext" style="min-height:44px">Next question</button>'
        + `<span class="fsh-note" id="calcScore">Score ${score} / ${asked}</span></div>`);

      body.querySelector('#calcOpts').addEventListener('click', (e) => {
        const b = e.target.closest('[data-opt]');
        if (!b || answered) return;
        answered = true; asked++;
        const right = b.dataset.opt === q[1];
        if (right) score++;
        body.querySelectorAll('#calcOpts button').forEach((btn) => {
          if (btn.dataset.opt === q[1]) btn.style.borderColor = 'rgba(55,201,138,.9)';
          else if (btn === b) btn.style.borderColor = 'rgba(242,84,91,.9)';
        });
        body.querySelector('#calcFb').innerHTML = right
          ? '<span style="color:#37c98a">Correct.</span>'
          : `<span style="color:#f2545b">Not quite — it is ${esc(q[1])}.</span>`;
        body.querySelector('#calcScore').textContent = `Score ${score} / ${asked}`;
      });
      body.querySelector('#calcNext').addEventListener('click', () => { pick(); renderDrill(body); });
    }

    H.register('math', [
      { id: 'ab-limits', name: 'Limits', icon: '⊸', desc: 'limits indeterminate lhopital squeeze continuity differentiable ap calculus ab', render: renderLimits,
        ai: { name: 'limitForm', description: 'What to do with a limit form or which standard limit applies. Arg: a form or name, e.g. "0/0" or "squeeze".', params: { query: 'string' },
          run: (a) => {
            const q = String(typeof a === 'string' ? a : a.query).trim().toLowerCase();
            const m = L_FORMS.concat(L_TOOLS, L_CONT).find((r) => (r[0] + ' ' + r[1]).toLowerCase().indexOf(q) >= 0);
            if (!m) throw new Error('No match');
            return { form: m[0], name: m[1], note: m[2] || '' };
          } } },
      { id: 'ab-theorems', name: 'Theorems', icon: '📐', desc: 'ivt evt mvt rolle fundamental theorem calculus hypotheses ap calculus ab', render: renderTheorems,
        ai: { name: 'calcTheorem', description: 'A named calculus theorem and the hypotheses it needs. Arg: theorem name, e.g. "MVT".', params: { name: 'string' },
          run: (a) => {
            const q = String(typeof a === 'string' ? a : a.name).trim().toLowerCase();
            const m = T_ROWS.find((r) => (r[1] + ' ' + r[0]).toLowerCase().indexOf(q) >= 0);
            if (!m) throw new Error('No such theorem');
            return { theorem: m[1], requires: m[0], note: m[2] || '' };
          } } },
      { id: 'ab-apps', name: 'Applications', icon: '📉', desc: 'curve sketching concavity inflection motion velocity related rates volume washer average value ap calculus ab', render: renderApplications },
      { id: 'ab-drill', name: 'Calculus drill', icon: '🎯', desc: 'calculus practice quiz derivative integral limit ap calculus ab', render: renderDrill },
    ]);
  }
  boot();
})();
