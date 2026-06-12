/* ============================================================================
   FLUX STUDY HUB  ·  flux-study-hub.js   (Pass 1)
   Native in-app study tools. Owns the #toolbox panel (overrides renderToolbox).

   Core (this file): shell + subject rail + search, the Chemistry flagship
   (Table · Atom · Tools · Ions · Worksheet), a tool REGISTRY that subject
   modules (flux-study-physics/math/music.js) plug into, and the Flux-AI
   bridge (callable tools + slash commands + system-prompt awareness).
   ========================================================================== */
(function () {
  'use strict';
  if (window.__fluxStudyHub) return;
  window.__fluxStudyHub = true;

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const LS_KEY = 'flux_study_hub';

  let state = { subject: 'chemistry', chemTab: 'table', tool: {}, recent: [] };
  try { const raw = localStorage.getItem(LS_KEY); if (raw) state = Object.assign(state, JSON.parse(raw)); } catch (e) {}
  if (!state.tool) state.tool = {};
  if (!Array.isArray(state.recent)) state.recent = [];
  const save = () => { try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {} };

  let selEl = 6, atomN = 6, atomSpeed = 1, searchQ = '';

  // ── element data ─────────────────────────────────────────────────────────
  const FALLBACK_MASS = { H:1.008,He:4.003,Li:6.94,Be:9.012,B:10.81,C:12.011,N:14.007,O:15.999,F:18.998,Ne:20.18,Na:22.99,Mg:24.305,Al:26.982,Si:28.085,P:30.974,S:32.06,Cl:35.45,Ar:39.948,K:39.098,Ca:40.078,Fe:55.845,Cu:63.546,Zn:65.38,Ag:107.868,Ba:137.327,Pb:207.2,I:126.904,Br:79.904,Mn:54.938,Hg:200.59 };
  const elements = () => { const E = window.fluxPeriodic && window.fluxPeriodic.ELEMENTS; return Array.isArray(E) && E.length ? E : []; };
  function massOf(sym) { const e = elements().find((x) => x.s === sym); return e ? e.mass : (FALLBACK_MASS[sym] != null ? FALLBACK_MASS[sym] : null); }
  const elByN = (n) => elements().find((e) => e.n === n) || null;

  // ── formula parsing ──────────────────────────────────────────────────────
  function parseFormula(f) {
    f = String(f).replace(/[·•]/g, '.').replace(/\s/g, '');
    const frags = f.split('.').filter(Boolean), total = {};
    const add = (dst, src, m) => { for (const k in src) dst[k] = (dst[k] || 0) + src[k] * m; };
    function parseFrag(s) {
      let i = 0;
      const num = () => { let t = ''; while (/\d/.test(s[i] || '')) { t += s[i]; i++; } return t ? parseInt(t, 10) : 1; };
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
      const out = seq(); if (i < s.length) throw new Error('Parse error'); return out;
    }
    for (let p = 0; p < frags.length; p++) {
      let part = frags[p], coef = 1; const m = part.match(/^(\d+)(.+)$/);
      if (m) { coef = parseInt(m[1], 10); part = m[2]; }
      add(total, parseFrag(part), coef);
    }
    return total;
  }
  const subFmt = (f) => esc(f).replace(/(\d+)/g, '<sub class="sub">$1</sub>');
  const subPlain = (f) => esc(f).replace(/(\d+)/g, '<sub>$1</sub>');

  // ── balancer (fractions + null space) ────────────────────────────────────
  const igcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a; };
  const ilcm = (a, b) => (a === 0 || b === 0 ? 0 : Math.abs(a / igcd(a, b) * b));
  const fr = (n, d = 1) => { if (d === 0) throw new Error('div0'); if (d < 0) { n = -n; d = -d; } const g = igcd(n, d) || 1; return { n: n / g, d: d / g }; };
  const fsub = (x, y) => fr(x.n * y.d - y.n * x.d, x.d * y.d);
  const fmul = (x, y) => fr(x.n * y.n, x.d * y.d);
  const fdiv = (x, y) => fr(x.n * y.d, x.d * y.n);
  const fzero = (x) => x.n === 0;

  function splitEquation(input) {
    // accept ->, =>, →, ⟶, –>, —>, a lone "=", or a spaced dash " - "
    const norm = String(input).replace(/—>|–>|=>|->|⟶|→/g, '=').replace(/\s[-–—]\s/g, '=');
    return norm.split('=').map((s) => s.trim()).filter(Boolean);
  }
  function balance(input) {
    const sides = splitEquation(input);
    if (sides.length !== 2) throw new Error('Use one separator (=, → or - ) between sides.');
    const toSpecies = (txt) => txt.split('+').map((t) => t.trim()).filter(Boolean).map((raw) => {
      const formula = raw.replace(/^\d+\s*/, ''); return { formula, counts: parseFormula(formula) };
    });
    const R = toSpecies(sides[0]), P = toSpecies(sides[1]);
    if (!R.length || !P.length) throw new Error('Need reactants and products.');
    const species = R.concat(P), els = [];
    species.forEach((sp) => Object.keys(sp.counts).forEach((e) => { if (!els.includes(e)) els.push(e); }));
    const M = els.map((e) => species.map((sp, j) => fr((sp.counts[e] || 0) * (j < R.length ? 1 : -1))));
    const cols = species.length, pivCols = []; let r = 0;
    for (let c = 0; c < cols && r < M.length; c++) {
      let piv = -1; for (let i = r; i < M.length; i++) if (!fzero(M[i][c])) { piv = i; break; }
      if (piv < 0) continue;
      [M[r], M[piv]] = [M[piv], M[r]];
      const lead = M[r][c]; for (let j = 0; j < cols; j++) M[r][j] = fdiv(M[r][j], lead);
      for (let i = 0; i < M.length; i++) { if (i === r) continue; const f = M[i][c]; if (fzero(f)) continue; for (let j = 0; j < cols; j++) M[i][j] = fsub(M[i][j], fmul(f, M[r][j])); }
      pivCols.push(c); r++;
    }
    const free = []; for (let c = 0; c < cols; c++) if (!pivCols.includes(c)) free.push(c);
    if (free.length === 0) throw new Error('No valid balance — check the formulas.');
    if (free.length > 1) throw new Error('Under-determined — add/remove a species.');
    const f = free[0], x = new Array(cols).fill(null).map(() => fr(0)); x[f] = fr(1);
    pivCols.forEach((p, i) => { x[p] = fr(-M[i][f].n, M[i][f].d); });
    let L = 1; x.forEach((v) => { L = ilcm(L, v.d) || L; });
    let ints = x.map((v) => v.n * (L / v.d)); let g = 0; ints.forEach((v) => { g = igcd(g, v); }); if (!g) g = 1;
    ints = ints.map((v) => v / g);
    if (ints.some((v) => v > 0) && ints.some((v) => v < 0)) throw new Error('Cannot balance as written.');
    if (ints.every((v) => v <= 0)) ints = ints.map((v) => -v);
    if (ints.some((v) => v === 0)) throw new Error('Cannot balance — a species drops out.');
    return { R, P, coeffs: ints, type: classify(R, P) };
  }
  function classify(R, P) {
    const isEl = (c) => Object.keys(c).length === 1;
    const fuel = R.find((s) => s.counts.C && s.counts.H), hasO2 = R.some((s) => isEl(s.counts) && s.counts.O);
    const hasCO2 = P.some((s) => s.formula === 'CO2'), hasH2O = P.some((s) => s.formula === 'H2O');
    if (fuel && hasO2 && hasCO2 && hasH2O) return { k: 'Combustion', d: 'Fuel + O₂ → CO₂ + H₂O' };
    if (P.length === 1) return { k: 'Synthesis', d: 'Reactants combine into one product' };
    if (R.length === 1) return { k: 'Decomposition', d: 'One compound splits apart' };
    if (R.length === 2 && P.length === 2) {
      const er = R.filter((s) => isEl(s.counts)).length, ep = P.filter((s) => isEl(s.counts)).length;
      if (er === 1 && ep === 1) return { k: 'Single replacement', d: 'An element displaces another' };
      if (er === 0 && ep === 0) { if (hasH2O && /^H/.test(R[0].formula + R[1].formula)) return { k: 'Neutralization', d: 'Acid + base → salt + water' }; return { k: 'Double replacement', d: 'Ions swap partners' }; }
    }
    return { k: 'Redox / other', d: 'General balanced reaction' };
  }

  // ── chemistry reference data ─────────────────────────────────────────────
  const EQUATIONS = [
    // easy
    ['H2 + O2 = H2O','synthesis','easy'],['N2 + H2 = NH3','synthesis','easy'],['Na + Cl2 = NaCl','synthesis','easy'],
    ['K + Cl2 = KCl','synthesis','easy'],['Mg + O2 = MgO','synthesis','easy'],['Ca + O2 = CaO','synthesis','easy'],
    ['Li + O2 = Li2O','synthesis','easy'],['H2 + Cl2 = HCl','synthesis','easy'],['C + O2 = CO2','synthesis','easy'],
    ['S + O2 = SO2','synthesis','easy'],['Ca + Cl2 = CaCl2','synthesis','easy'],['Al + Br2 = AlBr3','synthesis','easy'],
    ['CaCO3 = CaO + CO2','decomposition','easy'],['H2O = H2 + O2','decomposition','easy'],['HgO = Hg + O2','decomposition','easy'],
    ['Zn + HCl = ZnCl2 + H2','single','easy'],['Mg + HCl = MgCl2 + H2','single','easy'],['Fe + CuSO4 = FeSO4 + Cu','single','easy'],
    ['Zn + CuSO4 = ZnSO4 + Cu','single','easy'],['AgNO3 + NaCl = AgCl + NaNO3','double','easy'],['HCl + NaOH = NaCl + H2O','double','easy'],
    ['KOH + HCl = KCl + H2O','double','easy'],['NaOH + HBr = NaBr + H2O','double','easy'],
    // medium
    ['Fe + O2 = Fe2O3','synthesis','medium'],['Al + O2 = Al2O3','synthesis','medium'],['SO2 + O2 = SO3','synthesis','medium'],
    ['N2 + O2 = NO2','synthesis','medium'],['CaO + H2O = Ca(OH)2','synthesis','medium'],['Na2O + H2O = NaOH','synthesis','medium'],
    ['KClO3 = KCl + O2','decomposition','medium'],['H2O2 = H2O + O2','decomposition','medium'],['NaCl = Na + Cl2','decomposition','medium'],
    ['CH4 + O2 = CO2 + H2O','combustion','medium'],['C2H6 + O2 = CO2 + H2O','combustion','medium'],['C3H8 + O2 = CO2 + H2O','combustion','medium'],
    ['Al + HCl = AlCl3 + H2','single','medium'],['K + H2O = KOH + H2','single','medium'],['Na + H2O = NaOH + H2','single','medium'],
    ['Cl2 + NaBr = NaCl + Br2','single','medium'],['Fe + HCl = FeCl2 + H2','single','medium'],['CuO + H2 = Cu + H2O','single','medium'],
    ['BaCl2 + Na2SO4 = BaSO4 + NaCl','double','medium'],['Pb(NO3)2 + KI = PbI2 + KNO3','double','medium'],['H2SO4 + NaOH = Na2SO4 + H2O','double','medium'],
    ['Ca(OH)2 + HCl = CaCl2 + H2O','double','medium'],['AgNO3 + CaCl2 = AgCl + Ca(NO3)2','double','medium'],
    // hard
    ['C2H5OH + O2 = CO2 + H2O','combustion','hard'],['C6H12O6 + O2 = CO2 + H2O','combustion','hard'],['C8H18 + O2 = CO2 + H2O','combustion','hard'],
    ['C4H10 + O2 = CO2 + H2O','combustion','hard'],['C5H12 + O2 = CO2 + H2O','combustion','hard'],['C7H16 + O2 = CO2 + H2O','combustion','hard'],
    ['C6H6 + O2 = CO2 + H2O','combustion','hard'],['C2H2 + O2 = CO2 + H2O','combustion','hard'],['CH3OH + O2 = CO2 + H2O','combustion','hard'],
    ['C3H6 + O2 = CO2 + H2O','combustion','hard'],['NaHCO3 = Na2CO3 + H2O + CO2','decomposition','hard'],['P4 + O2 = P2O5','synthesis','hard'],
    ['AlCl3 + NaOH = Al(OH)3 + NaCl','double','hard'],['Fe2(SO4)3 + NaOH = Fe(OH)3 + Na2SO4','double','hard'],['Ca(OH)2 + H3PO4 = Ca3(PO4)2 + H2O','double','hard'],
    ['Al + Fe2O3 = Al2O3 + Fe','single','hard'],['Fe2O3 + CO = Fe + CO2','redox','hard'],['NH3 + O2 = NO + H2O','redox','hard'],
    ['Cu + HNO3 = Cu(NO3)2 + NO2 + H2O','redox','hard'],['KMnO4 + HCl = KCl + MnCl2 + H2O + Cl2','redox','hard'],['FeS2 + O2 = Fe2O3 + SO2','redox','hard'],
    ['H2 + N2 = NH3','synthesis','hard'],['Sb + O2 = Sb4O6','synthesis','hard'],['C2H4 + O2 = CO2 + H2O','combustion','hard'],
  ];
  const TYPE_LABEL = { synthesis:'Synthesis', decomposition:'Decomposition', combustion:'Combustion', single:'Single replacement', double:'Double replacement', redox:'Redox' };
  const SOL_CATIONS = ['Na⁺/K⁺/NH₄⁺','Ca²⁺','Ba²⁺','Ag⁺','Pb²⁺','Cu²⁺/Fe³⁺'];
  const SOL_ANIONS = ['NO₃⁻','Cl⁻','SO₄²⁻','CO₃²⁻','OH⁻','S²⁻'];
  const SOL_GRID = [['S','S','S','S','S','S'],['S','S','s','I','s','I'],['S','S','I','I','S','I'],['S','I','s','I','I','I'],['S','s','I','I','I','I'],['S','S','S','I','I','I']];
  const IONS_CAT = [['H⁺','Hydrogen'],['Na⁺','Sodium'],['K⁺','Potassium'],['NH₄⁺','Ammonium'],['Ag⁺','Silver'],['Ca²⁺','Calcium'],['Mg²⁺','Magnesium'],['Ba²⁺','Barium'],['Zn²⁺','Zinc'],['Cu²⁺','Copper(II)'],['Fe²⁺','Iron(II)'],['Fe³⁺','Iron(III)'],['Al³⁺','Aluminium'],['Pb²⁺','Lead(II)']];
  const IONS_AN = [['OH⁻','Hydroxide'],['NO₃⁻','Nitrate'],['Cl⁻','Chloride'],['Br⁻','Bromide'],['HCO₃⁻','Hydrogencarbonate'],['CH₃COO⁻','Acetate'],['CO₃²⁻','Carbonate'],['SO₄²⁻','Sulfate'],['SO₃²⁻','Sulfite'],['O²⁻','Oxide'],['S²⁻','Sulfide'],['PO₄³⁻','Phosphate'],['MnO₄⁻','Permanganate'],['Cr₂O₇²⁻','Dichromate']];
  const CONSTANTS = [['Avogadro','6.022×10²³ mol⁻¹'],['Gas constant R','8.314 J·mol⁻¹·K⁻¹'],['Molar volume (STP)','22.7 L·mol⁻¹'],['Faraday','96 485 C·mol⁻¹'],['Std pressure','100 kPa'],['Kw (25 °C)','1.0×10⁻¹⁴'],['Planck h','6.626×10⁻³⁴ J·s'],['Speed of light','2.998×10⁸ m·s⁻¹']];

  // ── secondary reference sites (small strip) ──────────────────────────────
  const REF = {
    chemistry:[['PhET Chemistry','phet.colorado.edu','https://phet.colorado.edu/en/simulations/filter?subjects=chemistry'],['ChemCollective','chemcollective.org','https://chemcollective.org'],['Master Organic Chem','masterorganicchemistry.com','https://www.masterorganicchemistry.com']],
    physics:[['PhET','phet.colorado.edu','https://phet.colorado.edu'],['Isaac Physics','isaacphysics.org','https://isaacphysics.org'],['oPhysics','ophysics.com','https://www.ophysics.com']],
    math:[['Desmos','desmos.com','https://www.desmos.com'],['Mathigon','mathigon.org','https://mathigon.org'],["Paul's Notes",'lamar.edu','https://tutorial.math.lamar.edu']],
    music:[['musictheory.net','musictheory.net','https://www.musictheory.net'],['Ableton Learning','ableton.com','https://learningmusic.ableton.com'],['Chrome Music Lab','chromeexperiments.com','https://musiclab.chromeexperiments.com']],
    biology:[['Learn.Genetics','utah.edu','https://learn.genetics.utah.edu'],['Amoeba Sisters','amoebasisters.com','https://www.amoebasisters.com']],
    cs:[['VisuAlgo','visualgo.net','https://visualgo.net'],['CS50','harvard.edu','https://cs50.harvard.edu']],
    econ:[['Our World in Data','ourworldindata.org','https://ourworldindata.org'],['MRU','mru.org','https://mru.org']],
    english:[['LitCharts','litcharts.com','https://www.litcharts.com'],['Purdue OWL','purdue.edu','https://owl.purdue.edu']],
    history:[['Crash Course','thecrashcourse.com','https://thecrashcourse.com'],['Seterra','geography-games.org','https://geography-games.org']],
    languages:[['Language Transfer','languagetransfer.org','https://www.languagetransfer.org'],['Kwiziq','kwiziq.com','https://www.kwiziq.com']],
    astronomy:[['Stellarium','stellarium-web.org','https://stellarium-web.org'],['NASA Eyes','nasa.gov','https://eyes.nasa.gov']],
  };

  const SUBJECTS = [
    { id:'chemistry', name:'Chemistry', ico:'⚗', accent:'#34d0ff', flagship:true },
    { id:'physics', name:'Physics', ico:'🪐', accent:'#7c8cff' },
    { id:'math', name:'Mathematics', ico:'∑', accent:'#5b8def' },
    { id:'music', name:'Music', ico:'🎵', accent:'#ff7a59' },
    { id:'biology', name:'Biology', ico:'🧬', accent:'#37c98a' },
    { id:'cs', name:'Computer Science', ico:'💻', accent:'#4fb6c9' },
    { id:'econ', name:'Economics', ico:'💹', accent:'#f4a13f' },
    { id:'english', name:'English', ico:'✒', accent:'#e069b4' },
    { id:'history', name:'History & Geo', ico:'🏛', accent:'#d8a657' },
    { id:'languages', name:'Languages', ico:'🌍', accent:'#36c5d6' },
    { id:'astronomy', name:'Astronomy', ico:'🔭', accent:'#a06eff' },
  ];
  const subjById = (id) => SUBJECTS.find((s) => s.id === id) || SUBJECTS[0];

  function hexRgb(hex) { const v = hex.replace('#', ''); const h = v.length === 3 ? v.split('').map((c) => c + c).join('') : v; const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function applyAccent(hex) { const r = $('fshRoot'); if (!r) return; r.style.setProperty('--fsh-accent', hex); r.style.setProperty('--fsh-accent-rgb', hexRgb(hex).join(',')); }

  // ════════════════════════════════════════════════════════════════════════
  //  TOOL REGISTRY  +  FLUX-AI BRIDGE
  // ════════════════════════════════════════════════════════════════════════
  const registry = {};          // subjectId -> [tool]
  const aiTools = {};           // name -> fn(args)
  const aiManifest = [];        // [{name, subject, description, params}]
  function addAITool(d) {
    if (!d || !d.name || typeof d.run !== 'function') return;
    aiTools[d.name] = d.run;
    if (!aiManifest.some((m) => m.name === d.name)) aiManifest.push({ name: d.name, subject: d.subject || '', description: d.description || '', params: d.params || {} });
  }
  function register(subjectId, tools) {
    if (!Array.isArray(tools)) tools = [tools];
    registry[subjectId] = (registry[subjectId] || []).concat(tools);
    tools.forEach((t) => { if (t && t.ai) addAITool(Object.assign({ subject: subjectId }, t.ai)); });
    if ($('fshRoot') && state.subject === subjectId && !searchQ) renderStage();
  }

  function aiSystemAddendum() {
    if (!aiManifest.length) return '';
    const lines = aiManifest.map((m) => `• ${m.name}(${Object.keys(m.params || {}).join(', ')}) — ${m.description}`);
    return 'FLUX STUDY TOOLS available in-app. You may reference these and tell the student to run them via the Study tab or a slash command (e.g. /balance, /molar). Tools:\n' + lines.join('\n');
  }
  // make every AI request aware of the tools (non-invasive fetch wrapper)
  (function patchFetch() {
    if (window.__fshFetchPatched) return; window.__fshFetchPatched = true;
    const orig = window.fetch;
    window.fetch = function (url, opts) {
      try {
        const u = typeof url === 'string' ? url : (url && url.url) || '';
        const aiUrl = (window.API && window.API.ai) || '';
        if (opts && typeof opts.body === 'string' && aiUrl && u && u.indexOf(aiUrl) !== -1 && /"messages"/.test(opts.body)) {
          const b = JSON.parse(opts.body);
          if (b && Array.isArray(b.messages)) { const add = aiSystemAddendum(); if (add) { b.system = (b.system ? b.system + '\n\n' : '') + add; opts = Object.assign({}, opts, { body: JSON.stringify(b) }); } }
        }
      } catch (e) {}
      return orig.call(this, url, opts);
    };
  })();
  // slash command runner: "/balance H2 + O2 = H2O"
  function slash(text) {
    const m = String(text || '').trim().match(/^\/(\w+)\s*(.*)$/s);
    if (!m) return null;
    const name = m[1].toLowerCase(), arg = m[2].trim();
    const map = { balance: 'balanceEquation', molar: 'molarMass', element: 'elementInfo', ph: 'phCalc', gas: 'gasLaw', convert: 'convertUnit', suvat: 'suvat', ohms: 'ohmsLaw', projectile: 'projectile', stats: 'statsSummary', matrix: 'matrixOp', circle5: 'circleOfFifths', scale: 'scaleNotes', chord: 'chordNotes' };
    const fn = aiTools[map[name]] || aiTools[name];
    if (!fn) return null;
    try { const out = fn(arg); return typeof out === 'string' ? out : JSON.stringify(out, null, 2); } catch (e) { return 'Error: ' + e.message; }
  }
  // register chemistry AI tools (UI is bespoke, so add directly)
  addAITool({ name: 'balanceEquation', subject: 'chemistry', description: 'Balance a chemical equation. Arg: "H2 + O2 = H2O".', params: { equation: 'string' }, run: (a) => { const r = balance(typeof a === 'string' ? a : a.equation); const side = (sp, o) => sp.map((s, i) => (r.coeffs[o + i] > 1 ? r.coeffs[o + i] : '') + s.formula).join(' + '); return `${side(r.R, 0)} → ${side(r.P, r.R.length)}  [${r.type.k}]`; } });
  addAITool({ name: 'molarMass', subject: 'chemistry', description: 'Molar mass (g/mol) of a formula, e.g. "Ca(OH)2".', params: { formula: 'string' }, run: (a) => { const f = typeof a === 'string' ? a : a.formula; const c = parseFormula(f); let m = 0; for (const s in c) { const z = massOf(s); if (z == null) throw new Error('Unknown element ' + s); m += z * c[s]; } return +m.toFixed(3); } });
  addAITool({ name: 'elementInfo', subject: 'chemistry', description: 'Look up an element by symbol/name/number.', params: { query: 'string' }, run: (a) => { const q = String(typeof a === 'string' ? a : a.query).trim().toLowerCase(); const e = elements().find((x) => x.s.toLowerCase() === q || x.name.toLowerCase() === q || String(x.n) === q); if (!e) throw new Error('No element'); return { number: e.n, symbol: e.s, name: e.name, mass: e.mass, category: e.cat, config: e.ec }; } });
  addAITool({ name: 'phCalc', subject: 'chemistry', description: 'pH from [H+] (mol/L). Arg: concentration.', params: { conc: 'number' }, run: (a) => { const c = parseFloat(typeof a === 'string' ? a : a.conc); if (!(c > 0)) throw new Error('Need [H+] > 0'); return +(-Math.log10(c)).toFixed(2); } });
  addAITool({ name: 'gasLaw', subject: 'chemistry', description: 'Ideal gas: give 3 of P(kPa),V(L),n(mol),T(K) to find the 4th. Arg: "P=100 V=2 T=298".', params: { P: 'number', V: 'number', n: 'number', T: 'number' }, run: (a) => gasSolve(typeof a === 'string' ? parseKV(a) : a) });

  // ── helpers shared with chemistry tools ──────────────────────────────────
  function parseKV(s) { const o = {}; String(s).split(/[\s,]+/).forEach((t) => { const m = t.split('='); if (m.length === 2) o[m[0].trim().toUpperCase()] = parseFloat(m[1]); }); return o; }
  function gasSolve(o) { const R = 8.314; let { P, V, n, T } = o; const known = ['P', 'V', 'n', 'T'].filter((k) => o[k] != null && !isNaN(o[k])); if (known.length !== 3) throw new Error('Give exactly 3 of P,V,n,T'); if (P == null) P = (n * R * T) / V / 1000; else if (V == null) V = (n * R * T) / (P * 1000); else if (n == null) n = (P * 1000 * V) / (R * T); else T = (P * 1000 * V) / (n * R); return { P: +(P).toFixed(3) + ' kPa', V: +(V).toFixed(3) + ' L', n: +(n).toFixed(4) + ' mol', T: +(T).toFixed(2) + ' K' }; }

  // ════════════════════════════════════════════════════════════════════════
  //  CHEMISTRY FLAGSHIP
  // ════════════════════════════════════════════════════════════════════════
  const CATS = [['all','All','#8b90ad'],['alkali','Alkali','#e23e57'],['alkaline','Alkaline earth','#f47b2f'],['transition','Transition','#3a5bd9'],['post-transition','Post-transition','#2d8aa6'],['metalloid','Metalloid','#5b3fd6'],['nonmetal','Nonmetal','#1f9e74'],['halogen','Halogen','#1f9bb8'],['noble','Noble gas','#8a3fd6'],['lanthanide','Lanthanide','#c23d96'],['actinide','Actinide','#c23d5a']];
  let ptCat = 'all', ptQuery = '';
  function elCell(e) { const m = e.mass === Math.round(e.mass) ? e.mass : e.mass.toFixed(2); return `<button type="button" class="fsh-el" data-cat="${e.cat}" data-n="${e.n}" style="grid-row:${e.row};grid-column:${e.col}" aria-label="${esc(e.name)}"><span class="e-n">${e.n}</span><span class="e-s">${esc(e.s)}</span><span class="e-m">${m}</span></button>`; }
  function renderTableTab() {
    const els = elements(); if (!els.length) return `<div class="fsh-card" style="padding:24px">Periodic data loading… reopen in a moment.</div>`;
    const grid = els.map(elCell).join('') + `<div class="fsh-pt-spacer" style="grid-row:8;grid-column:1/-1"></div><div class="fsh-pt-fnote" style="grid-row:11">La–Lu (57–71) · Ac–Lr (89–103) shown in the lower two rows.</div>`;
    return `<div class="fsh-panel">
      <div class="fsh-pt-toolbar">
        <div class="fsh-search" style="min-width:220px;flex:1;max-width:320px"><span class="fsh-search-ico">⌕</span><input id="fshPtSearch" type="search" placeholder="Find element, symbol or #…" value="${esc(ptQuery)}"></div>
        <div class="fsh-pt-cats" id="fshPtCats">${CATS.map((c) => `<button type="button" class="fsh-cat-chip${ptCat === c[0] ? ' active' : ''}" data-cat="${c[0]}">${c[0] === 'all' ? '' : `<span class="dot" style="background:${c[2]}"></span>`}${esc(c[1])}</button>`).join('')}</div>
      </div>
      <div class="fsh-pt-scroll"><div class="fsh-pt" id="fshPtGrid">${grid}</div></div>
      <div class="fsh-el-detail" id="fshElDetail">${elDetail(elByN(selEl))}</div></div>`;
  }
  const phaseAt = (e) => { if (e.mp != null && 25 < e.mp) return 'Solid'; if (e.bp != null && 25 > e.bp) return 'Gas'; if (e.mp != null && e.bp != null) return 'Liquid'; return e.phase === 'g' ? 'Gas' : e.phase === 'l' ? 'Liquid' : 'Solid'; };
  function elDetail(e) {
    if (!e) return '';
    const p = (k, v) => v == null || v === '' ? '' : `<div class="fsh-prop"><div class="k">${k}</div><div class="v">${v}</div></div>`;
    return `<div class="fsh-eld fsh-card"><div class="fsh-eld-badge" data-cat="${e.cat}" style="background:var(--el-c)"><span class="b-n">${e.n}</span><span class="b-s">${esc(e.s)}</span><span class="b-name">${esc(e.name)}</span><span class="b-m">${e.mass}</span></div>
      <div class="fsh-eld-main"><h3>${esc(e.name)}</h3><div class="fsh-eld-cat">${esc(e.cat.replace('-', ' '))} · Period ${e.p}${e.g ? ' · Group ' + e.g : ''}</div>
      <div class="fsh-eld-props">${p('Atomic mass', e.mass)}${p('Config', esc(e.ec))}${p('Phase 25°C', phaseAt(e))}${p('Melting', e.mp != null ? e.mp + ' °C' : null)}${p('Boiling', e.bp != null ? e.bp + ' °C' : null)}${p('Density', e.d != null ? e.d + ' g/cm³' : null)}${p('Electroneg.', e.en)}${p('Found', e.year ? (e.year < 0 ? Math.abs(e.year) + ' BCE' : e.year) : null)}</div>
      ${e.fact ? `<p class="fsh-eld-fact">${esc(e.fact)}</p>` : ''}<div style="margin-top:14px"><button type="button" class="fsh-btn ghost" data-act="view-atom" data-n="${e.n}">View 3D atom →</button></div></div></div>`;
  }
  function applyPtFilter() { const q = ptQuery.trim().toLowerCase(); document.querySelectorAll('#fshPtGrid .fsh-el').forEach((c) => { const e = elByN(+c.dataset.n); const ok = (ptCat === 'all' || e.cat === ptCat) && (!q || e.name.toLowerCase().includes(q) || e.s.toLowerCase() === q || String(e.n) === q); c.classList.toggle('dim', !ok); }); }

  // atom
  function shellFill(z) { const cap = [2, 8, 18, 32, 32, 18, 8], out = []; let rem = z; for (const c of cap) { if (rem <= 0) break; out.push(Math.min(c, rem)); rem -= c; } return out; }
  // interactive 3D atom — canvas, perspective, depth-sorted electron spheres, drag-orbit + scroll-zoom
  let atomRot = { yaw: 0, pitch: -0.95 }, atomZoom = 1, atomRAF = 0, atomDrag = null;
  const rotXp = (p, a) => { const c = Math.cos(a), s = Math.sin(a); return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c]; };
  const rotYp = (p, a) => { const c = Math.cos(a), s = Math.sin(a); return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c]; };
  function atomSideHTML(e) {
    const shells = shellFill(e.n);
    return `<div class="fsh-card"><div class="fsh-atom-picker"><button type="button" class="fsh-iconbtn" data-act="atom-prev" aria-label="Previous">‹</button><input id="fshAtomInput" type="text" value="${esc(e.s)}" aria-label="Element"><button type="button" class="fsh-iconbtn" data-act="atom-next" aria-label="Next">›</button></div>
      <div style="margin-top:14px"><div style="font-size:22px;font-weight:740">${esc(e.name)} <span style="color:var(--fsh-mut);font-weight:500">· ${e.n}</span></div><div style="font-size:12.5px;color:var(--fsh-mut);margin-top:2px;text-transform:capitalize">${esc(e.cat.replace('-', ' '))} · ${e.mass} u</div></div>
      <div class="fsh-shellbars">${shells.map((c, i) => `<span class="fsh-shellbar">n${i + 1}: ${c}e⁻</span>`).join('')}</div>
      <div style="margin-top:12px;font-size:13px;color:var(--fsh-ink-2)">Configuration<br><b style="font-family:monospace;font-size:14px">${esc(e.ec)}</b></div></div>
    <div class="fsh-card" style="padding:16px 18px"><div class="fsh-atom-controls"><span style="font-size:12px;color:var(--fsh-mut)">Orbit speed</span><input id="fshAtomSpeed" class="fsh-range" type="range" min="0" max="3" step="0.1" value="${atomSpeed}"></div>
      <div class="fsh-atom-controls" style="margin-top:10px"><button type="button" class="fsh-btn ghost mini" data-act="atom-reset">⟳ Reset view</button><span class="fsh-note" style="margin:0">Drag to rotate · scroll to zoom</span></div></div>`;
  }
  function renderAtomTab() {
    const e = elByN(atomN) || elements()[0]; if (!e) return `<div class="fsh-card" style="padding:24px">Loading…</div>`;
    return `<div class="fsh-panel"><div class="fsh-atom-wrap">
      <div class="fsh-atom-stage"><div id="fshAtomCanvas"></div><div class="fsh-atom-hint">Drag to rotate · scroll to zoom</div></div>
      <div class="fsh-atom-info" id="fshAtomSide">${atomSideHTML(e)}</div></div></div>`;
  }
  function updateAtomInfo() { const side = $('fshAtomSide'); const e = elByN(atomN); if (side && e) side.innerHTML = atomSideHTML(e); }
  function mountAtom3D() {
    const wrap = $('fshAtomCanvas'); if (!wrap) return;
    const root = $('fshRoot');
    const cvs = document.createElement('canvas'); wrap.innerHTML = ''; wrap.appendChild(cvs);
    const ctx = cvs.getContext('2d'); let W = 0; const Hh = 360; let dpr = 1;
    function size() { W = wrap.clientWidth || 520; dpr = Math.min(2, window.devicePixelRatio || 1); cvs.width = W * dpr; cvs.height = Hh * dpr; cvs.style.width = W + 'px'; cvs.style.height = Hh + 'px'; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    size();
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
    let last = performance.now();
    function frame(now) {
      if (!document.body.contains(cvs)) { cancelAnimationFrame(atomRAF); atomRAF = 0; return; }
      const dt = Math.min(60, now - last); last = now;
      const e = elByN(atomN) || elements()[0]; if (!e) { atomRAF = requestAnimationFrame(frame); return; }
      if (Math.abs(W - (wrap.clientWidth || W)) > 1) size();
      const acc = (root && getComputedStyle(root).getPropertyValue('--fsh-accent').trim()) || '#34d0ff';
      const accRgb = (root && getComputedStyle(root).getPropertyValue('--fsh-accent-rgb').trim()) || '52,208,255';
      const shells = shellFill(e.n), tsec = reduced ? 0 : now / 1000;
      const cx = W / 2, cy = Hh / 2, F = 470, base = Math.min(W, Hh) * 0.11 * atomZoom;
      const cosY = Math.cos(atomRot.yaw), sinY = Math.sin(atomRot.yaw), cosP = Math.cos(atomRot.pitch), sinP = Math.sin(atomRot.pitch);
      const proj = (p) => { const x1 = p[0] * cosY + p[2] * sinY, z1 = -p[0] * sinY + p[2] * cosY, y1 = p[1]; const y2 = y1 * cosP - z1 * sinP, z2 = y1 * sinP + z1 * cosP; const s = F / (F - z2); return { x: cx + x1 * s, y: cy + y2 * s, z: z2, s }; };
      ctx.clearRect(0, 0, W, Hh);
      const rings = [], blobs = []; let maxR = 1;
      shells.forEach((cnt, i) => {
        const R = base * (1.7 + i * 1.45); maxR = Math.max(maxR, R);
        const pts = []; for (let k = 0; k <= 64; k++) { const a = k / 64 * 2 * Math.PI; pts.push(proj([R * Math.cos(a), R * Math.sin(a), 0])); }
        rings.push(pts);
        const phase = tsec * 0.6 * Math.max(0.04, atomSpeed) / (i * 0.28 + 1) + i * 0.7;
        for (let j = 0; j < cnt; j++) { const a = j / cnt * 2 * Math.PI + phase; const pr = proj([R * Math.cos(a), R * Math.sin(a), 0]); blobs.push({ x: pr.x, y: pr.y, z: pr.z, s: pr.s }); }
      });
      ctx.lineWidth = 1.3; ctx.strokeStyle = 'rgba(' + accRgb + ',.22)';
      rings.forEach((pts) => { ctx.beginPath(); pts.forEach((p, k) => k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke(); });
      const items = blobs.map((b) => ({ z: b.z, el: b })); items.push({ z: 0, nucleus: true });
      items.sort((a, b) => a.z - b.z);
      const sphere = (x, y, r, col) => { const hx = x - r * 0.38, hy = y - r * 0.42; const g = ctx.createRadialGradient(hx, hy, r * 0.08, x, y, r * 1.05); g.addColorStop(0, '#ffffff'); g.addColorStop(0.18, '#e9fbff'); g.addColorStop(0.55, col); g.addColorStop(1, '#04101b'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); const sb = ctx.shadowBlur; ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(hx, hy, Math.max(1, r * 0.2), 0, 7); ctx.fill(); ctx.shadowBlur = sb; };
      items.forEach((it) => {
        if (it.nucleus) { const pr = proj([0, 0, 0]); const r = 20 * pr.s; ctx.shadowColor = acc; ctx.shadowBlur = 24; sphere(pr.x, pr.y, r, acc); ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(4,16,27,.92)'; ctx.font = '800 ' + (13 * pr.s) + 'px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(e.s, pr.x, pr.y); return; }
        const b = it.el, depth = Math.max(0, Math.min(1, (b.z + maxR) / (2 * maxR))), r = Math.max(2.5, 7 * b.s);
        ctx.globalAlpha = 0.45 + 0.55 * depth; ctx.shadowColor = acc; ctx.shadowBlur = 12 * depth; sphere(b.x, b.y, r, acc); ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      });
      atomRAF = requestAnimationFrame(frame);
    }
    cancelAnimationFrame(atomRAF); atomRAF = 0; frame(performance.now());
    cvs.style.touchAction = 'none';
    cvs.addEventListener('pointerdown', (ev) => { atomDrag = { x: ev.clientX, y: ev.clientY, yaw: atomRot.yaw, pitch: atomRot.pitch }; try { cvs.setPointerCapture(ev.pointerId); } catch (e2) {} });
    cvs.addEventListener('pointermove', (ev) => { if (!atomDrag) return; atomRot.yaw = atomDrag.yaw + (ev.clientX - atomDrag.x) * 0.01; atomRot.pitch = Math.max(-1.45, Math.min(1.45, atomDrag.pitch + (ev.clientY - atomDrag.y) * 0.01)); });
    const end = () => { atomDrag = null; }; cvs.addEventListener('pointerup', end); cvs.addEventListener('pointercancel', end);
    cvs.addEventListener('wheel', (ev) => { ev.preventDefault(); atomZoom = Math.max(0.5, Math.min(2.6, atomZoom * (1 - ev.deltaY * 0.0012))); }, { passive: false });
  }

  // tools tab
  let balInput = 'C3H8 + O2 = CO2 + H2O', molInput = 'C6H12O6';
  function balOut() {
    let r; try { r = balance(balInput); } catch (e) { return `<div class="fsh-err">⚠ ${esc(e.message)}</div>`; }
    const side = (sp, o) => sp.map((s, i) => `${r.coeffs[o + i] > 1 ? `<span class="coef">${r.coeffs[o + i]}</span>` : ''}${subFmt(s.formula)}`).join('<span class="op">+</span>');
    return `<div class="fsh-eq">${side(r.R, 0)}<span class="arrow">→</span>${side(r.P, r.R.length)}</div><div class="fsh-eq-type">⚗ <b>${esc(r.type.k)}</b> · ${esc(r.type.d)}</div>`;
  }
  function molOut() {
    let c; try { c = parseFormula(molInput); } catch (e) { return `<div class="fsh-err">⚠ ${esc(e.message)}</div>`; }
    let mass = 0; const rows = []; for (const s in c) { const m = massOf(s); if (m == null) return `<div class="fsh-err">⚠ Unknown element: ${esc(s)}</div>`; const sub = m * c[s]; mass += sub; rows.push({ s, n: c[s], sub }); }
    if (!mass) return ''; rows.sort((a, b) => b.sub - a.sub);
    return `<div class="fsh-mm-total">${mass.toFixed(3)} <small>g/mol</small></div><div class="fsh-mm-rows">${rows.map((r) => `<div><div class="fsh-mm-row"><span class="el">${esc(r.s)} × ${r.n}</span><span>${r.sub.toFixed(2)} · ${(r.sub / mass * 100).toFixed(1)}%</span></div><div class="fsh-mm-bar" style="width:${(r.sub / mass * 100).toFixed(1)}%"></div></div>`).join('')}</div>`;
  }
  function renderToolsTab() {
    return `<div class="fsh-panel"><div class="fsh-tools-grid">
      <div class="fsh-tool fsh-card"><h3>⚖ Equation balancer</h3><p class="sub">Type a skeleton equation — separate sides with <b>=</b>, <b>→</b> or <b>-</b>. Solves instantly.</p>
        <div class="fsh-chips-row">${['H2 + O2 = H2O','CH4 + O2 = CO2 + H2O','Fe + O2 = Fe2O3','Al + HCl = AlCl3 + H2'].map((q) => `<button type="button" class="fsh-cat-chip" data-bal="${esc(q)}">${subFmt(q)}</button>`).join('')}</div>
        <div class="fsh-field"><input id="fshBalIn" class="fsh-input" value="${esc(balInput)}" spellcheck="false"><button type="button" class="fsh-btn ghost mini" data-act="ins-arrow" title="Insert arrow">＋ →</button><button type="button" class="fsh-btn" data-act="balance">Balance</button></div>
        <div class="fsh-note">Can't type →? Just use “=” or “-”. The ＋→ button inserts one too.</div>
        <div class="fsh-eq-out" id="fshBalOut">${balOut()}</div></div>
      <div class="fsh-tool fsh-card"><h3>⚗ Molar mass</h3><p class="sub">Parse any formula — try Ca(OH)2 or (NH4)2SO4.</p>
        <div class="fsh-field"><input id="fshMolIn" class="fsh-input" value="${esc(molInput)}" spellcheck="false"><button type="button" class="fsh-btn" data-act="molar">Compute</button></div>
        <div class="fsh-eq-out" id="fshMolOut">${molOut()}</div></div>
      <div class="fsh-tool fsh-card"><h3>🧪 pH &amp; dilution</h3><p class="sub">pH from [H⁺], and C₁V₁ = C₂V₂.</p>
        <div class="fsh-label"><span>[H⁺] (mol/L)</span></div><div class="fsh-field"><input id="fshPhIn" class="fsh-input" value="1e-3"><button type="button" class="fsh-btn" data-act="ph">pH</button></div><div class="fsh-out" id="fshPhOut"></div>
        <div class="fsh-label" style="margin-top:16px"><span>Dilution — leave one blank</span></div>
        <div class="fsh-field"><input id="fshD_c1" class="fsh-input short" placeholder="C₁"><input id="fshD_v1" class="fsh-input short" placeholder="V₁"><input id="fshD_c2" class="fsh-input short" placeholder="C₂"><input id="fshD_v2" class="fsh-input short" placeholder="V₂"><button type="button" class="fsh-btn" data-act="dil">Solve</button></div><div class="fsh-out" id="fshDilOut"></div></div>
      <div class="fsh-tool fsh-card"><h3>🎈 Ideal gas law</h3><p class="sub">PV = nRT — fill any three, leave one blank.</p>
        <div class="fsh-field"><input id="fshG_P" class="fsh-input short" placeholder="P kPa"><input id="fshG_V" class="fsh-input short" placeholder="V L"><input id="fshG_n" class="fsh-input short" placeholder="n mol"><input id="fshG_T" class="fsh-input short" placeholder="T K"><button type="button" class="fsh-btn" data-act="gas">Solve</button></div><div class="fsh-out" id="fshGasOut"></div></div>
      <div class="fsh-tool fsh-card"><h3>🧫 Solubility table</h3><p class="sub">Common ionic compounds in water (25 °C).</p>
        <div class="fsh-sol-scroll"><table class="fsh-sol"><thead><tr><th></th>${SOL_ANIONS.map((a) => `<th>${a}</th>`).join('')}</tr></thead><tbody>${SOL_CATIONS.map((cat, i) => `<tr><th>${cat}</th>${SOL_GRID[i].map((s) => `<td data-s="${s}">${s === 's' ? 'sl' : s}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
        <div class="fsh-sol-legend"><span><i style="background:rgba(52,211,153,.5)"></i>Soluble</span><span><i style="background:rgba(251,191,36,.5)"></i>Slightly</span><span><i style="background:rgba(248,113,113,.5)"></i>Insoluble</span></div></div>
      <div class="fsh-tool fsh-card"><h3>📐 Constants</h3><p class="sub">Data-booklet values.</p><div class="fsh-const">${CONSTANTS.map((c) => `<div class="fsh-prop"><div class="k">${esc(c[0])}</div><div class="v" style="font-size:13px">${esc(c[1])}</div></div>`).join('')}</div></div>
    </div></div>`;
  }
  function renderIonsTab() {
    const grid = (arr) => `<div class="fsh-ion-grid">${arr.map((i) => `<div class="fsh-ion"><span class="f">${i[0]}</span><div class="n">${esc(i[1])}</div></div>`).join('')}</div>`;
    return `<div class="fsh-panel"><div class="fsh-section-head"><span class="fsh-sh-ico">＋</span><span><h2>Cations</h2><p>Positive ions — name & charge</p></span></div>${grid(IONS_CAT)}
      <div class="fsh-section-head"><span class="fsh-sh-ico">－</span><span><h2>Anions</h2><p>Negative ions — including polyatomics</p></span></div>${grid(IONS_AN)}</div>`;
  }

  // worksheet
  let wsCfg = { types: new Set(['synthesis','decomposition','combustion','single','double','redox']), diff: 'all', count: 10, mode: 'balance' }, wsGen = [];
  const wsPool = () => EQUATIONS.filter(([eq, t, d]) => wsCfg.types.has(t) && (wsCfg.diff === 'all' || wsCfg.diff === d));
  function wsGenerate() {
    const pool = wsPool().slice(); for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    wsGen = pool.slice(0, wsCfg.count).map(([eq, t]) => { let b = null; try { b = balance(eq); } catch (e) {} return { eq, t, bal: b }; }).filter((x) => x.bal);
  }
  function skeleton(eq, blanks) { const s = splitEquation(eq); const side = (txt) => txt.split('+').map((f) => `${blanks ? '<span class="blank">__ </span>' : ''}${subFmt(f.trim())}`).join(' <span class="op">+</span> '); return `${side(s[0])} <span class="arrow">→</span> ${side(s[1])}`; }
  function balancedStr(it) { const r = it.bal, side = (sp, o) => sp.map((s, i) => (r.coeffs[o + i] > 1 ? r.coeffs[o + i] : '') + subPlain(s.formula)).join(' + '); return `${side(r.R, 0)} → ${side(r.P, r.R.length)}`; }
  const wsActive = (g, v) => g === 'diff' ? wsCfg.diff === v : g === 'count' ? String(wsCfg.count) === v : g === 'mode' ? wsCfg.mode === v : false;
  function wsPreview() { if (!wsGen.length) return `<p style="color:var(--fsh-mut)">No equations match — pick at least one reaction type.</p>`; return wsGen.map((it, i) => `<div class="fsh-ws-q"><span class="num">${i + 1}</span><span class="eq">${skeleton(it.eq, wsCfg.mode !== 'type')}${wsCfg.mode !== 'balance' ? ` &nbsp;<span class="blank">— type: ______</span>` : ''}</span></div>`).join(''); }
  function renderWorksheetTab() {
    if (!wsGen.length) wsGenerate();
    const seg = (g, opts) => `<div class="fsh-seg">${opts.map(([v, l]) => `<button type="button" data-ws="${g}" data-v="${v}" class="${wsActive(g, v) ? 'active' : ''}">${l}</button>`).join('')}</div>`;
    const avail = wsPool().length;
    return `<div class="fsh-panel"><div class="fsh-card" style="padding:22px"><div class="fsh-ws-controls">
      <div class="fsh-ws-group"><label>Reaction types</label><div class="fsh-seg">${[['synthesis','Synth'],['decomposition','Decomp'],['combustion','Combust'],['single','Single'],['double','Double'],['redox','Redox']].map(([v, l]) => `<button type="button" data-ws="type" data-v="${v}" class="${wsCfg.types.has(v) ? 'active' : ''}">${l}</button>`).join('')}</div></div>
      <div class="fsh-ws-group"><label>Difficulty</label>${seg('diff', [['all','All'],['easy','Easy'],['medium','Medium'],['hard','Hard']])}</div>
      <div class="fsh-ws-group"><label>Questions</label>${seg('count', [['5','5'],['10','10'],['15','15'],['20','20']])}</div>
      <div class="fsh-ws-group"><label>Mode</label>${seg('mode', [['balance','Balance'],['type','Identify'],['combined','Combined']])}</div></div>
      <div style="display:flex;gap:10px;margin-top:18px;flex-wrap:wrap"><button type="button" class="fsh-btn" data-act="ws-gen">↻ Generate new set</button><button type="button" class="fsh-btn ghost" data-act="ws-print">🖨 Print / Save PDF</button><span style="align-self:center;color:var(--fsh-mut);font-size:12.5px">${wsGen.length} shown · ${avail} available for these filters</span></div>
      <div class="fsh-ws-preview" id="fshWsPreview">${wsPreview()}</div></div></div>`;
  }
  function wsPrint() {
    if (!wsGen.length) return; let root = $('fshPrintRoot'); if (!root) { root = document.createElement('div'); root.id = 'fshPrintRoot'; document.body.appendChild(root); }
    const blanks = (txt) => txt.split('+').map((f) => `____ ${subPlain(f.trim())}`).join(' + ');
    const plain = (txt) => txt.split('+').map((f) => subPlain(f.trim())).join(' + ');
    const pq = (eq) => { const s = splitEquation(eq); if (wsCfg.mode === 'type') return `${plain(s[0])} → ${plain(s[1])} &nbsp; Type: ________`; if (wsCfg.mode === 'combined') return `${blanks(s[0])} → ${blanks(s[1])} &nbsp; Type: ______`; return `${blanks(s[0])} → ${blanks(s[1])}`; };
    const q = wsGen.map((it, i) => `<p class="pq"><span class="n">${i + 1}.</span>${pq(it.eq)}</p>`).join('');
    const key = wsGen.map((it, i) => `<p class="ak">${i + 1}. ${balancedStr(it)} &nbsp;<i>[${TYPE_LABEL[it.t] || it.t}]</i></p>`).join('');
    root.innerHTML = `<h1>Chemistry — Balancing Worksheet</h1><div class="meta">Name: __________________ · Date: ${new Date().toLocaleDateString()} · ${wsGen.length} questions · ${wsCfg.mode}</div>${q}<div class="ans-key"><h2>Answer key</h2>${key}</div>`;
    window.print();
  }

  const CHEM_TABS = [['table','⊞','Table'],['atom','◎','Atom'],['tools','⚗','Tools'],['ions','±','Ions'],['worksheet','📝','Worksheet']];
  function renderChemBody() {
    const b = $('fshChemBody'); if (!b) return;
    if (state.chemTab && state.chemTab.indexOf('lg-') === 0) { const chip = legacyChipsFor('chemistry').find((c) => 'lg-' + c.id === state.chemTab); if (chip) { recordRecent('chemistry', 'chem:' + state.chemTab, chip.label || chip.id, chip.icon || '🧰'); renderLegacyTool(b, chip); return; } state.chemTab = 'table'; }
    const ct = CHEM_TABS.find((t) => t[0] === state.chemTab);
    if (ct) recordRecent('chemistry', 'chem:' + ct[0], CHEM_QUICK_NAME[ct[0]] || ct[2], ct[1]);
    b.innerHTML = state.chemTab === 'table' ? renderTableTab() : state.chemTab === 'atom' ? renderAtomTab() : state.chemTab === 'tools' ? renderToolsTab() : state.chemTab === 'ions' ? renderIonsTab() : renderWorksheetTab();
    if (state.chemTab === 'table') applyPtFilter();
    else if (state.chemTab === 'atom') setTimeout(mountAtom3D, 0);
  }
  function renderChem() {
    const tabs = CHEM_TABS.concat(legacyChipsFor('chemistry').map((c) => ['lg-' + c.id, c.icon || '🧰', c.label || c.id]));
    if (!tabs.some((t) => t[0] === state.chemTab)) state.chemTab = 'table';
    $('fshStage').innerHTML = `<div class="fsh-chem fsh-panel"><div class="fsh-chem-tabs" id="fshChemTabs"><div class="fsh-chem-tab-glide" id="fshTabGlide"></div>${tabs.map((t) => `<button type="button" class="fsh-chem-tab${state.chemTab === t[0] ? ' active' : ''}" data-tab="${esc(t[0])}"><span class="fsh-ct-ico">${t[1]}</span>${esc(t[2])}</button>`).join('')}</div><div class="fsh-chem-body" id="fshChemBody"></div></div>` + refStrip('chemistry');
    renderChemBody(); requestAnimationFrame(moveTabGlide);
  }

  // ── generic subject (registered tools) ───────────────────────────────────
  function renderRegistered(sid) {
    const tools = (registry[sid] || []).filter((t) => typeof t.render === 'function');
    const stage = $('fshStage');
    if (!tools.length) { stage.innerHTML = soonHTML(sid) + refStrip(sid); return; }
    let active = state.tool[sid]; if (!tools.some((t) => t.id === active)) active = tools[0].id; state.tool[sid] = active; save();
    const at = tools.find((t) => t.id === active); if (at) recordRecent(sid, at.id, at.name, at.icon);
    stage.innerHTML = `<div class="fsh-chem fsh-panel"><div class="fsh-chem-tabs" id="fshChemTabs"><div class="fsh-chem-tab-glide" id="fshTabGlide"></div>${tools.map((t) => `<button type="button" class="fsh-chem-tab${t.id === active ? ' active' : ''}" data-tool="${t.id}"><span class="fsh-ct-ico">${t.icon || '•'}</span>${esc(t.name)}</button>`).join('')}</div><div class="fsh-chem-body" id="fshSubBody"></div></div>` + refStrip(sid);
    const body = $('fshSubBody'), tool = tools.find((t) => t.id === active);
    try { tool.render(body); } catch (e) { body.innerHTML = `<div class="fsh-err">Tool error: ${esc(e.message)}</div>`; }
    requestAnimationFrame(moveTabGlide);
  }
  function soonHTML(sid) { const s = subjById(sid); return `<div class="fsh-card fsh-soon fsh-panel"><div class="ic">${s.ico}</div><h3>${esc(s.name)} tools didn't load</h3><p>The ${esc(s.name)} module isn't available right now — try reloading. Meanwhile, here are the best interactive sites.</p></div>`; }
  function refStrip(sid) {
    const r = REF[sid]; if (!r || !r.length) return '';
    return `<div class="fsh-section-head" style="margin-top:26px"><span class="fsh-sh-ico">↗</span><span><h2>Reference sites</h2><p>Trusted external interactives — opens in a new tab</p></span></div><div class="fsh-grid">${r.map(([n, h, u]) => `<a class="fsh-res" href="${esc(u)}" target="_blank" rel="noopener noreferrer"><div class="fsh-res-head"><span class="fsh-res-logo">${esc(n.slice(0, 2).toUpperCase())}</span><span><span class="fsh-res-title">${esc(n)}</span><span class="fsh-res-host">${esc(h)}</span></span></div><span class="fsh-res-open">Open site →</span></a>`).join('')}</div>`;
  }

  function moveTabGlide() {
    const tabs = $('fshChemTabs'), g = $('fshTabGlide'); if (!tabs || !g) return;
    const a = tabs.querySelector('.fsh-chem-tab.active'); if (!a) return; g.style.left = a.offsetLeft + 'px'; g.style.width = a.offsetWidth + 'px';
    try { a.scrollIntoView({ inline: 'nearest', block: 'nearest' }); } catch (e) {}
  }

  // ── search ───────────────────────────────────────────────────────────────
  const CHEM_SEARCH = [
    ['chem:table', '⊞', 'Periodic Table', 'periodic table elements groups categories'],
    ['chem:atom', '◎', '3D Atom Model', '3d atom model bohr electron shells orbit nucleus'],
    ['chem:tools', '⚗', 'Chem Calculators', 'balance balancer equation molar mass ph gas law dilution calculator'],
    ['chem:ions', '±', 'Ions & Solubility', 'ions polyatomic solubility table constants'],
    ['chem:worksheet', '📝', 'Worksheet Maker', 'worksheet practice problems generator print quiz redox'],
  ];
  function renderSearch() {
    const q = searchQ.trim().toLowerCase();
    const toolHits = [];
    CHEM_SEARCH.forEach(([tid, ico, name, kw]) => { if ((name + ' ' + kw).toLowerCase().includes(q)) toolHits.push({ sid: 'chemistry', t: { id: tid, icon: ico, name } }); });
    legacyChipsFor('chemistry').forEach((c) => { if (((c.label || '') + ' ' + (c.desc || '')).toLowerCase().includes(q)) toolHits.push({ sid: 'chemistry', t: { id: 'chem:lg-' + c.id, icon: c.icon || '🧰', name: c.label || c.id } }); });
    Object.keys(registry).forEach((sid) => (registry[sid] || []).forEach((t) => { if (t.render && (t.name + ' ' + (t.desc || '')).toLowerCase().includes(q)) toolHits.push({ sid, t }); }));
    const subHits = SUBJECTS.filter((s) => s.name.toLowerCase().includes(q));
    const elHits = elements().filter((e) => e.name.toLowerCase().includes(q) || e.s.toLowerCase() === q).slice(0, 8);
    const none = !toolHits.length && !elHits.length && !subHits.length;
    $('fshStage').innerHTML = `<div class="fsh-panel"><div class="fsh-section-head"><span class="fsh-sh-ico">⌕</span><span><h2>Results for "${esc(searchQ)}"</h2><p>${toolHits.length} tools · ${subHits.length} subjects · ${elHits.length} elements</p></span></div>
      ${subHits.length ? `<div class="fsh-chips-row" style="margin-bottom:16px">${subHits.map((s) => `<button type="button" class="fsh-qchip" data-act="open-sub" data-sid="${s.id}"><span class="qi">${s.ico}</span>${esc(s.name)} →</button>`).join('')}</div>` : ''}
      ${elHits.length ? `<div class="fsh-grid" style="margin-bottom:18px">${elHits.map((e) => `<button type="button" class="fsh-res" data-act="open-el" data-n="${e.n}" style="text-align:left"><div class="fsh-res-head"><span class="fsh-res-logo fsh-el" data-cat="${e.cat}" style="background:var(--el-c)">${esc(e.s)}</span><span><span class="fsh-res-title">${esc(e.name)}</span><span class="fsh-res-host">Element ${e.n} · ${e.mass} u</span></span></div><span class="fsh-res-open">Open in periodic table →</span></button>`).join('')}</div>` : ''}
      ${toolHits.length ? `<div class="fsh-grid">${toolHits.map((h) => `<button type="button" class="fsh-res" data-act="open-tool" data-sid="${h.sid}" data-tid="${h.t.id}" style="text-align:left"><div class="fsh-res-head"><span class="fsh-res-logo">${h.t.icon || '•'}</span><span><span class="fsh-res-title">${esc(h.t.name)}</span><span class="fsh-res-host">${esc(subjById(h.sid).name)}</span></span></div><span class="fsh-res-open">Open tool →</span></button>`).join('')}</div>` : ''}
      ${none ? `<p style="color:var(--fsh-mut)">No matches — try a tool name ("balancer"), an element ("Fe"), or a subject ("physics").</p>` : ''}</div>`;
  }

  // ── quick access (recently used tools) ───────────────────────────────────
  const CHEM_QUICK_NAME = { table: 'Periodic Table', atom: '3D Atom', tools: 'Chem Calculators', ions: 'Ions & Solubility', worksheet: 'Worksheet Maker' };
  function recordRecent(sid, tid, name, icon) {
    if (!name) return;
    state.recent = state.recent.filter((r) => !(r.sid === sid && r.tid === tid));
    state.recent.unshift({ sid, tid, name, icon: icon || '•' });
    state.recent = state.recent.slice(0, 8);
    save(); renderQuick();
  }
  function renderQuick() {
    const q = $('fshQuick'); if (!q) return;
    const items = state.recent.slice(0, 6);
    if (!items.length) { q.hidden = true; q.innerHTML = ''; return; }
    q.hidden = false;
    q.innerHTML = `<span class="fsh-quick-label">Recent</span>` + items.map((r) => `<button type="button" class="fsh-qchip" data-sid="${esc(r.sid)}" data-tid="${esc(r.tid)}" title="${esc(subjById(r.sid).name)} · ${esc(r.name)}"><span class="qi">${r.icon}</span>${esc(r.name)}</button>`).join('');
  }
  function openToolRef(sid, tid) {
    searchQ = ''; const si = $('fshSearch'); if (si) si.value = ''; const sc = $('fshSearchClear'); if (sc) sc.hidden = true;
    state.subject = sid;
    if (sid === 'chemistry' && tid && tid.indexOf('chem:') === 0) state.chemTab = tid.slice(5);
    else if (tid) state.tool[sid] = tid;
    save(); selectSubject(sid);
  }

  // ── stage dispatch ───────────────────────────────────────────────────────
  function renderStage() {
    if (searchQ.trim()) { renderSearch(); return; }
    const s = subjById(state.subject); applyAccent(s.accent);
    if (state.subject === 'chemistry') renderChem(); else renderRegistered(state.subject);
  }
  function selectSubject(id) {
    state.subject = id; searchQ = ''; save();
    const si = $('fshSearch'); if (si) si.value = ''; const c = $('fshSearchClear'); if (c) c.hidden = true;
    document.querySelectorAll('#fshRail .fsh-pill').forEach((p) => p.classList.toggle('active', p.dataset.sub === id));
    const a = document.querySelector('#fshRail .fsh-pill.active'); if (a && a.scrollIntoView) a.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    renderStage();
  }

  // ── shell + events ───────────────────────────────────────────────────────
  function buildShell() {
    const host = $('stSections'); if (!host) return false;
    if ($('toolbox')) $('toolbox').classList.add('fsh-active');
    host.innerHTML = `<div id="fshRoot" class="fsh"><div class="fsh-hero"><div class="fsh-hero-text"><h1>Study Tools</h1><p>Native, interactive tools for all ${SUBJECTS.length} subjects — calculators, simulations, references and your Classic tools, no tab-hopping.</p></div><div class="fsh-search"><span class="fsh-search-ico">⌕</span><input id="fshSearch" type="search" placeholder="Search tools, subjects & elements…" autocomplete="off"><button type="button" class="fsh-search-clear" id="fshSearchClear" hidden aria-label="Clear">×</button><span class="fsh-search-key" aria-hidden="true">/</span></div></div>
      <div class="fsh-rail-wrap"><div class="fsh-rail" id="fshRail">${SUBJECTS.map((s) => `<button type="button" class="fsh-pill${s.id === state.subject ? ' active' : ''}${s.flagship ? ' flagship' : ''}" data-sub="${s.id}"><span class="fsh-pill-ico">${s.ico}</span>${esc(s.name)}</button>`).join('')}</div></div>
      <div class="fsh-quick" id="fshQuick" hidden></div>
      <div class="fsh-stage" id="fshStage"></div></div>`;
    wire(); renderQuick(); return true;
  }
  function wire() {
    const root = $('fshRoot'); if (!root || root.__wired) return; root.__wired = true;
    $('fshRail').addEventListener('click', (e) => { const p = e.target.closest('.fsh-pill'); if (p) selectSubject(p.dataset.sub); });
    const si = $('fshSearch'), sc = $('fshSearchClear');
    si.addEventListener('input', () => { searchQ = si.value; sc.hidden = !searchQ; renderStage(); });
    si.addEventListener('keydown', (e) => { if (e.key === 'Escape') { searchQ = ''; si.value = ''; sc.hidden = true; renderStage(); si.blur(); } });
    sc.addEventListener('click', () => { searchQ = ''; si.value = ''; sc.hidden = true; renderStage(); });

    $('fshQuick').addEventListener('click', (e) => { const c = e.target.closest('.fsh-qchip'); if (c) openToolRef(c.dataset.sid, c.dataset.tid); });
    $('fshRail').addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const pills = [...document.querySelectorAll('#fshRail .fsh-pill')];
      const i = pills.indexOf(document.activeElement); if (i < 0) return;
      e.preventDefault();
      const next = pills[(i + (e.key === 'ArrowRight' ? 1 : -1) + pills.length) % pills.length];
      next.focus(); selectSubject(next.dataset.sub);
    });
    if (!window.__fshKeys) {
      window.__fshKeys = true;
      // capture phase + stopPropagation: on the Study tab "/" focuses tool search
      // instead of the app-wide "/" → AI panel shortcut in app.js
      document.addEventListener('keydown', (e) => {
        if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
        const t = e.target;
        if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
        // __fluxLastNavPanel updates synchronously in nav(); the panel's .active
        // class lingers ~500ms during the leave transition, so don't trust it alone
        const cur = window.__fluxLastNavPanel || (($('toolbox') || {}).classList && $('toolbox').classList.contains('active') ? 'toolbox' : '');
        if (cur !== 'toolbox' || !$('fshRoot')) return;
        const inp = $('fshSearch'); if (inp) { e.preventDefault(); e.stopPropagation(); inp.focus(); inp.select(); }
      }, true);
    }

    $('fshStage').addEventListener('click', (e) => {
      const t = e.target;
      const a0 = t.closest('[data-act]');
      if (a0 && a0.dataset.act === 'open-el') { selEl = +a0.dataset.n; openToolRef('chemistry', 'chem:table'); return; }
      if (a0 && a0.dataset.act === 'open-tool') { openToolRef(a0.dataset.sid, a0.dataset.tid); return; }
      if (a0 && a0.dataset.act === 'open-sub') { openToolRef(a0.dataset.sid, ''); return; }
      const chemTab = t.closest('.fsh-chem-tab[data-tab]');
      if (chemTab) { state.chemTab = chemTab.dataset.tab; save(); document.querySelectorAll('.fsh-chem-tab').forEach((b) => b.classList.toggle('active', b === chemTab)); renderChemBody(); requestAnimationFrame(moveTabGlide); return; }
      const subTab = t.closest('.fsh-chem-tab[data-tool]');
      if (subTab) { state.tool[state.subject] = subTab.dataset.tool; save(); renderRegistered(state.subject); return; }
      const cell = t.closest('.fsh-el');
      if (cell && cell.dataset.n && !a0) { selEl = +cell.dataset.n; const d = $('fshElDetail'); if (d) { d.innerHTML = elDetail(elByN(selEl)); d.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } return; }
      const cat = t.closest('.fsh-cat-chip[data-cat]');
      if (cat) { ptCat = cat.dataset.cat; document.querySelectorAll('#fshPtCats .fsh-cat-chip').forEach((c) => c.classList.toggle('active', c === cat)); applyPtFilter(); return; }
      const bc = t.closest('[data-bal]');
      if (bc) { balInput = bc.dataset.bal; const i = $('fshBalIn'); if (i) i.value = balInput; $('fshBalOut').innerHTML = balOut(); return; }
      const ws = t.closest('[data-ws]');
      if (ws) { const g = ws.dataset.ws, v = ws.dataset.v; if (g === 'type') { wsCfg.types.has(v) ? wsCfg.types.delete(v) : wsCfg.types.add(v); } else if (g === 'diff') wsCfg.diff = v; else if (g === 'count') wsCfg.count = +v; else if (g === 'mode') wsCfg.mode = v; wsGenerate(); renderChemBody(); requestAnimationFrame(moveTabGlide); return; }
      const act = t.closest('[data-act]'); if (!act) return; const a = act.dataset.act;
      if (a === 'lg-open') { const md = act.dataset.mode; if (md === 'link' && act.dataset.nav && window.nav) window.nav(act.dataset.nav); else if (act.dataset.fn && typeof window[act.dataset.fn] === 'function') window[act.dataset.fn](); return; }
      if (a === 'balance') { const i = $('fshBalIn'); balInput = i ? i.value : balInput; $('fshBalOut').innerHTML = balOut(); }
      else if (a === 'ins-arrow') { const i = $('fshBalIn'); if (i) { i.value = i.value.replace(/\s*$/, '') + ' → '; i.focus(); balInput = i.value; $('fshBalOut').innerHTML = balOut(); } }
      else if (a === 'molar') { const i = $('fshMolIn'); molInput = i ? i.value : molInput; $('fshMolOut').innerHTML = molOut(); }
      else if (a === 'ph') { const v = parseFloat(($('fshPhIn') || {}).value); const o = $('fshPhOut'); if (o) o.innerHTML = v > 0 ? `<span class="big">pH ${(-Math.log10(v)).toFixed(2)}</span>` : `<span class="fsh-err">Need [H⁺] > 0</span>`; }
      else if (a === 'dil') { dilSolve(); }
      else if (a === 'gas') { const o = $('fshGasOut'); try { const r = gasSolve({ P: num('fshG_P'), V: num('fshG_V'), n: num('fshG_n'), T: num('fshG_T') }); o.innerHTML = `<span class="big">${esc([r.P, r.V, r.n, r.T].join(' · '))}</span>`; } catch (e) { o.innerHTML = `<span class="fsh-err">${esc(e.message)}</span>`; } }
      else if (a === 'view-atom') { atomN = +act.dataset.n; state.chemTab = 'atom'; save(); document.querySelectorAll('.fsh-chem-tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === 'atom')); renderChemBody(); requestAnimationFrame(moveTabGlide); }
      else if (a === 'atom-prev' || a === 'atom-next') { atomN = Math.max(1, Math.min(elements().length, atomN + (a === 'atom-next' ? 1 : -1))); updateAtomInfo(); }
      else if (a === 'atom-reset') { atomRot = { yaw: 0, pitch: -0.95 }; atomZoom = 1; }
      else if (a === 'ws-gen') { wsGenerate(); $('fshWsPreview').innerHTML = wsPreview(); }
      else if (a === 'ws-print') { wsPrint(); }
    });
    $('fshStage').addEventListener('input', (e) => {
      const t = e.target;
      if (t.id === 'fshBalIn') { balInput = t.value; $('fshBalOut').innerHTML = balOut(); }
      else if (t.id === 'fshMolIn') { molInput = t.value; $('fshMolOut').innerHTML = molOut(); }
      else if (t.id === 'fshPtSearch') { ptQuery = t.value; applyPtFilter(); }
      else if (t.id === 'fshAtomSpeed') { atomSpeed = +t.value; }
      else if (t.id === 'fshAtomInput') { const v = t.value.trim(); let e2 = /^\d+$/.test(v) ? elByN(+v) : elements().find((x) => x.s.toLowerCase() === v.toLowerCase()); if (e2) atomN = e2.n; }
    });
  }
  const num = (id) => { const v = ($(id) || {}).value; return v === '' || v == null ? null : parseFloat(v); };
  function dilSolve() {
    const o = $('fshDilOut'); const c1 = num('fshD_c1'), v1 = num('fshD_v1'), c2 = num('fshD_c2'), v2 = num('fshD_v2');
    const vals = { c1, v1, c2, v2 }; const blanks = Object.keys(vals).filter((k) => vals[k] == null);
    if (blanks.length !== 1) { o.innerHTML = `<span class="fsh-err">Leave exactly one blank.</span>`; return; }
    let r; const b = blanks[0]; if (b === 'c1') r = c2 * v2 / v1; else if (b === 'v1') r = c2 * v2 / c1; else if (b === 'c2') r = c1 * v1 / v2; else r = c1 * v1 / c2;
    o.innerHTML = `<span class="big">${b.toUpperCase()} = ${(+r).toPrecision(4)}</span>`;
  }

  // ── public entry ─────────────────────────────────────────────────────────
  // ── merge legacy (original) tools as a "Classic" tab per subject ──────────
  let _legacyIdx = null, _merged = false;
  function buildLegacyIndex() {
    if (_legacyIdx) return _legacyIdx;
    const UL = window.fluxToolbox && window.fluxToolbox.UNIFIED_LAYOUT; if (!UL) return null;
    const SECTION = { math: 'math', cs: 'cs' };
    const OVERRIDE = { 'physics-sandbox': 'physics', 'chem-ref': 'chemistry', 'unit-conv': 'chemistry', 'codon': 'biology', 'psych-ref': 'biology', 'math-analysis': 'math', 'math-formulas': 'math', 'geo-ref': 'math', 'gopo-ref': 'history', 'hist-skills': 'history', 'lit-ref': 'english', 'arts-ref': 'english', 'german-ref': 'languages', 'spanish-conj': 'languages', 'french-conj': 'languages', 'translate-ai': 'languages', 'music-theory': 'music', 'cs-ref': 'cs' };
    const SKIP = { 'periodic-tbl': 1, 'molar-mass': 1, 'graphing': 1, 'matrix': 1, 'stats': 1, 'timeline': 1, 'map-quiz': 1, 'grammar': 1, 'essay': 1, 'literary': 1, 'cite-notes': 1, 'ipa': 1, 'econ-formulas': 1, 'fin-calc': 1, 'dp-dimensions': 1, 'dp-chart': 1, 'lit-devices': 1, 'hist-map': 1 };
    const idx = {};
    UL.forEach((sec) => (sec.tools || []).forEach((c) => {
      if (SKIP[c.id]) return;
      const sub = OVERRIDE[c.id] || SECTION[sec.id]; if (!sub) return;
      (idx[sub] = idx[sub] || []).push({ id: c.id, label: c.label, icon: c.icon, mode: c.mode, sub: c.sub, tid: c.tid, fn: c.fn, nav: c.nav, desc: c.desc });
    }));
    _legacyIdx = idx; return idx;
  }
  const legacyChipsFor = (sub) => { const idx = buildLegacyIndex(); return (idx && idx[sub]) || []; };
  function renderLegacyTool(body, chip) {
    if (chip.mode === 'inline' && window.fluxToolbox && window.fluxToolbox.renderToolIntoBody) {
      body.innerHTML = '<div class="fsh-panel" id="fshLgMount"></div>';
      try { window.fluxToolbox.renderToolIntoBody($('fshLgMount'), chip.sub, chip.tid); } catch (e3) { body.innerHTML = `<div class="fsh-panel"><div class="fsh-err">${esc(e3.message)}</div></div>`; }
      return;
    }
    // Clicking the chip opens the tool directly — no intermediate button.
    let opened = false;
    try {
      if (chip.mode === 'link' && chip.nav && window.nav) { window.nav(chip.nav); opened = true; }
      else if (chip.fn && typeof window[chip.fn] === 'function') { window[chip.fn](); opened = true; }
    } catch (e4) { opened = false; }
    body.innerHTML = `<div class="fsh-panel"><div class="fsh-card fsh-soon"><div class="ic">${chip.icon || '▣'}</div><h3>${esc(chip.label || chip.id)}</h3><p>${opened ? 'Opened — it’s on screen now.' : esc(chip.desc || 'Could not open this tool automatically.')} <button type="button" class="fsh-btn fsh-btn--ghost" data-act="lg-open" data-fn="${esc(chip.fn || '')}" data-nav="${esc(chip.nav || '')}" data-mode="${esc(chip.mode || '')}">${opened ? 'Reopen' : 'Open ' + esc(chip.label || 'tool')}</button></p></div></div>`;
  }
  function mergeLegacyOnce() {
    if (_merged) return; const idx = buildLegacyIndex(); if (!idx) return; _merged = true;
    Object.keys(idx).forEach((sub) => { if (sub === 'chemistry') return; register(sub, idx[sub].map((chip) => ({ id: 'lg-' + chip.id, name: chip.label || chip.id, icon: chip.icon || '🧰', desc: 'classic ' + (chip.desc || chip.label || ''), render: (b) => renderLegacyTool(b, chip) }))); });
  }
  function renderHub() { if (!$('fshRoot')) { if (!buildShell()) return; } mergeLegacyOnce(); renderStage(); }
  window.renderToolbox = renderHub;
  window.renderStudyTools = renderHub;
  window.fluxStudyHub = { render: renderHub, register, addAITool, tools: aiTools, aiManifest, slash, balance, parseFormula, selectSubject,
    helpers: { elements, elByN, massOf, shellFill, esc, subFmt } };

  document.addEventListener('DOMContentLoaded', () => { const tb = $('toolbox'); if (tb && tb.classList.contains('active')) renderHub(); });
})();
