/* ============================================================================
   FLUX STUDY HUB  ·  flux-study-hub.js
   Redesigned Study Tools. Owns the #toolbox panel by overriding
   window.renderToolbox (the function nav('toolbox') calls).

   • Chemistry flagship  — zperiod-inspired interactive workspace:
       Table · Atom · Tools (Balancer / Molar mass / Solubility / Constants) · Worksheet
   • Every other subject — curated directory of the best interactive learning sites.

   Reuses window.fluxPeriodic.ELEMENTS for the 118-element dataset.
   Non-destructive: legacy flux-toolbox.js stays loaded but dormant.
   ========================================================================== */
(function () {
  'use strict';
  if (window.__fluxStudyHub) return;
  window.__fluxStudyHub = true;

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const LS_KEY = 'flux_study_hub';

  // persisted view state ----------------------------------------------------
  let state = { subject: 'chemistry', chemTab: 'table' };
  try { const raw = localStorage.getItem(LS_KEY); if (raw) state = Object.assign(state, JSON.parse(raw)); } catch (e) {}
  const save = () => { try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {} };

  // transient state
  let selEl = 6;      // selected element (periodic detail) — Carbon
  let atomN = 6;      // atom model element
  let atomSpeed = 1;
  let searchQ = '';

  // ── element data ─────────────────────────────────────────────────────────
  const FALLBACK_MASS = { H:1.008,He:4.003,Li:6.94,Be:9.012,B:10.81,C:12.011,N:14.007,O:15.999,F:18.998,Ne:20.18,Na:22.99,Mg:24.305,Al:26.982,Si:28.085,P:30.974,S:32.06,Cl:35.45,Ar:39.948,K:39.098,Ca:40.078,Fe:55.845,Cu:63.546,Zn:65.38,Ag:107.868,Ba:137.327,Pb:207.2 };
  function elements() {
    const E = window.fluxPeriodic && window.fluxPeriodic.ELEMENTS;
    return Array.isArray(E) && E.length ? E : [];
  }
  function massOf(sym) {
    const e = elements().find((x) => x.s === sym);
    if (e) return e.mass;
    return FALLBACK_MASS[sym] != null ? FALLBACK_MASS[sym] : null;
  }
  function elByN(n) { return elements().find((e) => e.n === n) || null; }

  // ── formula parsing ──────────────────────────────────────────────────────
  function parseFormula(f) {
    f = String(f).replace(/[·•]/g, '.').replace(/\s/g, '');
    const frags = f.split('.').filter(Boolean);
    const total = {};
    const add = (dst, src, m) => { for (const k in src) dst[k] = (dst[k] || 0) + src[k] * m; };
    function parseFrag(s) {
      let i = 0;
      function num() { let t = ''; while (/\d/.test(s[i] || '')) { t += s[i]; i++; } return t ? parseInt(t, 10) : 1; }
      function seq() {
        const out = {};
        while (i < s.length) {
          const c = s[i];
          if (c === '(' || c === '[') { i++; const inner = seq(); if (s[i] !== ')' && s[i] !== ']') throw new Error('Unbalanced brackets'); i++; add(out, inner, num()); }
          else if (c === ')' || c === ']') break;
          else if (/[A-Z]/.test(c)) { let sym = c; i++; while (/[a-z]/.test(s[i] || '')) { sym += s[i]; i++; } out[sym] = (out[sym] || 0) + num(); }
          else if (/\d/.test(c)) { const m = num(); add(out, seq(), m); }
          else throw new Error('Unexpected "' + c + '"');
        }
        return out;
      }
      const out = seq();
      if (i < s.length) throw new Error('Parse error');
      return out;
    }
    for (let p = 0; p < frags.length; p++) {
      let part = frags[p], coef = 1;
      const m = part.match(/^(\d+)(.+)$/);
      if (m) { coef = parseInt(m[1], 10); part = m[2]; }
      add(total, parseFrag(part), coef);
    }
    return total;
  }
  const subFmt = (f) => esc(f).replace(/(\d+)/g, '<sub class="sub">$1</sub>');
  const subPlain = (f) => esc(f).replace(/(\d+)/g, '<sub>$1</sub>');

  // ── fraction math + linear balancer ──────────────────────────────────────
  const igcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a; };
  const ilcm = (a, b) => (a === 0 || b === 0 ? 0 : Math.abs(a / igcd(a, b) * b));
  function fr(n, d = 1) { if (d === 0) throw new Error('div0'); if (d < 0) { n = -n; d = -d; } const g = igcd(n, d) || 1; return { n: n / g, d: d / g }; }
  const fadd = (x, y) => fr(x.n * y.d + y.n * x.d, x.d * y.d);
  const fsub = (x, y) => fr(x.n * y.d - y.n * x.d, x.d * y.d);
  const fmul = (x, y) => fr(x.n * y.n, x.d * y.d);
  const fdiv = (x, y) => fr(x.n * y.d, x.d * y.n);
  const fzero = (x) => x.n === 0;

  function balance(input) {
    const sides = String(input).split(/->|=>|⟶|→|=/).map((s) => s.trim()).filter(Boolean);
    if (sides.length !== 2) throw new Error('Use a single arrow, e.g.  H2 + O2 -> H2O');
    const toSpecies = (txt) => txt.split('+').map((t) => t.trim()).filter(Boolean).map((raw) => {
      const formula = raw.replace(/^\d+\s*/, '');
      return { formula, counts: parseFormula(formula) };
    });
    const R = toSpecies(sides[0]), P = toSpecies(sides[1]);
    if (!R.length || !P.length) throw new Error('Need reactants and products.');
    const species = R.concat(P);
    const els = [];
    species.forEach((sp) => Object.keys(sp.counts).forEach((e) => { if (!els.includes(e)) els.push(e); }));
    // matrix els × species (reactants +, products −)
    const M = els.map((e) => species.map((sp, j) => fr((sp.counts[e] || 0) * (j < R.length ? 1 : -1))));
    // RREF
    const rows = M.length, cols = species.length, pivCols = [];
    let r = 0;
    for (let c = 0; c < cols && r < rows; c++) {
      let piv = -1;
      for (let i = r; i < rows; i++) if (!fzero(M[i][c])) { piv = i; break; }
      if (piv < 0) continue;
      [M[r], M[piv]] = [M[piv], M[r]];
      const lead = M[r][c];
      for (let j = 0; j < cols; j++) M[r][j] = fdiv(M[r][j], lead);
      for (let i = 0; i < rows; i++) {
        if (i === r) continue;
        const f = M[i][c];
        if (fzero(f)) continue;
        for (let j = 0; j < cols; j++) M[i][j] = fsub(M[i][j], fmul(f, M[r][j]));
      }
      pivCols.push(c); r++;
    }
    const free = [];
    for (let c = 0; c < cols; c++) if (!pivCols.includes(c)) free.push(c);
    if (free.length === 0) throw new Error('No valid balance — check your formulas.');
    if (free.length > 1) throw new Error('Under-determined — add or remove a species.');
    const f = free[0];
    const x = new Array(cols).fill(null).map(() => fr(0));
    x[f] = fr(1);
    pivCols.forEach((p, i) => { x[p] = fr(-M[i][f].n, M[i][f].d); });
    let L = 1; x.forEach((v) => { L = ilcm(L, v.d) || L; });
    let ints = x.map((v) => v.n * (L / v.d));
    let g = 0; ints.forEach((v) => { g = igcd(g, v); }); if (!g) g = 1;
    ints = ints.map((v) => v / g);
    if (ints.some((v) => v > 0) && ints.some((v) => v < 0)) throw new Error('Cannot balance as written.');
    if (ints.every((v) => v <= 0)) ints = ints.map((v) => -v);
    if (ints.some((v) => v === 0)) throw new Error('Cannot balance — a species drops out.');
    return { R, P, coeffs: ints, type: classify(R, P) };
  }

  function classify(R, P) {
    const isEl = (c) => Object.keys(c).length === 1;
    const fuel = R.find((s) => s.counts.C && s.counts.H);
    const hasO2 = R.some((s) => isEl(s.counts) && s.counts.O);
    const hasCO2 = P.some((s) => s.formula === 'CO2');
    const hasH2O = P.some((s) => s.formula === 'H2O');
    if (fuel && hasO2 && hasCO2 && hasH2O) return { k: 'Combustion', d: 'Fuel + O₂ → CO₂ + H₂O' };
    if (P.length === 1) return { k: 'Synthesis', d: 'Reactants combine into one product' };
    if (R.length === 1) return { k: 'Decomposition', d: 'One compound splits into simpler ones' };
    if (R.length === 2 && P.length === 2) {
      const er = R.filter((s) => isEl(s.counts)).length, ep = P.filter((s) => isEl(s.counts)).length;
      if (er === 1 && ep === 1) return { k: 'Single replacement', d: 'An element displaces another' };
      if (er === 0 && ep === 0) {
        if (hasH2O && /^H/.test(R[0].formula + R[1].formula)) return { k: 'Neutralization', d: 'Acid + base → salt + water' };
        return { k: 'Double replacement', d: 'Ions swap partners' };
      }
    }
    return { k: 'Redox / other', d: 'General balanced reaction' };
  }

  // ── worksheet equation bank ──────────────────────────────────────────────
  const EQUATIONS = [
    ['H2 + O2 -> H2O', 'synthesis', 'easy'], ['N2 + H2 -> NH3', 'synthesis', 'easy'],
    ['Na + Cl2 -> NaCl', 'synthesis', 'easy'], ['Fe + O2 -> Fe2O3', 'synthesis', 'medium'],
    ['Al + O2 -> Al2O3', 'synthesis', 'medium'], ['P4 + O2 -> P2O5', 'synthesis', 'hard'],
    ['H2O -> H2 + O2', 'decomposition', 'easy'], ['CaCO3 -> CaO + CO2', 'decomposition', 'easy'],
    ['KClO3 -> KCl + O2', 'decomposition', 'medium'], ['H2O2 -> H2O + O2', 'decomposition', 'medium'],
    ['NaHCO3 -> Na2CO3 + H2O + CO2', 'decomposition', 'hard'],
    ['CH4 + O2 -> CO2 + H2O', 'combustion', 'easy'], ['C2H6 + O2 -> CO2 + H2O', 'combustion', 'medium'],
    ['C3H8 + O2 -> CO2 + H2O', 'combustion', 'medium'], ['C2H5OH + O2 -> CO2 + H2O', 'combustion', 'hard'],
    ['C6H12O6 + O2 -> CO2 + H2O', 'combustion', 'hard'], ['C8H18 + O2 -> CO2 + H2O', 'combustion', 'hard'],
    ['Zn + HCl -> ZnCl2 + H2', 'single', 'easy'], ['Mg + HCl -> MgCl2 + H2', 'single', 'easy'],
    ['Fe + CuSO4 -> FeSO4 + Cu', 'single', 'easy'], ['Al + HCl -> AlCl3 + H2', 'single', 'medium'],
    ['K + H2O -> KOH + H2', 'single', 'medium'], ['Cl2 + NaBr -> NaCl + Br2', 'single', 'medium'],
    ['AgNO3 + NaCl -> AgCl + NaNO3', 'double', 'easy'], ['HCl + NaOH -> NaCl + H2O', 'double', 'easy'],
    ['BaCl2 + Na2SO4 -> BaSO4 + NaCl', 'double', 'medium'], ['Pb(NO3)2 + KI -> PbI2 + KNO3', 'double', 'medium'],
    ['H2SO4 + NaOH -> Na2SO4 + H2O', 'double', 'medium'], ['Ca(OH)2 + HCl -> CaCl2 + H2O', 'double', 'medium'],
    ['AlCl3 + NaOH -> Al(OH)3 + NaCl', 'double', 'hard'], ['Fe2O3 + CO -> Fe + CO2', 'redox', 'hard'],
  ];
  const TYPE_LABEL = { synthesis: 'Synthesis', decomposition: 'Decomposition', combustion: 'Combustion', single: 'Single replacement', double: 'Double replacement', redox: 'Redox' };

  // solubility rule grid (S soluble · I insoluble · s slightly)
  const SOL_CATIONS = ['Na⁺/K⁺/NH₄⁺', 'Ca²⁺', 'Ba²⁺', 'Ag⁺', 'Pb²⁺', 'Cu²⁺/Fe³⁺'];
  const SOL_ANIONS = ['NO₃⁻', 'Cl⁻', 'SO₄²⁻', 'CO₃²⁻', 'OH⁻', 'S²⁻'];
  const SOL_GRID = [
    // NO3  Cl   SO4  CO3  OH   S
    ['S', 'S', 'S', 'S', 'S', 'S'], // group 1 / ammonium
    ['S', 'S', 's', 'I', 's', 'I'], // Ca
    ['S', 'S', 'I', 'I', 'S', 'I'], // Ba
    ['S', 'I', 's', 'I', 'I', 'I'], // Ag
    ['S', 's', 'I', 'I', 'I', 'I'], // Pb
    ['S', 'S', 'S', 'I', 'I', 'I'], // Cu/Fe(III)
  ];
  const CONSTANTS = [
    ['Avogadro', '6.022×10²³ mol⁻¹'], ['Gas constant R', '8.314 J·mol⁻¹·K⁻¹'],
    ['Molar volume (STP)', '22.7 L·mol⁻¹'], ['Faraday', '96 485 C·mol⁻¹'],
    ['Std pressure', '100 kPa'], ['Std temp', '273.15 K'],
    ['Kw (25 °C)', '1.0×10⁻¹⁴'], ['Planck h', '6.626×10⁻³⁴ J·s'],
  ];

  // ── DIRECTORY (curated interactive learning sites) ───────────────────────
  function R(name, host, url, what, feat, verdict, tags) { return { name, host, url, what, feat, verdict, tags }; }
  const DIRECTORY = {
    chemistry: [{ title: 'More chemistry resources', items: [
      R('ChemCollective', 'chemcollective.org', 'https://chemcollective.org', 'Virtual labs, scenario problems & tutorials (originally Carnegie Mellon).', 'Virtual lab simulations for AP/IB lab skills.', 'B', ['Free', 'Labs']),
      R('PhET — Chemistry', 'phet.colorado.edu', 'https://phet.colorado.edu/en/simulations/filter?subjects=chemistry', 'Interactive sims: states of matter, reactions, molecule shapes, pH.', 'Gold-standard science simulations.', 'A', ['Free', 'Sims']),
      R('Master Organic Chemistry', 'masterorganicchemistry.com', 'https://www.masterorganicchemistry.com', 'Notes, mechanism walkthroughs & cheat sheets for ochem.', 'Best for college-level organic chemistry.', 'A', ['Free+', 'O-Chem']),
    ] }],
    physics: [{ title: 'Physics', items: [
      R('PhET Simulations', 'phet.colorado.edu', 'https://phet.colorado.edu', '~150 free interactive sims across physics & science.', 'Bright, classroom-tested, teacher libraries.', 'A', ['Free', 'Sims']),
      R('Isaac Physics', 'isaacphysics.org', 'https://isaacphysics.org', 'Leveled problem sets GCSE→university with mastery & instant feedback.', 'Excellent for honors/AP/IB practice.', 'A', ['Free', 'Cambridge']),
      R('oPhysics', 'ophysics.com', 'https://www.ophysics.com', 'Large library of GeoGebra-based physics simulations.', 'Broad topic coverage, useful supplement.', 'B', ['Free', 'Sims']),
      R('Falstad Applets', 'falstad.com', 'https://www.falstad.com/mathphysics.html', 'Circuit simulator plus EM, waves & quantum applets.', 'The circuit simulator is iconic & superb.', 'A', ['Free', 'Circuits']),
      R('The Particle Adventure', 'particleadventure.org', 'https://particleadventure.org', 'Guided tour of particle physics & the Standard Model.', 'Good conceptual intro (dated design).', 'C', ['Free']),
    ] }],
    math: [{ title: 'Mathematics', items: [
      R('Desmos', 'desmos.com', 'https://www.desmos.com', 'Graphing & geometry calculators + classroom activities.', 'The cleanest math UI on the web.', 'A', ['Free', 'Graphing']),
      R('Mathigon / Polypad', 'mathigon.org', 'https://mathigon.org', 'Interactive courses + a canvas of virtual manipulatives.', 'Gorgeous, deeply interactive.', 'A', ['Free', 'Manipulatives']),
      R('Seeing Theory', 'brown.edu', 'https://seeing-theory.brown.edu', 'Visual, scroll-driven intro to probability & statistics.', 'Elegant animated primer.', 'A', ['Free', 'Stats']),
      R('Immersive Math', 'immersivemath.com', 'http://immersivemath.com/ila/index.html', 'Fully interactive linear-algebra textbook.', 'Great companion to a LA course.', 'B', ['Free', 'Lin-Alg']),
      R("Paul's Online Math Notes", 'lamar.edu', 'https://tutorial.math.lamar.edu', 'Algebra → Calc III & ODEs, worked examples + practice.', 'Legendary for calculus.', 'A', ['Free', 'Calculus']),
    ] }],
    biology: [{ title: 'Biology & Medicine', items: [
      R('BioDigital Human', 'biodigital.com', 'https://www.biodigital.com', 'Interactive 3D model of the human body — rotate & dissect.', 'Slick, medical-grade 3D (free tier limited).', 'B', ['Account', '3D']),
      R('Learn.Genetics', 'utah.edu', 'https://learn.genetics.utah.edu', 'Explorables on genetics, cells & biology fundamentals.', 'Accurate, free & engaging.', 'A', ['Free', 'Explorable']),
      R('Amoeba Sisters', 'amoebasisters.com', 'https://www.amoebasisters.com', 'Cartoon-style biology videos with free handouts.', 'Great for intro & AP Bio fundamentals.', 'A', ['Free', 'Video']),
    ] }],
    cs: [{ title: 'Computer Science', items: [
      R('VisuAlgo', 'visualgo.net', 'https://visualgo.net', 'Animated visualizations of data structures & algorithms.', 'The best algorithm visualizer available.', 'A', ['Free', 'Algorithms']),
      R('CS50', 'harvard.edu', 'https://cs50.harvard.edu', "Harvard's full intro CS course — lectures, psets, IDE.", 'Outstanding & rigorous.', 'A', ['Free', 'Course']),
      R('Exercism', 'exercism.org', 'https://exercism.org', 'Coding exercises in 70+ languages with free mentoring.', 'Great practice with feedback.', 'A', ['Free', 'Practice']),
      R('LeetCode', 'leetcode.com', 'https://leetcode.com', 'Algorithm & interview problems with an online judge.', 'Best for interview/contest prep.', 'A', ['Freemium', 'Interview']),
      R('CPU.land', 'cpu.land', 'https://cpu.land', 'Interactive explainer of how CPUs & OSes run programs.', 'A beautiful conceptual deep-dive.', 'A', ['Free', 'Read']),
    ] }],
    econ: [{ title: 'Economics', items: [
      R('Our World in Data', 'ourworldindata.org', 'https://ourworldindata.org', 'Interactive charts on development, economics & health.', 'Exceptional data visualization.', 'A', ['Free', 'Data']),
      R('Marginal Revolution U', 'mru.org', 'https://mru.org', 'Free econ video courses — micro, macro, dev, international.', 'High-quality free instruction.', 'A', ['Free', 'Video']),
      R('Gapminder', 'gapminder.org', 'https://www.gapminder.org/tools', "Animated bubble-chart tools (Hans Rosling's work).", 'Iconic & eye-opening (narrow scope).', 'B', ['Free', 'Data']),
    ] }],
    english: [{ title: 'English · Literature · Writing', items: [
      R('LitCharts', 'litcharts.com', 'https://www.litcharts.com', 'Study guides with theme tracking & color-coded analysis.', 'Among the best literature guides.', 'A', ['Freemium', 'Lit']),
      R('SparkNotes', 'sparknotes.com', 'https://www.sparknotes.com', 'Chapter summaries, analysis & quotes.', 'Reliable for plot & themes.', 'B', ['Free', 'Lit']),
      R('Poetry Foundation', 'poetryfoundation.org', 'https://www.poetryfoundation.org', 'Vast poem archive + essays & audio.', 'The authoritative free poetry resource.', 'A', ['Free', 'Poetry']),
      R('Purdue OWL', 'purdue.edu', 'https://owl.purdue.edu', 'Writing, grammar & citation reference (MLA/APA/Chicago).', 'The citation/grammar standard.', 'A', ['Free', 'Citation']),
    ] }],
    history: [{ title: 'History & Geography', items: [
      R('Crash Course', 'thecrashcourse.com', 'https://thecrashcourse.com', 'Fast animated survey videos across history & more.', 'Great for overview & engagement.', 'A', ['Free', 'Video']),
      R('Histography', 'histography.io', 'https://histography.io', 'Interactive timeline of history from Wikipedia.', 'A beautiful exploratory toy.', 'B', ['Free', 'Timeline']),
      R('Geography Games', 'geography-games.org', 'https://geography-games.org', 'Map quizzes for countries, capitals, rivers & flags.', 'Great for geography drilling.', 'A', ['Free', 'Quiz']),
      R('Our World in Data', 'ourworldindata.org', 'https://ourworldindata.org', 'Long-run historical data & charts.', 'Excellent for evidence & IAs.', 'A', ['Free', 'Data']),
    ] }],
    languages: [{ title: 'World Languages', items: [
      R('Language Transfer', 'languagetransfer.org', 'https://www.languagetransfer.org', 'Free audio courses using a Socratic "thinking method".', 'Great for intuition & early fluency.', 'A', ['Free', 'Audio']),
      R('Kwiziq', 'kwiziq.com', 'https://www.kwiziq.com', 'Adaptive French & Spanish grammar by CEFR level.', 'Structured leveled grammar.', 'A', ['Sub', 'Grammar']),
      R('Conjuguemos', 'conjuguemos.com', 'https://conjuguemos.com', 'Conjugation & vocabulary drill platform.', 'Effective drilling (often assigned).', 'B', ['Freemium', 'Drills']),
    ] }],
    astronomy: [{ title: 'Astronomy', items: [
      R('Stellarium Web', 'stellarium-web.org', 'https://stellarium-web.org', 'Browser planetarium showing the real-time sky.', 'Excellent free planetarium.', 'A', ['Free', 'Sky']),
      R('NASA Eyes', 'nasa.gov', 'https://eyes.nasa.gov', '3D solar system, exoplanet & Earth visualizations.', 'Impressive & authoritative.', 'A', ['Free', '3D']),
      R('Solar System Scope', 'solarsystemscope.com', 'https://www.solarsystemscope.com', '3D orrery model of the solar system.', 'Pleasant interactive model.', 'B', ['Free', '3D']),
      R('100,000 Stars', 'chromeexperiments.com', 'https://stars.chromeexperiments.com', "WebGL map of the Milky Way's nearest stars.", 'A gorgeous visualization.', 'B', ['Free', 'WebGL']),
    ] }],
    music: [{ title: 'Music', items: [
      R('Chrome Music Lab', 'chromeexperiments.com', 'https://musiclab.chromeexperiments.com', 'Experiments for sound, rhythm, harmonics & Song Maker.', 'Delightful intro to sound & rhythm.', 'A', ['Free', 'Play']),
      R('Ableton Learning Music', 'ableton.com', 'https://learningmusic.ableton.com', 'Make music in the browser — beats, melody, synthesis.', 'Best interactive intro to production.', 'A', ['Free', 'Interactive']),
      R('musictheory.net', 'musictheory.net', 'https://www.musictheory.net', 'Theory lessons + customizable ear-training trainers.', 'Great for theory drills.', 'A', ['Free', 'Theory']),
    ] }],
    examprep: [
      { title: 'All-level platforms', items: [
        R('Khan Academy', 'khanacademy.org', 'https://www.khanacademy.org', 'Free videos + adaptive practice across K-12 & AP.', 'Best free starting point; official AP partner.', 'A', ['Free', 'K-12', 'AP']),
        R('Brilliant', 'brilliant.org', 'https://brilliant.org', 'Interactive, problem-first courses in STEM.', 'Builds intuition (subscription).', 'A', ['Sub', 'STEM']),
        R('CK-12', 'ck12.org', 'https://www.ck12.org', 'Free adaptive "FlexBook" textbooks + PLIX sims.', 'A genuine free textbook replacement.', 'B', ['Free', 'Textbook']),
        R('Wolfram Alpha', 'wolframalpha.com', 'https://www.wolframalpha.com', 'Computational knowledge engine + demonstrations.', 'Great for checking work.', 'A', ['Freemium', 'Compute']),
      ] },
      { title: 'AP-specific', items: [
        R('AP Classroom', 'collegeboard.org', 'https://apclassroom.collegeboard.org', 'Official College Board hub: AP Daily + Progress Checks.', 'Official real question bank (join code).', 'A', ['Official', 'AP']),
        R('Fiveable', 'fiveable.me', 'https://fiveable.me', 'Student-written guides, unit notes & cram streams.', 'Strong free notes & community.', 'B', ['Freemium', 'AP']),
        R('Marco Learning', 'marcolearning.com', 'https://www.marcolearning.com', 'AP free-response practice with rubric feedback.', 'Good for FRQ technique.', 'B', ['Freemium', 'FRQ']),
        R("Heimler's History", 'heimlershistory.com', 'https://www.youtube.com/@heimlershistory', 'AP-aligned reviews for APUSH, World, Euro & Gov.', 'Excellent AP history cramming.', 'A', ['Free', 'AP']),
        R('Bozeman Science', 'bozemanscience.com', 'https://www.bozemanscience.com', "Paul Andersen's AP Bio/Chem/Physics/Env videos.", 'Solid, accurate AP coverage.', 'B', ['Free', 'AP']),
      ] },
      { title: 'IB Diploma Programme', items: [
        R('Revision Village', 'revisionvillage.com', 'https://www.revisionvillage.com', 'Question banks + video solutions for IB Math & Sciences.', 'Widely regarded best-in-class for IB.', 'A', ['Sub', 'IB']),
        R('IB Documents', 'ibresources.cc', 'https://ibresources.cc', 'Aggregator of past papers, mark schemes & notes.', 'Best for raw past-paper access.', 'A', ['Free', 'IB']),
        R('Lanterna', 'lanterna.com', 'https://lanterna.com/for-students/free-resources', 'Free revision notes & guides across all six groups.', 'Useful free notes (funnels to tutoring).', 'B', ['Free', 'IB']),
        R('InThinking', 'thinkib.net', 'https://www.thinkib.net', 'Examiner-authored subject sites with deep content.', 'High quality (usually school-bought).', 'A', ['Sub', 'IB']),
        R('Hack Your Course', 'hackyourcourse.com', 'https://www.hackyourcourse.com/ib-free-resources', 'Curated, annotated directory of IB resources.', 'Excellent meta-resource.', 'B', ['Free', 'IB']),
      ] },
    ],
    explorables: [{ title: 'Cross-subject explorables', items: [
      R('Bartosz Ciechanowski', 'ciechanowski.com', 'https://ciechanowski.com', 'Long-form interactive deep-dives with WebGL sims.', 'Arguably the best explanatory work online.', 'A+', ['Free', 'Read']),
      R('Nicky Case', 'ncase.me', 'https://ncase.me', 'Playable explainers on trust, networks & systems.', 'Excellent for systems thinking.', 'A', ['Free', 'Play']),
      R('Explorable Explanations', 'explorabl.es', 'https://explorabl.es', 'Curated hub of interactive learning toys.', 'Great jumping-off point.', 'B', ['Free', 'Hub']),
    ] }],
    practice: [{ title: 'Practice & retention', items: [
      R('Anki', 'ankiweb.net', 'https://apps.ankiweb.net', 'Spaced-repetition flashcards with shared decks & add-ons.', 'The most powerful retention tool there is.', 'A', ['Free', 'SRS']),
      R('Quizlet', 'quizlet.com', 'https://quizlet.com', 'Flashcards, matching games & practice tests.', 'Easy & popular (best AI features paid).', 'B', ['Freemium', 'Cards']),
    ] }],
  };

  const SUBJECTS = [
    { id: 'chemistry', name: 'Chemistry', ico: '⚗', accent: '#34d0ff', flagship: true },
    { id: 'physics', name: 'Physics', ico: '🪐', accent: '#7c8cff' },
    { id: 'math', name: 'Mathematics', ico: '∑', accent: '#5b8def' },
    { id: 'biology', name: 'Biology', ico: '🧬', accent: '#37c98a' },
    { id: 'cs', name: 'Computer Science', ico: '💻', accent: '#4fb6c9' },
    { id: 'econ', name: 'Economics', ico: '💹', accent: '#f4a13f' },
    { id: 'english', name: 'English', ico: '✒', accent: '#e069b4' },
    { id: 'history', name: 'History & Geo', ico: '🏛', accent: '#d8a657' },
    { id: 'languages', name: 'Languages', ico: '🌍', accent: '#36c5d6' },
    { id: 'astronomy', name: 'Astronomy', ico: '🔭', accent: '#a06eff' },
    { id: 'music', name: 'Music', ico: '🎵', accent: '#ff7a59' },
    { id: 'examprep', name: 'Exam Prep', ico: '🎓', accent: '#5eecb6' },
    { id: 'explorables', name: 'Explorables', ico: '✨', accent: '#b16cf0' },
    { id: 'practice', name: 'Practice', ico: '🔁', accent: '#34d0ff' },
  ];
  const subjById = (id) => SUBJECTS.find((s) => s.id === id) || SUBJECTS[0];

  // ── colour helpers ───────────────────────────────────────────────────────
  function hexRgb(hex) {
    const m = hex.replace('#', '');
    const v = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
    const n = parseInt(v, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function applyAccent(hex) {
    const root = $('fshRoot'); if (!root) return;
    root.style.setProperty('--fsh-accent', hex);
    root.style.setProperty('--fsh-accent-rgb', hexRgb(hex).join(','));
  }
  const logoText = (name) => {
    const w = name.replace(/[^A-Za-z0-9 ].*/, '').trim().split(/\s+/);
    return (w.length > 1 ? w[0][0] + w[1][0] : name.slice(0, 2)).toUpperCase();
  };

  // ── card / directory rendering ───────────────────────────────────────────
  function resCard(it) {
    return `<a class="fsh-res" href="${esc(it.url)}" target="_blank" rel="noopener noreferrer">
      <div class="fsh-res-head">
        <span class="fsh-res-logo">${esc(logoText(it.name))}</span>
        <span><span class="fsh-res-title">${esc(it.name)}</span><span class="fsh-res-host">${esc(it.host)}</span></span>
      </div>
      <p class="fsh-res-what">${esc(it.what)}</p>
      <p class="fsh-res-feat">${esc(it.feat)}</p>
      <div class="fsh-res-foot">
        <span class="fsh-tags">${(it.tags || []).map((t) => `<span class="fsh-tag">${esc(t)}</span>`).join('')}</span>
        <span class="fsh-verdict" data-v="${esc(it.verdict)}">${esc(it.verdict)}</span>
      </div>
      <span class="fsh-res-open">Open site →</span>
    </a>`;
  }
  function renderDirectory(id) {
    const groups = DIRECTORY[id] || [];
    const subj = subjById(id);
    return `<div class="fsh-panel">${groups.map((g) => `
      <div class="fsh-section-head">
        <span class="fsh-sh-ico">${subj.ico}</span>
        <span><h2>${esc(g.title)}</h2><p>Curated interactive sites · opens in a new tab</p></span>
      </div>
      <div class="fsh-grid">${g.items.map(resCard).join('')}</div>`).join('')}</div>`;
  }

  // ── CHEMISTRY: periodic table ────────────────────────────────────────────
  const CATS = [
    ['all', 'All', '#8b90ad'], ['alkali', 'Alkali', '#e23e57'], ['alkaline', 'Alkaline earth', '#f47b2f'],
    ['transition', 'Transition', '#3a5bd9'], ['post-transition', 'Post-transition', '#2d8aa6'],
    ['metalloid', 'Metalloid', '#5b3fd6'], ['nonmetal', 'Nonmetal', '#1f9e74'], ['halogen', 'Halogen', '#1f9bb8'],
    ['noble', 'Noble gas', '#8a3fd6'], ['lanthanide', 'Lanthanide', '#c23d96'], ['actinide', 'Actinide', '#c23d5a'],
  ];
  let ptCat = 'all', ptQuery = '';
  function elCellHTML(e) {
    const m = e.mass === Math.round(e.mass) ? e.mass : e.mass.toFixed(2);
    return `<button type="button" class="fsh-el" data-cat="${e.cat}" data-n="${e.n}"
      style="grid-row:${e.row};grid-column:${e.col}" aria-label="${esc(e.name)}, number ${e.n}">
      <span class="e-n">${e.n}</span><span class="e-s">${esc(e.s)}</span><span class="e-m">${m}</span></button>`;
  }
  function renderPeriodicTab() {
    const els = elements();
    if (!els.length) return `<div class="fsh-card" style="padding:24px">Periodic data still loading… reopen Study tools in a moment.</div>`;
    const grid = els.map(elCellHTML).join('') +
      `<div class="fsh-pt-spacer" style="grid-row:8;grid-column:1/-1"></div>` +
      `<div class="fsh-pt-fnote" style="grid-row:11">La–Lu (57–71) and Ac–Lr (89–103) shown in the lower two rows.</div>`;
    return `<div class="fsh-panel">
      <div class="fsh-pt-toolbar">
        <div class="fsh-search" style="min-width:220px;flex:1;max-width:320px">
          <span class="fsh-search-ico">⌕</span>
          <input id="fshPtSearch" type="search" placeholder="Find element, symbol or number…" value="${esc(ptQuery)}">
        </div>
        <div class="fsh-pt-cats" id="fshPtCats">${CATS.map((c) =>
          `<button type="button" class="fsh-cat-chip${ptCat === c[0] ? ' active' : ''}" data-cat="${c[0]}">
            ${c[0] === 'all' ? '' : `<span class="dot" style="background:${c[2]}"></span>`}${esc(c[1])}</button>`).join('')}</div>
      </div>
      <div class="fsh-pt-scroll"><div class="fsh-pt" id="fshPtGrid">${grid}</div></div>
      <div class="fsh-el-detail" id="fshElDetail">${elDetailHTML(elByN(selEl))}</div>
    </div>`;
  }
  const phaseAt = (e) => { const t = 25; if (e.mp != null && t < e.mp) return 'Solid'; if (e.bp != null && t > e.bp) return 'Gas'; if (e.mp != null && e.bp != null) return 'Liquid'; return e.phase === 'g' ? 'Gas' : e.phase === 'l' ? 'Liquid' : 'Solid'; };
  function elDetailHTML(e) {
    if (!e) return '';
    const prop = (k, v) => v == null || v === '' ? '' : `<div class="fsh-prop"><div class="k">${k}</div><div class="v">${v}</div></div>`;
    return `<div class="fsh-eld fsh-card">
      <div class="fsh-eld-badge" data-cat="${e.cat}" style="background:var(--el-c)">
        <span class="b-n">${e.n}</span><span class="b-s">${esc(e.s)}</span>
        <span class="b-name">${esc(e.name)}</span><span class="b-m">${e.mass}</span>
      </div>
      <div class="fsh-eld-main">
        <h3>${esc(e.name)}</h3><div class="fsh-eld-cat">${esc(e.cat.replace('-', ' '))} · Period ${e.p}${e.g ? ' · Group ' + e.g : ''}</div>
        <div class="fsh-eld-props">
          ${prop('Atomic mass', e.mass)}
          ${prop('Config', esc(e.ec))}
          ${prop('Phase at 25 °C', phaseAt(e))}
          ${prop('Melting pt', e.mp != null ? e.mp + ' °C' : null)}
          ${prop('Boiling pt', e.bp != null ? e.bp + ' °C' : null)}
          ${prop('Density', e.d != null ? e.d + ' g/cm³' : null)}
          ${prop('Electronegativity', e.en != null ? e.en : null)}
          ${prop('Discovered', e.year ? (e.year < 0 ? Math.abs(e.year) + ' BCE' : e.year) : null)}
        </div>
        ${e.fact ? `<p class="fsh-eld-fact">${esc(e.fact)}</p>` : ''}
        <div style="margin-top:14px"><button type="button" class="fsh-btn ghost" data-act="view-atom" data-n="${e.n}">View 3D atom →</button></div>
      </div>
    </div>`;
  }
  function applyPtFilter() {
    const q = ptQuery.trim().toLowerCase();
    document.querySelectorAll('#fshPtGrid .fsh-el').forEach((cell) => {
      const e = elByN(+cell.dataset.n);
      const okCat = ptCat === 'all' || e.cat === ptCat;
      const okQ = !q || e.name.toLowerCase().includes(q) || e.s.toLowerCase() === q || String(e.n) === q;
      cell.classList.toggle('dim', !(okCat && okQ));
    });
  }

  // ── CHEMISTRY: atom model ────────────────────────────────────────────────
  function shellFill(z) {
    const cap = [2, 8, 18, 32, 32, 18, 8]; const out = []; let rem = z;
    for (const c of cap) { if (rem <= 0) break; out.push(Math.min(c, rem)); rem -= c; }
    return out;
  }
  function atomStageHTML(e) {
    const shells = shellFill(e.n);
    const ns = shells.length, minR = 42, maxR = 138;
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
    const shellHTML = shells.map((cnt, i) => {
      const Rr = ns === 1 ? 72 : minR + (maxR - minR) * (i / (ns - 1));
      const dur = ((9 + i * 3.5) / Math.max(0.2, atomSpeed)).toFixed(2);
      const es = [];
      for (let j = 0; j < cnt; j++) {
        const ang = (j / cnt) * 360;
        es.push(`<span class="fsh-e" style="transform:rotateZ(${ang}deg) translateY(-${Rr}px) rotateX(-72deg)"></span>`);
      }
      return `<div class="fsh-shell" style="width:${Rr * 2}px;height:${Rr * 2}px;--spin:${dur}s${reduced ? ';animation:none' : ''}">${es.join('')}</div>`;
    }).join('');
    return `<div class="fsh-atom"><div class="fsh-atom-nucleus">${esc(e.s)}</div>${shellHTML}</div>`;
  }
  function renderAtomTab() {
    const els = elements(); if (!els.length) return `<div class="fsh-card" style="padding:24px">Loading…</div>`;
    const e = elByN(atomN) || els[0];
    const shells = shellFill(e.n);
    return `<div class="fsh-panel"><div class="fsh-atom-wrap">
      <div class="fsh-atom-stage" id="fshAtomStage">${atomStageHTML(e)}</div>
      <div class="fsh-atom-info">
        <div class="fsh-card">
          <div class="fsh-atom-picker">
            <button type="button" class="fsh-iconbtn" data-act="atom-prev" aria-label="Previous element">‹</button>
            <input id="fshAtomInput" type="text" value="${esc(e.s)}" aria-label="Element symbol or number" />
            <button type="button" class="fsh-iconbtn" data-act="atom-next" aria-label="Next element">›</button>
          </div>
          <div style="margin-top:14px">
            <div style="font-size:22px;font-weight:740">${esc(e.name)} <span style="color:var(--fsh-mut);font-weight:500">· ${e.n}</span></div>
            <div style="font-size:12.5px;color:var(--fsh-mut);margin-top:2px;text-transform:capitalize">${esc(e.cat.replace('-', ' '))} · ${e.mass} u</div>
          </div>
          <div class="fsh-shellbars">${shells.map((c, i) => `<span class="fsh-shellbar">n${i + 1}: ${c}e⁻</span>`).join('')}</div>
          <div style="margin-top:12px;font-size:13px;color:var(--fsh-ink-2)">Configuration<br><b style="font-family:monospace;font-size:14px">${esc(e.ec)}</b></div>
        </div>
        <div class="fsh-card" style="padding:16px 18px">
          <div class="fsh-atom-controls">
            <span style="font-size:12px;color:var(--fsh-mut)">Orbit speed</span>
            <input id="fshAtomSpeed" class="fsh-range" type="range" min="0.2" max="3" step="0.1" value="${atomSpeed}">
          </div>
        </div>
      </div>
    </div></div>`;
  }

  // ── CHEMISTRY: tools ─────────────────────────────────────────────────────
  let balInput = 'C3H8 + O2 -> CO2 + H2O';
  let molInput = 'C6H12O6';
  function balOutHTML() {
    let r;
    try { r = balance(balInput); } catch (err) { return `<div class="fsh-err">⚠ ${esc(err.message)}</div>`; }
    const side = (sp, off) => sp.map((s, i) => {
      const c = r.coeffs[off + i];
      return `${c > 1 ? `<span class="coef">${c}</span>` : ''}${subFmt(s.formula)}`;
    }).join('<span class="op">+</span>');
    return `<div class="fsh-eq">${side(r.R, 0)}<span class="arrow">→</span>${side(r.P, r.R.length)}</div>
      <div class="fsh-eq-type">⚗ <b>${esc(r.type.k)}</b> · ${esc(r.type.d)}</div>`;
  }
  function molOutHTML() {
    let counts; try { counts = parseFormula(molInput); } catch (e) { return `<div class="fsh-err">⚠ ${esc(e.message)}</div>`; }
    let mass = 0; const rows = [];
    for (const sym in counts) { const m = massOf(sym); if (m == null) return `<div class="fsh-err">⚠ Unknown element: ${esc(sym)}</div>`; const sub = m * counts[sym]; mass += sub; rows.push({ sym, n: counts[sym], m, sub }); }
    if (!mass) return '';
    rows.sort((a, b) => b.sub - a.sub);
    return `<div class="fsh-mm-total">${mass.toFixed(3)} <small>g/mol</small></div>
      <div class="fsh-mm-rows">${rows.map((r) => `<div><div class="fsh-mm-row">
        <span class="el">${esc(r.sym)} × ${r.n}</span><span>${r.sub.toFixed(2)} g/mol · ${(r.sub / mass * 100).toFixed(1)}%</span></div>
        <div class="fsh-mm-bar" style="width:${(r.sub / mass * 100).toFixed(1)}%"></div></div>`).join('')}</div>`;
  }
  function renderToolsTab() {
    return `<div class="fsh-panel"><div class="fsh-tools-grid">
      <div class="fsh-tool fsh-card">
        <h3>⚖ Equation balancer</h3><p class="sub">Type a skeleton equation — coefficients solve instantly.</p>
        <div class="fsh-chips-row">${['H2 + O2 -> H2O', 'CH4 + O2 -> CO2 + H2O', 'Fe + O2 -> Fe2O3', 'Al + HCl -> AlCl3 + H2'].map((q) => `<button type="button" class="fsh-cat-chip" data-bal="${esc(q)}">${subFmt(q.replace(' -> ', ' → '))}</button>`).join('')}</div>
        <div class="fsh-field"><input id="fshBalIn" class="fsh-input" value="${esc(balInput)}" spellcheck="false"><button type="button" class="fsh-btn" data-act="balance">Balance</button></div>
        <div class="fsh-eq-out" id="fshBalOut">${balOutHTML()}</div>
      </div>
      <div class="fsh-tool fsh-card">
        <h3>⚗ Molar mass</h3><p class="sub">Parse any formula — try Ca(OH)2 or (NH4)2SO4.</p>
        <div class="fsh-field"><input id="fshMolIn" class="fsh-input" value="${esc(molInput)}" spellcheck="false"><button type="button" class="fsh-btn" data-act="molar">Compute</button></div>
        <div class="fsh-eq-out" id="fshMolOut">${molOutHTML()}</div>
      </div>
      <div class="fsh-tool fsh-card">
        <h3>🧪 Solubility table</h3><p class="sub">Common ionic compounds in water (25 °C).</p>
        <div class="fsh-sol-scroll"><table class="fsh-sol"><thead><tr><th></th>${SOL_ANIONS.map((a) => `<th>${a}</th>`).join('')}</tr></thead>
        <tbody>${SOL_CATIONS.map((cat, i) => `<tr><th>${cat}</th>${SOL_GRID[i].map((s) => `<td data-s="${s}">${s === 's' ? 'sl' : s}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
        <div class="fsh-sol-legend"><span><i style="background:rgba(52,211,153,.5)"></i>Soluble</span><span><i style="background:rgba(251,191,36,.5)"></i>Slightly</span><span><i style="background:rgba(248,113,113,.5)"></i>Insoluble</span></div>
      </div>
      <div class="fsh-tool fsh-card">
        <h3>📐 Constants</h3><p class="sub">Data-booklet values for quick reference.</p>
        <div class="fsh-const">${CONSTANTS.map((c) => `<div class="fsh-prop"><div class="k">${esc(c[0])}</div><div class="v" style="font-size:13px">${esc(c[1])}</div></div>`).join('')}</div>
      </div>
    </div></div>`;
  }

  // ── CHEMISTRY: worksheet ─────────────────────────────────────────────────
  let wsCfg = { types: new Set(['synthesis', 'decomposition', 'combustion', 'single', 'double']), diff: 'all', count: 10, mode: 'balance' };
  let wsGen = [];
  function wsPool() {
    return EQUATIONS.filter(([eq, t, d]) => wsCfg.types.has(t) && (wsCfg.diff === 'all' || wsCfg.diff === d));
  }
  function wsGenerate() {
    const pool = wsPool().slice();
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    wsGen = pool.slice(0, wsCfg.count).map(([eq, t]) => { let bal = null; try { bal = balance(eq); } catch (e) {} return { eq, t, bal }; }).filter((x) => x.bal);
  }
  function skeletonHTML(eq, blanks) {
    const sides = eq.split(/->|=>|→|=/).map((s) => s.trim());
    const side = (txt) => txt.split('+').map((f) => `${blanks ? '<span class="blank">__ </span>' : ''}${subFmt(f.trim())}`).join(' <span class="op">+</span> ');
    return `${side(sides[0])} <span class="arrow">→</span> ${side(sides[1])}`;
  }
  function balancedPrint(item) {
    const r = item.bal;
    const side = (sp, off) => sp.map((s, i) => { const c = r.coeffs[off + i]; return (c > 1 ? c : '') + subPlain(s.formula); }).join(' + ');
    return `${side(r.R, 0)} → ${side(r.P, r.R.length)}`;
  }
  function renderWorksheetTab() {
    if (!wsGen.length) wsGenerate();
    const seg = (group, opts) => `<div class="fsh-seg">${opts.map(([v, l]) => `<button type="button" data-ws="${group}" data-v="${v}" class="${wsActive(group, v) ? 'active' : ''}">${l}</button>`).join('')}</div>`;
    return `<div class="fsh-panel"><div class="fsh-card" style="padding:22px">
      <div class="fsh-ws-controls">
        <div class="fsh-ws-group"><label>Reaction types</label>
          <div class="fsh-seg">${[['synthesis', 'Synth'], ['decomposition', 'Decomp'], ['combustion', 'Combust'], ['single', 'Single'], ['double', 'Double']].map(([v, l]) => `<button type="button" data-ws="type" data-v="${v}" class="${wsCfg.types.has(v) ? 'active' : ''}">${l}</button>`).join('')}</div>
        </div>
        <div class="fsh-ws-group"><label>Difficulty</label>${seg('diff', [['all', 'All'], ['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']])}</div>
        <div class="fsh-ws-group"><label>Questions</label>${seg('count', [['5', '5'], ['10', '10'], ['15', '15'], ['20', '20']])}</div>
        <div class="fsh-ws-group"><label>Mode</label>${seg('mode', [['balance', 'Balance'], ['type', 'Identify'], ['combined', 'Combined']])}</div>
      </div>
      <div style="display:flex;gap:10px;margin-top:18px;flex-wrap:wrap">
        <button type="button" class="fsh-btn" data-act="ws-gen">↻ Generate new set</button>
        <button type="button" class="fsh-btn ghost" data-act="ws-print">🖨 Print / Save PDF</button>
        <span style="align-self:center;color:var(--fsh-mut);font-size:12.5px">${wsGen.length} of ${wsPool().length} available</span>
      </div>
      <div class="fsh-ws-preview" id="fshWsPreview">${wsPreviewHTML()}</div>
    </div></div>`;
  }
  const wsActive = (g, v) => g === 'diff' ? wsCfg.diff === v : g === 'count' ? String(wsCfg.count) === v : g === 'mode' ? wsCfg.mode === v : false;
  function wsPreviewHTML() {
    if (!wsGen.length) return `<p style="color:var(--fsh-mut)">No equations match — pick at least one reaction type.</p>`;
    return wsGen.map((it, i) => `<div class="fsh-ws-q"><span class="num">${i + 1}</span>
      <span class="eq">${wsCfg.mode === 'type' ? skeletonHTML(it.eq, false) : skeletonHTML(it.eq, true)}${wsCfg.mode !== 'balance' ? ` &nbsp;<span class="blank">— type: ______</span>` : ''}</span></div>`).join('');
  }
  function wsPrint() {
    if (!wsGen.length) return;
    let root = $('fshPrintRoot');
    if (!root) { root = document.createElement('div'); root.id = 'fshPrintRoot'; document.body.appendChild(root); }
    const date = new Date().toLocaleDateString();
    const q = wsGen.map((it, i) => `<p class="pq"><span class="n">${i + 1}.</span>${printSkeleton(it.eq, wsCfg.mode)}</p>`).join('');
    const key = wsGen.map((it, i) => `<p class="ak">${i + 1}. ${balancedPrint(it)} &nbsp; <i>[${TYPE_LABEL[it.t] || it.t}]</i></p>`).join('');
    root.innerHTML = `<h1>Chemistry — Balancing Worksheet</h1>
      <div class="meta">Name: _______________________  ·  Date: ${date}  ·  ${wsGen.length} questions · Mode: ${wsCfg.mode}</div>
      ${q}
      <div class="ans-key"><h2>Answer key</h2>${key}</div>`;
    window.print();
  }
  function printSkeleton(eq, mode) {
    const sides = eq.split(/->|=>|→|=/).map((s) => s.trim());
    const blanks = (txt) => txt.split('+').map((f) => `____ ${subPlain(f.trim())}`).join(' + ');
    const plain = (txt) => txt.split('+').map((f) => subPlain(f.trim())).join(' + ');
    if (mode === 'type') return `${plain(sides[0])} → ${plain(sides[1])} &nbsp;&nbsp; Type: ____________`;
    if (mode === 'combined') return `${blanks(sides[0])} → ${blanks(sides[1])} &nbsp;&nbsp; Type: __________`;
    return `${blanks(sides[0])} → ${blanks(sides[1])}`;
  }

  // ── CHEMISTRY shell ──────────────────────────────────────────────────────
  const CHEM_TABS = [['table', '⊞', 'Table'], ['atom', '◎', 'Atom'], ['tools', '⚗', 'Tools'], ['worksheet', '📝', 'Worksheet']];
  function renderChemBody() {
    const body = $('fshChemBody'); if (!body) return;
    body.innerHTML = state.chemTab === 'table' ? renderPeriodicTab()
      : state.chemTab === 'atom' ? renderAtomTab()
        : state.chemTab === 'tools' ? renderToolsTab()
          : renderWorksheetTab();
    if (state.chemTab === 'table') applyPtFilter();
  }
  function renderChem() {
    const stage = $('fshStage');
    stage.innerHTML = `<div class="fsh-chem fsh-panel">
      <div class="fsh-chem-tabs" id="fshChemTabs">
        <div class="fsh-chem-tab-glide" id="fshTabGlide"></div>
        ${CHEM_TABS.map((t) => `<button type="button" class="fsh-chem-tab${state.chemTab === t[0] ? ' active' : ''}" data-tab="${t[0]}"><span class="fsh-ct-ico">${t[1]}</span>${t[2]}</button>`).join('')}
      </div>
      <div class="fsh-chem-body" id="fshChemBody"></div>
    </div>` + renderDirectory('chemistry');
    renderChemBody();
    scheduleGlide();
  }
  function moveTabGlide() {
    const tabs = $('fshChemTabs'), g = $('fshTabGlide'); if (!tabs || !g) return;
    const active = tabs.querySelector('.fsh-chem-tab.active'); if (!active) return;
    const w = active.offsetWidth;
    if (!w) { setTimeout(moveTabGlide, 60); return; } // layout not painted yet — retry
    g.style.left = active.offsetLeft + 'px'; g.style.width = w + 'px';
  }
  // Position the glider robustly: a single rAF can fire before freshly injected
  // tabs have layout, so use a double rAF plus a timeout safety net.
  function scheduleGlide() {
    requestAnimationFrame(() => requestAnimationFrame(moveTabGlide));
    setTimeout(moveTabGlide, 120);
  }

  // ── search ───────────────────────────────────────────────────────────────
  function renderSearch() {
    const q = searchQ.trim().toLowerCase();
    const hits = [];
    Object.keys(DIRECTORY).forEach((sid) => DIRECTORY[sid].forEach((g) => g.items.forEach((it) => {
      if ((it.name + ' ' + it.what + ' ' + it.feat).toLowerCase().includes(q)) hits.push(it);
    })));
    const elHits = elements().filter((e) => e.name.toLowerCase().includes(q) || e.s.toLowerCase() === q).slice(0, 8);
    const stage = $('fshStage');
    stage.innerHTML = `<div class="fsh-panel">
      <div class="fsh-section-head"><span class="fsh-sh-ico">⌕</span><span><h2>Results for "${esc(searchQ)}"</h2><p>${hits.length} site${hits.length === 1 ? '' : 's'}${elHits.length ? ' · ' + elHits.length + ' elements' : ''}</p></span></div>
      ${elHits.length ? `<div class="fsh-grid" style="margin-bottom:18px">${elHits.map((e) => `<button type="button" class="fsh-res" data-act="open-el" data-n="${e.n}" data-cat="${e.cat}" style="text-align:left">
        <div class="fsh-res-head"><span class="fsh-res-logo fsh-el" data-cat="${e.cat}" style="background:var(--el-c)">${esc(e.s)}</span>
        <span><span class="fsh-res-title">${esc(e.name)}</span><span class="fsh-res-host">Element ${e.n} · ${e.mass} u</span></span></div>
        <span class="fsh-res-open">Open in periodic table →</span></button>`).join('')}</div>` : ''}
      ${hits.length ? `<div class="fsh-grid">${hits.map(resCard).join('')}</div>` : (elHits.length ? '' : `<p style="color:var(--fsh-mut)">No matches. Try a subject or site name.</p>`)}
    </div>`;
  }

  // ── stage dispatch ───────────────────────────────────────────────────────
  function renderStage() {
    if (searchQ.trim()) { renderSearch(); return; }
    const subj = subjById(state.subject);
    applyAccent(subj.accent);
    if (state.subject === 'chemistry') renderChem();
    else $('fshStage').innerHTML = renderDirectory(state.subject);
  }
  function selectSubject(id) {
    state.subject = id; searchQ = ''; save();
    const s = $('fshSearch'); if (s) s.value = '';
    const clr = $('fshSearchClear'); if (clr) clr.hidden = true;
    document.querySelectorAll('#fshRail .fsh-pill').forEach((p) => p.classList.toggle('active', p.dataset.sub === id));
    const active = document.querySelector('#fshRail .fsh-pill.active');
    if (active && active.scrollIntoView) active.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    renderStage();
  }

  // ── shell ────────────────────────────────────────────────────────────────
  function buildShell() {
    const host = $('stSections'); if (!host) return false;
    if ($('toolbox')) $('toolbox').classList.add('fsh-active');
    host.innerHTML = `<div id="fshRoot" class="fsh">
      <div class="fsh-hero">
        <div class="fsh-hero-text"><h1>Study Tools</h1><p>An interactive chemistry workspace, plus the best hand-picked learning sites for every subject.</p></div>
        <div class="fsh-search"><span class="fsh-search-ico">⌕</span>
          <input id="fshSearch" type="search" placeholder="Search subjects, sites, elements…" autocomplete="off">
          <button type="button" class="fsh-search-clear" id="fshSearchClear" hidden aria-label="Clear">×</button></div>
      </div>
      <div class="fsh-rail-wrap"><div class="fsh-rail" id="fshRail">${SUBJECTS.map((s) =>
        `<button type="button" class="fsh-pill${s.id === state.subject ? ' active' : ''}${s.flagship ? ' flagship' : ''}" data-sub="${s.id}"><span class="fsh-pill-ico">${s.ico}</span>${esc(s.name)}</button>`).join('')}</div></div>
      <div class="fsh-stage" id="fshStage"></div>
    </div>`;
    wireEvents();
    return true;
  }

  function wireEvents() {
    const root = $('fshRoot'); if (!root || root.__wired) return; root.__wired = true;
    $('fshRail').addEventListener('click', (e) => { const p = e.target.closest('.fsh-pill'); if (p) selectSubject(p.dataset.sub); });
    const sIn = $('fshSearch'), sClr = $('fshSearchClear');
    sIn.addEventListener('input', () => { searchQ = sIn.value; sClr.hidden = !searchQ; renderStage(); });
    sClr.addEventListener('click', () => { searchQ = ''; sIn.value = ''; sClr.hidden = true; renderStage(); });

    // delegated stage interactions
    $('fshStage').addEventListener('click', (e) => {
      const t = e.target;
      const tab = t.closest('.fsh-chem-tab');
      if (tab) { state.chemTab = tab.dataset.tab; save(); document.querySelectorAll('.fsh-chem-tab').forEach((b) => b.classList.toggle('active', b === tab)); renderChemBody(); scheduleGlide(); return; }
      const act0 = t.closest('[data-act]');
      if (act0 && act0.dataset.act === 'open-el') { searchQ = ''; if (sIn) sIn.value = ''; sClr.hidden = true; selEl = +act0.dataset.n; state.subject = 'chemistry'; state.chemTab = 'table'; save(); selectSubject('chemistry'); return; }
      const cell = t.closest('.fsh-el');
      if (cell && cell.dataset.n && !act0) { selEl = +cell.dataset.n; const d = $('fshElDetail'); if (d) { d.innerHTML = elDetailHTML(elByN(selEl)); d.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } return; }
      const cat = t.closest('.fsh-cat-chip[data-cat]');
      if (cat) { ptCat = cat.dataset.cat; document.querySelectorAll('#fshPtCats .fsh-cat-chip').forEach((c) => c.classList.toggle('active', c === cat)); applyPtFilter(); return; }
      const balChip = t.closest('[data-bal]');
      if (balChip) { balInput = balChip.dataset.bal; const i = $('fshBalIn'); if (i) i.value = balInput; $('fshBalOut').innerHTML = balOutHTML(); return; }
      const wsBtn = t.closest('[data-ws]');
      if (wsBtn) {
        const g = wsBtn.dataset.ws, v = wsBtn.dataset.v;
        if (g === 'type') { if (wsCfg.types.has(v)) wsCfg.types.delete(v); else wsCfg.types.add(v); }
        else if (g === 'diff') wsCfg.diff = v;
        else if (g === 'count') wsCfg.count = +v;
        else if (g === 'mode') wsCfg.mode = v;
        wsGenerate(); renderChemBody(); scheduleGlide(); return;
      }
      const act = t.closest('[data-act]'); if (!act) return;
      const a = act.dataset.act;
      if (a === 'balance') { const i = $('fshBalIn'); balInput = i ? i.value : balInput; $('fshBalOut').innerHTML = balOutHTML(); }
      else if (a === 'molar') { const i = $('fshMolIn'); molInput = i ? i.value : molInput; $('fshMolOut').innerHTML = molOutHTML(); }
      else if (a === 'view-atom') { atomN = +act.dataset.n; state.chemTab = 'atom'; save(); document.querySelectorAll('.fsh-chem-tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === 'atom')); renderChemBody(); scheduleGlide(); }
      else if (a === 'atom-prev' || a === 'atom-next') { atomN = Math.max(1, Math.min(elements().length, atomN + (a === 'atom-next' ? 1 : -1))); renderChemBody(); }
      else if (a === 'ws-gen') { wsGenerate(); $('fshWsPreview').innerHTML = wsPreviewHTML(); }
      else if (a === 'ws-print') { wsPrint(); }
    });
    // input events (balancer/molar live, atom picker, pt search, atom speed)
    $('fshStage').addEventListener('input', (e) => {
      const t = e.target;
      if (t.id === 'fshBalIn') { balInput = t.value; $('fshBalOut').innerHTML = balOutHTML(); }
      else if (t.id === 'fshMolIn') { molInput = t.value; $('fshMolOut').innerHTML = molOutHTML(); }
      else if (t.id === 'fshPtSearch') { ptQuery = t.value; applyPtFilter(); }
      else if (t.id === 'fshAtomSpeed') { atomSpeed = +t.value; const st = $('fshAtomStage'); if (st) st.innerHTML = atomStageHTML(elByN(atomN)); }
      else if (t.id === 'fshAtomInput') {
        const v = t.value.trim(); let e2 = null;
        if (/^\d+$/.test(v)) e2 = elByN(+v); else e2 = elements().find((x) => x.s.toLowerCase() === v.toLowerCase());
        if (e2) { atomN = e2.n; const st = $('fshAtomStage'); if (st) st.innerHTML = atomStageHTML(e2); }
      }
    });
    // keep the chem-tab glider aligned on viewport resize
    let rzT; window.addEventListener('resize', () => { clearTimeout(rzT); rzT = setTimeout(() => { if ($('fshChemTabs')) moveTabGlide(); }, 120); });
  }

  // ── public entry (overrides legacy) ──────────────────────────────────────
  function renderHub() {
    if (!$('fshRoot')) { if (!buildShell()) return; }
    renderStage();
  }
  window.renderToolbox = renderHub;
  window.renderStudyTools = renderHub;
  window.fluxStudyHub = { render: renderHub, balance, parseFormula, selectSubject };

  // if toolbox is already the visible panel at load, render now
  document.addEventListener('DOMContentLoaded', () => {
    const tb = $('toolbox');
    if (tb && tb.classList.contains('active')) renderHub();
  });
})();
