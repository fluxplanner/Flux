/* ════════════════════════════════════════════════════════════════
   FLUX TOOLBOX
   Cross-subject study tools: formula sheets, graphing calc, matrix
   calc, stats, converters, citation builder, conjugation, ASCII/
   binary, financial calc, and more. One tab with subject subtabs.
   ════════════════════════════════════════════════════════════════ */

(function(){
'use strict';

// ────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const esc = s => String(s == null ? '' : s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const round = (n, d=4) => {
  if (!isFinite(n)) return String(n);
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
};
const fmt = (n, d=4) => {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  if (!isFinite(n)) return n > 0 ? '∞' : '-∞';
  const abs = Math.abs(n);
  if (abs !== 0 && (abs >= 1e6 || abs < 1e-3)) return n.toExponential(d-1);
  return String(round(n, d));
};
function copyToClipboard(text){
  try{
    navigator.clipboard?.writeText(text);
    if (window.showToast) showToast('Copied','success');
  }catch(e){ /* ignore */ }
}

// Escape attribute value without disturbing user input rendering
const attr = esc;

// ────────────────────────────────────────────────────────────────
// SUBJECTS & TOOLS CONFIG
// Each subject has tools; each tool has {id, label, icon, render}.
// ────────────────────────────────────────────────────────────────
const SUBJECTS = []; // populated below

// ────────────────────────────────────────────────────────────────
// STATE
// ────────────────────────────────────────────────────────────────
const state = {
  subject: 'science',
  tool: null, // id of current tool within subject
  built: false,
};

// ────────────────────────────────────────────────────────────────
// Shared render helpers (unified Study Tools + legacy callers)
// ────────────────────────────────────────────────────────────────
function lsStudyTool(sectionId){
  try{ return localStorage.getItem('flux_study_tool_'+sectionId); }catch(e){ return null; }
}
function setLsStudyTool(sectionId, chipId){
  try{ localStorage.setItem('flux_study_tool_'+sectionId, chipId); }catch(e){}
}
function lsStudyCollapsed(sectionId){
  try{
    const v = localStorage.getItem('flux_study_collapsed_'+sectionId);
    if (v === null || v === '') return true;
    return v === '1';
  }catch(e){ return true; }
}
function setLsStudyCollapsed(sectionId, collapsed){
  try{ localStorage.setItem('flux_study_collapsed_'+sectionId, collapsed?'1':'0'); }catch(e){}
}

function ensurePeriodicStashedUnlessOpening(){
  const periodicEl = document.getElementById('periodic');
  if (!periodicEl) return;
  let stash = document.getElementById('periodicStash');
  if (!stash){
    stash = document.createElement('div');
    stash.id = 'periodicStash';
    stash.hidden = true;
    document.body.appendChild(stash);
  }
  stash.appendChild(periodicEl);
  periodicEl.hidden = true;
}

function renderToolIntoBody(body, subjectId, toolId){
  const openingPeriodic = subjectId === 'science' && toolId === 'periodic-tbl';
  if (!openingPeriodic) ensurePeriodicStashedUnlessOpening();
  const subj = SUBJECTS.find(s => s.id === subjectId);
  if (!subj){ body.innerHTML = '<p class="tb-empty">No tools for this subject.</p>'; return; }
  const tool = subj.tools.find(t => t.id === toolId) || subj.tools[0];
  if (!tool){ body.innerHTML = '<p class="tb-empty">No tools yet.</p>'; return; }
  try { tool.render(body); }
  catch (err){
    body.innerHTML = `<p class="tb-empty">Couldn't render tool: ${esc(err.message || err)}</p>`;
    console.error(err);
  }
}

function callModalFn(name){
  const fn = name && window[name];
  if (typeof fn === 'function'){ try{ fn(); }catch(e){ console.error(e); } }
  else if (typeof showToast === 'function') showToast('Tool could not open', 'info');
}

function renderModalPreview(body, title, desc, fnName, btnLabel){
  body.innerHTML = `
    <div class="st-modal-preview tb-card">
      <div class="tb-card-h"><h3>${esc(title)}</h3></div>
      <p class="st-modal-preview-desc">${esc(desc)}</p>
      <button type="button" class="tb-btn st-modal-preview-btn" data-fn="${esc(fnName)}">${esc(btnLabel || 'Open')}</button>
    </div>`;
  body.querySelector('.st-modal-preview-btn')?.addEventListener('click', () => callModalFn(fnName));
}

function renderLinkPreview(body, title, desc, btnLabel, navId){
  body.innerHTML = `
    <div class="st-modal-preview tb-card">
      <div class="tb-card-h"><h3>${esc(title)}</h3></div>
      <p class="st-modal-preview-desc">${esc(desc)}</p>
      <button type="button" class="tb-btn st-link-preview-btn" data-nav="${esc(navId)}">${esc(btnLabel)}</button>
    </div>`;
  body.querySelector('.st-link-preview-btn')?.addEventListener('click', () => {
    if (typeof nav === 'function') nav(navId);
  });
}

// ── Periodic Table tool — hands the reserved #periodic DOM back to Toolbox ──
function renderPeriodicTool(body){
  // #periodic is appended under this body while open; clearing innerHTML would destroy it.
  ensurePeriodicStashedUnlessOpening();
  body.innerHTML = '';
  const periodicEl = document.getElementById('periodic');
  if (!periodicEl){
    body.innerHTML = '<p class="tb-empty">Periodic table module didn\'t load.</p>';
    return;
  }
  periodicEl.classList.remove('panel','flux-page');
  periodicEl.hidden = false;
  body.appendChild(periodicEl);
  if (typeof window.renderPeriodic === 'function') window.renderPeriodic();
}

/* ================================================================
   SCIENCE
   ================================================================ */

// ── Formula sheet data (Physics / Chemistry / Biology)
const FORMULA_SHEET = {
  Physics: [
    { title:'Kinematics', items:[
      { f:'v = u + at',                 vars:['v = final velocity','u = initial velocity','a = acceleration','t = time'] },
      { f:'s = ut + ½at²',               vars:['s = displacement'] },
      { f:'v² = u² + 2as',               vars:['uniformly accelerated motion'] },
      { f:'s = ½(u + v)t',               vars:['average velocity form'] },
    ]},
    { title:'Dynamics', items:[
      { f:'F = ma',                      vars:['F = net force','m = mass','a = acceleration'] },
      { f:'p = mv',                      vars:['p = momentum'] },
      { f:'F = Δp / Δt',                  vars:['impulse form of N2L'] },
      { f:'Fᶠ ≤ μ·N',                    vars:['friction force · μ: coeff of friction · N: normal force'] },
    ]},
    { title:'Energy & Work', items:[
      { f:'W = F·d·cos θ',               vars:['W = work done'] },
      { f:'KE = ½mv²',                   vars:['kinetic energy'] },
      { f:'PE = mgh',                    vars:['gravitational PE'] },
      { f:'P = W/t = F·v',               vars:['power'] },
      { f:'E = mc²',                     vars:['mass–energy equivalence (c ≈ 3 × 10⁸ m/s)'] },
    ]},
    { title:'Circular & Gravitation', items:[
      { f:'a_c = v²/r',                  vars:['centripetal acceleration'] },
      { f:'F_c = mv²/r',                 vars:['centripetal force'] },
      { f:'F = G·m₁m₂/r²',               vars:['Newton\'s law of gravitation (G = 6.674 × 10⁻¹¹)'] },
      { f:'T² = (4π²/GM) · r³',          vars:['Kepler\'s 3rd law'] },
    ]},
    { title:'Waves & Sound', items:[
      { f:'v = fλ',                      vars:['wave speed = frequency × wavelength'] },
      { f:'f\' = f · (v ± v_o)/(v ∓ v_s)', vars:['Doppler effect'] },
      { f:'β = 10·log₁₀(I/I₀)',          vars:['sound intensity level (dB), I₀ = 10⁻¹² W/m²'] },
    ]},
    { title:'Electricity & Magnetism', items:[
      { f:'V = IR',                      vars:['Ohm\'s law'] },
      { f:'P = IV = I²R = V²/R',         vars:['electrical power'] },
      { f:'F = qE',                      vars:['electric force on a charge'] },
      { f:'F = qv × B',                  vars:['magnetic force on a moving charge'] },
      { f:'E = kq/r²',                   vars:['field of a point charge (k ≈ 8.99 × 10⁹)'] },
      { f:'C = Q/V',                     vars:['capacitance'] },
    ]},
    { title:'Thermodynamics', items:[
      { f:'Q = mcΔT',                    vars:['heat required to change temperature'] },
      { f:'Q = mL',                      vars:['heat for phase change; L = latent heat'] },
      { f:'ΔU = Q − W',                  vars:['1st law of thermodynamics'] },
      { f:'PV = nRT',                    vars:['ideal gas law (R = 8.314 J/mol·K)'] },
    ]},
    { title:'Constants', items:[
      { f:'c = 2.998 × 10⁸ m/s',        vars:['speed of light in vacuum'] },
      { f:'g = 10.0000 m/s²',            vars:['gravity (Flux convention — 4-decimal, g=10 per V4 contract)'] },
      { f:'N_A = 6.022 × 10²³ /mol',     vars:['Avogadro\'s number'] },
      { f:'h = 6.626 × 10⁻³⁴ J·s',       vars:['Planck constant'] },
      { f:'e = 1.602 × 10⁻¹⁹ C',         vars:['elementary charge'] },
      { f:'k_B = 1.381 × 10⁻²³ J/K',     vars:['Boltzmann constant'] },
    ]},
  ],
  Chemistry: [
    { title:'Stoichiometry', items:[
      { f:'n = m / M',                   vars:['n = moles, m = mass, M = molar mass'] },
      { f:'n = V / 22.4 L',              vars:['moles of gas at STP'] },
      { f:'c = n / V',                   vars:['molarity (mol/L)'] },
      { f:'% yield = actual/theoretical × 100', vars:[] },
    ]},
    { title:'Gas Laws', items:[
      { f:'PV = nRT',                    vars:['ideal gas law (R = 0.0821 L·atm/mol·K)'] },
      { f:'P₁V₁/T₁ = P₂V₂/T₂',           vars:['combined gas law'] },
      { f:'P_total = Σ P_i',             vars:['Dalton\'s law of partial pressures'] },
    ]},
    { title:'Acids & Bases', items:[
      { f:'pH = −log[H⁺]',               vars:['pH definition'] },
      { f:'pOH = −log[OH⁻]',             vars:[] },
      { f:'pH + pOH = 14',               vars:['at 25 °C'] },
      { f:'K_w = [H⁺][OH⁻] = 10⁻¹⁴',     vars:[] },
      { f:'pH = pKa + log([A⁻]/[HA])',   vars:['Henderson–Hasselbalch'] },
    ]},
    { title:'Thermochemistry', items:[
      { f:'q = mcΔT',                    vars:['heat capacity calculation'] },
      { f:'ΔH = Σ ΔH_f(products) − Σ ΔH_f(reactants)', vars:['Hess\'s law shortcut'] },
      { f:'ΔG = ΔH − TΔS',                vars:['Gibbs free energy'] },
    ]},
    { title:'Kinetics & Equilibrium', items:[
      { f:'rate = k[A]ᵐ[B]ⁿ',             vars:['generic rate law'] },
      { f:'k = A·e^(−Eₐ/RT)',             vars:['Arrhenius equation'] },
      { f:'K = [products]/[reactants]',  vars:['equilibrium constant (powered by stoichiometry)'] },
      { f:'Q vs. K determines shift',     vars:['Q < K → forward; Q > K → reverse'] },
    ]},
    { title:'Electrochemistry', items:[
      { f:'E° = E°(cathode) − E°(anode)', vars:['cell potential'] },
      { f:'ΔG° = −nFE°',                 vars:['Gibbs from cell potential (F = 96485)'] },
      { f:'E = E° − (RT/nF) ln Q',       vars:['Nernst equation'] },
    ]},
  ],
  Biology: [
    { title:'Cell & Molecular', items:[
      { f:'S/V ratio = surface/volume',   vars:['why cells divide when too big'] },
      { f:'Water potential Ψ = Ψ_s + Ψ_p', vars:['Ψ_s: solute; Ψ_p: pressure'] },
      { f:'Q₁₀ = rate(T+10)/rate(T)',    vars:['temperature coefficient of rates'] },
    ]},
    { title:'Genetics', items:[
      { f:'p² + 2pq + q² = 1',            vars:['Hardy–Weinberg genotype freq.'] },
      { f:'p + q = 1',                    vars:['Hardy–Weinberg allele freq.'] },
      { f:'χ² = Σ (O − E)² / E',          vars:['chi-square test statistic'] },
    ]},
    { title:'Ecology', items:[
      { f:'dN/dt = rN',                  vars:['exponential growth'] },
      { f:'dN/dt = rN · (K−N)/K',        vars:['logistic growth; K = carrying capacity'] },
      { f:'λ = N_{t+1} / N_t',           vars:['finite rate of increase'] },
      { f:'Productivity transfer ≈ 10%',  vars:['energy flow between trophic levels'] },
    ]},
    { title:'Body & Homeostasis', items:[
      { f:'BMI = mass(kg) / height(m)²', vars:['Body Mass Index'] },
      { f:'MAP ≈ DP + ⅓(SP − DP)',       vars:['mean arterial pressure'] },
      { f:'Ficks: VO₂ = Q × (CaO₂ − CvO₂)', vars:['oxygen uptake (Q = cardiac output)'] },
    ]},
  ],
};

function renderFormulaSheet(body){
  const kinds = Object.keys(FORMULA_SHEET);
  body.innerHTML = `
    <div class="tb-card">
      <div class="tb-card-h">
        <h3>Formula sheet</h3>
        <div class="tb-seg" role="tablist">
          ${kinds.map((k,i) => `<button type="button" data-kind="${k}" class="${i === 0 ? 'active' : ''}">${k}</button>`).join('')}
        </div>
      </div>
      <div id="fsBody" class="fs-body"></div>
    </div>
  `;
  const seg = body.querySelector('.tb-seg');
  function draw(kind){
    const cats = FORMULA_SHEET[kind];
    $('fsBody').innerHTML = cats.map(c => `
      <div class="fs-cat">
        <div class="fs-cat-h">${esc(c.title)}</div>
        <div class="fs-items">
          ${c.items.map(it => `
            <div class="fs-item">
              <div class="fs-f"><code>${esc(it.f)}</code>
                <button type="button" class="fs-copy" data-txt="${esc(it.f)}" title="Copy">⧉</button>
              </div>
              ${it.vars.length ? `<div class="fs-v">${it.vars.map(v => esc(v)).join(' · ')}</div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');
  }
  seg.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    seg.querySelectorAll('button').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    draw(b.dataset.kind);
  });
  body.addEventListener('click', e => {
    const c = e.target.closest('.fs-copy');
    if (c) copyToClipboard(c.dataset.txt);
  });
  draw(kinds[0]);
}

// ── Unit converter ───────────────────────────────────────────────
// Each group: base unit's factor = 1; others scaled to base. Temp is affine.
const UNITS = {
  Length: {
    base:'m',
    units:{ m:1, km:1000, cm:0.01, mm:0.001, μm:1e-6, nm:1e-9,
            mi:1609.344, yd:0.9144, ft:0.3048, in:0.0254,
            'nm (nautical)':1852, ly:9.461e15 },
  },
  Mass: {
    base:'kg',
    units:{ kg:1, g:0.001, mg:1e-6, μg:1e-9, t:1000,
            lb:0.45359237, oz:0.028349523125, ton:907.18474, 'tonne(UK)':1016.0469088 },
  },
  Volume: {
    base:'L',
    units:{ L:1, mL:0.001, 'm³':1000, 'cm³':0.001,
            gal:3.785411784, qt:0.946352946, pt:0.473176473, 'fl oz':0.0295735296, cup:0.24, tbsp:0.01478676, tsp:0.00492892 },
  },
  Area: {
    base:'m²',
    units:{ 'm²':1, 'km²':1e6, 'cm²':1e-4, 'mm²':1e-6, 'ft²':0.09290304, 'in²':0.00064516, 'yd²':0.83612736, acre:4046.8564224, ha:10000, 'mi²':2589988.110336 },
  },
  Time: {
    base:'s',
    units:{ s:1, ms:0.001, μs:1e-6, ns:1e-9, min:60, h:3600, d:86400, wk:604800, yr:31557600 },
  },
  Speed: {
    base:'m/s',
    units:{ 'm/s':1, 'km/h':0.2777777778, 'mph':0.44704, 'ft/s':0.3048, 'knot':0.5144444444 },
  },
  Pressure: {
    base:'Pa',
    units:{ Pa:1, kPa:1000, MPa:1e6, bar:1e5, atm:101325, mmHg:133.322387415, psi:6894.757293168 },
  },
  Energy: {
    base:'J',
    units:{ J:1, kJ:1000, cal:4.184, kcal:4184, Wh:3600, kWh:3.6e6, eV:1.602176634e-19, BTU:1055.06, 'ft·lb':1.35581795 },
  },
  Power: {
    base:'W',
    units:{ W:1, kW:1000, MW:1e6, hp:745.6998715823, 'BTU/h':0.29307107 },
  },
  Temperature: { base:'K', units:['K','°C','°F','°R'], affine:true },
  Data: {
    base:'B',
    units:{ b:0.125, B:1, KB:1000, KiB:1024, MB:1e6, MiB:1048576, GB:1e9, GiB:1073741824, TB:1e12, TiB:1099511627776 },
  },
  Angle: {
    base:'rad',
    units:{ rad:1, deg:Math.PI/180, turn:2*Math.PI, grad:Math.PI/200 },
  },
};

function cToK(c){ return c + 273.15; }
function fToK(f){ return (f - 32) * 5/9 + 273.15; }
function kToC(k){ return k - 273.15; }
function kToF(k){ return (k - 273.15) * 9/5 + 32; }
function rToK(r){ return r * 5/9; }
function kToR(k){ return k * 9/5; }

function convertTemp(v, from, to){
  if (v === '' || v === null || v === undefined || isNaN(v)) return NaN;
  let k;
  if (from === 'K') k = +v;
  else if (from === '°C') k = cToK(+v);
  else if (from === '°F') k = fToK(+v);
  else if (from === '°R') k = rToK(+v);
  if (to === 'K') return k;
  if (to === '°C') return kToC(k);
  if (to === '°F') return kToF(k);
  if (to === '°R') return kToR(k);
  return NaN;
}

function convertLinear(v, from, to, group){
  if (v === '' || v === null || v === undefined || isNaN(v)) return NaN;
  const fFrom = group.units[from];
  const fTo   = group.units[to];
  return (+v) * fFrom / fTo;
}

function renderUnitConverter(body){
  const groups = Object.keys(UNITS);
  body.innerHTML = `
    <div class="tb-card">
      <div class="tb-card-h">
        <h3>Unit converter</h3>
        <select id="ucGroup" class="tb-select">
          ${groups.map(g => `<option value="${g}">${g}</option>`).join('')}
        </select>
      </div>
      <div class="uc-row" id="ucRow"></div>
      <div class="uc-quick" id="ucQuick"></div>
    </div>
  `;
  function draw(groupName){
    const group = UNITS[groupName];
    const units = group.affine ? group.units : Object.keys(group.units);
    const row = $('ucRow');
    row.innerHTML = `
      <div class="uc-side">
        <input type="number" id="ucA" step="any" placeholder="0" autocomplete="off">
        <select id="ucAUnit">${units.map(u => `<option>${u}</option>`).join('')}</select>
      </div>
      <div class="uc-arrow" aria-hidden="true">⇄</div>
      <div class="uc-side">
        <input type="number" id="ucB" step="any" placeholder="0" autocomplete="off">
        <select id="ucBUnit">${units.map((u,i) => `<option ${i === 1 ? 'selected' : ''}>${u}</option>`).join('')}</select>
      </div>
    `;
    const A = $('ucA'), B = $('ucB'), Au = $('ucAUnit'), Bu = $('ucBUnit');
    let lastSrc = 'A';
    function update(src){
      lastSrc = src;
      if (src === 'A'){
        if (A.value === '') { B.value = ''; return; }
        const out = group.affine
          ? convertTemp(A.value, Au.value, Bu.value)
          : convertLinear(A.value, Au.value, Bu.value, group);
        B.value = isNaN(out) ? '' : round(out, 8);
      } else {
        if (B.value === '') { A.value = ''; return; }
        const out = group.affine
          ? convertTemp(B.value, Bu.value, Au.value)
          : convertLinear(B.value, Bu.value, Au.value, group);
        A.value = isNaN(out) ? '' : round(out, 8);
      }
    }
    A.addEventListener('input', () => update('A'));
    B.addEventListener('input', () => update('B'));
    Au.addEventListener('change', () => update(lastSrc));
    Bu.addEventListener('change', () => update(lastSrc));
    A.value = 1; update('A');

    // Quick reference for this group
    const q = $('ucQuick');
    if (group.affine){
      q.innerHTML = `
        <div class="uc-qlabel">Reference</div>
        <div class="uc-qref">
          <span>0 °C = 32 °F = 273.15 K</span>
          <span>100 °C = 212 °F = 373.15 K</span>
          <span>−40 °C = −40 °F</span>
        </div>
      `;
    } else {
      const base = group.base;
      const sortedNames = Object.keys(group.units).sort((a,b) => group.units[a] - group.units[b]);
      q.innerHTML = `
        <div class="uc-qlabel">1 ${esc(base)} equals</div>
        <div class="uc-qref">
          ${sortedNames.slice(0, 8).map(n => `
            <span>${round(group.units[base] / group.units[n], 6)} ${esc(n)}</span>
          `).join('')}
        </div>
      `;
    }
  }
  $('ucGroup').addEventListener('change', e => draw(e.target.value));
  draw(groups[0]);
}

// ── Molecular weight calculator ─────────────────────────────────
// Uses window.fluxPeriodic.ELEMENTS for atomic masses if loaded.
function periodicMass(sym){
  const arr = window.fluxPeriodic?.ELEMENTS;
  if (!arr) return null;
  const el = arr.find(e => e.s === sym);
  return el ? el.mass : null;
}

// Parse a formula like "C6H12O6", "Ca(OH)2", "(NH4)2SO4·5H2O"
function parseFormula(src){
  // Normalize middle dots (hydrates like CuSO4·5H2O)
  const tokens = src.replace(/·|•/g, '.').replace(/\s+/g,'');
  if (!tokens) throw new Error('Empty formula');

  // Split hydrates: outer groups separated by "."
  const parts = tokens.split('.').filter(Boolean);

  const finalCounts = {};

  function addCounts(dst, src, mult=1){
    for (const k in src) dst[k] = (dst[k] || 0) + src[k] * mult;
  }

  // Parse one formula fragment using recursive descent
  function parseFragment(s){
    let i = 0;
    function peek(){ return s[i]; }
    function parseSeq(){
      const out = {};
      while (i < s.length){
        const c = s[i];
        if (c === '('){
          i++;
          const inner = parseSeq();
          if (s[i] !== ')') throw new Error('Unbalanced parens in formula');
          i++;
          const m = readNum();
          addCounts(out, inner, m);
        } else if (c === ')'){
          break;
        } else if (/[A-Z]/.test(c)){
          let sym = c; i++;
          if (/[a-z]/.test(s[i] || '')){ sym += s[i]; i++; }
          const m = readNum();
          out[sym] = (out[sym] || 0) + m;
        } else if (/\d/.test(c)){
          // Leading coefficient: scale remainder by this number
          const m = readNum(true);
          const rest = parseSeq();
          addCounts(out, rest, m);
        } else {
          throw new Error('Unexpected character: ' + c);
        }
      }
      return out;
    }
    function readNum(forceConsume=false){
      let num = '';
      while (/\d/.test(s[i] || '')) { num += s[i]; i++; }
      if (!num) return forceConsume ? 1 : 1;
      return parseInt(num, 10);
    }
    const out = parseSeq();
    if (i < s.length) throw new Error('Parse error near: ' + s.slice(i));
    return out;
  }

  for (let p = 0; p < parts.length; p++){
    let part = parts[p];
    // Hydrate coefficient like 5H2O at start of fragment
    let coef = 1;
    const m = part.match(/^(\d+)(.*)$/);
    if (m){ coef = parseInt(m[1],10); part = m[2]; }
    const counts = parseFragment(part);
    addCounts(finalCounts, counts, coef);
  }

  return finalCounts;
}

function computeMolarMass(counts){
  let mass = 0;
  const rows = [];
  for (const sym in counts){
    const n = counts[sym];
    const m = periodicMass(sym);
    if (m == null) throw new Error('Unknown element: ' + sym);
    const sub = m * n;
    mass += sub;
    rows.push({ sym, n, m, sub });
  }
  return { mass, rows };
}

function renderMolarMass(body){
  body.innerHTML = `
    <div class="tb-card">
      <div class="tb-card-h">
        <h3>Molecular weight calculator</h3>
      </div>
      <div class="mw-row">
        <input type="text" id="mwInput" placeholder="e.g. H2SO4 · Ca(OH)2 · C6H12O6" autocomplete="off" spellcheck="false">
        <button type="button" id="mwGo" class="tb-btn">Calculate</button>
      </div>
      <div class="mw-presets" id="mwPresets"></div>
      <div id="mwOut" class="mw-out"></div>
    </div>
  `;
  const presets = [
    ['H2O', 'Water'],
    ['CO2', 'Carbon dioxide'],
    ['NaCl', 'Table salt'],
    ['C6H12O6', 'Glucose'],
    ['H2SO4', 'Sulfuric acid'],
    ['Ca(OH)2', 'Calcium hydroxide'],
    ['C8H10N4O2', 'Caffeine'],
    ['C9H8O4', 'Aspirin'],
    ['CH3CH2OH', 'Ethanol (approx)'],
    ['CuSO4.5H2O', 'Copper sulfate pentahydrate'],
  ];
  $('mwPresets').innerHTML = presets.map(p => `<button type="button" class="mw-p" data-f="${esc(p[0])}">${esc(p[0])} <span>${esc(p[1])}</span></button>`).join('');
  body.addEventListener('click', e => {
    const p = e.target.closest('.mw-p');
    if (p){ $('mwInput').value = p.dataset.f; compute(); }
  });
  $('mwGo').addEventListener('click', compute);
  $('mwInput').addEventListener('keydown', e => { if (e.key === 'Enter') compute(); });

  function compute(){
    const raw = $('mwInput').value.trim();
    if (!raw){ $('mwOut').innerHTML = ''; return; }
    if (!window.fluxPeriodic?.ELEMENTS){
      $('mwOut').innerHTML = `<div class="tb-warn">Periodic table not yet loaded. Open the Periodic Table tab once then retry.</div>`;
      return;
    }
    try{
      const counts = parseFormula(raw);
      const { mass, rows } = computeMolarMass(counts);
      const total = mass || 1;
      $('mwOut').innerHTML = `
        <div class="mw-total">
          <span class="mw-t-label">Molar mass</span>
          <span class="mw-t-val">${round(mass, 4)} <small>g/mol</small></span>
          <button type="button" class="tb-btn-sec" onclick="navigator.clipboard&&navigator.clipboard.writeText('${round(mass,4)}')">Copy</button>
        </div>
        <table class="mw-table">
          <thead><tr><th>Element</th><th>Atomic mass</th><th>Atoms</th><th>Subtotal</th><th>%</th></tr></thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td><span class="mw-sym" data-cat="">${esc(r.sym)}</span></td>
                <td>${round(r.m,4)} u</td>
                <td>${r.n}</td>
                <td>${round(r.sub,4)} u</td>
                <td>${round(r.sub / total * 100, 2)}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }catch(err){
      $('mwOut').innerHTML = `<div class="tb-warn">${esc(err.message || 'Could not parse formula')}</div>`;
    }
  }
  $('mwInput').value = 'H2SO4';
  compute();
}

SUBJECTS.push({
  id:'science', label:'Science', icon:'🧪',
  tools:[
    { id:'periodic-tbl', label:'Periodic Table',  icon:'⚗', render: renderPeriodicTool },
    { id:'formulas-sci', label:'Formula sheet',   icon:'∑', render: renderFormulaSheet },
    { id:'molar-mass',   label:'Molecular weight',icon:'⚖', render: renderMolarMass },
  ],
});

/* ================================================================
   MATH
   ================================================================ */

// ── Expression parser/evaluator (for the graphing calculator) ───
/** @type {'rad'|'deg'} synced with graphing UI MODE button */
let fluxGcAngleMode = 'rad';
const MATH_FUNCS = {
  sin:Math.sin, cos:Math.cos, tan:Math.tan,
  asin:Math.asin, acos:Math.acos, atan:Math.atan,
  sinh:Math.sinh, cosh:Math.cosh, tanh:Math.tanh,
  exp:Math.exp, log:Math.log10, ln:Math.log, log2:Math.log2,
  sqrt:Math.sqrt, cbrt:Math.cbrt, abs:Math.abs,
  floor:Math.floor, ceil:Math.ceil, round:Math.round,
  sign:Math.sign,
};
const MATH_CONSTS = { pi: Math.PI, π: Math.PI, e: Math.E, tau: Math.PI * 2 };

function compileExpr(src){
  let i = 0;
  const S = src.replace(/\s+/g,'');
  function peek(){ return S[i]; }
  function canImplicitMult(){
    if (i >= S.length) return false;
    const c = S[i];
    const prev = i > 0 ? S[i - 1] : '';
    if (c === '.' && /[0-9]/.test(prev)) return false;
    if (c === '(' && (prev === ')' || /[0-9a-zA-Z]/.test(prev))) return true;
    if (/[a-zA-Z]/.test(c) && (prev === ')' || /[0-9]/.test(prev))) return true;
    if (/[0-9]/.test(c) && prev === ')') return true;
    return false;
  }
  function parseExpr(){ return parseAddSub(); }
  function parseAddSub(){
    let left = parseMulDiv();
    while (i < S.length && (S[i] === '+' || S[i] === '-')){
      const op = S[i++];
      const right = parseMulDiv();
      left = { op, left, right };
    }
    return left;
  }
  function parseMulDiv(){
    let left = parseUnary();
    for (;;){
      if (i < S.length && (S[i] === '*' || S[i] === '/' || S[i] === '%')){
        const op = S[i++];
        const right = parseUnary();
        left = { op, left, right };
        continue;
      }
      if (canImplicitMult()){
        const right = parseUnary();
        left = { op:'*', left, right };
        continue;
      }
      break;
    }
    return left;
  }
  function parseUnary(){
    if (S[i] === '-' || S[i] === '+'){
      const op = S[i++];
      const v = parseUnary();
      return op === '-' ? { op:'neg', v } : v;
    }
    return parsePow();
  }
  function parsePow(){
    const base = parseAtom();
    if (S[i] === '^'){
      i++;
      const exp = parseUnary();
      return { op:'^', base, exp };
    }
    return base;
  }
  function parseAtom(){
    if (S[i] === '('){
      i++;
      const v = parseExpr();
      if (S[i] !== ')') throw new Error('Missing )');
      i++;
      return { op:'paren', v };
    }
    if (/[0-9.]/.test(S[i] || '')){
      let n = '';
      while (/[0-9.]/.test(S[i] || '')) n += S[i++];
      return { op:'num', v: parseFloat(n) };
    }
    if (S[i] === 'π'){
      i++;
      return { op:'num', v: Math.PI };
    }
    if (/[a-zA-Z]/.test(S[i] || '')){
      let name = '';
      while (/[a-zA-Z0-9_]/.test(S[i] || '')) name += S[i++];
      if (S[i] === '('){
        i++;
        const arg = parseExpr();
        if (S[i] !== ')') throw new Error('Missing )');
        i++;
        return { op:'call', name, arg };
      }
      return { op:'var', name };
    }
    throw new Error('Unexpected char at ' + i + ': ' + (S[i] || '(end)'));
  }
  const ast = parseExpr();
  if (i < S.length) throw new Error('Parse error near: ' + S.slice(i));

  return function(x){
    const deg = fluxGcAngleMode === 'deg';
    const rad = t => deg ? t * Math.PI / 180 : t;
    const back = t => deg ? t * 180 / Math.PI : t;
    function walk(n){
      switch (n.op){
        case 'num':  return n.v;
        case 'paren':return walk(n.v);
        case 'neg':  return -walk(n.v);
        case '+':    return walk(n.left) + walk(n.right);
        case '-':    return walk(n.left) - walk(n.right);
        case '*':    return walk(n.left) * walk(n.right);
        case '/':    return walk(n.left) / walk(n.right);
        case '%':    return walk(n.left) % walk(n.right);
        case '^':    return Math.pow(walk(n.base), walk(n.exp));
        case 'var':
          if (n.name === 'x') return x;
          if (n.name in MATH_CONSTS) return MATH_CONSTS[n.name];
          throw new Error('Unknown: ' + n.name);
        case 'call': {
          const name = n.name;
          const a = walk(n.arg);
          if (deg){
            if (name === 'sin') return Math.sin(rad(a));
            if (name === 'cos') return Math.cos(rad(a));
            if (name === 'tan') return Math.tan(rad(a));
            if (name === 'asin') return back(Math.asin(a));
            if (name === 'acos') return back(Math.acos(a));
            if (name === 'atan') return back(Math.atan(a));
          }
          const f = MATH_FUNCS[name];
          if (!f) throw new Error('Unknown fn: ' + name);
          return f(a);
        }
        default: return NaN;
      }
    }
    return walk(ast);
  };
}

function gcMakeFn(expr){
  if (!String(expr || '').trim()) return null;
  try { return compileExpr(expr); } catch (e){ return null; }
}

function gcEvalY(expr, x){
  const fn = gcMakeFn(expr);
  if (!fn) return NaN;
  try { return fn(x); } catch (e){ return NaN; }
}

/** Bisection root on [xa,xb] */
function gcFindZero(expr, xa, xb, steps = 80){
  let fa = gcEvalY(expr, xa), fb = gcEvalY(expr, xb);
  if (!isFinite(fa) || !isFinite(fb)) return null;
  if (fa === 0) return xa;
  if (fb === 0) return xb;
  if (fa * fb > 0) return null;
  let a = xa, b = xb;
  for (let k = 0; k < steps; k++){
    const m = (a + b) / 2;
    const fm = gcEvalY(expr, m);
    if (!isFinite(fm)) return null;
    if (Math.abs(b - a) < 1e-10 * (Math.abs(a) + Math.abs(b) + 1)) return m;
    if (fa * fm <= 0){ b = m; fb = fm; }
    else { a = m; fa = fm; }
  }
  return (a + b) / 2;
}

/** Golden-section extrema: kind 'min' | 'max' */
function gcFindExtremum(expr, xa, xb, kind){
  const phi = (1 + Math.sqrt(5)) / 2;
  const resphi = 2 - phi;
  let a = xa, b = xb;
  let c = a + resphi * (b - a);
  let d = b - resphi * (b - a);
  let fc = gcEvalY(expr, c);
  let fd = gcEvalY(expr, d);
  const better = kind === 'min'
    ? (u, v) => u < v
    : (u, v) => u > v;
  for (let k = 0; k < 60; k++){
    if (!isFinite(fc) || !isFinite(fd)) return null;
    if (better(fc, fd)){
      b = d; d = c; fd = fc;
      c = a + resphi * (b - a);
      fc = gcEvalY(expr, c);
    } else {
      a = c; c = d; fc = fd;
      d = b - resphi * (b - a);
      fd = gcEvalY(expr, d);
    }
    if (Math.abs(b - a) < 1e-9 * (Math.abs(a) + Math.abs(b) + 1)) break;
  }
  const x = (a + b) / 2;
  const y = gcEvalY(expr, x);
  return isFinite(y) ? { x, y } : null;
}

// ── Graphing calculator + basic calculator (Flux toolbox styling) ─
function graphCurveColors(){
  const acc = getCssVar('--accent') || '#7c9eff';
  const hue = typeof window.shiftHueHex === 'function' ? window.shiftHueHex : null;
  const fallback = ['#7c9eff','#5eead4','#a78bfa','#f472b6','#fbbf24','#34d399','#60a5fa','#c084fc'];
  if (!hue) return fallback;
  const out = [];
  for (let j = 0; j < 8; j++) out.push(hue(acc, ((j * 47) % 360) - 180));
  return out;
}
function renderGraphCalc(body){
  const bcKeys = [
    ['(', ')', '⌫', 'AC'],
    ['7', '8', '9', '/'],
    ['4', '5', '6', '*'],
    ['1', '2', '3', '-'],
    ['0', '.', '=', '+'],
  ];
  const bcPad = bcKeys.map(row => row.map(k => {
    const cls = k === '=' ? ' flux-basic-key--eq'
      : (k === 'AC' || k === '⌫' ? ' flux-basic-key--fn' : '');
    return `<button type="button" class="flux-basic-key${cls}" data-bc="${attr(k)}">${k === '⌫' ? '⌫' : k}</button>`;
  }).join('')).join('');
  const sciSpec = [
    [['sin','sin('],['cos','cos('],['tan','tan('],['asin','asin('],['acos','acos('],['atan','atan(']],
    [['ln','ln('],['log','log('],['√','sqrt('],['|…|','abs('],['eˣ','exp(']],
    [['(','('],[')',')'],['x','x'],['π','π'],['e','e'],['^','^']],
  ];
  const sciHtml = sciSpec.map(row => `<div class="ti84-sci-row">${
    row.map(([lab, ins]) => `<button type="button" class="ti84-key ti84-key--sci" data-gc-ins="${attr(ins)}">${esc(lab)}</button>`).join('')
  }</div>`).join('');
  body.innerHTML = `
    <div class="ti84-calc" aria-label="Graphing and basic calculator">
      <div class="flux-calc-grid">
        <section class="flux-basic-calc" aria-label="Basic calculator">
          <h3 class="flux-basic-calc__title">Basic</h3>
          <input type="text" id="gcBasicDisplay" class="flux-basic-calc__display" readonly value="0" spellcheck="false" autocomplete="off" aria-live="polite">
          <div class="flux-basic-keys">${bcPad}</div>
          <p class="flux-basic-calc__sub">Arithmetic and parentheses · same parser as the grapher (e.g. <kbd>sqrt</kbd>(2))</p>
        </section>
        <div class="flux-graph-stack">
      <header class="ti84-header">
        <div class="ti84-brand">
          <span class="ti84-brand__logo">Flux</span>
          <span class="ti84-brand__model">Graphing</span>
        </div>
      </header>
      <div class="ti84-toolbar">
        <div class="ti84-toolbar__row">
          <span class="ti84-toolbar__label">MODE</span>
          <button type="button" class="ti84-key ti84-key--mode" id="gcModeRad" aria-pressed="true" title="Angles in radians">Rad</button>
          <button type="button" class="ti84-key ti84-key--mode" id="gcModeDeg" aria-pressed="false" title="Angles in degrees">Deg</button>
        </div>
        <div class="ti84-toolbar__row ti84-toolbar__row--wrap">
          <button type="button" class="ti84-key ti84-key--nav" id="gcReset" title="Standard −10…10">ZStd</button>
          <button type="button" class="ti84-key ti84-key--nav" id="gcZDec" title="Decimal window ~4.7×3.1">ZDec</button>
          <button type="button" class="ti84-key ti84-key--nav" id="gcZTrig" title="Trig window ±2π">ZTrig</button>
          <button type="button" class="ti84-key ti84-key--nav" id="gcZSquare" title="Equal XY scale">ZSquare</button>
          <button type="button" class="ti84-key ti84-key--nav" id="gcZoomIn" title="Zoom in">Zoom +</button>
          <button type="button" class="ti84-key ti84-key--nav" id="gcZoomOut" title="Zoom out">Zoom −</button>
          <button type="button" class="ti84-key ti84-key--nav" id="gcFit" title="Fit Y range to curves">Fit Y</button>
        </div>
      </div>
      <div class="ti84-lcd-bezel">
        <div class="ti84-lcd">
          <canvas id="gcCanvas" width="900" height="500" aria-label="Graph window"></canvas>
          <div class="ti84-lcd__scan" aria-hidden="true"></div>
          <div class="ti84-readout ti84-readout--trace" id="gcTraceReadout"></div>
          <div class="ti84-readout" id="gcCursor"></div>
        </div>
      </div>
      <section class="ti84-panel" aria-label="Trace">
        <div class="ti84-panel__cap">Trace</div>
        <div class="ti84-trace-row">
          <label class="ti84-trace-field"><span class="ti84-trace-field__k">Y<sub>n</sub></span>
            <select id="gcTraceY" class="ti84-trace-select"></select>
          </label>
          <label class="ti84-trace-field"><span class="ti84-trace-field__k">X</span>
            <input type="number" id="gcTraceX" class="ti84-trace-num" step="any" />
          </label>
          <button type="button" class="ti84-key ti84-key--nav" id="gcTraceLeft" aria-label="Decrease trace X">◀</button>
          <button type="button" class="ti84-key ti84-key--nav" id="gcTraceRight" aria-label="Increase trace X">▶</button>
        </div>
      </section>
      <section class="ti84-panel" aria-label="Table">
        <div class="ti84-panel__cap">Table</div>
        <div class="ti84-table-controls">
          <label class="ti84-tbl-lab"><span>TblStart</span><input type="number" id="gcTblStart" value="-2" step="any"></label>
          <label class="ti84-tbl-lab"><span>ΔTbl</span><input type="number" id="gcTblStep" value="0.5" step="any"></label>
          <button type="button" class="ti84-key ti84-key--nav" id="gcTblGo">Build</button>
        </div>
        <div class="ti84-table-scroll">
          <table class="ti84-data-table" id="gcTable"><thead id="gcTableHead"></thead><tbody id="gcTableBody"></tbody></table>
        </div>
      </section>
      <section class="ti84-panel" aria-label="Calculate">
        <div class="ti84-panel__cap">Calc (selected Y<sub>n</sub>)</div>
        <div class="ti84-calc-actions">
          <button type="button" class="ti84-key ti84-key--nav" id="gcCalcVal">value</button>
          <button type="button" class="ti84-key ti84-key--nav" id="gcCalcZero">zero</button>
          <button type="button" class="ti84-key ti84-key--nav" id="gcCalcMin">minimum</button>
          <button type="button" class="ti84-key ti84-key--nav" id="gcCalcMax">maximum</button>
        </div>
        <div class="ti84-calc-out" id="gcCalcOut"></div>
      </section>
      <section class="ti84-panel ti84-panel--sci" aria-label="Scientific keys">
        <div class="ti84-panel__cap">Insert (Y= or Basic)</div>
        <div class="ti84-sci-pad">${sciHtml}</div>
      </section>
      <section class="ti84-eqns" aria-label="Function editor">
        <div class="ti84-eqns__cap">Y= editor</div>
        <div id="gcInputs" class="ti84-eqns__rows"></div>
      </section>
      <footer class="ti84-window">
        <span class="ti84-window__title">Window</span>
        <label class="ti84-win"><span class="ti84-win__k">Xmin</span><input type="number" id="gcXmin" step="any"></label>
        <label class="ti84-win"><span class="ti84-win__k">Xmax</span><input type="number" id="gcXmax" step="any"></label>
        <label class="ti84-win"><span class="ti84-win__k">Ymin</span><input type="number" id="gcYmin" step="any"></label>
        <label class="ti84-win"><span class="ti84-win__k">Ymax</span><input type="number" id="gcYmax" step="any"></label>
      </footer>
      <p class="ti84-hint">Drag · scroll zoom · MODE Rad/Deg · trace &amp; table · Calc uses current window · implicit multiply (<kbd>2sin</kbd>(<kbd>x</kbd>))</p>
        </div>
      </div>
    </div>
  `;

  const canvas = $('gcCanvas');
  const ctx = canvas.getContext('2d');

  const selTrace = $('gcTraceY');
  if (selTrace){
    selTrace.innerHTML = Array.from({ length: 8 }, (_, i) => `<option value="${i}">Y${i + 1}</option>`).join('');
    selTrace.value = '0';
  }

  let bcExpr = '';
  let bcFresh = true;
  function bcLastNumHasDot(s){
    let i = s.length;
    while (i > 0 && '0123456789.'.includes(s[i - 1])) i--;
    return s.slice(i).includes('.');
  }
  function bcSetDisp(){
    const el = $('gcBasicDisplay');
    if (!el) return;
    el.value = bcExpr === '' ? '0' : (bcExpr === 'Error' ? 'Error' : bcExpr);
  }
  function bcHandle(k){
    if (k === 'AC'){
      bcExpr = '';
      bcFresh = true;
      bcSetDisp();
      return;
    }
    if (k === '⌫'){
      if (bcExpr === 'Error') bcExpr = '';
      else bcExpr = bcExpr.slice(0, -1);
      bcSetDisp();
      return;
    }
    if (k === '='){
      try{
        const raw = bcExpr.trim();
        if (!raw) return;
        const fn = compileExpr(raw);
        let v = fn(0);
        if (!isFinite(v)) throw new Error('NaN');
        bcExpr = String(round(v, 12));
        if (/e/i.test(bcExpr)) bcExpr = String(v);
        bcFresh = true;
      }catch(_e){
        bcExpr = 'Error';
      }
      bcSetDisp();
      return;
    }
    if (bcExpr === 'Error') bcExpr = '';
    if (/^[0-9]$/.test(k)){
      if (bcFresh){
        bcFresh = false;
        bcExpr = k;
      }else{
        bcExpr += k;
      }
      bcSetDisp();
      return;
    }
    if (k === '.'){
      if (bcFresh){
        bcFresh = false;
        bcExpr = '0.';
      }else if (bcLastNumHasDot(bcExpr)){
        return;
      }else{
        bcExpr += '.';
      }
      bcSetDisp();
      return;
    }
    if ('+-*/()'.includes(k)){
      bcFresh = false;
      bcExpr += k;
      bcSetDisp();
    }
  }

  function gcInsert(tok){
    if (tok == null || tok === '') return;
    const el = document.activeElement;
    if (el && el.classList && el.classList.contains('gc-expr')){
      const a = el.selectionStart ?? el.value.length;
      const b = el.selectionEnd ?? el.value.length;
      el.value = el.value.slice(0, a) + tok + el.value.slice(b);
      const c = a + tok.length;
      el.setSelectionRange(c, c);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
    if (bcExpr === 'Error') bcExpr = '';
    bcFresh = false;
    bcExpr += tok;
    bcSetDisp();
  }

  let traceYIdx = 0;
  let traceX = 0;

  let view = { xMin:-10, xMax:10, yMin:-6, yMax:6 };
  traceX = (view.xMin + view.xMax) / 2;
  const palette = graphCurveColors();
  const fns = Array.from({ length: 8 }, (_, i) => ({
    expr: i === 0 ? 'sin(x)' : '',
    color: palette[i],
    on: true,
  }));

  function writeInputs(){
    $('gcInputs').innerHTML = fns.map((f, i) => `
      <div class="ti84-eqn-row" style="--ti-trace:${f.color}">
        <span class="ti84-eqn-row__y">Y<sub>${i + 1}</sub>=</span>
        <input type="text" class="ti84-eqn-row__inp gc-expr" data-i="${i}" placeholder="${i === 0 ? 'sin(x)' : '—'}" value="${attr(f.expr)}" spellcheck="false" autocapitalize="off" autocomplete="off">
        <button type="button" class="ti84-eqn-row__on gc-toggle" data-i="${i}" aria-pressed="${f.on}" title="Graph on/off">${f.on ? 'On' : 'Off'}</button>
      </div>
    `).join('');
  }

  function clampTrace(){
    traceX = Math.min(view.xMax, Math.max(view.xMin, traceX));
    const ti = $('gcTraceX');
    if (ti) ti.value = String(round(traceX, 12));
  }

  function setRange(){
    $('gcXmin').value = view.xMin; $('gcXmax').value = view.xMax;
    $('gcYmin').value = view.yMin; $('gcYmax').value = view.yMax;
    clampTrace();
  }

  function syncModeUI(){
    const r = $('gcModeRad'), d = $('gcModeDeg');
    if (!r || !d) return;
    r.setAttribute('aria-pressed', fluxGcAngleMode === 'rad' ? 'true' : 'false');
    d.setAttribute('aria-pressed', fluxGcAngleMode === 'deg' ? 'true' : 'false');
  }

  function traceDx(){
    return Math.max(1e-9, (view.xMax - view.xMin) / 200);
  }

  function zoomSquare(){
    const W = canvas.clientWidth, H = canvas.clientHeight;
    if (!W || !H) return;
    const midX = (view.xMin + view.xMax) / 2;
    const midY = (view.yMin + view.yMax) / 2;
    let spanX = view.xMax - view.xMin;
    let spanY = view.yMax - view.yMin;
    const dx = spanX / W, dy = spanY / H;
    if (dx < dy) spanX = spanY * W / H;
    else spanY = spanX * H / W;
    view.xMin = midX - spanX / 2;
    view.xMax = midX + spanX / 2;
    view.yMin = midY - spanY / 2;
    view.yMax = midY + spanY / 2;
  }

  function zoomBy(f){
    const midX = (view.xMin + view.xMax) / 2;
    const midY = (view.yMin + view.yMax) / 2;
    const hx = (view.xMax - view.xMin) / 2 * f;
    const hy = (view.yMax - view.yMin) / 2 * f;
    view.xMin = midX - hx;
    view.xMax = midX + hx;
    view.yMin = midY - hy;
    view.yMax = midY + hy;
  }

  function refreshTable(){
    const tb = $('gcTableBody'), hd = $('gcTableHead');
    if (!tb || !hd) return;
    const start = parseFloat($('gcTblStart').value);
    const dt = parseFloat($('gcTblStep').value);
    if (!isFinite(start) || !isFinite(dt) || dt === 0){
      hd.innerHTML = '';
      tb.innerHTML = '<tr><td>Enter TblStart and ΔTbl</td></tr>';
      return;
    }
    const cols = fns.map((f, i) => i).filter(i => fns[i].expr.trim());
    if (!cols.length){
      hd.innerHTML = '<tr><th>X</th></tr>';
      tb.innerHTML = '<tr><td>Enter a Y= expression</td></tr>';
      return;
    }
    hd.innerHTML = '<tr><th>X</th>' + cols.map(i => `<th>Y<sub>${i + 1}</sub></th>`).join('') + '</tr>';
    let x = start;
    let rows = '';
    for (let r = 0; r < 12; r++){
      rows += '<tr><td>' + esc(fmt(x, 5)) + '</td>';
      for (const j of cols){
        const y = gcEvalY(fns[j].expr, x);
        rows += '<td>' + esc(isFinite(y) ? String(round(y, 5)) : '—') + '</td>';
      }
      rows += '</tr>';
      x += dt;
    }
    tb.innerHTML = rows;
  }

  writeInputs();
  setRange();
  syncModeUI();

  function fmtTick(n){
    if (Math.abs(n) < 1e-9) return '0';
    return Math.abs(n) < 0.1 || Math.abs(n) > 9999 ? n.toExponential(1) : String(round(n, 3));
  }

  function redraw(){
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width  = canvas.clientWidth  * dpr;
    canvas.height = canvas.clientHeight * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    const W = canvas.clientWidth, H = canvas.clientHeight;

    const xr = view.xMax - view.xMin;
    const yr = view.yMax - view.yMin;
    const toSx = x => ((x - view.xMin) / xr) * W;
    const toSy = y => H - ((y - view.yMin) / yr) * H;

    const isLight = document.body && document.body.getAttribute('data-theme') === 'light';
    const lcdTop = getCssVar('--bg2') || (isLight ? '#eef1f7' : '#0e1424');
    const lcdMid = getCssVar('--card') || (isLight ? '#f6f8fc' : '#121826');
    const lcdBot = getCssVar('--bg3') || (isLight ? '#e4e9f2' : '#0a0e18');
    ctx.clearRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, lcdTop);
    g.addColorStop(0.45, lcdMid);
    g.addColorStop(1, lcdBot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.globalAlpha = isLight ? 0.04 : 0.05;
    ctx.fillStyle = isLight ? '#000' : '#fff';
    for (let py = 0; py < H; py += 2) ctx.fillRect(0, py, W, 1);
    ctx.restore();

    const gridMajor = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.07)';
    const tickRgb = isLight ? '0,0,0' : '255,255,255';
    ctx.lineWidth = 1;
    ctx.strokeStyle = gridMajor;
    ctx.font = '10px "JetBrains Mono", ui-monospace, monospace';
    ctx.fillStyle = `rgba(${tickRgb},0.48)`;

    const stepX = niceStep(xr / 10);
    const stepY = niceStep(yr / 8);
    for (let x = Math.ceil(view.xMin / stepX) * stepX; x <= view.xMax; x += stepX){
      const sx = toSx(x);
      ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, H); ctx.stroke();
      ctx.fillText(fmtTick(x), sx + 3, H - 4);
    }
    for (let y = Math.ceil(view.yMin / stepY) * stepY; y <= view.yMax; y += stepY){
      const sy = toSy(y);
      ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(W, sy); ctx.stroke();
      ctx.fillText(fmtTick(y), 4, sy - 3);
    }

    const axRgb = isLight ? '0,0,0' : '255,255,255';
    ctx.strokeStyle = `rgba(${axRgb},0.72)`;
    ctx.lineWidth = 1.35;
    if (0 >= view.xMin && 0 <= view.xMax){
      const sx = toSx(0);
      ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, H); ctx.stroke();
    }
    if (0 >= view.yMin && 0 <= view.yMax){
      const sy = toSy(0);
      ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(W, sy); ctx.stroke();
    }

    fns.forEach(f => {
      if (!f.on || !f.expr.trim()) return;
      let fn;
      try { fn = compileExpr(f.expr); } catch(e){ return; }
      ctx.strokeStyle = f.color;
      ctx.lineWidth = 2.1;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      let started = false;
      const n = Math.max(200, Math.floor(W));
      for (let i = 0; i <= n; i++){
        const x = view.xMin + (i / n) * xr;
        let y;
        try { y = fn(x); } catch(e){ y = NaN; }
        if (!isFinite(y)){ started = false; continue; }
        const sx = toSx(x), sy = toSy(y);
        if (!started){ ctx.moveTo(sx, sy); started = true; }
        else { ctx.lineTo(sx, sy); }
      }
      ctx.stroke();
    });

    const tr = $('gcTraceReadout');
    const curFn = fns[traceYIdx];
    if (curFn && curFn.expr.trim() && tr){
      let ty = NaN;
      try { ty = gcEvalY(curFn.expr, traceX); } catch(e){ ty = NaN; }
      if (isFinite(ty)){
        const sx = toSx(traceX), sy = toSy(ty);
        ctx.strokeStyle = `rgba(${axRgb},0.82)`;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(sx, 0); ctx.lineTo(sx, H);
        ctx.moveTo(0, sy); ctx.lineTo(W, sy);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = curFn.color;
        ctx.beginPath();
        ctx.arc(sx, sy, 5, 0, Math.PI * 2);
        ctx.fill();
        tr.textContent = `Y${traceYIdx + 1}  X=${fmt(traceX, 6)}  Y=${fmt(ty, 6)}`;
      }else if (tr) tr.textContent = `Y${traceYIdx + 1} — undefined at X=${fmt(traceX, 6)}`;
    }else if (tr) tr.textContent = '';
  }
  function niceStep(x){
    const p = Math.pow(10, Math.floor(Math.log10(Math.max(x, 1e-9))));
    const r = x / p;
    if (r < 1.5) return 1 * p;
    if (r < 3) return 2 * p;
    if (r < 7) return 5 * p;
    return 10 * p;
  }

  function onInput(){
    $('gcInputs').querySelectorAll('.gc-expr').forEach(inp => {
      const i = +inp.dataset.i;
      fns[i].expr = inp.value;
    });
    $('gcInputs').querySelectorAll('.gc-toggle').forEach(b => {
      const i = +b.dataset.i;
      fns[i].on = b.getAttribute('aria-pressed') === 'true';
    });
    redraw();
  }

  bcSetDisp();
  body.addEventListener('input', e => {
    if (e.target.matches('.gc-expr')) onInput();
    if (e.target && e.target.id === 'gcTraceX'){
      const v = parseFloat($('gcTraceX').value);
      traceX = isFinite(v) ? v : traceX;
      clampTrace();
      redraw();
    }
  });
  body.addEventListener('click', e => {
    const bcBtn = e.target.closest('[data-bc]');
    if (bcBtn){
      bcHandle(bcBtn.getAttribute('data-bc') || '');
      return;
    }
    const insBtn = e.target.closest('[data-gc-ins]');
    if (insBtn){
      gcInsert(insBtn.getAttribute('data-gc-ins') || '');
      return;
    }
    const t = e.target.closest('.gc-toggle');
    if (!t) return;
    const state = t.getAttribute('aria-pressed') === 'true';
    t.setAttribute('aria-pressed', String(!state));
    t.textContent = !state ? 'On' : 'Off';
    onInput();
  });

  function updateRangeFromInputs(){
    view.xMin = parseFloat($('gcXmin').value);
    view.xMax = parseFloat($('gcXmax').value);
    view.yMin = parseFloat($('gcYmin').value);
    view.yMax = parseFloat($('gcYmax').value);
    clampTrace();
    redraw();
  }
  ['gcXmin','gcXmax','gcYmin','gcYmax'].forEach(id => $(id).addEventListener('change', updateRangeFromInputs));

  $('gcModeRad').addEventListener('click', () => {
    fluxGcAngleMode = 'rad';
    syncModeUI();
    redraw();
    refreshTable();
  });
  $('gcModeDeg').addEventListener('click', () => {
    fluxGcAngleMode = 'deg';
    syncModeUI();
    redraw();
    refreshTable();
  });

  $('gcReset').addEventListener('click', () => {
    view = { xMin:-10, xMax:10, yMin:-6, yMax:6 };
    setRange(); redraw();
  });
  $('gcZDec').addEventListener('click', () => {
    view = { xMin:-4.7, xMax:4.7, yMin:-3.1, yMax:3.1 };
    setRange(); redraw();
  });
  const twopi = 2 * Math.PI;
  $('gcZTrig').addEventListener('click', () => {
    view = { xMin:-twopi, xMax:twopi, yMin:-4, yMax:4 };
    setRange(); redraw();
  });
  $('gcZSquare').addEventListener('click', () => {
    zoomSquare();
    setRange(); redraw();
  });
  $('gcZoomIn').addEventListener('click', () => { zoomBy(1 / 1.4); setRange(); redraw(); });
  $('gcZoomOut').addEventListener('click', () => { zoomBy(1.4); setRange(); redraw(); });

  $('gcFit').addEventListener('click', () => {
    let lo = Infinity, hi = -Infinity;
    const xr = view.xMax - view.xMin;
    fns.forEach(f => {
      if (!f.on || !f.expr.trim()) return;
      let fn; try { fn = compileExpr(f.expr); } catch(e){ return; }
      for (let i = 0; i <= 200; i++){
        const x = view.xMin + (i / 200) * xr;
        let y; try { y = fn(x); } catch(e){ y = NaN; }
        if (isFinite(y)){ if (y < lo) lo = y; if (y > hi) hi = y; }
      }
    });
    if (isFinite(lo) && isFinite(hi) && hi > lo){
      const pad = (hi - lo) * 0.12 || 1;
      view.yMin = lo - pad;
      view.yMax = hi + pad;
      setRange(); redraw();
    }
  });

  $('gcTraceY').addEventListener('change', () => {
    traceYIdx = +$('gcTraceY').value || 0;
    redraw();
  });
  $('gcTraceLeft').addEventListener('click', () => { traceX -= traceDx(); clampTrace(); redraw(); });
  $('gcTraceRight').addEventListener('click', () => { traceX += traceDx(); clampTrace(); redraw(); });
  $('gcTblGo').addEventListener('click', refreshTable);

  const calcOut = $('gcCalcOut');
  $('gcCalcVal').addEventListener('click', () => {
    const ex = fns[traceYIdx]?.expr?.trim();
    if (!ex){ if (calcOut) calcOut.textContent = 'Choose Yₙ with an expression.'; return; }
    const y = gcEvalY(ex, traceX);
    if (calcOut) calcOut.textContent = isFinite(y) ? `Y${traceYIdx + 1}(${fmt(traceX, 6)}) = ${fmt(y, 8)}` : 'Undefined at this X.';
  });
  $('gcCalcZero').addEventListener('click', () => {
    const ex = fns[traceYIdx]?.expr?.trim();
    if (!ex){ if (calcOut) calcOut.textContent = 'Choose Yₙ with an expression.'; return; }
    const z = gcFindZero(ex, view.xMin, view.xMax);
    if (z == null){ if (calcOut) calcOut.textContent = 'No sign change in window (try adjusting Xmin/Xmax).'; return; }
    const yz = gcEvalY(ex, z);
    if (calcOut) calcOut.textContent = `Zero ≈ ${fmt(z, 8)}   Y=${fmt(yz, 8)}`;
  });
  $('gcCalcMin').addEventListener('click', () => {
    const ex = fns[traceYIdx]?.expr?.trim();
    if (!ex){ if (calcOut) calcOut.textContent = 'Choose Yₙ with an expression.'; return; }
    const r = gcFindExtremum(ex, view.xMin, view.xMax, 'min');
    if (!r){ if (calcOut) calcOut.textContent = 'Could not find minimum in window.'; return; }
    if (calcOut) calcOut.textContent = `Min at X≈${fmt(r.x, 8)}  Y=${fmt(r.y, 8)}`;
  });
  $('gcCalcMax').addEventListener('click', () => {
    const ex = fns[traceYIdx]?.expr?.trim();
    if (!ex){ if (calcOut) calcOut.textContent = 'Choose Yₙ with an expression.'; return; }
    const r = gcFindExtremum(ex, view.xMin, view.xMax, 'max');
    if (!r){ if (calcOut) calcOut.textContent = 'Could not find maximum in window.'; return; }
    if (calcOut) calcOut.textContent = `Max at X≈${fmt(r.x, 8)}  Y=${fmt(r.y, 8)}`;
  });

  let drag = null;
  canvas.addEventListener('mousedown', e => {
    const rect = canvas.getBoundingClientRect();
    drag = { x:e.clientX, y:e.clientY, v:{...view}, w:rect.width, h:rect.height };
  });
  window.addEventListener('mouseup', () => drag = null);
  window.addEventListener('mousemove', e => {
    if (!drag) return;
    const dx = (e.clientX - drag.x) / drag.w * (drag.v.xMax - drag.v.xMin);
    const dy = (e.clientY - drag.y) / drag.h * (drag.v.yMax - drag.v.yMin);
    view.xMin = drag.v.xMin - dx; view.xMax = drag.v.xMax - dx;
    view.yMin = drag.v.yMin + dy; view.yMax = drag.v.yMax + dy;
    setRange(); redraw();
  });
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width;
    const my = 1 - (e.clientY - rect.top) / rect.height;
    const cx = view.xMin + mx * (view.xMax - view.xMin);
    const cy = view.yMin + my * (view.yMax - view.yMin);
    const k = Math.pow(1.0015, e.deltaY);
    view.xMin = cx + (view.xMin - cx) * k;
    view.xMax = cx + (view.xMax - cx) * k;
    view.yMin = cy + (view.yMin - cy) * k;
    view.yMax = cy + (view.yMax - cy) * k;
    setRange(); redraw();
  }, { passive:false });

  canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width;
    const my = 1 - (e.clientY - rect.top) / rect.height;
    const x = view.xMin + mx * (view.xMax - view.xMin);
    const y = view.yMin + my * (view.yMax - view.yMin);
    const cur = $('gcCursor');
    if (cur) cur.textContent = `cursor X=${round(x, 4)}  Y=${round(y, 4)}`;
  });

  redraw();
  window.addEventListener('resize', redraw);
}

function getCssVar(name){
  try { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  catch(e){ return ''; }
}

// ── Matrix calculator ───────────────────────────────────────────
function mxMake(r,c,fill=0){ return Array.from({length:r}, () => Array(c).fill(fill)); }
function mxTranspose(M){ const r=M.length, c=M[0].length; const out=mxMake(c,r); for (let i=0;i<r;i++) for (let j=0;j<c;j++) out[j][i]=M[i][j]; return out; }
function mxAdd(A,B,sign=1){ const r=A.length, c=A[0].length; if (B.length!==r || B[0].length!==c) throw new Error('dim mismatch'); const out=mxMake(r,c); for (let i=0;i<r;i++) for (let j=0;j<c;j++) out[i][j]=A[i][j]+sign*B[i][j]; return out; }
function mxMul(A,B){ const r=A.length, k=A[0].length, c=B[0].length; if (B.length!==k) throw new Error('dim mismatch'); const out=mxMake(r,c); for (let i=0;i<r;i++) for (let j=0;j<c;j++){ let s=0; for (let t=0;t<k;t++) s+=A[i][t]*B[t][j]; out[i][j]=s; } return out; }
function mxScale(A,s){ return A.map(row => row.map(v => v*s)); }
function mxDet(A){
  const n = A.length;
  if (n !== A[0].length) throw new Error('not square');
  if (n === 1) return A[0][0];
  if (n === 2) return A[0][0]*A[1][1]-A[0][1]*A[1][0];
  // LU via Gauss elimination
  const M = A.map(r => r.slice());
  let det = 1;
  for (let i = 0; i < n; i++){
    // pivot
    let p = i;
    for (let r = i+1; r < n; r++) if (Math.abs(M[r][i]) > Math.abs(M[p][i])) p = r;
    if (M[p][i] === 0) return 0;
    if (p !== i){ [M[i], M[p]] = [M[p], M[i]]; det = -det; }
    det *= M[i][i];
    for (let r = i+1; r < n; r++){
      const f = M[r][i] / M[i][i];
      for (let c = i; c < n; c++) M[r][c] -= f * M[i][c];
    }
  }
  return det;
}
function mxInv(A){
  const n = A.length;
  if (n !== A[0].length) throw new Error('not square');
  // Augmented matrix
  const M = A.map((r, i) => r.concat(Array.from({length:n}, (_,j) => (i===j?1:0))));
  for (let i = 0; i < n; i++){
    let p = i;
    for (let r = i+1; r < n; r++) if (Math.abs(M[r][i]) > Math.abs(M[p][i])) p = r;
    if (Math.abs(M[p][i]) < 1e-12) throw new Error('singular (not invertible)');
    if (p !== i) [M[i], M[p]] = [M[p], M[i]];
    const piv = M[i][i];
    for (let c = 0; c < 2*n; c++) M[i][c] /= piv;
    for (let r = 0; r < n; r++){
      if (r === i) continue;
      const f = M[r][i];
      if (f === 0) continue;
      for (let c = 0; c < 2*n; c++) M[r][c] -= f * M[i][c];
    }
  }
  return M.map(r => r.slice(n));
}

function renderMatrixCalc(body){
  body.innerHTML = `
    <div class="tb-card">
      <div class="tb-card-h"><h3>Matrix calculator</h3></div>
      <div class="mx-grid">
        <div class="mx-side">
          <div class="mx-size">
            A: <input type="number" id="mxArows" min="1" max="6" value="3"> ×
               <input type="number" id="mxAcols" min="1" max="6" value="3">
          </div>
          <div id="mxA" class="mx-box"></div>
        </div>
        <div class="mx-side">
          <div class="mx-size">
            B: <input type="number" id="mxBrows" min="1" max="6" value="3"> ×
               <input type="number" id="mxBcols" min="1" max="6" value="3">
          </div>
          <div id="mxB" class="mx-box"></div>
        </div>
      </div>
      <div class="mx-ops">
        <button type="button" class="tb-btn" data-op="add">A + B</button>
        <button type="button" class="tb-btn" data-op="sub">A − B</button>
        <button type="button" class="tb-btn" data-op="mul">A · B</button>
        <button type="button" class="tb-btn" data-op="tA">Aᵀ</button>
        <button type="button" class="tb-btn" data-op="detA">det(A)</button>
        <button type="button" class="tb-btn" data-op="invA">A⁻¹</button>
        <button type="button" class="tb-btn" data-op="tB">Bᵀ</button>
        <button type="button" class="tb-btn" data-op="detB">det(B)</button>
        <button type="button" class="tb-btn" data-op="invB">B⁻¹</button>
      </div>
      <div id="mxOut" class="mx-out"></div>
    </div>
  `;

  function draw(id, rows, cols){
    const host = $(id);
    const existing = {};
    host.querySelectorAll('input').forEach(inp => existing[inp.dataset.key] = inp.value);
    host.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    host.innerHTML = Array.from({length:rows}, (_,i) =>
      Array.from({length:cols}, (_,j) => {
        const key = `${id}-${i}-${j}`;
        const v = existing[key] ?? ((i === j && id === 'mxA') || (i === j && id === 'mxB') ? 1 : 0);
        return `<input type="number" step="any" data-key="${key}" value="${v}">`;
      }).join('')
    ).join('');
  }
  function read(id){
    const rows = id === 'mxA' ? +$('mxArows').value : +$('mxBrows').value;
    const cols = id === 'mxA' ? +$('mxAcols').value : +$('mxBcols').value;
    const host = $(id);
    const M = [];
    for (let i = 0; i < rows; i++){
      const row = [];
      for (let j = 0; j < cols; j++){
        const el = host.querySelector(`[data-key="${id}-${i}-${j}"]`);
        row.push(parseFloat(el?.value) || 0);
      }
      M.push(row);
    }
    return M;
  }
  function renderMat(label, M){
    return `
      <div class="mx-out-card">
        <div class="mx-out-label">${esc(label)}</div>
        <div class="mx-mat" style="grid-template-columns: repeat(${M[0].length}, auto)">
          ${M.map(r => r.map(v => `<span>${round(v, 5)}</span>`).join('')).join('')}
        </div>
      </div>
    `;
  }
  function renderScalar(label, v){
    return `
      <div class="mx-out-card">
        <div class="mx-out-label">${esc(label)}</div>
        <div class="mx-scalar">${round(v, 6)}</div>
      </div>
    `;
  }

  $('mxArows').addEventListener('change', () => draw('mxA', +$('mxArows').value, +$('mxAcols').value));
  $('mxAcols').addEventListener('change', () => draw('mxA', +$('mxArows').value, +$('mxAcols').value));
  $('mxBrows').addEventListener('change', () => draw('mxB', +$('mxBrows').value, +$('mxBcols').value));
  $('mxBcols').addEventListener('change', () => draw('mxB', +$('mxBrows').value, +$('mxBcols').value));
  draw('mxA', 3, 3); draw('mxB', 3, 3);

  body.addEventListener('click', e => {
    const b = e.target.closest('[data-op]');
    if (!b) return;
    const out = $('mxOut');
    try{
      const A = read('mxA'), B = read('mxB');
      let html = '';
      switch (b.dataset.op){
        case 'add': html = renderMat('A + B', mxAdd(A, B)); break;
        case 'sub': html = renderMat('A − B', mxAdd(A, B, -1)); break;
        case 'mul': html = renderMat('A · B', mxMul(A, B)); break;
        case 'tA':  html = renderMat('Aᵀ',    mxTranspose(A)); break;
        case 'tB':  html = renderMat('Bᵀ',    mxTranspose(B)); break;
        case 'detA':html = renderScalar('det(A)', mxDet(A)); break;
        case 'detB':html = renderScalar('det(B)', mxDet(B)); break;
        case 'invA':html = renderMat('A⁻¹',   mxInv(A)); break;
        case 'invB':html = renderMat('B⁻¹',   mxInv(B)); break;
      }
      out.innerHTML = html;
    }catch(err){
      out.innerHTML = `<div class="tb-warn">${esc(err.message)}</div>`;
    }
  });
}

// ── Statistics toolkit ──────────────────────────────────────────
function stats(arr){
  const n = arr.length;
  if (!n) return null;
  const sorted = [...arr].sort((a,b) => a-b);
  const sum = arr.reduce((s,v) => s+v, 0);
  const mean = sum / n;
  const median = n % 2 ? sorted[(n-1)/2] : (sorted[n/2-1] + sorted[n/2]) / 2;
  const variance = arr.reduce((s,v) => s + (v-mean)**2, 0) / n;
  const sampleVar = n > 1 ? arr.reduce((s,v) => s + (v-mean)**2, 0) / (n-1) : 0;
  const stdPop = Math.sqrt(variance);
  const stdSamp = Math.sqrt(sampleVar);
  const q = (p) => {
    const pos = (n - 1) * p;
    const b = Math.floor(pos);
    const r = pos - b;
    return sorted[b] + r * ((sorted[b+1] ?? sorted[b]) - sorted[b]);
  };
  const q1 = q(0.25), q3 = q(0.75);
  const iqr = q3 - q1;
  const freq = {};
  arr.forEach(v => freq[v] = (freq[v] || 0) + 1);
  const maxF = Math.max(...Object.values(freq));
  const modes = Object.keys(freq).filter(k => freq[k] === maxF).map(Number);
  return {
    n, sum, mean, median,
    mode: modes.length === arr.length ? '—' : modes.map(m => round(m,6)).join(', '),
    stdPop, stdSamp, variance, sampleVar,
    min: sorted[0], max: sorted[n-1],
    range: sorted[n-1] - sorted[0],
    q1, q3, iqr,
  };
}
// Normal CDF using Abramowitz & Stegun (erf approximation)
function erf(x){
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - (((((1.061405429*t - 1.453152027)*t) + 1.421413741)*t - 0.284496736)*t + 0.254829592) * t * Math.exp(-x*x);
  return x < 0 ? -y : y;
}
function normalCdf(z){ return 0.5 * (1 + erf(z / Math.SQRT2)); }

function renderStatsTool(body){
  body.innerHTML = `
    <div class="tb-card">
      <div class="tb-card-h"><h3>Statistics toolkit</h3>
        <button type="button" class="tb-btn-sec" id="stPreset">Try sample data</button>
      </div>
      <div class="st-top">
        <textarea id="stData" rows="4" placeholder="Paste or type numbers, separated by commas, spaces, or newlines"></textarea>
      </div>
      <div class="st-grid" id="stGrid"></div>
      <div class="tb-hr"></div>
      <div class="tb-card-h"><h3 style="font-size:.9rem">Z-score & normal probability</h3></div>
      <div class="st-z">
        <label>Value (x)  <input type="number" id="stX" step="any" value="72"></label>
        <label>Mean (μ)   <input type="number" id="stMu" step="any" value="70"></label>
        <label>Std (σ)    <input type="number" id="stSd" step="any" value="4"></label>
      </div>
      <div id="stZOut" class="st-z-out"></div>
    </div>
  `;

  function parseNums(txt){
    return txt.split(/[\s,]+/).map(s => parseFloat(s)).filter(v => !isNaN(v));
  }

  function recompute(){
    const arr = parseNums($('stData').value);
    const s = stats(arr);
    if (!s){
      $('stGrid').innerHTML = '<div class="tb-empty">Enter some numbers above.</div>';
      return;
    }
    $('stGrid').innerHTML = `
      ${statCell('n', s.n)}
      ${statCell('Sum', round(s.sum, 6))}
      ${statCell('Mean', round(s.mean, 6))}
      ${statCell('Median', round(s.median, 6))}
      ${statCell('Mode', s.mode)}
      ${statCell('Min', round(s.min, 6))}
      ${statCell('Max', round(s.max, 6))}
      ${statCell('Range', round(s.range, 6))}
      ${statCell('Std (pop σ)', round(s.stdPop, 6))}
      ${statCell('Std (sample s)', round(s.stdSamp, 6))}
      ${statCell('Variance (pop)', round(s.variance, 6))}
      ${statCell('Variance (sample)', round(s.sampleVar, 6))}
      ${statCell('Q1', round(s.q1, 6))}
      ${statCell('Q3', round(s.q3, 6))}
      ${statCell('IQR', round(s.iqr, 6))}
    `;
  }
  function statCell(lbl, val){
    return `<div class="st-cell"><div class="st-lbl">${esc(lbl)}</div><div class="st-val">${esc(String(val))}</div></div>`;
  }
  function recomputeZ(){
    const x = +$('stX').value, mu = +$('stMu').value, sd = +$('stSd').value;
    if (!isFinite(x) || !isFinite(mu) || !isFinite(sd) || sd === 0){
      $('stZOut').innerHTML = `<div class="tb-empty">Fill all three fields (σ ≠ 0).</div>`;
      return;
    }
    const z = (x - mu) / sd;
    const p_lt = normalCdf(z);
    const p_gt = 1 - p_lt;
    const p_2t = 2 * (1 - normalCdf(Math.abs(z)));
    $('stZOut').innerHTML = `
      ${statCell('z', round(z, 6))}
      ${statCell('P(X < x)', round(p_lt, 6))}
      ${statCell('P(X > x)', round(p_gt, 6))}
      ${statCell('Two-tailed', round(p_2t, 6))}
    `;
  }

  $('stData').addEventListener('input', recompute);
  ['stX','stMu','stSd'].forEach(id => $(id).addEventListener('input', recomputeZ));
  $('stPreset').addEventListener('click', () => {
    $('stData').value = '72, 75, 68, 70, 74, 71, 69, 77, 73, 70, 72, 68, 76, 74, 71, 69';
    recompute();
  });
  recompute(); recomputeZ();
}

// ── Geometric formulas reference ────────────────────────────────
const GEO = [
  {
    kind:'2D', name:'Square', svg:`<rect x="20" y="20" width="100" height="100" fill="none" stroke="currentColor" stroke-width="2"/><text x="70" y="75" text-anchor="middle" font-size="13">a</text>`,
    formulas:[['Perimeter','P = 4a'], ['Area','A = a²']],
  },
  {
    kind:'2D', name:'Rectangle', svg:`<rect x="20" y="40" width="110" height="70" fill="none" stroke="currentColor" stroke-width="2"/><text x="75" y="80" text-anchor="middle" font-size="12">a, b</text>`,
    formulas:[['Perimeter','P = 2(a+b)'], ['Area','A = a·b']],
  },
  {
    kind:'2D', name:'Triangle', svg:`<polygon points="30,120 120,120 75,30" fill="none" stroke="currentColor" stroke-width="2"/><text x="75" y="110" text-anchor="middle" font-size="11">b, h</text>`,
    formulas:[['Area','A = ½·b·h'], ['Heron','A = √(s(s−a)(s−b)(s−c)), s = (a+b+c)/2']],
  },
  {
    kind:'2D', name:'Circle', svg:`<circle cx="75" cy="75" r="50" fill="none" stroke="currentColor" stroke-width="2"/><line x1="75" y1="75" x2="125" y2="75" stroke="currentColor" stroke-dasharray="3 3"/><text x="100" y="70" font-size="11">r</text>`,
    formulas:[['Circumference','C = 2πr'], ['Area','A = πr²']],
  },
  {
    kind:'2D', name:'Trapezoid', svg:`<polygon points="30,110 120,110 100,40 50,40" fill="none" stroke="currentColor" stroke-width="2"/>`,
    formulas:[['Area','A = ½(a+b)·h']],
  },
  {
    kind:'2D', name:'Parallelogram', svg:`<polygon points="30,110 110,110 130,40 50,40" fill="none" stroke="currentColor" stroke-width="2"/>`,
    formulas:[['Area','A = b·h']],
  },
  {
    kind:'2D', name:'Regular polygon (n sides)', svg:`<polygon points="75,25 120,55 105,110 45,110 30,55" fill="none" stroke="currentColor" stroke-width="2"/>`,
    formulas:[['Perimeter','P = n·s'], ['Area','A = ½·P·a (a = apothem)']],
  },
  {
    kind:'3D', name:'Cube', svg:`<path d="M30 50 L90 50 L120 30 L60 30 Z M30 50 L30 120 L90 120 L90 50 Z M90 50 L120 30 L120 100 L90 120 Z" fill="none" stroke="currentColor" stroke-width="2"/>`,
    formulas:[['Volume','V = a³'], ['Surface area','SA = 6a²']],
  },
  {
    kind:'3D', name:'Rectangular prism', svg:`<path d="M30 60 L100 60 L130 35 L60 35 Z M30 60 L30 115 L100 115 L100 60 Z M100 60 L130 35 L130 90 L100 115 Z" fill="none" stroke="currentColor" stroke-width="2"/>`,
    formulas:[['Volume','V = l·w·h'], ['Surface area','SA = 2(lw + lh + wh)']],
  },
  {
    kind:'3D', name:'Sphere', svg:`<circle cx="75" cy="75" r="50" fill="none" stroke="currentColor" stroke-width="2"/><ellipse cx="75" cy="75" rx="50" ry="14" fill="none" stroke="currentColor" stroke-opacity=".35" stroke-width="1.5"/>`,
    formulas:[['Volume','V = (4/3)πr³'], ['Surface area','SA = 4πr²']],
  },
  {
    kind:'3D', name:'Cylinder', svg:`<ellipse cx="75" cy="30" rx="45" ry="10" fill="none" stroke="currentColor" stroke-width="2"/><ellipse cx="75" cy="120" rx="45" ry="10" fill="none" stroke="currentColor" stroke-width="2"/><line x1="30" y1="30" x2="30" y2="120" stroke="currentColor" stroke-width="2"/><line x1="120" y1="30" x2="120" y2="120" stroke="currentColor" stroke-width="2"/>`,
    formulas:[['Volume','V = πr²h'], ['Surface area','SA = 2πr² + 2πrh']],
  },
  {
    kind:'3D', name:'Cone', svg:`<ellipse cx="75" cy="120" rx="45" ry="10" fill="none" stroke="currentColor" stroke-width="2"/><line x1="30" y1="120" x2="75" y2="25" stroke="currentColor" stroke-width="2"/><line x1="120" y1="120" x2="75" y2="25" stroke="currentColor" stroke-width="2"/>`,
    formulas:[['Volume','V = (1/3)πr²h'], ['Lateral area','LA = πr·ℓ (ℓ = √(r²+h²))'], ['Surface area','SA = πr² + πrℓ']],
  },
  {
    kind:'3D', name:'Square pyramid', svg:`<polygon points="20,120 130,120 90,95 55,95" fill="none" stroke="currentColor" stroke-width="2"/><line x1="20" y1="120" x2="75" y2="30" stroke="currentColor" stroke-width="2"/><line x1="130" y1="120" x2="75" y2="30" stroke="currentColor" stroke-width="2"/><line x1="55" y1="95" x2="75" y2="30" stroke="currentColor" stroke-width="1" opacity=".6"/>`,
    formulas:[['Volume','V = (1/3)·b²·h'], ['Surface area','SA = b² + 2b·ℓ']],
  },
];

function renderGeoRef(body){
  const kinds = ['2D','3D'];
  body.innerHTML = `
    <div class="tb-card">
      <div class="tb-card-h"><h3>Geometric formulas</h3>
        <div class="tb-seg">${kinds.map((k,i) => `<button type="button" data-k="${k}" class="${i === 0 ? 'active':''}">${k}</button>`).join('')}</div>
      </div>
      <div id="geoGrid" class="geo-grid"></div>
    </div>
  `;
  function draw(k){
    $('geoGrid').innerHTML = GEO.filter(g => g.kind === k).map(g => `
      <div class="geo-card">
        <div class="geo-svg" aria-hidden="true"><svg viewBox="0 0 150 150" width="120" height="120">${g.svg}</svg></div>
        <div class="geo-name">${esc(g.name)}</div>
        <div class="geo-formulas">
          ${g.formulas.map(f => `<div><span class="geo-lbl">${esc(f[0])}</span><code>${esc(f[1])}</code></div>`).join('')}
        </div>
      </div>
    `).join('');
  }
  body.querySelector('.tb-seg').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    body.querySelectorAll('.tb-seg button').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    draw(b.dataset.k);
  });
  draw(kinds[0]);
}

SUBJECTS.push({
  id:'math', label:'Math', icon:'∑',
  tools:[
    { id:'graphing', label:'Graph + calc',  icon:'📈', render: renderGraphCalc },
    { id:'matrix',   label:'Matrix calc',    icon:'⊞',  render: renderMatrixCalc },
    { id:'stats',    label:'Statistics',     icon:'𝝈',  render: renderStatsTool },
    { id:'geo-ref',  label:'Geometric formulas', icon:'△', render: renderGeoRef },
  ],
});

/* ================================================================
   HISTORY / SOCIAL STUDIES
   ================================================================ */

function renderTimelineBuilder(body){
  const STORE_KEY = 'flux_timelines';
  const load = () => { try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); } catch(e){ return []; } };
  const save = (v) => { try { localStorage.setItem(STORE_KEY, JSON.stringify(v)); } catch(e){} };
  let timelines = load();
  if (!timelines.length){
    timelines = [{
      id: 't_' + Date.now(), name:'World History · 20th Century',
      events:[
        { year:1914, label:'WWI begins' },
        { year:1918, label:'WWI ends' },
        { year:1929, label:'Great Depression starts' },
        { year:1939, label:'WWII begins' },
        { year:1945, label:'WWII ends · UN founded' },
        { year:1947, label:'India & Pakistan independence' },
        { year:1969, label:'Moon landing' },
        { year:1989, label:'Berlin Wall falls' },
        { year:1991, label:'USSR dissolves' },
      ],
    }];
    save(timelines);
  }
  let active = timelines[0].id;

  function refresh(){
    const t = timelines.find(x => x.id === active) || timelines[0];
    // timeline axis
    const evs = (t?.events || []).slice().sort((a,b) => a.year - b.year);
    const minY = evs.length ? evs[0].year : 1900;
    const maxY = evs.length ? evs[evs.length-1].year : 2000;
    const span = Math.max(10, maxY - minY);

    body.innerHTML = `
      <div class="tb-card">
        <div class="tb-card-h">
          <h3>Timeline builder</h3>
          <div class="tb-actions">
            <select id="tlPick">
              ${timelines.map(x => `<option value="${x.id}" ${x.id === active ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}
            </select>
            <button type="button" class="tb-btn-sec" id="tlRename">Rename</button>
            <button type="button" class="tb-btn-sec" id="tlNew">+ New</button>
            <button type="button" class="tb-btn-sec" id="tlDel">Delete</button>
          </div>
        </div>
        <div class="tl-wrap">
          <div class="tl-line">
            ${evs.map(ev => {
              const pct = ((ev.year - minY) / span) * 100;
              return `<div class="tl-ev" style="left:${pct}%">
                <div class="tl-dot"></div>
                <div class="tl-year">${ev.year}</div>
                <div class="tl-lbl">${esc(ev.label)}</div>
              </div>`;
            }).join('')}
          </div>
          <div class="tl-scale"><span>${minY}</span><span>${maxY}</span></div>
        </div>
        <div class="tl-add">
          <input type="number" id="tlYear" placeholder="Year (e.g. 1776)">
          <input type="text" id="tlLabel" placeholder="Event title">
          <button type="button" class="tb-btn" id="tlAdd">Add event</button>
        </div>
        <div class="tl-list">
          ${evs.map((ev, i) => `<div class="tl-row"><span class="tl-y">${ev.year}</span><span class="tl-t">${esc(ev.label)}</span><button type="button" class="tl-rm" data-i="${i}" title="Remove">✕</button></div>`).join('')}
        </div>
      </div>
    `;

    $('tlPick').addEventListener('change', e => { active = e.target.value; refresh(); });
    $('tlNew').addEventListener('click', () => {
      const name = prompt('Timeline name?');
      if (!name) return;
      const id = 't_' + Date.now();
      timelines.push({ id, name, events:[] });
      save(timelines);
      active = id; refresh();
    });
    $('tlDel').addEventListener('click', () => {
      if (!confirm('Delete this timeline?')) return;
      timelines = timelines.filter(x => x.id !== active);
      if (!timelines.length) timelines = [{ id:'t_' + Date.now(), name:'New timeline', events:[] }];
      active = timelines[0].id;
      save(timelines); refresh();
    });
    $('tlRename').addEventListener('click', () => {
      const cur = timelines.find(x => x.id === active);
      const n = prompt('Rename timeline:', cur?.name || '');
      if (!n) return;
      cur.name = n; save(timelines); refresh();
    });
    $('tlAdd').addEventListener('click', () => {
      const y = parseInt($('tlYear').value, 10);
      const l = $('tlLabel').value.trim();
      if (!y || !l) return;
      const cur = timelines.find(x => x.id === active);
      cur.events.push({ year:y, label:l });
      save(timelines); refresh();
    });
    body.querySelectorAll('.tl-rm').forEach(btn => btn.addEventListener('click', () => {
      const cur = timelines.find(x => x.id === active);
      const evsSorted = cur.events.slice().sort((a,b) => a.year - b.year);
      const target = evsSorted[+btn.dataset.i];
      const idx = cur.events.findIndex(e => e === target);
      if (idx > -1) cur.events.splice(idx, 1);
      save(timelines); refresh();
    }));
  }
  refresh();
}

// Map reference — regional quiz & reference (text-based, high quality).
const MAP_DATA = {
  'US states': [
    ['Alabama','Montgomery'],['Alaska','Juneau'],['Arizona','Phoenix'],['Arkansas','Little Rock'],
    ['California','Sacramento'],['Colorado','Denver'],['Connecticut','Hartford'],['Delaware','Dover'],
    ['Florida','Tallahassee'],['Georgia','Atlanta'],['Hawaii','Honolulu'],['Idaho','Boise'],
    ['Illinois','Springfield'],['Indiana','Indianapolis'],['Iowa','Des Moines'],['Kansas','Topeka'],
    ['Kentucky','Frankfort'],['Louisiana','Baton Rouge'],['Maine','Augusta'],['Maryland','Annapolis'],
    ['Massachusetts','Boston'],['Michigan','Lansing'],['Minnesota','St. Paul'],['Mississippi','Jackson'],
    ['Missouri','Jefferson City'],['Montana','Helena'],['Nebraska','Lincoln'],['Nevada','Carson City'],
    ['New Hampshire','Concord'],['New Jersey','Trenton'],['New Mexico','Santa Fe'],['New York','Albany'],
    ['North Carolina','Raleigh'],['North Dakota','Bismarck'],['Ohio','Columbus'],['Oklahoma','Oklahoma City'],
    ['Oregon','Salem'],['Pennsylvania','Harrisburg'],['Rhode Island','Providence'],['South Carolina','Columbia'],
    ['South Dakota','Pierre'],['Tennessee','Nashville'],['Texas','Austin'],['Utah','Salt Lake City'],
    ['Vermont','Montpelier'],['Virginia','Richmond'],['Washington','Olympia'],['West Virginia','Charleston'],
    ['Wisconsin','Madison'],['Wyoming','Cheyenne'],
  ],
  'Europe': [
    ['United Kingdom','London'],['France','Paris'],['Germany','Berlin'],['Italy','Rome'],
    ['Spain','Madrid'],['Portugal','Lisbon'],['Netherlands','Amsterdam'],['Belgium','Brussels'],
    ['Luxembourg','Luxembourg'],['Ireland','Dublin'],['Switzerland','Bern'],['Austria','Vienna'],
    ['Denmark','Copenhagen'],['Norway','Oslo'],['Sweden','Stockholm'],['Finland','Helsinki'],
    ['Iceland','Reykjavík'],['Poland','Warsaw'],['Czechia','Prague'],['Slovakia','Bratislava'],
    ['Hungary','Budapest'],['Romania','Bucharest'],['Bulgaria','Sofia'],['Greece','Athens'],
    ['Ukraine','Kyiv'],['Belarus','Minsk'],['Russia','Moscow'],['Estonia','Tallinn'],
    ['Latvia','Riga'],['Lithuania','Vilnius'],['Croatia','Zagreb'],['Slovenia','Ljubljana'],
    ['Serbia','Belgrade'],['Bosnia and Herzegovina','Sarajevo'],['North Macedonia','Skopje'],
    ['Albania','Tirana'],['Montenegro','Podgorica'],['Kosovo','Pristina'],['Moldova','Chișinău'],
    ['Turkey','Ankara'],['Cyprus','Nicosia'],['Malta','Valletta'],['Andorra','Andorra la Vella'],
    ['Monaco','Monaco'],['San Marino','San Marino'],['Vatican City','Vatican City'],
    ['Liechtenstein','Vaduz'],
  ],
  'Asia': [
    ['China','Beijing'],['India','New Delhi'],['Japan','Tokyo'],['South Korea','Seoul'],['North Korea','Pyongyang'],
    ['Vietnam','Hanoi'],['Thailand','Bangkok'],['Indonesia','Jakarta'],['Philippines','Manila'],['Malaysia','Kuala Lumpur'],
    ['Singapore','Singapore'],['Pakistan','Islamabad'],['Bangladesh','Dhaka'],['Sri Lanka','Sri Jayawardenepura Kotte'],
    ['Nepal','Kathmandu'],['Bhutan','Thimphu'],['Myanmar','Naypyidaw'],['Cambodia','Phnom Penh'],['Laos','Vientiane'],
    ['Mongolia','Ulaanbaatar'],['Taiwan','Taipei'],['Afghanistan','Kabul'],['Iran','Tehran'],['Iraq','Baghdad'],
    ['Saudi Arabia','Riyadh'],['Israel','Jerusalem'],['Jordan','Amman'],['Lebanon','Beirut'],['Syria','Damascus'],
    ['United Arab Emirates','Abu Dhabi'],['Qatar','Doha'],['Kuwait','Kuwait City'],['Oman','Muscat'],['Bahrain','Manama'],
    ['Yemen','Sana\'a'],['Kazakhstan','Astana'],['Uzbekistan','Tashkent'],['Turkmenistan','Ashgabat'],
    ['Tajikistan','Dushanbe'],['Kyrgyzstan','Bishkek'],['Armenia','Yerevan'],['Azerbaijan','Baku'],['Georgia','Tbilisi'],['Maldives','Malé'],['Brunei','Bandar Seri Begawan'],['East Timor','Dili'],
  ],
  'Africa': [
    ['Egypt','Cairo'],['Nigeria','Abuja'],['South Africa','Pretoria'],['Kenya','Nairobi'],
    ['Ethiopia','Addis Ababa'],['Morocco','Rabat'],['Algeria','Algiers'],['Tunisia','Tunis'],
    ['Libya','Tripoli'],['Sudan','Khartoum'],['Ghana','Accra'],['Senegal','Dakar'],['Uganda','Kampala'],
    ['Tanzania','Dodoma'],['Angola','Luanda'],['Mozambique','Maputo'],['Madagascar','Antananarivo'],
    ['Cameroon','Yaoundé'],['Ivory Coast','Yamoussoukro'],['Zambia','Lusaka'],['Zimbabwe','Harare'],
    ['Botswana','Gaborone'],['Namibia','Windhoek'],['Mali','Bamako'],['Burkina Faso','Ouagadougou'],
    ['Niger','Niamey'],['Chad','N\'Djamena'],['Somalia','Mogadishu'],['Rwanda','Kigali'],['Burundi','Gitega'],
    ['Republic of the Congo','Brazzaville'],['Democratic Republic of the Congo','Kinshasa'],
    ['Central African Republic','Bangui'],['South Sudan','Juba'],['Eritrea','Asmara'],['Djibouti','Djibouti'],
    ['Sierra Leone','Freetown'],['Liberia','Monrovia'],['Guinea','Conakry'],['Togo','Lomé'],['Benin','Porto-Novo'],
    ['Mauritania','Nouakchott'],['Gambia','Banjul'],['Equatorial Guinea','Malabo'],['Gabon','Libreville'],
    ['Lesotho','Maseru'],['Eswatini','Mbabane'],['Cape Verde','Praia'],['Comoros','Moroni'],['Mauritius','Port Louis'],
    ['Seychelles','Victoria'],['São Tomé and Príncipe','São Tomé'],['Malawi','Lilongwe'],
  ],
  'Americas': [
    ['Canada','Ottawa'],['United States','Washington, D.C.'],['Mexico','Mexico City'],
    ['Brazil','Brasília'],['Argentina','Buenos Aires'],['Chile','Santiago'],['Peru','Lima'],
    ['Colombia','Bogotá'],['Venezuela','Caracas'],['Ecuador','Quito'],['Bolivia','Sucre'],
    ['Paraguay','Asunción'],['Uruguay','Montevideo'],['Suriname','Paramaribo'],['Guyana','Georgetown'],
    ['Cuba','Havana'],['Haiti','Port-au-Prince'],['Dominican Republic','Santo Domingo'],
    ['Jamaica','Kingston'],['Bahamas','Nassau'],['Panama','Panama City'],['Costa Rica','San José'],
    ['Nicaragua','Managua'],['Honduras','Tegucigalpa'],['El Salvador','San Salvador'],['Guatemala','Guatemala City'],
    ['Belize','Belmopan'],['Trinidad and Tobago','Port of Spain'],['Barbados','Bridgetown'],
  ],
  'Oceania': [
    ['Australia','Canberra'],['New Zealand','Wellington'],['Papua New Guinea','Port Moresby'],
    ['Fiji','Suva'],['Solomon Islands','Honiara'],['Vanuatu','Port Vila'],['Samoa','Apia'],
    ['Tonga','Nuku\'alofa'],['Kiribati','Tarawa'],['Micronesia','Palikir'],['Marshall Islands','Majuro'],
    ['Palau','Ngerulmud'],['Nauru','Yaren'],['Tuvalu','Funafuti'],
  ],
};

function renderMapRef(body){
  const regions = Object.keys(MAP_DATA);
  body.innerHTML = `
    <div class="tb-card">
      <div class="tb-card-h">
        <h3>Map reference & capitals quiz</h3>
        <div class="tb-actions">
          <select id="mrRegion" class="tb-select">
            ${regions.map(r => `<option>${esc(r)}</option>`).join('')}
          </select>
          <div class="tb-seg" role="tablist">
            <button type="button" data-mode="browse" class="active">Browse</button>
            <button type="button" data-mode="quiz">Quiz</button>
          </div>
        </div>
      </div>
      <div id="mrOut"></div>
    </div>
  `;
  let mode = 'browse';
  function draw(){
    const region = $('mrRegion').value;
    const pairs = MAP_DATA[region];
    if (mode === 'browse'){
      $('mrOut').innerHTML = `
        <div class="mr-browse">
          ${pairs.map(([place,cap]) => `
            <div class="mr-row"><span class="mr-p">${esc(place)}</span><span class="mr-c">${esc(cap)}</span></div>
          `).join('')}
        </div>
      `;
    } else {
      // Quiz: pick a random pair, ask capital; user enters guess
      let idx = Math.floor(Math.random() * pairs.length);
      const startQuiz = () => {
        idx = Math.floor(Math.random() * pairs.length);
        $('mrOut').innerHTML = `
          <div class="mr-quiz">
            <div class="mr-qprompt">What is the capital of <strong>${esc(pairs[idx][0])}</strong>?</div>
            <input type="text" id="mrAns" autocomplete="off" spellcheck="false" placeholder="Type the capital">
            <div class="tb-actions">
              <button type="button" class="tb-btn" id="mrCheck">Check</button>
              <button type="button" class="tb-btn-sec" id="mrSkip">Skip</button>
              <button type="button" class="tb-btn-sec" id="mrShow">Show answer</button>
            </div>
            <div id="mrFb" class="mr-fb"></div>
          </div>
        `;
        $('mrAns').focus();
        $('mrAns').addEventListener('keydown', e => { if (e.key === 'Enter') check(); });
        $('mrCheck').addEventListener('click', check);
        $('mrSkip').addEventListener('click', startQuiz);
        $('mrShow').addEventListener('click', () => {
          $('mrFb').innerHTML = `<div class="mr-fb-ans">The answer is <strong>${esc(pairs[idx][1])}</strong>.</div>`;
        });
      };
      function check(){
        const guess = $('mrAns').value.trim().toLowerCase();
        const truth = pairs[idx][1].toLowerCase();
        const ok = guess === truth || truth.includes(guess) && guess.length >= 4;
        if (ok){
          $('mrFb').innerHTML = `<div class="mr-fb-ok">✓ Correct!</div>`;
          setTimeout(startQuiz, 700);
        } else {
          $('mrFb').innerHTML = `<div class="mr-fb-no">Not quite — answer: <strong>${esc(pairs[idx][1])}</strong></div>`;
        }
      }
      startQuiz();
    }
  }
  $('mrRegion').addEventListener('change', draw);
  body.querySelector('.tb-seg').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    body.querySelectorAll('.tb-seg button').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    mode = b.dataset.mode;
    draw();
  });
  draw();
}

function renderWorldHistoryMapTool(body){
  if (typeof window.renderWorldHistoryMap === 'function') window.renderWorldHistoryMap(body);
  else body.innerHTML = '<p class="tb-empty">World history map could not load. Refresh the app.</p>';
}

SUBJECTS.push({
  id:'history', label:'History', icon:'🏛',
  tools:[
    { id:'world-hist', label:'World history map', icon:'🌍', render: renderWorldHistoryMapTool },
    { id:'timeline',  label:'Timeline builder', icon:'🕰', render: renderTimelineBuilder },
    { id:'map-quiz',  label:'Map & capitals',   icon:'🗺', render: renderMapRef },
  ],
});

/* ================================================================
   ENGLISH / LANGUAGE ARTS
   ================================================================ */

const GRAMMAR = [
  { title:'Parts of speech', items:[
    ['Noun','Person, place, thing, or idea. <em>The cat slept.</em>'],
    ['Verb','Action or state of being. <em>She runs daily.</em>'],
    ['Adjective','Describes a noun. <em>A tall tree</em>'],
    ['Adverb','Describes verb/adj/adv; often -ly. <em>He ran quickly.</em>'],
    ['Pronoun','Replaces a noun: I, you, she, they, it, we, this, who.'],
    ['Preposition','Shows relationship: in, on, at, by, with, under.'],
    ['Conjunction','Connects: and, but, or, because, although, while.'],
    ['Interjection','Brief exclamation: Wow! Oh! Yikes!'],
  ]},
  { title:'Comma rules', items:[
    ['Series (Oxford)','Use commas to separate items in a list: <em>red, white, and blue</em>.'],
    ['Compound sentence','Use before a coordinating conjunction (FANBOYS) joining independent clauses: <em>She ran, but I walked.</em>'],
    ['Introductory element','After an introductory word/phrase/clause: <em>After class, we ate.</em>'],
    ['Non-essential clause','Around extra, non-essential info: <em>My brother, who lives in NY, called.</em>'],
    ['Direct address','Around names used in address: <em>Can you help, Sam?</em>'],
    ['Dates & addresses','<em>July 4, 1776, was a big day. Paris, France, is nice.</em>'],
  ]},
  { title:'Clause types', items:[
    ['Independent','Subject + verb, stands alone as a sentence.'],
    ['Dependent','Starts with a subordinator (because, although, when). Cannot stand alone.'],
    ['Simple','One independent clause.'],
    ['Compound','Two+ independent clauses joined by FANBOYS or semicolon.'],
    ['Complex','One independent + one or more dependent.'],
    ['Compound-complex','Compound sentence that also contains a dependent clause.'],
  ]},
  { title:'Common mistakes', items:[
    ['Your vs. You\'re','Your = possession. You\'re = "you are".'],
    ['Its vs. It\'s','Its = possession. It\'s = "it is".'],
    ['Their / There / They\'re','Their = possession. There = location. They\'re = they are.'],
    ['Affect vs. Effect','Affect = verb (influence). Effect = noun (result).'],
    ['Less vs. Fewer','Less for uncountables (water). Fewer for countables (items).'],
    ['Lie vs. Lay','You lie down. You lay something down.'],
    ['Who vs. Whom','Who = subject. Whom = object.'],
  ]},
];

function renderGrammar(body){
  body.innerHTML = `
    <div class="tb-card">
      <div class="tb-card-h"><h3>Grammar reference</h3></div>
      <div class="gr-sections">
        ${GRAMMAR.map(g => `
          <div class="gr-sec">
            <h4 class="gr-h">${esc(g.title)}</h4>
            <div class="gr-list">
              ${g.items.map(([t, d]) => `<div class="gr-item"><span class="gr-t">${esc(t)}</span><span class="gr-d">${d}</span></div>`).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderEssayGuide(body){
  const K = 'flux_essay_draft';
  const prev = JSON.parse(localStorage.getItem(K) || '{}');
  body.innerHTML = `
    <div class="tb-card">
      <div class="tb-card-h">
        <h3>Essay structure guide</h3>
        <div class="tb-actions">
          <button type="button" class="tb-btn-sec" id="esClear">Clear</button>
          <button type="button" class="tb-btn" id="esCopy">Copy outline</button>
        </div>
      </div>
      <p class="es-intro">Fill each field. The outline auto-builds as you go. Your draft is saved to this browser.</p>

      <div class="es-block">
        <label class="es-label">Introduction — Hook</label>
        <textarea class="es-ta" data-k="hook" rows="2" placeholder="Open with a striking fact, question, or anecdote.">${esc(prev.hook || '')}</textarea>
        <label class="es-label">Context (background / bridge)</label>
        <textarea class="es-ta" data-k="context" rows="2" placeholder="Why the reader should care; brief context of the topic.">${esc(prev.context || '')}</textarea>
        <label class="es-label">Thesis (one sentence — your argument)</label>
        <textarea class="es-ta" data-k="thesis" rows="2" placeholder="Clear, arguable claim that the rest of the essay will prove.">${esc(prev.thesis || '')}</textarea>
      </div>

      ${[1,2,3].map(i => `
        <div class="es-block">
          <label class="es-label">Body ${i} — Topic sentence</label>
          <textarea class="es-ta" data-k="b${i}topic" rows="2">${esc(prev['b'+i+'topic'] || '')}</textarea>
          <label class="es-label">Body ${i} — Evidence (quote / data / example)</label>
          <textarea class="es-ta" data-k="b${i}ev" rows="2">${esc(prev['b'+i+'ev'] || '')}</textarea>
          <label class="es-label">Body ${i} — Analysis (how the evidence supports thesis)</label>
          <textarea class="es-ta" data-k="b${i}an" rows="2">${esc(prev['b'+i+'an'] || '')}</textarea>
        </div>
      `).join('')}

      <div class="es-block">
        <label class="es-label">Counter-argument (and rebuttal)</label>
        <textarea class="es-ta" data-k="counter" rows="3">${esc(prev.counter || '')}</textarea>
        <label class="es-label">Conclusion — restate &amp; expand</label>
        <textarea class="es-ta" data-k="concl" rows="3">${esc(prev.concl || '')}</textarea>
      </div>

      <div class="es-preview">
        <h4>Compiled outline</h4>
        <div id="esOutline" class="es-outline"></div>
      </div>
    </div>
  `;
  function collect(){
    const data = {};
    body.querySelectorAll('.es-ta').forEach(t => data[t.dataset.k] = t.value.trim());
    localStorage.setItem(K, JSON.stringify(data));
    return data;
  }
  function outline(d){
    const lines = [
      d.hook && `HOOK: ${d.hook}`,
      d.context && `CONTEXT: ${d.context}`,
      d.thesis && `THESIS: ${d.thesis}`,
      '',
    ];
    [1,2,3].forEach(i => {
      const t = d['b'+i+'topic'], e = d['b'+i+'ev'], a = d['b'+i+'an'];
      if (t || e || a){
        lines.push(`BODY ${i}:`);
        if (t) lines.push('  Topic: ' + t);
        if (e) lines.push('  Evidence: ' + e);
        if (a) lines.push('  Analysis: ' + a);
        lines.push('');
      }
    });
    if (d.counter) lines.push(`COUNTER-ARG: ${d.counter}\n`);
    if (d.concl)   lines.push(`CONCLUSION: ${d.concl}`);
    return lines.join('\n');
  }
  function redraw(){
    const d = collect();
    $('esOutline').textContent = outline(d);
  }
  body.addEventListener('input', redraw);
  $('esClear').addEventListener('click', () => {
    if (!confirm('Clear all fields?')) return;
    body.querySelectorAll('.es-ta').forEach(t => t.value = '');
    localStorage.removeItem(K);
    redraw();
  });
  $('esCopy').addEventListener('click', () => {
    copyToClipboard(outline(collect()));
  });
  redraw();
}

// ── Citation builder (MLA 9 / APA 7 / Chicago 17) ───────────────
function renderCitationBuilder(body){
  body.innerHTML = `
    <div class="tb-card">
      <div class="tb-card-h">
        <h3>Citation builder</h3>
        <div class="tb-seg">
          <button type="button" class="active" data-style="MLA">MLA 9</button>
          <button type="button" data-style="APA">APA 7</button>
          <button type="button" data-style="Chicago">Chicago 17</button>
        </div>
      </div>
      <div class="cb-body">
        <label class="cb-lbl">Source type
          <select id="cbType">
            <option value="book">Book</option>
            <option value="journal">Journal article</option>
            <option value="web">Website / webpage</option>
            <option value="news">Newspaper / magazine</option>
          </select>
        </label>
        <div id="cbFields"></div>
        <div class="cb-out">
          <div class="cb-out-label">Citation</div>
          <div id="cbResult" class="cb-result"></div>
          <button type="button" class="tb-btn-sec" id="cbCopy">Copy</button>
        </div>
      </div>
    </div>
  `;
  let style = 'MLA';

  const FIELDS = {
    book: [
      ['lastName','Author last name'],
      ['firstName','Author first name'],
      ['title','Book title'],
      ['publisher','Publisher'],
      ['year','Year'],
      ['city','City (Chicago only)', true],
    ],
    journal: [
      ['lastName','Author last name'],
      ['firstName','Author first name'],
      ['title','Article title'],
      ['journal','Journal name'],
      ['vol','Volume'],
      ['issue','Issue'],
      ['year','Year'],
      ['pages','Pages (e.g., 12-34)'],
      ['doi','DOI (optional)'],
    ],
    web: [
      ['lastName','Author last name (optional)'],
      ['firstName','Author first name (optional)'],
      ['title','Page title'],
      ['site','Website name'],
      ['year','Year published'],
      ['accessed','Date accessed (MLA)'],
      ['url','URL'],
    ],
    news: [
      ['lastName','Author last name'],
      ['firstName','Author first name'],
      ['title','Article title'],
      ['publication','Newspaper/Magazine name'],
      ['year','Year'],
      ['date','Full date (e.g., March 3, 2024)'],
      ['url','URL (if online)'],
    ],
  };

  function drawFields(){
    const t = $('cbType').value;
    $('cbFields').innerHTML = FIELDS[t].map(([k, lbl]) => `
      <label class="cb-lbl"><span>${esc(lbl)}</span><input type="text" data-k="${k}" autocomplete="off"></label>
    `).join('');
  }
  function getVals(){
    const out = {};
    body.querySelectorAll('#cbFields [data-k]').forEach(i => out[i.dataset.k] = esc(i.value.trim()));
    return out;
  }
  function build(){
    const t = $('cbType').value;
    const v = getVals();
    let cit = '';
    if (style === 'MLA'){
      const author = v.lastName ? `${v.lastName}, ${v.firstName || ''}`.trim().replace(/,\s*$/,'') : '';
      if (t === 'book')    cit = `${author ? author + '. ' : ''}<em>${v.title}</em>. ${v.publisher || ''}${v.publisher ? ', ' : ''}${v.year || ''}.`;
      if (t === 'journal') cit = `${author ? author + '. ' : ''}"${v.title}." <em>${v.journal}</em>, vol. ${v.vol || ''}, no. ${v.issue || ''}, ${v.year || ''}, pp. ${v.pages || ''}${v.doi ? ', doi:' + v.doi : ''}.`;
      if (t === 'web')     cit = `${author ? author + '. ' : ''}"${v.title}." <em>${v.site}</em>, ${v.year || ''}${v.url ? ', ' + v.url : ''}${v.accessed ? '. Accessed ' + v.accessed : ''}.`;
      if (t === 'news')    cit = `${author ? author + '. ' : ''}"${v.title}." <em>${v.publication}</em>, ${v.date || v.year || ''}${v.url ? ', ' + v.url : ''}.`;
    } else if (style === 'APA'){
      const init = v.firstName ? v.firstName.split(/\s+/).map(s => s[0] + '.').join(' ') : '';
      const author = v.lastName ? `${v.lastName}, ${init}`.trim() : '';
      if (t === 'book')    cit = `${author ? author + ' ' : ''}(${v.year || 'n.d.'}). <em>${v.title}</em>. ${v.publisher || ''}.`;
      if (t === 'journal') cit = `${author ? author + ' ' : ''}(${v.year || 'n.d.'}). ${v.title}. <em>${v.journal}</em>, ${v.vol || ''}${v.issue ? '(' + v.issue + ')' : ''}, ${v.pages || ''}.${v.doi ? ' https://doi.org/' + v.doi : ''}`;
      if (t === 'web')     cit = `${author ? author + ' ' : ''}(${v.year || 'n.d.'}). ${v.title}. <em>${v.site}</em>.${v.url ? ' ' + v.url : ''}`;
      if (t === 'news')    cit = `${author ? author + ' ' : ''}(${v.date || v.year || 'n.d.'}). ${v.title}. <em>${v.publication}</em>.${v.url ? ' ' + v.url : ''}`;
    } else if (style === 'Chicago'){
      const author = v.lastName ? `${v.lastName}, ${v.firstName || ''}`.trim().replace(/,\s*$/,'') : '';
      if (t === 'book')    cit = `${author ? author + '. ' : ''}<em>${v.title}</em>. ${v.city ? v.city + ': ' : ''}${v.publisher || ''}, ${v.year || ''}.`;
      if (t === 'journal') cit = `${author ? author + '. ' : ''}"${v.title}." <em>${v.journal}</em> ${v.vol || ''}, no. ${v.issue || ''} (${v.year || ''}): ${v.pages || ''}.${v.doi ? ' https://doi.org/' + v.doi : ''}`;
      if (t === 'web')     cit = `${author ? author + '. ' : ''}"${v.title}." <em>${v.site}</em>, ${v.year || ''}.${v.url ? ' ' + v.url : ''}${v.accessed ? ' Accessed ' + v.accessed : ''}.`;
      if (t === 'news')    cit = `${author ? author + '. ' : ''}"${v.title}." <em>${v.publication}</em>, ${v.date || v.year || ''}.${v.url ? ' ' + v.url : ''}`;
    }
    $('cbResult').innerHTML = cit.trim();
  }

  body.querySelector('.tb-seg').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    body.querySelectorAll('.tb-seg button').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    style = b.dataset.style;
    build();
  });
  $('cbType').addEventListener('change', () => { drawFields(); build(); });
  body.addEventListener('input', build);
  $('cbCopy').addEventListener('click', () => copyToClipboard($('cbResult').textContent));
  drawFields(); build();
}

const LIT_DEVICES = [
  ['Metaphor','Direct comparison without like/as.','“All the world\'s a stage.”'],
  ['Simile','Comparison using like or as.','“Busy as a bee.”'],
  ['Personification','Giving human traits to non-human.','“The wind whispered.”'],
  ['Hyperbole','Extreme exaggeration for effect.','“I\'ve told you a million times.”'],
  ['Alliteration','Repeated consonant sounds at word starts.','“Peter Piper picked a peck.”'],
  ['Assonance','Repeated vowel sounds within words.','“The rain in Spain stays mainly…”'],
  ['Onomatopoeia','Word that sounds like what it means.','“Buzz, bang, hiss.”'],
  ['Irony','Contrast between expectation and reality.','A fire station burns down.'],
  ['Symbolism','An object stands for something larger.','A dove symbolizes peace.'],
  ['Imagery','Sensory language that paints a picture.','“The bitter coffee scalded his tongue.”'],
  ['Foreshadowing','Hints of events to come.','Act 1 dagger seen, used in Act 3.'],
  ['Allusion','Reference to another work or event.','“He had the patience of Job.”'],
  ['Oxymoron','Two contradictory terms together.','“Deafening silence.”'],
  ['Paradox','Self-contradictory but revealing statement.','“This sentence is false.”'],
  ['Juxtaposition','Placing contrasting things side by side.','Beauty and decay together.'],
  ['Anaphora','Repetition at the start of successive clauses.','“We shall fight on the beaches, we shall fight on the landing grounds…”'],
  ['Metonymy','Substituting an attribute for the whole.','“The crown decided…” (the monarchy)'],
  ['Synecdoche','Part stands for whole or vice versa.','“All hands on deck.”'],
  ['Motif','Recurring element with symbolic weight.','Light in <em>The Great Gatsby</em>.'],
  ['Tone','Author\'s attitude toward subject.','Sardonic, reverent, detached.'],
  ['Mood','Atmosphere the reader feels.','Ominous, nostalgic, uplifting.'],
  ['Euphemism','Mild term substituted for a harsh one.','“Passed away” for died.'],
];
function renderLitDevices(body){
  body.innerHTML = `
    <div class="tb-card">
      <div class="tb-card-h">
        <h3>Literary devices</h3>
        <input type="text" id="ldSearch" class="tb-input-narrow" placeholder="Filter…">
      </div>
      <div class="ld-grid" id="ldGrid"></div>
    </div>
  `;
  function draw(q){
    const s = (q || '').toLowerCase();
    $('ldGrid').innerHTML = LIT_DEVICES
      .filter(([n, d, e]) => !s || n.toLowerCase().includes(s) || d.toLowerCase().includes(s))
      .map(([n, d, e]) => `
        <div class="ld-card">
          <div class="ld-name">${esc(n)}</div>
          <div class="ld-def">${esc(d)}</div>
          <div class="ld-ex">${e}</div>
        </div>
      `).join('');
  }
  $('ldSearch').addEventListener('input', e => draw(e.target.value));
  draw('');
}

SUBJECTS.push({
  id:'english', label:'English', icon:'✒',
  tools:[
    { id:'grammar',   label:'Grammar ref',     icon:'📘', render: renderGrammar },
    { id:'essay',     label:'Essay guide',     icon:'🖊', render: renderEssayGuide },
    { id:'cite',      label:'Citation builder',icon:'❝ ❞', render: renderCitationBuilder },
    { id:'literary',  label:'Literary devices',icon:'📖', render: renderLitDevices },
  ],
});

/* ================================================================
   LANGUAGES
   ================================================================ */

// ── AI-powered conjugation ─────────────────────────────────────
const CJ_CACHE_KEY = 'flux_cj_ai_cache_v1';
const CJ_CACHE_MAX = 200;
function cjCacheGet(lang, verb){
  try {
    const c = JSON.parse(localStorage.getItem(CJ_CACHE_KEY) || '{}');
    return c[`${lang}:${verb}`] || null;
  } catch { return null; }
}
function cjCacheSet(lang, verb, data){
  try {
    const c = JSON.parse(localStorage.getItem(CJ_CACHE_KEY) || '{}');
    c[`${lang}:${verb}`] = { ...data, _at: Date.now() };
    const keys = Object.keys(c);
    if (keys.length > CJ_CACHE_MAX){
      keys.sort((a,b) => (c[a]._at||0) - (c[b]._at||0))
          .slice(0, keys.length - CJ_CACHE_MAX)
          .forEach(k => delete c[k]);
    }
    localStorage.setItem(CJ_CACHE_KEY, JSON.stringify(c));
  } catch {}
}

// Popular verbs surfaced as quick chips for each language.
const CJ_POPULAR = {
  es: ['ser','estar','tener','hacer','ir','decir','poder','querer','saber','ver','dar','poner','venir','salir','jugar','pensar','dormir','pedir'],
  fr: ['être','avoir','aller','faire','dire','pouvoir','vouloir','savoir','voir','venir','prendre','mettre','devoir','sortir','finir','aimer','manger','connaître'],
};

const CJ_TENSE_ORDER = {
  es: ['present','preterite','imperfect','future','conditional','present_subjunctive','imperative'],
  fr: ['present','imparfait','passe_simple','futur','conditionnel','subjonctif_present','imperatif'],
};
const CJ_TENSE_LABEL = {
  es: { present:'Presente', preterite:'Pretérito', imperfect:'Imperfecto', future:'Futuro', conditional:'Condicional', present_subjunctive:'Pres. subjuntivo', imperative:'Imperativo' },
  fr: { present:'Présent', imparfait:'Imparfait', passe_simple:'Passé simple', futur:'Futur simple', conditionnel:'Conditionnel', subjonctif_present:'Subj. présent', imperatif:'Impératif' },
};
const CJ_PRONOUN_ORDER = {
  es: ['yo','tu','el','nosotros','vosotros','ellos'],
  fr: ['je','tu','il','nous','vous','ils'],
};
const CJ_PRONOUN_LABEL = {
  es: { yo:'yo', tu:'tú', el:'él/ella/Ud.', nosotros:'nosotros', vosotros:'vosotros', ellos:'ellos/Uds.' },
  fr: { je:'je', tu:'tu', il:'il/elle', nous:'nous', vous:'vous', ils:'ils/elles' },
};
const CJ_IMPERATIVE_KEYS = {
  es: ['tu','usted','nosotros','vosotros','ustedes'],
  fr: ['tu','nous','vous'],
};
const CJ_IMPERATIVE_LABEL = {
  es: { tu:'tú', usted:'Ud.', nosotros:'nosotros', vosotros:'vosotros', ustedes:'Uds.' },
  fr: { tu:'tu', nous:'nous', vous:'vous' },
};

async function conjugateWithAI(lang, verb){
  const cached = cjCacheGet(lang, verb.toLowerCase());
  if (cached) return cached;

  if (typeof API === 'undefined' || !API.ai || typeof API_HEADERS === 'undefined'){
    throw new Error('AI unavailable — check your connection and try again.');
  }

  const isEs = lang === 'es';
  const langName = isEs ? 'Spanish' : 'French';
  const pronounsLine = isEs
    ? '"yo", "tu", "el", "nosotros", "vosotros", "ellos" (keys are ASCII; el covers él/ella/usted; ellos covers ellos/ellas/ustedes)'
    : '"je", "tu", "il", "nous", "vous", "ils" (keys are ASCII; il covers il/elle; ils covers ils/elles)';
  const tenseList = isEs
    ? '"present","preterite","imperfect","future","conditional","present_subjunctive","imperative"'
    : '"present","imparfait","passe_simple","futur","conditionnel","subjonctif_present","imperatif"';
  const imperativePronouns = isEs
    ? '"tu","usted","nosotros","vosotros","ustedes"'
    : '"tu","nous","vous"';

  const system = `You are a world-class ${langName} linguist and verb-conjugation expert. Given any input (infinitive, conjugated form, or mild typo), identify the correct infinitive and return the complete standard conjugation as strict JSON. Handle every irregular pattern correctly: stem changes (e→ie, o→ue, e→i, u→ue), yo-go verbs, orthographic changes (c→qu, g→gu, z→c, c→z), preterite-irregulars, spelling-change verbs, and defective verbs. Accent marks are always required.`;

  const user = `Conjugate the ${langName} verb input: "${verb}"

Return ONLY a valid JSON object, no markdown, no backticks, no prose. Exact shape:

{
  "verb": "<correct infinitive; fix spelling if needed>",
  "meaning": "<1–5 word English gloss>",
  "irregular": <true|false>,
  "group": "<-ar|-er|-ir|-re|reflexive|other>",
  "notes": "<one sentence about irregularities or stem changes; empty string if fully regular>",
  "tenses": {
    <each of ${tenseList} as a key, each mapping to an object with pronoun keys>
  }
}

Pronoun keys for non-imperative tenses: ${pronounsLine}.
Pronoun keys for imperative only: ${imperativePronouns}.

Every pronoun for every tense must be present. Use "—" for any genuinely defective slot. Accent marks (é, á, ñ, ç, è, ê, î, etc.) MUST be correct. If the input is clearly not a real ${langName} verb even after typo correction, return exactly {"error":"not_a_verb"}.`;

  const res = await fetch(API.ai, {
    method: 'POST',
    headers: API_HEADERS,
    body: JSON.stringify({ system, messages: [{ role:'user', content: user }] }),
  });
  if (!res.ok) throw new Error('AI error ' + res.status);
  const data = await res.json();
  let txt = (data.content?.[0]?.text || '').replace(/```json|```/g, '').trim();
  const s = txt.indexOf('{'), e = txt.lastIndexOf('}');
  if (s === -1 || e === -1) throw new Error('AI response not JSON — try again.');
  let parsed;
  try { parsed = JSON.parse(txt.slice(s, e + 1)); }
  catch { throw new Error('Could not parse conjugation — try again.'); }
  if (parsed && parsed.error === 'not_a_verb') throw new Error(`"${verb}" isn't a recognised ${langName} verb. Check spelling?`);
  if (!parsed.tenses || typeof parsed.tenses !== 'object') throw new Error('Incomplete conjugation — try again.');

  cjCacheSet(lang, verb.toLowerCase(), parsed);
  // Also cache under the corrected infinitive if the user typed something else.
  if (parsed.verb && parsed.verb.toLowerCase() !== verb.toLowerCase()){
    cjCacheSet(lang, parsed.verb.toLowerCase(), parsed);
  }
  return parsed;
}

function renderConjTable(lang, data){
  const order = CJ_TENSE_ORDER[lang];
  const label = CJ_TENSE_LABEL[lang];
  const pOrder = CJ_PRONOUN_ORDER[lang];
  const pLabel = CJ_PRONOUN_LABEL[lang];
  const impKeys = CJ_IMPERATIVE_KEYS[lang];
  const impLabel = CJ_IMPERATIVE_LABEL[lang];

  const blocks = order.map(tKey => {
    const forms = data.tenses[tKey] || {};
    const keys = /imperativ|imperative/.test(tKey) ? impKeys : pOrder;
    const labels = /imperativ|imperative/.test(tKey) ? impLabel : pLabel;
    return `
      <div class="cj-tense">
        <h5>${esc(label[tKey] || tKey)}</h5>
        <div class="cj-grid">
          ${keys.map(k => `<div class="cj-row"><span class="cj-p">${esc(labels[k] || k)}</span><span class="cj-f">${esc(forms[k] ?? '—')}</span></div>`).join('')}
        </div>
      </div>
    `;
  }).join('');

  const irregPill = data.irregular
    ? '<span class="cj-chip cj-chip--irreg">irregular</span>'
    : '<span class="cj-chip cj-chip--reg">regular</span>';
  const groupPill = data.group ? `<span class="cj-chip">${esc(data.group)}</span>` : '';

  return `
    <div class="cj-result">
      <div class="cj-head">
        <div class="cj-head-l">
          <h4>${esc(data.verb || '')}</h4>
          <span class="cj-meaning">${esc(data.meaning || '')}</span>
        </div>
        <div class="cj-head-r">${irregPill}${groupPill}</div>
      </div>
      ${data.notes ? `<p class="cj-notes">${esc(data.notes)}</p>` : ''}
      <div class="cj-tenses-grid">${blocks}</div>
      <p class="cj-note">Generated by Flux AI · cached locally so repeats are instant.</p>
    </div>
  `;
}

function renderConjugation(body){
  body.innerHTML = `
    <div class="tb-card">
      <div class="tb-card-h">
        <h3>Verb conjugation</h3>
        <div class="tb-seg">
          <button type="button" class="active" data-lang="es">Español</button>
          <button type="button" data-lang="fr">Français</button>
        </div>
      </div>
      <p class="tb-sub" style="margin:0 0 10px">Type any verb — infinitive or conjugated form. Flux AI returns all major tenses including irregulars.</p>
      <div class="cj-input-row">
        <input type="text" id="cjInput" class="cj-input" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="e.g. hablar, tener, decir">
        <button type="button" class="tb-btn" id="cjGo">Conjugate</button>
      </div>
      <div class="cj-quick" id="cjQuick"></div>
      <div id="cjOut" class="cj-out"></div>
    </div>
  `;

  let lang = 'es';
  const inputEl = $('cjInput');
  const quickEl = $('cjQuick');
  const outEl = $('cjOut');

  function updatePlaceholder(){
    inputEl.placeholder = lang === 'es'
      ? 'e.g. hablar, tener, decir, pedir…'
      : 'e.g. être, avoir, aller, courir…';
  }

  function populateQuick(){
    quickEl.innerHTML = `<span class="cj-quick-label">Popular:</span>` +
      CJ_POPULAR[lang].map(v => `<button type="button" class="tb-chip" data-v="${esc(v)}">${esc(v)}</button>`).join('');
  }

  function showIdle(){
    outEl.innerHTML = `<div class="tb-empty">Type a ${lang === 'es' ? 'Spanish' : 'French'} verb above — Flux AI handles regulars <em>and</em> every irregular.</div>`;
  }

  function showLoading(v){
    outEl.innerHTML = `
      <div class="cj-loading">
        <span class="cj-spinner" aria-hidden="true"></span>
        <span>Flux AI is conjugating <strong>${esc(v)}</strong>…</span>
      </div>
    `;
  }

  function showError(msg){
    outEl.innerHTML = `<div class="cj-error">${esc(msg)}</div>`;
  }

  async function run(v){
    const verb = (v || '').trim().toLowerCase();
    if (!verb){ inputEl.focus(); return; }
    showLoading(verb);
    try {
      const data = await conjugateWithAI(lang, verb);
      outEl.innerHTML = renderConjTable(lang, data);
    } catch (err){
      showError(err?.message || 'Could not conjugate.');
    }
  }

  body.querySelector('.tb-seg').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    body.querySelectorAll('.tb-seg button').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    lang = b.dataset.lang;
    updatePlaceholder();
    populateQuick();
    showIdle();
    inputEl.value = '';
  });

  $('cjGo').addEventListener('click', () => run(inputEl.value));
  inputEl.addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); run(inputEl.value); }});
  quickEl.addEventListener('click', e => {
    const b = e.target.closest('button[data-v]');
    if (!b) return;
    inputEl.value = b.dataset.v;
    run(b.dataset.v);
  });

  updatePlaceholder();
  populateQuick();
  showIdle();
  setTimeout(() => inputEl.focus(), 50);
}

// ── IPA chart (simplified pulmonic consonants + vowels) ─────────
const IPA_CONS = {
  places: ['Bilabial','Labiodental','Dental','Alveolar','Postalveolar','Palatal','Velar','Uvular','Pharyngeal','Glottal'],
  manners: ['Plosive','Nasal','Trill','Tap/Flap','Fricative','Approximant','Lateral approx.'],
  // rows aligned to manners; null = no consonant
  // entries shown as "voiceless voiced" pair; '—' for empty
  data: {
    'Plosive':       ['p b','—','—','t d','—','c ɟ','k ɡ','q ɢ','—','ʔ —'],
    'Nasal':         ['— m','— ɱ','—','— n','—','— ɲ','— ŋ','— ɴ','—','—'],
    'Trill':         ['— ʙ','—','—','— r','—','—','—','— ʀ','—','—'],
    'Tap/Flap':      ['—','— ⱱ','—','— ɾ','—','—','—','—','—','—'],
    'Fricative':     ['ɸ β','f v','θ ð','s z','ʃ ʒ','ç ʝ','x ɣ','χ ʁ','ħ ʕ','h ɦ'],
    'Approximant':   ['—','— ʋ','—','— ɹ','—','— j','— ɰ','—','—','—'],
    'Lateral approx.':['—','—','—','— l','—','— ʎ','— ʟ','—','—','—'],
  },
};
const IPA_VOWELS = [
  // height × front/central/back
  ['Close',      ['i y','ɨ ʉ','ɯ u']],
  ['Near-close', ['ɪ ʏ','—','ʊ']],
  ['Close-mid',  ['e ø','ɘ ɵ','ɤ o']],
  ['Mid',        ['—','ə','—']],
  ['Open-mid',   ['ɛ œ','ɜ ɞ','ʌ ɔ']],
  ['Near-open',  ['æ','ɐ','—']],
  ['Open',       ['a ɶ','—','ɑ ɒ']],
];

function renderIPA(body){
  body.innerHTML = `
    <div class="tb-card">
      <div class="tb-card-h"><h3>IPA phonetic chart</h3></div>
      <p class="ipa-note">Pulmonic consonants — each cell pairs voiceless / voiced.</p>
      <div class="ipa-scroll">
        <table class="ipa-table">
          <thead>
            <tr><th></th>${IPA_CONS.places.map(p => `<th>${esc(p)}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${IPA_CONS.manners.map(m => `
              <tr><th>${esc(m)}</th>${(IPA_CONS.data[m] || []).map(cell => `<td>${esc(cell)}</td>`).join('')}</tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <h4 class="ipa-h">Vowels — front · central · back</h4>
      <div class="ipa-vowels">
        ${IPA_VOWELS.map(([h, row]) => `
          <div class="ipa-v-row"><span class="ipa-v-h">${esc(h)}</span>${row.map(c => `<span class="ipa-v-cell">${esc(c)}</span>`).join('')}</div>
        `).join('')}
      </div>
    </div>
  `;
}

// ── AI Translation helper — pipes prompt into the AI tab ────────
const LANGS_TR = [
  'Spanish','French','German','Italian','Portuguese','Dutch','Polish','Russian','Ukrainian',
  'Chinese (Simplified)','Chinese (Traditional)','Japanese','Korean','Vietnamese','Thai',
  'Arabic','Hebrew','Turkish','Hindi','Bengali','Urdu','Persian',
  'Greek','Swedish','Norwegian','Danish','Finnish',
  'English',
];
function renderTranslate(body){
  body.innerHTML = `
    <div class="tb-card">
      <div class="tb-card-h"><h3>Translation helper</h3>
        <span class="tb-sub">Powered by Flux AI · routes to the AI tab</span>
      </div>
      <div class="tr-langs">
        <label>From
          <select id="trFrom">
            ${LANGS_TR.map(l => `<option ${l === 'English' ? 'selected' : ''}>${esc(l)}</option>`).join('')}
          </select>
        </label>
        <button type="button" class="tr-swap" id="trSwap" title="Swap">⇄</button>
        <label>To
          <select id="trTo">
            ${LANGS_TR.map(l => `<option ${l === 'Spanish' ? 'selected' : ''}>${esc(l)}</option>`).join('')}
          </select>
        </label>
      </div>
      <textarea id="trText" rows="4" placeholder="Enter text to translate…"></textarea>
      <div class="tb-actions">
        <button type="button" class="tb-btn" id="trGo">Translate with Flux AI</button>
        <button type="button" class="tb-btn-sec" id="trLiteral">Also explain literal meaning</button>
      </div>
      <div class="tr-tips">
        <h4>Phrase quick-fills</h4>
        <div class="tr-chips">
          ${['Hello, how are you?','Where is the library?','Can you help me?','I don\'t understand.','Thank you very much.','What does this word mean?']
            .map(p => `<button type="button" class="tb-chip" data-p="${esc(p)}">${esc(p)}</button>`).join('')}
        </div>
      </div>
    </div>
  `;
  $('trSwap').addEventListener('click', () => {
    const a = $('trFrom').value, b = $('trTo').value;
    $('trFrom').value = b; $('trTo').value = a;
  });
  body.querySelectorAll('.tr-chips .tb-chip').forEach(b => b.addEventListener('click', () => {
    $('trText').value = b.dataset.p;
  }));
  function sendAI(extra=''){
    const txt = $('trText').value.trim();
    if (!txt){ $('trText').focus(); return; }
    const from = $('trFrom').value, to = $('trTo').value;
    const prompt = `Translate the following from ${from} to ${to}. Provide: (1) a natural translation, (2) a more literal word-by-word version${extra ? ', (3) ' + extra : ''}.\n\n"${txt}"`;
    try {
      if (typeof nav === 'function') nav('ai');
      setTimeout(() => {
        const inp = document.getElementById('aiInput');
        if (inp){ inp.value = prompt; inp.focus(); }
      }, 200);
    } catch(e){ /* fallback: copy */ copyToClipboard(prompt); }
  }
  $('trGo').addEventListener('click', () => sendAI());
  $('trLiteral').addEventListener('click', () => sendAI('a short usage note with 1–2 example sentences'));
}

/* ================================================================
   MUSIC — dimensions / metadimensions (study reference)
   ================================================================ */
const DP_MUSIC_INNER_RING = ['Timbre', 'Melody', 'Harmony', 'Dynamics', 'Articulation', 'Texture', 'Meter', 'Tempo', 'Form'];
const DP_MUSIC_META_RING = ['Style', 'Architecture', 'Affective qualities', 'Sense of ensemble', 'Personal context', 'Cultural context', 'Historical context', 'Sense of simultaneity', 'Genre'];
const DP_MUSIC_DIMENSIONS_ALL = ['Pitch', 'Rhythm', 'Timbre', 'Melody', 'Harmony', 'Dynamics', 'Form', 'Tempo', 'Meter', 'Texture', 'Articulation'];

function renderDpMusicDimensions(body){
  const uid = 'dp' + Math.random().toString(36).slice(2, 9);
  const cx = 220;
  const cy = 220;
  const innerRing = DP_MUSIC_INNER_RING;
  const metaRing = DP_MUSIC_META_RING;

  function placeBubbles(labels, r, phaseDeg, kind){
    const n = labels.length;
    const step = 360 / n;
    const mult = kind === 'meta' ? 5.05 : 5.45;
    const maxW = kind === 'meta' ? 118 : 108;
    const minW = 44;
    return labels.map((label, i) => {
      const deg = phaseDeg + i * step;
      const rad = (deg * Math.PI) / 180;
      const x = cx + r * Math.cos(rad);
      const y = cy + r * Math.sin(rad);
      const tw = Math.min(maxW, Math.max(minW, label.length * mult));
      const th = label.length > 22 ? 32 : 22;
      const rx = Math.min(12, th / 2);
      const cls = kind === 'meta' ? 'dp-music-bubble dp-music-bubble--meta' : 'dp-music-bubble dp-music-bubble--dim';
      const x0 = (-tw / 2).toFixed(1);
      const y0 = (-th / 2).toFixed(1);
      return `<g class="${cls}" transform="translate(${x.toFixed(2)},${y.toFixed(2)})">
        <rect class="dp-music-bubble__pill" x="${x0}" y="${y0}" width="${tw.toFixed(1)}" height="${th}" rx="${rx}"/>
        <text class="dp-music-bubble__text" text-anchor="middle" dominant-baseline="central">${esc(label)}</text>
      </g>`;
    }).join('');
  }

  const metaPhase = -90 + (360 / metaRing.length) / 2;
  const innerPhase = metaPhase + 180 / metaRing.length;

  body.innerHTML = `
    <div class="tb-card tb-dp-music">
      <div class="tb-card-h tb-dp-music__head">
        <div>
          <h3 class="tb-dp-music__title">Dimensions &amp; metadimensions</h3>
          <p class="tb-sub tb-dp-music__lede">Classic listening framework: <b>dimensions</b> describe the sound itself; <b>metadimensions</b> describe context, culture, and meaning. Use <b>Quick chart</b> for a flat checklist.</p>
        </div>
      </div>
      <div class="dp-music-diagram-wrap">
        <svg class="dp-music-svg" viewBox="0 0 440 440" role="img" aria-labelledby="${uid}-ttl ${uid}-dsc">
            <title id="${uid}-ttl">Music dimensions and metadimensions</title>
            <desc id="${uid}-dsc">Concentric diagram: outer metadimension labels, inner dimension labels, pitch and rhythm at the center.</desc>
            <defs>
              <radialGradient id="${uid}-glow" cx="50%" cy="42%" r="65%">
                <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.18"/>
                <stop offset="55%" stop-color="var(--accent)" stop-opacity="0.05"/>
                <stop offset="100%" stop-color="transparent"/>
              </radialGradient>
              <linearGradient id="${uid}-meta" x1="12%" y1="8%" x2="88%" y2="92%">
                <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.15"/>
                <stop offset="50%" stop-color="rgba(var(--purple-rgb), 0.1)"/>
                <stop offset="100%" stop-color="var(--accent)" stop-opacity="0.05"/>
              </linearGradient>
              <linearGradient id="${uid}-dim" x1="50%" y1="0%" x2="50%" y2="100%">
                <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.2"/>
                <stop offset="100%" stop-color="var(--accent)" stop-opacity="0.06"/>
              </linearGradient>
              <linearGradient id="${uid}-core" x1="35%" y1="0%" x2="65%" y2="100%">
                <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.24"/>
                <stop offset="100%" stop-color="rgba(var(--purple-rgb), 0.12)"/>
              </linearGradient>
            </defs>
            <circle class="dp-music-svg__plate" cx="${cx}" cy="${cy}" r="218"/>
            <circle cx="${cx}" cy="${cy}" r="216" fill="url(#${uid}-glow)" opacity="0.9"/>
            <circle cx="${cx}" cy="${cy}" r="214" fill="url(#${uid}-meta)" stroke="rgba(0,0,0,0.14)" stroke-width="1" class="dp-music-svg__stroke"/>
            <circle cx="${cx}" cy="${cy}" r="170" fill="var(--card)" stroke="rgba(var(--accent-rgb), 0.18)" stroke-width="1"/>
            <circle cx="${cx}" cy="${cy}" r="168" fill="url(#${uid}-dim)" stroke="rgba(0,0,0,0.1)" stroke-width="1" class="dp-music-svg__stroke"/>
            <circle cx="${cx}" cy="${cy}" r="56" fill="url(#${uid}-core)" stroke="rgba(var(--accent-rgb), 0.35)" stroke-width="1" class="dp-music-core-ring"/>
            <text class="dp-music-svg__band" x="${cx}" y="36" text-anchor="middle">Metadimensions</text>
            <text class="dp-music-svg__band dp-music-svg__band--inner" x="${cx}" y="92" text-anchor="middle">Dimensions</text>
            ${placeBubbles(metaRing, 192, metaPhase, 'meta')}
            ${placeBubbles(innerRing, 128, innerPhase, 'dim')}
            <text class="dp-music-svg__core" x="${cx}" y="${cy - 7}" text-anchor="middle">Pitch</text>
          <text class="dp-music-svg__core" x="${cx}" y="${cy + 15}" text-anchor="middle">Rhythm</text>
        </svg>
      </div>
    </div>`;
}

function renderDpMusicChart(body){
  const chartDim = DP_MUSIC_DIMENSIONS_ALL.map(d => `<tr><td><span class="dp-music-chart__dot dp-music-chart__dot--dim"></span></td><td>${esc(d)}</td></tr>`).join('');
  const chartMeta = DP_MUSIC_META_RING.map(d => `<tr><td><span class="dp-music-chart__dot dp-music-chart__dot--meta"></span></td><td>${esc(d)}</td></tr>`).join('');
  body.innerHTML = `
    <div class="tb-card tb-dp-music tb-dp-music--charttool">
      <div class="tb-card-h tb-dp-music__head">
        <div>
          <h3 class="tb-dp-music__title">Quick chart</h3>
          <p class="tb-sub tb-dp-music__lede">Same framework as the <b>ring diagram</b> — a scannable list for listening notes or essays.</p>
        </div>
      </div>
      <div class="dp-music-chart-page">
        <div class="dp-music-chart-grid">
          <div class="dp-music-chart-block">
            <h4 class="dp-music-chart-block__h">Dimensions</h4>
            <p class="dp-music-chart-block__sub">Sound &amp; structure</p>
            <div class="dp-music-chart__scroll">
              <table class="dp-music-chart__tbl">${chartDim}</table>
            </div>
          </div>
          <div class="dp-music-chart-block dp-music-chart-block--meta">
            <h4 class="dp-music-chart-block__h">Metadimensions</h4>
            <p class="dp-music-chart-block__sub">Context &amp; meaning</p>
            <div class="dp-music-chart__scroll">
              <table class="dp-music-chart__tbl">${chartMeta}</table>
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

SUBJECTS.push({
  id:'music', label:'Music', icon:'🎵',
  tools:[
    { id:'dp-dimensions', label:'Ring diagram', icon:'◎', render: renderDpMusicDimensions },
    { id:'dp-chart', label:'Quick chart', icon:'📊', render: renderDpMusicChart },
  ],
});

SUBJECTS.push({
  id:'languages', label:'Languages', icon:'🌍',
  tools:[
    { id:'conj',     label:'Conjugation', icon:'🗣', render: renderConjugation },
    { id:'ipa',      label:'IPA chart',   icon:'Ƃ', render: renderIPA },
    { id:'translate',label:'Translate',   icon:'🔁', render: renderTranslate },
  ],
});

/* ================================================================
   ECONOMICS / BUSINESS
   ================================================================ */

const ECON_FORMULAS = [
  { title:'Demand & Supply', items:[
    { f:'Qd = a − bP',      vars:['linear demand'] },
    { f:'Qs = c + dP',      vars:['linear supply'] },
    { f:'Equilibrium: Qd = Qs', vars:[] },
    { f:'E_d = %ΔQ / %ΔP',  vars:['price elasticity of demand'] },
    { f:'E_i = %ΔQ / %ΔY',  vars:['income elasticity'] },
    { f:'E_x = %ΔQ_A / %ΔP_B', vars:['cross-price elasticity'] },
  ]},
  { title:'Macroeconomics', items:[
    { f:'GDP = C + I + G + NX', vars:['expenditure approach'] },
    { f:'CPI = (cost of basket this yr / cost of basket base yr) × 100', vars:[] },
    { f:'Inflation rate = (CPI_t − CPI_{t-1}) / CPI_{t-1} × 100%', vars:[] },
    { f:'Real = Nominal − Inflation', vars:['approximate Fisher'] },
    { f:'(1 + i) = (1 + r)(1 + π)', vars:['exact Fisher equation'] },
    { f:'u = unemployed / labor force × 100%', vars:['unemployment rate'] },
  ]},
  { title:'Micro & Firm', items:[
    { f:'TR = P × Q',              vars:['total revenue'] },
    { f:'MR = dTR/dQ',             vars:['marginal revenue'] },
    { f:'MC = dTC/dQ',             vars:['marginal cost'] },
    { f:'Profit max: MR = MC',     vars:[] },
    { f:'ATC = TC/Q = AFC + AVC',  vars:['average total cost'] },
    { f:'Break-even: P = ATC',     vars:[] },
    { f:'Shutdown: P < AVC (short run)', vars:[] },
  ]},
  { title:'Finance', items:[
    { f:'FV = PV · (1 + r)ⁿ',       vars:['compound interest, annual'] },
    { f:'FV = PV · (1 + r/m)^(mn)', vars:['compounded m times/yr'] },
    { f:'A = P · (1 + r/n)^(nt)',   vars:['compound interest standard form'] },
    { f:'PV = FV / (1 + r)ⁿ',       vars:['present value'] },
    { f:'PMT = P · (r(1+r)ⁿ) / ((1+r)ⁿ − 1)', vars:['loan payment'] },
    { f:'NPV = Σ (CF_t / (1+r)^t)', vars:['net present value'] },
  ]},
];
function renderEconFormulas(body){
  body.innerHTML = `
    <div class="tb-card">
      <div class="tb-card-h"><h3>Economics formula sheet</h3></div>
      <div class="fs-body">
        ${ECON_FORMULAS.map(c => `
          <div class="fs-cat">
            <div class="fs-cat-h">${esc(c.title)}</div>
            <div class="fs-items">
              ${c.items.map(it => `
                <div class="fs-item">
                  <div class="fs-f"><code>${esc(it.f)}</code></div>
                  ${it.vars.length ? `<div class="fs-v">${it.vars.map(v => esc(v)).join(' · ')}</div>` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderFinCalc(body){
  body.innerHTML = `
    <div class="tb-card">
      <div class="tb-card-h">
        <h3>Financial calculator</h3>
        <div class="tb-seg">
          <button type="button" class="active" data-m="ci">Compound interest</button>
          <button type="button" data-m="loan">Loan payment</button>
          <button type="button" data-m="goal">Savings goal</button>
        </div>
      </div>
      <div id="fcBody"></div>
    </div>
  `;
  let mode = 'ci';
  function drawCI(){
    $('fcBody').innerHTML = `
      <div class="fc-grid">
        <label>Principal (P)        <input type="number" id="ciP"  value="1000" step="any"></label>
        <label>Annual rate (r, %)   <input type="number" id="ciR"  value="5"    step="any"></label>
        <label>Compounds/year (n)   <input type="number" id="ciN"  value="12"   min="1" step="1"></label>
        <label>Years (t)            <input type="number" id="ciT"  value="10"   step="any"></label>
        <label>Monthly contribution <input type="number" id="ciC"  value="0"    step="any"></label>
      </div>
      <div id="ciOut" class="fc-out"></div>
    `;
    function calc(){
      const P = +$('ciP').value, r = +$('ciR').value/100, n = +$('ciN').value, t = +$('ciT').value;
      const C = +$('ciC').value || 0;
      const m = t * n;
      const base = P * Math.pow(1 + r/n, m);
      // Contribution assumed monthly regardless of n; convert to periodic via monthly rate
      const rm = r / 12;
      const contribMonths = Math.round(t * 12);
      const contribFV = rm > 0 ? C * ((Math.pow(1 + rm, contribMonths) - 1) / rm) : C * contribMonths;
      const total = base + contribFV;
      const contributed = P + C * contribMonths;
      const interest = total - contributed;
      $('ciOut').innerHTML = `
        <div class="fc-card">
          <div><span>Future value</span><strong>${money(total)}</strong></div>
          <div><span>Total contributed</span><strong>${money(contributed)}</strong></div>
          <div><span>Interest earned</span><strong>${money(interest)}</strong></div>
        </div>
      `;
    }
    body.addEventListener('input', calc);
    calc();
  }
  function drawLoan(){
    $('fcBody').innerHTML = `
      <div class="fc-grid">
        <label>Loan amount (P)    <input type="number" id="loP" value="250000" step="any"></label>
        <label>Annual rate (r, %) <input type="number" id="loR" value="6.5" step="any"></label>
        <label>Term (years)       <input type="number" id="loT" value="30" step="any"></label>
      </div>
      <div id="loOut" class="fc-out"></div>
    `;
    function calc(){
      const P = +$('loP').value, r = +$('loR').value/100/12, n = +$('loT').value * 12;
      const pmt = r > 0 ? P * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1) : P / n;
      const total = pmt * n;
      const interest = total - P;
      $('loOut').innerHTML = `
        <div class="fc-card">
          <div><span>Monthly payment</span><strong>${money(pmt)}</strong></div>
          <div><span>Total paid</span><strong>${money(total)}</strong></div>
          <div><span>Total interest</span><strong>${money(interest)}</strong></div>
        </div>
      `;
    }
    body.addEventListener('input', calc);
    calc();
  }
  function drawGoal(){
    $('fcBody').innerHTML = `
      <div class="fc-grid">
        <label>Target amount           <input type="number" id="gT"  value="50000" step="any"></label>
        <label>Years to goal            <input type="number" id="gY"  value="10"    step="any"></label>
        <label>Expected annual return (%) <input type="number" id="gR" value="7"    step="any"></label>
        <label>Starting balance         <input type="number" id="gS" value="0"      step="any"></label>
      </div>
      <div id="gOut" class="fc-out"></div>
    `;
    function calc(){
      const T = +$('gT').value, y = +$('gY').value, r = +$('gR').value / 100, S = +$('gS').value;
      const months = Math.max(1, Math.round(y * 12));
      const rm = r / 12;
      const futureStart = S * Math.pow(1 + rm, months);
      const required = T - futureStart;
      const denom = rm > 0 ? ((Math.pow(1 + rm, months) - 1) / rm) : months;
      const monthly = required / denom;
      $('gOut').innerHTML = `
        <div class="fc-card">
          <div><span>Monthly contribution needed</span><strong>${money(Math.max(monthly, 0))}</strong></div>
          <div><span>Starting balance grows to</span><strong>${money(futureStart)}</strong></div>
          <div><span>Amount still needed</span><strong>${money(Math.max(required, 0))}</strong></div>
        </div>
      `;
    }
    body.addEventListener('input', calc);
    calc();
  }
  function money(n){
    if (!isFinite(n)) return '—';
    return n.toLocaleString('en-US', { style:'currency', currency:'USD', maximumFractionDigits:2 });
  }
  body.querySelector('.tb-seg').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    body.querySelectorAll('.tb-seg button').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    mode = b.dataset.m;
    if (mode === 'ci') drawCI();
    if (mode === 'loan') drawLoan();
    if (mode === 'goal') drawGoal();
  });
  drawCI();
}

SUBJECTS.push({
  id:'econ', label:'Economics', icon:'💹',
  tools:[
    { id:'econ-formulas', label:'Formula sheet', icon:'Σ', render: renderEconFormulas },
    { id:'fin-calc',      label:'Financial calc', icon:'🧮', render: renderFinCalc },
  ],
});

/* ================================================================
   COMPUTER SCIENCE
   ================================================================ */

// ── ASCII / Unicode reference ───────────────────────────────────
const ASCII_CONTROL = {
  0:['NUL','Null'],1:['SOH','Start of heading'],2:['STX','Start of text'],3:['ETX','End of text'],
  4:['EOT','End of transmission'],5:['ENQ','Enquiry'],6:['ACK','Acknowledge'],7:['BEL','Bell (\\a)'],
  8:['BS','Backspace (\\b)'],9:['HT','Horizontal tab (\\t)'],10:['LF','Line feed (\\n)'],
  11:['VT','Vertical tab'],12:['FF','Form feed'],13:['CR','Carriage return (\\r)'],
  14:['SO','Shift out'],15:['SI','Shift in'],16:['DLE','Data link escape'],17:['DC1','Device control 1'],
  18:['DC2','Device control 2'],19:['DC3','Device control 3'],20:['DC4','Device control 4'],
  21:['NAK','Negative acknowledge'],22:['SYN','Sync idle'],23:['ETB','End of transmission block'],
  24:['CAN','Cancel'],25:['EM','End of medium'],26:['SUB','Substitute'],27:['ESC','Escape'],
  28:['FS','File separator'],29:['GS','Group separator'],30:['RS','Record separator'],
  31:['US','Unit separator'],127:['DEL','Delete'],
};
function renderAscii(body){
  body.innerHTML = `
    <div class="tb-card">
      <div class="tb-card-h">
        <h3>ASCII / Unicode table</h3>
        <div class="tb-seg">
          <button type="button" class="active" data-r="ascii">ASCII (0–127)</button>
          <button type="button" data-r="latin">Latin-1 (128–255)</button>
          <button type="button" data-r="find">Lookup</button>
        </div>
      </div>
      <div id="asBody" class="as-body"></div>
    </div>
  `;
  function rangeTable(from, to){
    let html = '<table class="as-table"><thead><tr><th>Dec</th><th>Hex</th><th>Oct</th><th>Bin</th><th>Char</th><th>Name</th></tr></thead><tbody>';
    for (let i = from; i <= to; i++){
      const ctrl = ASCII_CONTROL[i];
      const char = ctrl ? `<em>${ctrl[0]}</em>` : i === 32 ? '(space)' : esc(String.fromCharCode(i));
      const name = ctrl ? ctrl[1] : '';
      html += `<tr>
        <td>${i}</td>
        <td>0x${i.toString(16).toUpperCase().padStart(2,'0')}</td>
        <td>${i.toString(8).padStart(3,'0')}</td>
        <td><code>${i.toString(2).padStart(8,'0')}</code></td>
        <td class="as-ch">${char}</td>
        <td>${esc(name)}</td>
      </tr>`;
    }
    html += '</tbody></table>';
    return html;
  }
  function lookup(){
    return `
      <div class="as-look">
        <label>Char<input type="text" id="asIn" maxlength="2" value="A"></label>
        <label>Dec <input type="number" id="asDec" value="65"></label>
        <label>Hex <input type="text" id="asHex" value="41"></label>
        <div id="asLookOut" class="as-look-out"></div>
      </div>
    `;
  }
  function draw(kind){
    if (kind === 'ascii') $('asBody').innerHTML = rangeTable(0, 127);
    else if (kind === 'latin') $('asBody').innerHTML = rangeTable(128, 255);
    else {
      $('asBody').innerHTML = lookup();
      const inp = $('asIn'), dec = $('asDec'), hex = $('asHex');
      function updateFrom(which){
        let cp = 65;
        if (which === 'char'){ cp = (inp.value || 'A').codePointAt(0); }
        else if (which === 'dec'){ cp = parseInt(dec.value, 10) || 0; }
        else if (which === 'hex'){ cp = parseInt(hex.value, 16) || 0; }
        const char = cp >= 32 ? String.fromCodePoint(cp) : (ASCII_CONTROL[cp]?.[0] || '');
        if (which !== 'char') inp.value = char;
        if (which !== 'dec') dec.value = cp;
        if (which !== 'hex') hex.value = cp.toString(16).toUpperCase();
        $('asLookOut').innerHTML = `
          <div><span>Character</span><code>${esc(char)}</code></div>
          <div><span>Code point</span><code>U+${cp.toString(16).toUpperCase().padStart(4,'0')}</code></div>
          <div><span>Dec / Oct / Bin</span><code>${cp} · ${cp.toString(8)} · ${cp.toString(2)}</code></div>
          <div><span>UTF-8 bytes</span><code>${utf8Bytes(cp)}</code></div>
          <div><span>HTML entity</span><code>&amp;#${cp};</code></div>
        `;
      }
      inp.addEventListener('input', () => updateFrom('char'));
      dec.addEventListener('input', () => updateFrom('dec'));
      hex.addEventListener('input', () => updateFrom('hex'));
      updateFrom('char');
    }
  }
  function utf8Bytes(cp){
    const bytes = [];
    if (cp < 0x80) bytes.push(cp);
    else if (cp < 0x800){
      bytes.push(0xC0 | (cp >> 6)); bytes.push(0x80 | (cp & 0x3F));
    } else if (cp < 0x10000){
      bytes.push(0xE0 | (cp >> 12)); bytes.push(0x80 | ((cp >> 6) & 0x3F)); bytes.push(0x80 | (cp & 0x3F));
    } else {
      bytes.push(0xF0 | (cp >> 18)); bytes.push(0x80 | ((cp >> 12) & 0x3F)); bytes.push(0x80 | ((cp >> 6) & 0x3F)); bytes.push(0x80 | (cp & 0x3F));
    }
    return bytes.map(b => '0x' + b.toString(16).toUpperCase().padStart(2,'0')).join(' ');
  }
  body.querySelector('.tb-seg').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    body.querySelectorAll('.tb-seg button').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    draw(b.dataset.r);
  });
  draw('ascii');
}

// ── Big-O cheat sheet ───────────────────────────────────────────
const BIGO = [
  ['O(1)',        'Constant',       'Array index, hash lookup (avg), push/pop'],
  ['O(log n)',    'Logarithmic',    'Binary search, balanced BST ops'],
  ['O(n)',        'Linear',         'Single loop over n, linear scan, array map'],
  ['O(n log n)',  'Linearithmic',   'Mergesort, heapsort, quicksort (avg)'],
  ['O(n²)',       'Quadratic',      'Nested loop, bubble/insertion sort'],
  ['O(n³)',       'Cubic',          'Naïve matrix multiplication'],
  ['O(2ⁿ)',       'Exponential',    'Recursive Fibonacci, subset-sum brute force'],
  ['O(n!)',       'Factorial',      'Generate all permutations, TSP brute force'],
];
const BIGO_SIZES = [1, 10, 100, 1000, 10000];
function bigoEval(label, n){
  switch (label){
    case 'O(1)': return 1;
    case 'O(log n)': return Math.log2(n);
    case 'O(n)': return n;
    case 'O(n log n)': return n * Math.log2(Math.max(n, 2));
    case 'O(n²)': return n * n;
    case 'O(n³)': return n * n * n;
    case 'O(2ⁿ)': return Math.pow(2, n);
    case 'O(n!)': {
      let f = 1;
      for (let i = 2; i <= n; i++) f *= i;
      return f;
    }
  }
  return NaN;
}
function fmtBig(n){
  if (!isFinite(n)) return '∞';
  if (n < 1000) return String(Math.round(n));
  if (n < 1e6)  return (n/1e3).toFixed(1) + 'K';
  if (n < 1e9)  return (n/1e6).toFixed(1) + 'M';
  if (n < 1e12) return (n/1e9).toFixed(1) + 'B';
  return n.toExponential(2);
}
function renderBigO(body){
  body.innerHTML = `
    <div class="tb-card">
      <div class="tb-card-h"><h3>Big-O complexity cheat sheet</h3></div>
      <div class="bo-scroll">
        <table class="bo-table">
          <thead>
            <tr><th>Complexity</th><th>Name</th><th>Examples</th>${BIGO_SIZES.map(n => `<th>n=${n}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${BIGO.map(([c, name, ex]) => `
              <tr>
                <td><code>${esc(c)}</code></td>
                <td>${esc(name)}</td>
                <td>${esc(ex)}</td>
                ${BIGO_SIZES.map(n => `<td class="bo-num">${fmtBig(bigoEval(c, n))}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <h4 class="bo-sub">Common data-structure operations</h4>
      <table class="bo-table">
        <thead><tr><th>Structure</th><th>Access</th><th>Search</th><th>Insert</th><th>Delete</th></tr></thead>
        <tbody>
          <tr><td>Array</td><td>O(1)</td><td>O(n)</td><td>O(n)</td><td>O(n)</td></tr>
          <tr><td>Linked list</td><td>O(n)</td><td>O(n)</td><td>O(1)</td><td>O(1)</td></tr>
          <tr><td>Hash table (avg)</td><td>—</td><td>O(1)</td><td>O(1)</td><td>O(1)</td></tr>
          <tr><td>Hash table (worst)</td><td>—</td><td>O(n)</td><td>O(n)</td><td>O(n)</td></tr>
          <tr><td>Binary search tree (avg)</td><td>O(log n)</td><td>O(log n)</td><td>O(log n)</td><td>O(log n)</td></tr>
          <tr><td>Balanced BST (AVL / RB)</td><td>O(log n)</td><td>O(log n)</td><td>O(log n)</td><td>O(log n)</td></tr>
          <tr><td>Heap</td><td>—</td><td>O(n)</td><td>O(log n)</td><td>O(log n)</td></tr>
        </tbody>
      </table>
    </div>
  `;
}

// ── Binary / hex / decimal converter ─────────────────────────────
function renderBinHex(body){
  body.innerHTML = `
    <div class="tb-card">
      <div class="tb-card-h"><h3>Binary / hex / decimal converter</h3></div>
      <div class="bh-grid">
        <label>Decimal <input type="text" id="bhDec" inputmode="numeric" autocomplete="off" value="42"></label>
        <label>Binary  <input type="text" id="bhBin" autocomplete="off" value="101010"></label>
        <label>Octal   <input type="text" id="bhOct" autocomplete="off" value="52"></label>
        <label>Hex     <input type="text" id="bhHex" autocomplete="off" value="2A"></label>
      </div>
      <div class="bh-meta" id="bhMeta"></div>
      <div class="tb-hr"></div>
      <h4 class="bh-sub">Bitwise calculator</h4>
      <div class="bh-bit">
        <label>A <input type="text" id="bhA" value="12"></label>
        <label>B <input type="text" id="bhB" value="10"></label>
        <label>Shift n <input type="number" id="bhShift" value="1"></label>
      </div>
      <div class="bh-results" id="bhResults"></div>
    </div>
  `;

  const dec = $('bhDec'), bin = $('bhBin'), oct = $('bhOct'), hex = $('bhHex');
  function sync(from){
    try {
      let n;
      if (from === 'd') n = BigInt(dec.value || '0');
      else if (from === 'b') n = BigInt('0b' + (bin.value || '0').replace(/[^01]/g,''));
      else if (from === 'o') n = BigInt('0o' + (oct.value || '0').replace(/[^0-7]/g,''));
      else if (from === 'h') n = BigInt('0x' + (hex.value || '0').replace(/[^0-9a-fA-F]/g,''));
      if (from !== 'd') dec.value = n.toString(10);
      if (from !== 'b') bin.value = n.toString(2);
      if (from !== 'o') oct.value = n.toString(8);
      if (from !== 'h') hex.value = n.toString(16).toUpperCase();
      const bits = n.toString(2).length;
      $('bhMeta').innerHTML = `
        <span>Bit length: <strong>${bits}</strong></span>
        <span>Bytes: <strong>${Math.ceil(bits/8)}</strong></span>
        <span>2's comp (8-bit signed): <strong>${(n >= 0n && n < 128n) ? n.toString() : (n < 128n ? n.toString() : (n - 256n).toString())}</strong></span>
      `;
    } catch(e){ /* invalid input */ }
  }
  dec.addEventListener('input', () => sync('d'));
  bin.addEventListener('input', () => sync('b'));
  oct.addEventListener('input', () => sync('o'));
  hex.addEventListener('input', () => sync('h'));
  sync('d');

  function doBit(){
    function parseAny(s){
      s = (s || '').trim();
      if (!s) return 0;
      if (s.startsWith('0b')) return parseInt(s.slice(2), 2);
      if (s.startsWith('0x')) return parseInt(s.slice(2), 16);
      if (s.startsWith('0o')) return parseInt(s.slice(2), 8);
      return parseInt(s, 10);
    }
    const a = parseAny($('bhA').value), b = parseAny($('bhB').value), n = parseInt($('bhShift').value, 10) || 0;
    const ops = {
      'A & B': a & b, 'A | B': a | b, 'A ^ B': a ^ b, '~A': ~a >>> 0,
      'A << n': a << n, 'A >> n': a >> n, 'A >>> n': a >>> n, 'A + B': a + b,
    };
    $('bhResults').innerHTML = Object.entries(ops).map(([k, v]) => `
      <div class="bh-op">
        <div class="bh-op-name">${esc(k)}</div>
        <div class="bh-op-vals">
          <code>${v}</code>
          <code>0x${(v >>> 0).toString(16).toUpperCase()}</code>
          <code>0b${(v >>> 0).toString(2)}</code>
        </div>
      </div>
    `).join('');
  }
  $('bhA').addEventListener('input', doBit);
  $('bhB').addEventListener('input', doBit);
  $('bhShift').addEventListener('input', doBit);
  doBit();
}

SUBJECTS.push({
  id:'cs', label:'Computer Science', icon:'</>',
  tools:[
    { id:'ascii',   label:'ASCII / Unicode', icon:'𝐀',   render: renderAscii },
    { id:'bigo',    label:'Big-O cheat sheet', icon:'Ω', render: renderBigO },
    { id:'binhex',  label:'Binary / hex',    icon:'01',  render: renderBinHex },
  ],
});

// ────────────────────────────────────────────────────────────────
// Unified Study Tools (single scroll: search + classes + sections)
// ────────────────────────────────────────────────────────────────
const UNIFIED_LAYOUT = [
  { id:'science', name:'Science', icon:'🧪', classTags:['physics','chem','bio'],
    tools:[
      { id:'periodic-tbl', label:'Periodic Table', icon:'⚗', desc:'Interactive table with properties and categories.', mode:'inline', sub:'science', tid:'periodic-tbl' },
      { id:'physics-sandbox', label:'Physics sandbox', icon:'🪐', desc:'Mechanics, kinematics, energy, waves — formulas and constants.', mode:'inline', sub:'science', tid:'formulas-sci' },
      { id:'chem-ref', label:'Chemistry Reference', icon:'⚗️', desc:'Polyatomic ions, solubility rules, acids & bases, constants.', mode:'modal', fn:'openChemReference' },
      { id:'codon', label:'Biology codon table', icon:'🧬', desc:'64 codons and amino-acid lookup.', mode:'modal', fn:'openCodonTable' },
      { id:'unit-conv', label:'Unit converter', icon:'🔁', desc:'Length, mass, temperature, energy, data — live conversions.', mode:'modal', fn:'openUnitConverter' },
      { id:'molar-mass', label:'Molecular weight', icon:'⚖', desc:'Parse formulas (H2O, Ca(OH)2) and get molar mass.', mode:'inline', sub:'science', tid:'molar-mass' },
    ],
  },
  { id:'math', name:'Math', icon:'∑', classTags:['math'],
    tools:[
      { id:'math-formulas', label:'Math formula sheet', icon:'📐', desc:'Algebra, trig, calculus, and statistics reference.', mode:'modal', fn:'openMathFormulas' },
      { id:'graphing', label:'Graph + calc', icon:'📈', desc:'Plot functions and use a built-in basic calculator (same math parser).', mode:'inline', sub:'math', tid:'graphing' },
      { id:'matrix', label:'Matrix calculator', icon:'⊞', desc:'Multiply, invert, determinant, and more.', mode:'inline', sub:'math', tid:'matrix' },
      { id:'stats', label:'Statistics toolkit', icon:'𝝈', desc:'Summary stats and z-scores from raw data.', mode:'inline', sub:'math', tid:'stats' },
      { id:'geo-ref', label:'Geometric formulas', icon:'△', desc:'2D and 3D area, surface, and volume.', mode:'inline', sub:'math', tid:'geo-ref' },
    ],
  },
  { id:'history', name:'History', icon:'🏛', classTags:['history'],
    tools:[
      { id:'world-hist', label:'World history map', icon:'🌍', desc:'Clickable world map with eras, empires, and key dates.', mode:'modal', fn:'openHistoryMap' },
      { id:'timeline', label:'Timeline builder', icon:'🕰', desc:'Build and save timelines for papers and exams.', mode:'inline', sub:'history', tid:'timeline' },
      { id:'map-quiz', label:'Map & capitals', icon:'🗺', desc:'Browse regions or quiz yourself on capitals.', mode:'inline', sub:'history', tid:'map-quiz' },
    ],
  },
  { id:'english', name:'English', icon:'✒', classTags:['english'],
    tools:[
      { id:'grammar', label:'Grammar reference', icon:'📘', desc:'Parts of speech, commas, clauses, and common mistakes.', mode:'inline', sub:'english', tid:'grammar' },
      { id:'essay', label:'Essay structure guide', icon:'🖊', desc:'Thesis, body paragraphs, evidence, and revision.', mode:'inline', sub:'english', tid:'essay' },
      { id:'literary', label:'Literary devices', icon:'📖', desc:'Glossary with definitions and examples.', mode:'inline', sub:'english', tid:'literary' },
      { id:'cite-notes', label:'Citation builder', icon:'❝ ❞', desc:'Build MLA / APA citations — lives in Notes for copying into papers.', mode:'link', nav:'notes', btn:'Open in Notes' },
    ],
  },
  { id:'languages', name:'Languages', icon:'🌍', classTags:['spanish','french','language'],
    tools:[
      { id:'spanish-conj', label:'Spanish conjugator', icon:'🇪🇸', desc:'60 high-frequency verbs across major tenses (modal reference).', mode:'modal', fn:'openSpanishConjugator' },
      { id:'french-conj', label:'French conjugator', icon:'🇫🇷', desc:'French tenses with être / auxiliary flags (modal reference).', mode:'modal', fn:'openFrenchConjugator' },
      { id:'ipa', label:'IPA chart', icon:'Ƃ', desc:'Pulmonic consonants and vowel quadrilateral.', mode:'inline', sub:'languages', tid:'ipa' },
      { id:'translate-ai', label:'Translation', icon:'🔁', desc:'Send text to Flux AI with language pair context.', mode:'link', nav:'ai', btn:'Open Flux AI' },
    ],
  },
  { id:'music', name:'Music', icon:'🎵', classTags:['music','band','orchestra','choir','ib music','ib'],
    tools:[
      { id:'dp-dimensions', label:'Ring diagram', icon:'◎', desc:'Concentric dimensions map with bubble labels.', mode:'inline', sub:'music', tid:'dp-dimensions' },
      { id:'dp-chart', label:'Quick chart', icon:'📊', desc:'Flat checklist of dimensions and metadimensions.', mode:'inline', sub:'music', tid:'dp-chart' },
    ],
  },
  { id:'econ', name:'Economics', icon:'💹', classTags:['econ'],
    tools:[
      { id:'econ-formulas', label:'Economics formulas', icon:'Σ', desc:'Micro and macro formulas with quick explanations.', mode:'inline', sub:'econ', tid:'econ-formulas' },
      { id:'fin-calc', label:'Financial calculator', icon:'🧮', desc:'Compound interest, loans, and savings goals.', mode:'inline', sub:'econ', tid:'fin-calc' },
    ],
  },
  { id:'cs', name:'Computer Science', icon:'💻', classTags:['cs'],
    tools:[
      { id:'cs-ref', label:'CS reference', icon:'💻', desc:'Number converter, ASCII, Big-O, and logic gates in one place.', mode:'modal', fn:'openCSReference' },
    ],
  },
];

let studySearchQuery = '';
/** Only one subject section mounts heavy widgets (#periodic, #gcCanvas, …) at a time. */
let focusedUnifiedSectionId = 'science';

function clearStudyToolBody(secId){
  const body = document.getElementById('st-tool-body-'+secId);
  if (!body) return;
  const per = document.getElementById('periodic');
  if (per && body.contains(per)) ensurePeriodicStashedUnlessOpening();
  body.innerHTML = '<p class="tb-sub st-tool-deferred-hint">Pick a tool chip to load it here.</p>';
}

function getFluxUserClasses(){
  const cl = Array.isArray(window.classes) ? window.classes : [];
  const out = [];
  cl.forEach(c => {
    if (!c || !c.name) return;
    const classify = window.fluxRefsClassify || (() => []);
    const tags = classify(c.name) || [];
    out.push({ id: String(c.id), name: c.name, color: c.color || 'var(--accent)', tags });
  });
  return out;
}

function primarySectionForTags(tags){
  if (!tags || !tags.length) return null;
  for (const sec of UNIFIED_LAYOUT){
    if (tags.some(t => sec.classTags.includes(t))) return sec.id;
  }
  return null;
}

function classPillsHtml(sec){
  const cls = getFluxUserClasses();
  const parts = [];
  cls.forEach(c => {
    if (!c.tags || !c.tags.some(t => sec.classTags.includes(t))) return;
    const col = c.color ? ` style="--chip-col:${esc(c.color)}"` : '';
    parts.push(`<span class="st-class-tag"${col}>${esc(c.name)}</span>`);
  });
  return parts.join('');
}

function getActiveChipId(sec){
  const saved = lsStudyTool(sec.id);
  if (saved && sec.tools.some(t => t.id === saved)) return saved;
  return sec.tools[0]?.id || null;
}

const LS_ST_LAYOUT = 'flux_study_tools_layout';

function getStudyLayoutMode(){
  return 'subject';
}

function setStudyLayoutMode(mode){
  if (mode === 'class') return;
  try{ localStorage.setItem(LS_ST_LAYOUT, 'subject'); }catch(e){}
  syncStudyLayoutToggleUI();
  applyStudyLayoutModeToDom();
}

function syncStudyLayoutToggleUI(){
  const mode = getStudyLayoutMode();
  const bSub = $('stLayoutSubject');
  const bCls = $('stLayoutClass');
  if (bSub){
    bSub.classList.toggle('active', mode === 'subject');
    bSub.setAttribute('aria-pressed', mode === 'subject' ? 'true' : 'false');
  }
  if (bCls){
    bCls.classList.toggle('active', mode === 'class');
    bCls.setAttribute('aria-pressed', mode === 'class' ? 'true' : 'false');
  }
}

/** Move every inline tool body back under its subject accordion (needed before rebuilding By-class UI). */
function rehomeAllStudyToolBodies(){
  UNIFIED_LAYOUT.forEach(sec => {
    const body = document.getElementById('st-tool-body-'+sec.id);
    const slot = document.querySelector('#st-section-'+sec.id+' .st-section-body');
    if (body && slot) slot.appendChild(body);
  });
}

function placeStudyToolBodyForLayout(secId){
  const body = document.getElementById('st-tool-body-'+secId);
  if (!body) return;
  if (getStudyLayoutMode() === 'class'){
    const mount = $('stClassInlineMount');
    if (mount && body.parentElement !== mount) mount.appendChild(body);
  } else {
    const slot = document.querySelector('#st-section-'+secId+' .st-section-body');
    if (slot && body.parentElement !== slot) slot.appendChild(body);
  }
}

function getToolboxSectionHosts(){
  const wrap = $('stSections');
  if (wrap && !$('stSubjectHost')){
    wrap.innerHTML = '<div id="stSubjectHost" class="st-subject-host"></div><div id="stClassHost" class="st-class-host" hidden><div id="stClassBlocks" class="st-class-blocks"></div><div id="stClassInlineMount" class="st-class-inline-mount" aria-live="polite"></div></div>';
  }
  return { wrap, subject: $('stSubjectHost'), classHost: $('stClassHost'), blocks: $('stClassBlocks'), mount: $('stClassInlineMount') };
}

function syncStudyPanelHostVisibility(){
  const mode = getStudyLayoutMode();
  const { subject, classHost } = getToolboxSectionHosts();
  if (subject) subject.hidden = mode !== 'subject';
  if (classHost) classHost.hidden = mode !== 'class';
}

function sortClassesForStudyBlocks(cls){
  return [...cls].sort((a, b) => {
    const pa = parseInt(a.period, 10);
    const pb = parseInt(b.period, 10);
    const aOk = !isNaN(pa);
    const bOk = !isNaN(pb);
    if (aOk && bOk && pa !== pb) return pa - pb;
    if (aOk && !bOk) return -1;
    if (!aOk && bOk) return 1;
    return String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' });
  });
}

function syncClassBlockChipsActive(secId, chipId){
  document.querySelectorAll('.st-class-host .st-tool-chip').forEach(b => {
    const sid = b.getAttribute('data-sec');
    const cid = b.getAttribute('data-chip');
    b.classList.toggle('active', sid === secId && cid === chipId);
  });
}

function renderStudyClassBlocks(){
  const { blocks } = getToolboxSectionHosts();
  if (!blocks) return;
  const cls = getFluxUserClasses();
  rehomeAllStudyToolBodies();
  if (!cls.length){
    blocks.innerHTML = `<div class="st-class-empty tb-card">
      <p class="st-class-empty-title">No classes yet</p>
      <p class="tb-sub">Add classes in <strong>School Info</strong> so Study tools can match tools to your schedule.</p>
      <div class="st-class-empty-actions">
        <button type="button" class="tb-btn" onclick="nav('school')">Open School Info</button>
        <button type="button" class="btn-sec" onclick="setStudyLayoutMode('subject')">View by subject</button>
      </div>
    </div>`;
    return;
  }
  const sorted = sortClassesForStudyBlocks(cls);
  blocks.innerHTML = sorted.map(c => {
    const secId = primarySectionForTags(c.tags);
    const sec = secId ? UNIFIED_LAYOUT.find(s => s.id === secId) : null;
    const col = c.color ? ` style="--stcb-col:${esc(c.color)}"` : '';
    const meta = c.period != null && String(c.period) !== '' ? `<span class="st-class-block-meta">P${esc(String(c.period))}</span>` : '';
    if (!sec){
      return `<article class="st-class-block tb-card st-class-block--unknown"${col}>
        <header class="st-class-block-head"><span class="st-class-block-name">${esc(c.name)}</span>${meta}</header>
        <p class="tb-sub st-class-block-hint">This class name doesn’t match a subject area yet. Adjust the name in School Info or use By subject.</p>
        <button type="button" class="btn-sec st-class-block-fallback" data-st-fallback="subject">Browse by subject</button>
      </article>`;
    }
    const chips = sec.tools.map(t => `
      <button type="button" class="st-tool-chip" data-sec="${esc(sec.id)}" data-chip="${esc(t.id)}" role="tab">${t.icon ? `<span class="st-tool-chip-ic" aria-hidden="true">${t.icon}</span>` : ''}<span>${esc(t.label)}</span></button>
    `).join('');
    return `<article class="st-class-block tb-card"${col}>
      <header class="st-class-block-head">
        <span class="st-class-block-name">${esc(c.name)}</span>
        ${meta}
        <span class="st-class-block-sec">${esc(sec.name)}</span>
      </header>
      <div class="st-tool-chips st-tool-chips--in-card" role="tablist">${chips}</div>
    </article>`;
  }).join('');
  blocks.querySelectorAll('.st-tool-chip').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const sid = btn.getAttribute('data-sec');
      const id = btn.getAttribute('data-chip');
      if (!sid || !id) return;
      setLsStudyTool(sid, id);
      refreshSectionToolUI(sid);
    });
  });
  blocks.querySelectorAll('[data-st-fallback="subject"]').forEach(b => {
    b.addEventListener('click', () => { setStudyLayoutMode('subject'); });
  });
}

function applyStudyLayoutModeToDom(){
  syncStudyPanelHostVisibility();
  if (getStudyLayoutMode() === 'class') renderStudyClassBlocks();
  else rehomeAllStudyToolBodies();
  const fid = focusedUnifiedSectionId && UNIFIED_LAYOUT.some(s => s.id === focusedUnifiedSectionId)
    ? focusedUnifiedSectionId
    : 'science';
  refreshSectionToolUI(fid);
}

function renderToolContentForChip(body, chip){
  if (chip.mode === 'inline') renderToolIntoBody(body, chip.sub, chip.tid);
  else if (chip.mode === 'modal') renderModalPreview(body, chip.label, chip.desc, chip.fn, 'Open '+chip.label);
  else if (chip.mode === 'link') renderLinkPreview(body, chip.label, chip.desc, chip.btn, chip.nav);
}

function scrollToStudySection(secId, pulse){
  const wrap = document.getElementById('st-section-'+secId);
  if (!wrap) return;
  setLsStudyCollapsed(secId, false);
  const inner = wrap.querySelector('.st-section-body');
  const hdr = wrap.querySelector('.st-section-header');
  if (inner){ inner.classList.remove('collapsed'); inner.style.maxHeight = '2000px'; }
  if (hdr){ hdr.setAttribute('aria-expanded','true'); hdr.querySelector('.st-section-chevron')?.classList.remove('collapsed'); }
  if (getStudyLayoutMode() !== 'class'){
    wrap.scrollIntoView({ behavior:'smooth', block:'start' });
  } else {
    const blk = document.querySelector('.st-class-blocks .st-tool-chip[data-sec="'+secId+'"]')?.closest('.st-class-block');
    if (blk) blk.scrollIntoView({ behavior:'smooth', block:'nearest' });
    $('stClassInlineMount')?.scrollIntoView({ behavior:'smooth', block:'nearest' });
  }
  if (pulse && hdr){
    hdr.classList.add('st-section--pulse');
    setTimeout(() => hdr.classList.remove('st-section--pulse'), 1400);
  }
}

function buildStudySearchIndex(){
  const rows = [];
  UNIFIED_LAYOUT.forEach(sec => {
    sec.tools.forEach(t => {
      rows.push({
        sec, tool: t,
        hay: (t.label+' '+t.desc+' '+sec.name).toLowerCase(),
      });
    });
  });
  return rows;
}

function updateStudySearchUI(){
  const inp = $('stSearchInput');
  if (inp) studySearchQuery = inp.value;
  const q = (studySearchQuery || '').trim().toLowerCase();
  const clr = $('stSearchClear');
  const results = $('stSearchResults');
  const sections = $('stSections');
  const tbPanel = $('toolbox');
  if (clr) clr.hidden = !q;
  if (!q){
    if (results){ results.hidden = true; results.innerHTML = ''; }
    if (sections) sections.hidden = false;
    syncStudyPanelHostVisibility();
    if (tbPanel) tbPanel.classList.remove('st-panel--study-search');
    const fid = focusedUnifiedSectionId && UNIFIED_LAYOUT.some(s => s.id === focusedUnifiedSectionId)
      ? focusedUnifiedSectionId : 'science';
    focusedUnifiedSectionId = fid;
    UNIFIED_LAYOUT.forEach(s => { if (s.id !== fid) clearStudyToolBody(s.id); });
    refreshSectionToolUI(fid);
    return;
  }
  if (tbPanel) tbPanel.classList.add('st-panel--study-search');
  if (sections) sections.hidden = true;
  if (!results) return;
  const idx = buildStudySearchIndex().filter(r => r.hay.includes(q));
  results.hidden = false;
  if (!idx.length){
    results.innerHTML = `<div class="st-empty tb-card"><p>No tools found for “${esc(studySearchQuery)}”.</p><p class="tb-sub">Try the Flux AI tab for open-ended help.</p></div>`;
    return;
  }
  results.innerHTML = `<div class="st-search-results-inner">${idx.map(r => {
    const t = r.tool;
    const openLabel = t.mode === 'inline' ? 'Use' : (t.mode === 'link' ? 'Open' : 'Open');
    return `<article class="st-search-card tb-card" data-sec="${esc(r.sec.id)}" data-chip="${esc(t.id)}">
      <div class="st-search-card-head"><span class="st-search-emoji" aria-hidden="true">${t.icon}</span><span class="st-search-name">${esc(t.label)}</span></div>
      <span class="st-search-subject-pill">${esc(r.sec.name)}</span>
      <p class="st-search-desc">${esc(t.desc)}</p>
      <button type="button" class="tb-btn st-search-open">${esc(openLabel)}</button>
    </article>`;
  }).join('')}</div>`;
  results.querySelectorAll('.st-search-card').forEach(card => {
    card.querySelector('.st-search-open')?.addEventListener('click', () => {
      const sid = card.getAttribute('data-sec');
      const cid = card.getAttribute('data-chip');
      studySearchQuery = '';
      if (inp) inp.value = '';
      updateStudySearchUI();
      setLsStudyTool(sid, cid);
      if (typeof nav === 'function') nav('toolbox');
      setTimeout(() => {
        scrollToStudySection(sid, true);
        refreshSectionToolUI(sid);
      }, 80);
    });
  });
}

function refreshSectionToolUI(secId){
  const sec = UNIFIED_LAYOUT.find(s => s.id === secId);
  if (!sec) return;
  const wrap = document.getElementById('st-section-'+secId);
  if (!wrap) return;
  focusedUnifiedSectionId = secId;
  UNIFIED_LAYOUT.forEach(s => {
    if (s.id !== secId) clearStudyToolBody(s.id);
  });
  const chipId = getActiveChipId(sec);
  wrap.querySelectorAll('.st-tool-chip').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-chip') === chipId);
  });
  UNIFIED_LAYOUT.forEach(s => {
    if (s.id === secId) return;
    const w2 = document.getElementById('st-section-'+s.id);
    w2?.querySelectorAll('.st-tool-chip').forEach(b => {
      const id = b.getAttribute('data-chip');
      b.classList.toggle('active', id === getActiveChipId(s));
    });
  });
  const body = document.getElementById('st-tool-body-'+secId);
  if (!body) return;
  const chip = sec.tools.find(t => t.id === chipId) || sec.tools[0];
  if (!chip) return;
  if (chip.mode === 'inline'){
    state.subject = chip.sub;
    state.tool = chip.tid;
  }
  renderToolContentForChip(body, chip);
  placeStudyToolBodyForLayout(secId);
  syncClassBlockChipsActive(secId, chipId);
}

function wireStudyUnifiedOnce(){
  const root = $('toolbox');
  if (!root || root._stUnifiedWired) return;
  root._stUnifiedWired = 1;
  const inp = $('stSearchInput');
  const clr = $('stSearchClear');
  if (inp){
    inp.addEventListener('input', () => {
      studySearchQuery = inp.value;
      updateStudySearchUI();
    });
    inp.addEventListener('keydown', e => {
      if (e.key === 'Escape'){
        studySearchQuery = '';
        inp.value = '';
        updateStudySearchUI();
      }
    });
  }
  if (clr){
    clr.addEventListener('click', () => {
      studySearchQuery = '';
      if (inp) inp.value = '';
      updateStudySearchUI();
    });
  }
}

function activateStudyTool(subjectId, toolId){
  for (const sec of UNIFIED_LAYOUT){
    for (const t of sec.tools){
      if (t.mode === 'inline' && t.sub === subjectId && t.tid === toolId){
        state.subject = subjectId;
        state.tool = toolId;
        setLsStudyTool(sec.id, t.id);
        focusedUnifiedSectionId = sec.id;
        return;
      }
    }
  }
  state.subject = subjectId;
  state.tool = toolId;
}

function renderUnifiedStudyTools(){
  const root = $('toolbox');
  getToolboxSectionHosts();
  const subjectHost = $('stSubjectHost');
  if (!root || !subjectHost) return;
  wireStudyUnifiedOnce();

  if (!root._stSectionsBuilt){
    root._stSectionsBuilt = 1;
    subjectHost.innerHTML = UNIFIED_LAYOUT.map(sec => {
      const collapsed = lsStudyCollapsed(sec.id);
      const pills = classPillsHtml(sec);
      const sid = sec.id;
      return `<section class="st-section" id="st-section-${sid}" data-section="${sid}">
        <button type="button" class="st-section-header" aria-expanded="${collapsed ? 'false' : 'true'}">
          <span class="st-section-header-main">
            <span class="st-section-icon" aria-hidden="true">${sec.icon}</span>
            <span class="st-section-name">${esc(sec.name)}</span>
            ${pills ? `<span class="st-class-tags">${pills}</span>` : ''}
          </span>
          <span class="st-section-chevron${collapsed ? ' collapsed' : ''}" aria-hidden="true">▼</span>
        </button>
        <div class="st-section-body${collapsed ? ' collapsed' : ''}" style="max-height:${collapsed ? '0' : '2000px'}">
          <div class="st-tool-chips" role="tablist">${sec.tools.map(t => `
            <button type="button" class="st-tool-chip" data-chip="${esc(t.id)}" role="tab">${t.icon ? `<span class="st-tool-chip-ic" aria-hidden="true">${t.icon}</span>` : ''}<span>${esc(t.label)}</span></button>
          `).join('')}</div>
          <div class="st-tool-content tb-body" id="st-tool-body-${sid}" aria-live="polite"></div>
        </div>
      </section>`;
    }).join('');

    subjectHost.querySelectorAll('.st-section').forEach(secEl => {
      const sid = secEl.getAttribute('data-section');
      secEl.querySelector('.st-section-header')?.addEventListener('click', () => {
        const body = secEl.querySelector('.st-section-body');
        const hdr = secEl.querySelector('.st-section-header');
        const chev = secEl.querySelector('.st-section-chevron');
        if (!body || !hdr) return;
        const wasCollapsed = body.classList.contains('collapsed');
        const nextCollapsed = !wasCollapsed;
        const applyDom = () => {
          body.classList.toggle('collapsed', nextCollapsed);
          body.style.maxHeight = nextCollapsed ? '0' : '2000px';
          body.style.opacity = '';
          hdr.setAttribute('aria-expanded', nextCollapsed ? 'false' : 'true');
          chev?.classList.toggle('collapsed', !!nextCollapsed);
          setLsStudyCollapsed(sid, !!nextCollapsed);
        };
        const useAnime =
          typeof window.FluxAnim?.sectionToggle === 'function' &&
          !(typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) &&
          document.documentElement.getAttribute('data-flux-perf') !== 'on';
        if (useAnime) {
          try {
            window.FluxAnim.sectionToggle(body, chev, nextCollapsed, applyDom);
            return;
          } catch (_) {}
        }
        applyDom();
      });
      secEl.querySelectorAll('.st-tool-chip').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          const id = btn.getAttribute('data-chip');
          if (!id) return;
          setLsStudyTool(sid, id);
          refreshSectionToolUI(sid);
        });
      });
    });

    focusedUnifiedSectionId = 'science';
  }

  UNIFIED_LAYOUT.forEach(sec => {
    const wrap = document.getElementById('st-section-'+sec.id);
    if (!wrap) return;
    wrap.classList.remove('st-section--filtered-out');
    const pills = classPillsHtml(sec);
    const tagHost = wrap.querySelector('.st-class-tags');
    if (tagHost) tagHost.innerHTML = pills;
    else if (pills){
      const main = wrap.querySelector('.st-section-header-main');
      if (main) main.insertAdjacentHTML('beforeend', `<span class="st-class-tags">${pills}</span>`);
    }
  });

  syncStudyLayoutToggleUI();
  syncStudyPanelHostVisibility();

  updateStudySearchUI();
}

// ────────────────────────────────────────────────────────────────
// EXPOSE
// ────────────────────────────────────────────────────────────────
function renderToolboxCompat(){
  renderUnifiedStudyTools();
}
window.renderToolbox = renderToolboxCompat;
window.renderStudyTools = renderToolboxCompat;
window.activateStudyTool = activateStudyTool;
window.setStudyLayoutMode = setStudyLayoutMode;
window.fluxToolbox = { render: renderToolboxCompat, SUBJECTS, state, activateStudyTool, renderToolIntoBody, UNIFIED_LAYOUT };

})();
