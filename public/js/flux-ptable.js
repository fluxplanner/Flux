/* ════════════════════════════════════════════════════════════════════════
   FLUX · Periodic Table — flux-ptable.js
   ------------------------------------------------------------------------
   The periodic table as its own tool: periodic.html, and the same thing in
   Study tools ▸ Chemistry ▸ Table, the way the grapher is both.

   The table colours by every periodic trend — size, nuclear charge,
   shielding, ionization energies, electronegativity, metallic character,
   mass, density, melting point and more — with the trend across a period
   and down a group written under it, and a graph of it against atomic
   number beneath, where the repeating pattern shows. An element opens with
   everything a course asks about it: configuration and orbital boxes, the
   ions it makes, every successive ionization energy with the jumps pointed
   out, its isotopes and how they average to its atomic mass, and its real
   emission spectrum.

   Data: flux-periodic.js (the element list the planner already uses) and
   flux-ptable-data.js (generated from PubChem and NIST; see
   scripts/build-ptable-data.mjs). Nothing here is a remembered constant.
   ════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.FluxPTable) return;

  const P = () => window.fluxPeriodic;
  const X = () => (window.FluxPTableData && window.FluxPTableData.el) || {};
  const C = () => window.FluxChem;
  const STORE = 'flux_ptable_v1';
  const KJ = 96.4853321233;              // kJ/mol in one eV per atom (NA × e)
  const HC = 1239.84198;                 // eV·nm: a photon's energy from its wavelength

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  const trim0 = (s) => String(s).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  /** A number the way a data book prints it: sensible digits, no float noise. */
  function fmt(v, sig) {
    if (v == null || !Number.isFinite(v)) return '—';
    const a = Math.abs(v);
    if (a !== 0 && (a < 1e-3 || a >= 1e6)) {
      const [m, e] = v.toExponential((sig || 3) - 1).split('e');
      return trim0(m) + ' × 10' + C().toSup(String(+e));
    }
    if (a >= 1000) return Math.round(v).toLocaleString('en');
    return trim0(v.toPrecision(sig || 4));
  }

  /* ── The elements ───────────────────────────────────────────────────── */

  const CATS = [
    ['alkali', 'Alkali metals', '#e8475f'], ['alkaline', 'Alkaline earth metals', '#f58a3d'],
    ['transition', 'Transition metals', '#4a70e8'], ['post-transition', 'Post-transition metals', '#2e9fbd'],
    ['metalloid', 'Metalloids', '#8a63f2'], ['nonmetal', 'Other nonmetals', '#25a97c'],
    ['halogen', 'Halogens', '#17b3cc'], ['noble', 'Noble gases', '#a855e8'],
    ['lanthanide', 'Lanthanides', '#d94aa0'], ['actinide', 'Actinides', '#e2566f'],
    ['unknown', 'Unknown chemistry', '#8a90a6'],
  ];
  const CAT = {};
  CATS.forEach((c) => { CAT[c[0]] = { label: c[1], colour: c[2] }; });
  const BLOCKS = { s: ['s-block', '#ef5f73'], p: ['p-block', '#f2b53a'], d: ['d-block', '#4a8ff0'], f: ['f-block', '#3cc08a'] };
  const STATES = { s: ['Solid', '#6f8fd8'], l: ['Liquid', '#2fb8d8'], g: ['Gas', '#f0a64a'], u: ['Unknown', '#666c80'] };
  /** Flame colours for the metal ions school practicals test. */
  const FLAME = {
    Li: ['crimson', '#dc143c'], Na: ['yellow-orange', '#ffb000'], K: ['lilac', '#c8a2c8'], Rb: ['red-violet', '#c0306b'],
    Cs: ['blue-violet', '#7a5cff'], Ca: ['orange-red', '#ff5a2a'], Sr: ['red', '#ff1a1a'], Ba: ['pale green', '#9be38f'],
    Cu: ['blue-green', '#1fbfa8'], B: ['bright green', '#46d246'],
  };

  let MODEL = null;
  function model() {
    if (MODEL) return MODEL;
    const E = P() && P().ELEMENTS;
    if (!E) return [];
    const x = X();
    MODEL = E.map((e) => Object.assign({}, e, { x: x[e.n] || {} }));
    if (C()) C().useElements(E);
    return MODEL;
  }
  const byN = (n) => model()[n - 1] || null;
  function bySym(s) { return model().find((e) => e.s.toLowerCase() === String(s).toLowerCase()) || null; }
  const mpK = (e) => (e.x.mp != null ? e.x.mp : e.mp != null ? e.mp + 273.15 : null);
  const bpK = (e) => (e.x.bp != null ? e.x.bp : e.bp != null ? e.bp + 273.15 : null);
  function stateAt(e, K) {
    const mp = mpK(e), bp = bpK(e);
    if (mp == null && bp == null) return 'u';
    if (bp != null && K >= bp) return 'g';
    // Helium's solid needs pressure; at ordinary pressure it stays liquid to absolute zero.
    if (e.s === 'He') return 'l';
    if (mp != null && K < mp) return 's';
    if (bp == null && mp != null) return 'l';
    return mp == null ? 'u' : 'l';
  }
  function block(e) {
    if (e.row >= 9) return 'f';
    if (e.s === 'He' || e.col <= 2) return 's';
    if (e.col >= 13) return 'p';
    return 'd';
  }
  const ievals = (e) => e.x.ie || [];
  /** Oxidation states as numbers, from "+3, +2". */
  const oxStates = (e) => String(e.x.ox || '').split(',').map((s) => parseInt(s, 10)).filter(Number.isFinite);
  // 55.845 is stored as 55.84499…; a whisker up makes it round the way a data booklet prints it (55.85).
  const dp2 = (v) => (Math.round(v * 100 + 1e-7) / 100).toFixed(2);
  const massText = (e) => (e.mass === Math.round(e.mass) ? '[' + e.mass + ']' : dp2(e.mass));
  const radioactive = (e) => !e.x.iso;

  /* ── Values worked out from the data ────────────────────────────────── */

  /** Unpaired electrons in the ground-state atom, by Hund's rule. */
  function unpaired(e) { try { return C().orbitals(C().occupancy(e.ec)).reduce((a, o) => a + o.unpaired, 0); } catch (err) { return null; } }
  /** Electrons in the full inner shells: all but the outermost shell. */
  function coreElectrons(e) { const o = P().trendValue('outer', e); return o == null ? null : e.n - o; }
  /** Slater's shielding constant σ = Z − Z_eff: the share of the nuclear charge the other electrons cancel. */
  function shielding(e) { const z = P().zeff(e); return z == null ? null : Math.round((e.n - z) * 100) / 100; }
  /** Neutrons in the most common isotope, or the longest-lived one for elements with no stable isotope. */
  function neutrons(e) {
    const iso = e.x.iso;
    if (iso && iso.length) return iso.reduce((a, b) => (b[2] > a[2] ? b : a))[0] - e.n;
    return e.x.hl ? e.x.hl[0] - e.n : null;
  }
  /** Atomic volume (cm³ per mole of atoms) = molar mass ÷ density, for solids and liquids. */
  function atomicVolume(e) {
    const d = e.x.d != null ? e.x.d : e.d, s = stateAt(e, 298.15);
    return d > 0 && (s === 's' || s === 'l') ? e.mass / d : null;
  }
  function liquidRange(e) { const m = mpK(e), b = bpK(e); return m != null && b != null && b > m ? b - m : null; }
  const ieN = (k) => (e) => (ievals(e)[k] != null ? ievals(e)[k] * KJ : null);

  /* ── Every trend the table can be coloured by ───────────────────────── */

  const trend = (id) => (P().TRENDS || []).find((t) => t.id === id) || {};
  function yearOf(e) { return typeof e.year === 'number' && e.year > 0 ? e.year : null; }
  const round = (v) => Math.round(v);
  const PROPS = [
    { g: 'The table', id: 'cat', label: 'Category', kind: 'cat' },
    { g: 'The table', id: 'block', label: 'Block (s, p, d, f)', kind: 'block' },
    { g: 'The table', id: 'state', label: 'State at a temperature', kind: 'state' },

    { g: 'Size', id: 'rc', label: 'Atomic radius (covalent)', unit: 'pm', get: (e) => (e.x.rc != null ? e.x.rc : null), f: round,
      across: 'decreases →  (more protons pull the same shell in)',
      down: 'increases ↓  (one more shell each period)',
      note: 'Half the distance between two atoms joined by a single bond (Cordero et al., 2008), in picometres — the radius exam data booklets list.' },
    { g: 'Size', id: 'rv', label: 'Van der Waals radius', unit: 'pm', get: (e) => (e.x.rv != null ? e.x.rv : null), f: round,
      across: 'decreases →  (roughly)', down: 'increases ↓',
      note: 'Half the distance between two atoms that touch without bonding — bigger than the covalent radius. For many metals it is an estimate.' },
    { g: 'Size', id: 're', label: 'Empirical atomic radius', unit: 'pm', get: (e) => (e.x.re != null ? e.x.re : null), f: round,
      across: 'decreases →', down: 'increases ↓',
      note: 'Slater\'s radii (1964), averaged from bond lengths in real compounds and crystals.' },
    { g: 'Size', id: 'vol', label: 'Atomic volume', unit: 'cm³/mol', get: atomicVolume, f: (v) => fmt(v, 3),
      across: 'falls towards the middle of each period, then rises again', down: 'increases ↓',
      note: 'Molar mass ÷ density, for solids and liquids. Lothar Meyer plotted this in 1870: a peak at every alkali metal, one of the first pictures of periodicity.' },

    { g: 'Charge and electrons', id: 'z', label: 'Atomic number (nuclear charge)', get: (e) => e.n, f: (v) => v,
      across: 'increases by one each step →',
      down: 'increases ↓ — by the length of each period (2, 8, 8, 18, 18, 32, 32)',
      note: 'The number of protons, so the positive charge on the nucleus. Everything else on the table follows from it.' },
    { g: 'Charge and electrons', id: 'zeff', label: 'Effective nuclear charge', get: (e) => P().zeff(e), f: (v) => v.toFixed(2),
      across: () => trend('zeff').across, down: () => trend('zeff').down, note: () => trend('zeff').note },
    { g: 'Charge and electrons', id: 'shield', label: 'Shielding (Slater\'s σ)', get: shielding, f: (v) => v.toFixed(2),
      across: 'rises only slightly →  (an electron in the same shell shields just 0.35)',
      down: 'rises steeply ↓  (a whole full shell more underneath)',
      note: 'How much of the nuclear charge the other electrons cancel: σ = Z − Z_eff, by Slater\'s rules. It is why Z_eff barely changes down a group.' },
    { g: 'Charge and electrons', id: 'shells', label: 'Shells (energy levels)', get: (e) => e.p, f: (v) => v,
      across: () => trend('shells').across, down: () => trend('shells').down, note: () => trend('shells').note },
    { g: 'Charge and electrons', id: 'outer', label: 'Outer-shell electrons', get: (e) => P().trendValue('outer', e), f: (v) => v,
      across: () => trend('outer').across, down: () => trend('outer').down, note: () => trend('outer').note },
    { g: 'Charge and electrons', id: 'core', label: 'Inner-shell (core) electrons', get: coreElectrons, f: (v) => v,
      across: 'stays the same → across the main groups (the d-block adds to an inner shell)',
      down: 'increases ↓  (a full shell more each period)',
      note: 'Every electron except those in the outermost shell. These do most of the shielding.' },
    { g: 'Charge and electrons', id: 'unpaired', label: 'Unpaired electrons', get: unpaired, f: (v) => v,
      across: 'rises to the middle of each block, then falls (Hund\'s rule: one per orbital before any pair up)',
      down: 'stays much the same ↓ in the main groups',
      note: 'In the ground-state atom. Gadolinium and curium have the most (8); an atom with unpaired electrons is paramagnetic.' },

    { g: 'Energy and reactivity', id: 'ie', label: 'First ionization energy', unit: 'kJ/mol', get: ieN(0), f: round,
      across: 'increases →  (more protons, same shell) — with small dips at groups 13 and 16',
      down: 'decreases ↓  (the outer electron is further out and more shielded)',
      note: 'Energy to remove one electron from each atom in a mole of gaseous atoms. NIST data.' },
    { g: 'Energy and reactivity', id: 'ie2', label: 'Second ionization energy', unit: 'kJ/mol', get: ieN(1), f: round,
      across: 'generally increases →, but peaks in group 1', down: 'decreases ↓',
      note: 'Removing a second electron. Group 1 is highest: its second electron has to come out of a full inner shell.' },
    { g: 'Energy and reactivity', id: 'ie3', label: 'Third ionization energy', unit: 'kJ/mol', get: ieN(2), f: round,
      across: 'generally increases →, but peaks in group 2', down: 'decreases ↓',
      note: 'Removing a third electron. Group 2 is highest: its third electron comes from a full inner shell.' },
    { g: 'Energy and reactivity', id: 'ea', label: 'Electron affinity', unit: 'kJ/mol', get: (e) => (e.x.ea != null ? e.x.ea * KJ : null), f: round,
      across: 'becomes larger →  reaching the halogens',
      down: 'generally smaller ↓  (but chlorine releases more than fluorine)',
      note: 'Energy released when a gaseous atom gains an electron — shown as a positive number here. Noble gases release none.' },
    { g: 'Energy and reactivity', id: 'en', label: 'Electronegativity (Pauling)', get: (e) => (e.x.en != null ? e.x.en : e.en), f: (v) => v.toFixed(2),
      across: () => trend('en').across, down: () => trend('en').down, note: () => trend('en').note },
    { g: 'Energy and reactivity', id: 'enA', label: 'Electronegativity (Allen)', get: (e) => (e.x.enA != null ? e.x.enA : null), f: (v) => v.toFixed(2),
      across: 'increases →', down: 'decreases ↓',
      note: 'Allen\'s scale (1989): the average energy of an atom\'s valence electrons. Unlike Pauling\'s, it gives the noble gases values — neon is the highest.' },
    { g: 'Energy and reactivity', id: 'metal', label: 'Metallic character', unit: 'kJ/mol', reverse: true, ends: ['least metallic', 'most metallic'], get: ieN(0), f: round,
      across: 'decreases →  (metals on the left, nonmetals on the right)',
      down: 'increases ↓  (the outer electrons are held less tightly)',
      note: 'How readily an atom gives up its outer electrons, shown by its first ionization energy turned round: the lower the energy, the brighter the square. Caesium is the most metallic.' },

    { g: 'Mass and matter', id: 'mass', label: 'Relative atomic mass', get: (e) => e.mass, f: (v) => (v === Math.round(v) ? '[' + v + ']' : dp2(v)),
      across: 'increases with atomic number (argon/potassium and tellurium/iodine are the famous swaps)', down: 'increases ↓',
      note: 'Brackets give the mass number of the longest-lived isotope, for elements with no stable one.' },
    { g: 'Mass and matter', id: 'neutrons', label: 'Neutrons', get: neutrons, f: (v) => v,
      across: 'increase →', down: 'increase ↓',
      note: 'In the most common isotope (or the longest-lived one). Light nuclei have about as many neutrons as protons; heavy ones need half as many again to hold together.' },
    { g: 'Mass and matter', id: 'd', label: 'Density', unit: 'g/cm³', log: true, get: (e) => (e.x.d != null ? e.x.d : e.d), f: (v) => fmt(v, 3),
      across: 'rises to the middle of the transition metals, then falls', down: 'increases ↓',
      note: 'Gases are shown at 0 °C and 1 atm. Osmium and iridium are the densest; the scale is logarithmic.' },
    { g: 'Mass and matter', id: 'mp', label: 'Melting point', unit: 'temp', get: mpK, f: null,
      across: 'rises to the middle of each period (to carbon, to silicon), then falls',
      down: 'falls down group 1; rises down group 17',
      note: 'Giant structures melt highest: carbon, tungsten. Molecular elements and noble gases melt lowest.' },
    { g: 'Mass and matter', id: 'bp', label: 'Boiling point', unit: 'temp', get: bpK, f: null,
      across: 'rises to the middle of each period, then falls', down: 'falls down group 1; rises down groups 17 and 18',
      note: 'At standard pressure. Tungsten and rhenium boil hottest; helium lowest.' },
    { g: 'Mass and matter', id: 'liq', label: 'Liquid range', unit: 'K', get: liquidRange, f: round,
      note: 'Boiling point minus melting point: how many degrees the element stays liquid. Gallium stays liquid for over 2,000 degrees. (A change of 1 K is a change of 1 °C.)' },

    { g: 'More', id: 'oxmax', label: 'Highest oxidation state', get: (e) => { const o = oxStates(e); return o.length ? Math.max.apply(null, o) : null; }, f: (v) => (v > 0 ? '+' + v : String(v)),
      across: 'rises with the outer electrons, up to +7 for manganese and chlorine', down: 'mostly the same ↓',
      note: 'Common oxidation states, from PubChem.' },
    { g: 'More', id: 'oxmin', label: 'Lowest oxidation state', get: (e) => { const o = oxStates(e); return o.length ? Math.min.apply(null, o) : null; }, f: (v) => (v > 0 ? '+' + v : String(v)),
      across: 'for the nonmetals, from −4 in group 14 up to −1 in group 17', down: 'mostly the same ↓',
      note: 'The most negative common state — the charge on the ion a nonmetal forms.' },
    { g: 'More', id: 'iso', label: 'Natural isotopes', get: (e) => (e.x.iso ? e.x.iso.length : 0), f: (v) => v,
      note: 'How many isotopes occur in nature. Tin has the most (10); an element with an odd atomic number never has more than two stable ones.' },
    { g: 'More', id: 'abC', label: 'Abundance in Earth\'s crust', unit: 'mg/kg', log: true, get: (e) => (e.x.abC > 0 ? e.x.abC : null), f: (v) => fmt(v, 2),
      note: 'Oxygen and silicon make up three quarters of the crust. The scale is logarithmic.' },
    { g: 'More', id: 'abO', label: 'Abundance in seawater', unit: 'mg/L', log: true, get: (e) => (e.x.abO > 0 ? e.x.abO : null), f: (v) => fmt(v, 2),
      note: 'Oxygen and hydrogen top it because they are the water itself; next come chlorine and sodium — the salt. The scale is logarithmic.' },
    { g: 'More', id: 'year', label: 'Year discovered', get: yearOf, f: (v) => v, note: 'Elements known since antiquity have no date and are left grey.' },
  ];
  const PROP = {};
  PROPS.forEach((p) => { PROP[p.id] = p; });
  const text = (v) => (typeof v === 'function' ? v() : v);

  /* ── The app ────────────────────────────────────────────────────────── */

  function loadPrefs() {
    try { return JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch (e) { return {}; }
  }

  function App(host, opts) {
    this.host = host;
    this.o = opts || {};
    const pref = loadPrefs();
    this.st = {
      colour: PROP[pref.colour] ? pref.colour : 'cat', unit: pref.unit === 'K' ? 'K' : 'C',
      temp: 298.15, sel: null, tab: pref.tab || 'overview', filling: false, query: '', hl: null, hlLabel: '', catFilter: null,
      spectrum: 'emission',
    };
    this.build();
    if (this.o.hash) this.readHash();
    this.refresh();
  }
  App.prototype.save = function () {
    const s = this.st;
    try { localStorage.setItem(STORE, JSON.stringify({ colour: s.colour, unit: s.unit, tab: s.tab })); } catch (e) { /* private window */ }
  };
  App.prototype.els = function () { return model(); };
  App.prototype.byN = byN;
  App.prototype.bySym = bySym;

  App.prototype.build = function () {
    const groups = [];
    PROPS.forEach((p) => {
      let g = groups.find((x) => x[0] === p.g);
      if (!g) groups.push(g = [p.g, []]);
      g[1].push(p);
    });
    const opts = groups.map((g) => '<optgroup label="' + esc(g[0]) + '">' + g[1].map((p) => '<option value="' + p.id + '">' + esc(p.label) + '</option>').join('') + '</optgroup>').join('');
    this.host.innerHTML = '<div class="fpt" tabindex="-1">'
      + '<div class="fpt-bar">'
      + '<div class="fpt-search"><input class="fpt-in fpt-q" type="search" autocomplete="off" spellcheck="false" placeholder="Find an element, or try “halogens”, “liquid”, “d-block”" aria-label="Find an element">'
      + '<div class="fpt-sugg" role="listbox" hidden></div></div>'
      + '<label class="fpt-colour"><span>Colour by</span><select class="fpt-in fpt-sel" aria-label="Colour the table by">' + opts + '</select></label>'
      + '<div class="fpt-unit" role="group" aria-label="Temperature unit"><button type="button" class="fpt-u" data-unit="C">°C</button><button type="button" class="fpt-u" data-unit="K">K</button></div>'
      + '</div>'
      + '<div class="fpt-body">'
      + '<section class="fpt-main"><div class="fpt-legend"></div><div class="fpt-scroll"><div class="fpt-grid" role="grid" aria-label="Periodic table"></div></div>'
      + '<div class="fpt-chart" hidden></div></section>'
      + '<aside class="fpt-side" aria-live="polite"></aside>'
      + '</div></div>';
    this.root = this.host.querySelector('.fpt');
    this.grid = this.host.querySelector('.fpt-grid');
    this.legend = this.host.querySelector('.fpt-legend');
    this.side = this.host.querySelector('.fpt-side');
    this.q = this.host.querySelector('.fpt-q');
    this.sugg = this.host.querySelector('.fpt-sugg');
    this.sel = this.host.querySelector('.fpt-sel');
    this.chart = this.host.querySelector('.fpt-chart');
    // Redraw the graph when it crosses between the phone and desktop sizes.
    if (window.ResizeObserver) {
      new ResizeObserver(() => {
        if (!this.chart.hidden && this.chartNarrow !== this.isNarrowChart()) this.renderChart();
      }).observe(this.chart);
    }
    this.buildGrid();
    this.wire();
  };

  App.prototype.buildGrid = function () {
    let h = '';
    for (let g = 1; g <= 18; g++) h += '<div class="fpt-lbl fpt-lbl--g" style="grid-row:1;grid-column:' + (g + 1) + '">' + g + '</div>';
    for (let p = 1; p <= 7; p++) h += '<div class="fpt-lbl fpt-lbl--p" style="grid-row:' + (p + 1) + ';grid-column:1">' + p + '</div>';
    h += '<div class="fpt-gap" style="grid-row:9;grid-column:1/-1"></div>';
    model().forEach((e) => {
      h += '<button type="button" class="fpt-el" role="gridcell" data-n="' + e.n + '" data-cat="' + e.cat + '" style="grid-row:' + (e.row + 1) + ';grid-column:' + (e.col + 1) + '"'
        + ' aria-label="' + esc(e.name) + ', ' + e.n + '" tabindex="' + (e.n === 1 ? 0 : -1) + '">'
        + '<span class="fpt-n">' + e.n + '</span><span class="fpt-s">' + esc(e.s) + '</span>'
        + '<span class="fpt-nm">' + esc(e.name) + '</span><span class="fpt-v"></span></button>';
    });
    // Where the f-block comes from.
    h += '<div class="fpt-fmark" style="grid-row:10;grid-column:1/4">57–71</div><div class="fpt-fmark" style="grid-row:11;grid-column:1/4">89–103</div>';
    this.grid.innerHTML = h;
    this.cells = {};
    this.grid.querySelectorAll('.fpt-el').forEach((b) => { this.cells[b.dataset.n] = b; });
  };

  App.prototype.wire = function () {
    const self = this;
    this.root.addEventListener('click', (ev) => {
      const t = ev.target;
      const cell = t.closest('.fpt-el');
      if (cell && this.grid.contains(cell)) {
        const n = +cell.dataset.n;
        self.select(self.st.sel === n ? null : n);
        return;
      }
      // A point on the trend graph is that element.
      const pt = t.closest('.fpt-pt');
      if (pt) { self.select(+pt.dataset.n); return; }
      const u = t.closest('[data-unit]');
      if (u && u.closest('.fpt-unit')) { self.st.unit = u.dataset.unit; self.save(); self.refresh(); return; }
      const act = t.closest('[data-act]');
      if (act) { self.action(act.dataset.act, act); }
    });
    this.sel.addEventListener('change', () => { this.st.colour = this.sel.value; this.st.catFilter = null; this.save(); if (this.o.hash) this.writeHash(); this.refresh(); });
    this.q.addEventListener('input', () => this.search(this.q.value));
    this.q.addEventListener('keydown', (ev) => {
      const items = [...this.sugg.querySelectorAll('[data-pick]')];
      const cur = items.findIndex((x) => x.classList.contains('is-on'));
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        ev.preventDefault();
        if (!items.length) return;
        const next = (cur + (ev.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length;
        items.forEach((x, i) => x.classList.toggle('is-on', i === next));
      } else if (ev.key === 'Enter') {
        ev.preventDefault();
        const it = items[cur >= 0 ? cur : 0];
        if (it) this.pick(it.dataset.pick);
      } else if (ev.key === 'Escape') {
        this.q.value = '';
        this.search('');
      }
    });
    this.sugg.addEventListener('mousedown', (ev) => {
      const it = ev.target.closest('[data-pick]');
      if (it) { ev.preventDefault(); this.pick(it.dataset.pick); }
    });
    this.q.addEventListener('blur', () => setTimeout(() => { this.sugg.hidden = true; }, 120));
    this.grid.addEventListener('keydown', (ev) => this.gridKey(ev));
    this.onKey = (ev) => {
      if (!this.root.isConnected) return;
      const inField = /^(INPUT|TEXTAREA|SELECT)$/.test((ev.target && ev.target.tagName) || '');
      if (ev.key === '/' && !inField) { ev.preventDefault(); this.q.focus(); }
      else if (ev.key === 'Escape' && !inField && this.st.sel) this.select(null);
    };
    document.addEventListener('keydown', this.onKey);
  };

  /* ── Search ─────────────────────────────────────────────────────────── */

  const GROUP_WORDS = {
    halogen: (e) => e.cat === 'halogen', 'noble gas': (e) => e.cat === 'noble', noble: (e) => e.cat === 'noble',
    alkali: (e) => e.cat === 'alkali', 'alkali metal': (e) => e.cat === 'alkali', 'alkaline earth': (e) => e.cat === 'alkaline', alkaline: (e) => e.cat === 'alkaline',
    transition: (e) => e.cat === 'transition', 'transition metal': (e) => e.cat === 'transition', lanthanide: (e) => e.cat === 'lanthanide', actinide: (e) => e.cat === 'actinide',
    metalloid: (e) => e.cat === 'metalloid', nonmetal: (e) => ['nonmetal', 'halogen', 'noble'].indexOf(e.cat) >= 0,
    metal: (e) => ['alkali', 'alkaline', 'transition', 'post-transition', 'lanthanide', 'actinide'].indexOf(e.cat) >= 0,
    gas: (e) => stateAt(e, 298.15) === 'g', liquid: (e) => stateAt(e, 298.15) === 'l', solid: (e) => stateAt(e, 298.15) === 's',
    radioactive: radioactive,
    's-block': (e) => block(e) === 's', 'p-block': (e) => block(e) === 'p', 'd-block': (e) => block(e) === 'd', 'f-block': (e) => block(e) === 'f',
    diatomic: (e) => ['H', 'N', 'O', 'F', 'Cl', 'Br', 'I'].indexOf(e.s) >= 0,
  };
  function groupWord(q) {
    const s = q.toLowerCase().trim();
    for (const w of [s, s.replace(/es$/, ''), s.replace(/s$/, '')]) if (GROUP_WORDS[w]) return w;
    const m = /^group\s*(\d{1,2})$/.exec(s);
    if (m && +m[1] >= 1 && +m[1] <= 18) return 'group ' + m[1];
    const pm = /^period\s*([1-7])$/.exec(s);
    if (pm) return 'period ' + pm[1];
    return null;
  }
  function groupTest(word) {
    if (GROUP_WORDS[word]) return GROUP_WORDS[word];
    const g = /^group (\d+)$/.exec(word);
    if (g) return (e) => e.g === +g[1];
    const p = /^period (\d)$/.exec(word);
    if (p) return (e) => e.p === +p[1];
    return () => false;
  }
  function matches(q) {
    const s = q.toLowerCase().trim();
    if (!s) return [];
    const out = [];
    model().forEach((e) => {
      let score = 0;
      const nm = e.name.toLowerCase();
      if (String(e.n) === s) score = 100;
      else if (e.s.toLowerCase() === s) score = 90;
      else if (nm === s) score = 85;
      else if (nm.startsWith(s)) score = 60;
      else if (s.length >= 3 && nm.indexOf(s) >= 0) score = 30;
      else if (e.s.toLowerCase().startsWith(s)) score = 20;
      if (score) out.push({ e: e, score: score });
    });
    return out.sort((a, b) => b.score - a.score || a.e.n - b.e.n).map((x) => x.e);
  }
  App.prototype.search = function (q) {
    this.st.query = q;
    const word = groupWord(q);
    const found = matches(q);
    let html = '';
    if (word) {
      const n = model().filter(groupTest(word)).length;
      html += '<div class="fpt-sug" data-pick="w:' + esc(word) + '"><b>' + esc(word.charAt(0).toUpperCase() + word.slice(1)) + '</b><span>' + n + ' elements</span></div>';
    }
    found.slice(0, 7).forEach((e) => {
      html += '<div class="fpt-sug" data-pick="n:' + e.n + '"><span class="fpt-sug-s" style="--c:' + CAT[e.cat].colour + '">' + esc(e.s) + '</span><b>' + esc(e.name) + '</b><span>' + e.n + '</span></div>';
    });
    this.sugg.innerHTML = html;
    this.sugg.hidden = !html;
    const first = this.sugg.querySelector('[data-pick]');
    if (first) first.classList.add('is-on');
    // Light up what matches as you type.
    if (!q.trim()) this.highlight(null);
    else if (word) this.highlight(model().filter(groupTest(word)).map((e) => e.n), word);
    else this.highlight(found.map((e) => e.n), '“' + q.trim() + '”');
  };
  App.prototype.pick = function (v) {
    this.sugg.hidden = true;
    if (v.indexOf('n:') === 0) {
      this.q.value = '';
      this.st.query = '';
      this.highlight(null);
      this.select(+v.slice(2));
      const cell = this.cells[v.slice(2)];
      if (cell) cell.focus({ preventScroll: true });
    } else if (v.indexOf('w:') === 0) {
      const w = v.slice(2);
      this.highlight(model().filter(groupTest(w)).map((e) => e.n), w);
    }
  };

  /* ── Highlighting (search) ──────────────────────────────────────────── */

  /** Light up these elements and dim the rest; null clears it. */
  App.prototype.highlight = function (ns, label) {
    this.st.hl = ns ? new Set(ns) : null;
    this.st.hlLabel = label || '';
    this.paint();
    this.renderLegend();
  };

  /* ── Painting the cells ─────────────────────────────────────────────── */

  App.prototype.paint = function () {
    const st = this.st, prop = PROP[st.colour];
    let lo = Infinity, hi = -Infinity;
    const vals = {};
    if (!prop.kind) {
      model().forEach((e) => {
        const v = prop.get(e);
        if (v == null || !Number.isFinite(v) || (prop.log && v <= 0)) return;
        vals[e.n] = v;
        const t = prop.log ? Math.log10(v) : v;
        lo = Math.min(lo, t); hi = Math.max(hi, t);
      });
    }
    this.range = { lo: lo, hi: hi };
    model().forEach((e) => {
      const b = this.cells[e.n];
      if (!b) return;
      let bg = '', ink = '', value = massText(e), none = false;
      if (prop.kind === 'cat') bg = CAT[e.cat].colour;
      else if (prop.kind === 'block') bg = BLOCKS[block(e)][1];
      else if (prop.kind === 'state') {
        const s = stateAt(e, st.temp);
        bg = STATES[s][1];
        value = STATES[s][0];
        none = s === 'u';
      } else {
        const v = vals[e.n];
        if (v == null) { none = true; value = '—'; }
        else {
          let t = hi > lo ? ((prop.log ? Math.log10(v) : v) - lo) / (hi - lo) : 0.5;
          if (prop.reverse) t = 1 - t;
          bg = P().trendColor(t);
          ink = t > 0.62 ? '#10131a' : '#fff';
          value = prop.unit === 'temp' ? this.tempText(v, true) : String(prop.f ? prop.f(v) : fmt(v));
        }
      }
      b.style.setProperty('--c', bg || '');
      // A property colours the cell outright; categories tint it (see the CSS).
      b.style.background = prop.kind ? '' : (bg || '');
      b.style.color = ink;
      b.classList.toggle('is-heat', !prop.kind && !none);
      b.classList.toggle('is-none', none);
      b.querySelector('.fpt-v').textContent = value;
      const dim = (st.hl && !st.hl.has(e.n)) || (st.catFilter && e.cat !== st.catFilter && st.colour === 'cat');
      b.classList.toggle('is-dim', !!dim);
      b.classList.toggle('is-hl', !!(st.hl && st.hl.has(e.n)));
      b.classList.toggle('is-sel', st.sel === e.n);
    });
    this.root.dataset.colour = st.colour;
    this.renderChart();
  };

  /* ── The trend against atomic number ────────────────────────────────── */

  /** Round steps for a linear axis: 1, 2 or 5 times a power of ten. */
  function niceTicks(lo, hi, n) {
    const span = hi - lo || 1, raw = span / (n || 5), p = Math.pow(10, Math.floor(Math.log10(raw)));
    const m = raw / p, step = (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
    const out = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(+v.toPrecision(12));
    return out;
  }
  const PERIOD_ENDS = [[2, 'He'], [10, 'Ne'], [18, 'Ar'], [36, 'Kr'], [54, 'Xe'], [86, 'Rn'], [118, 'Og']];
  /**
   * The property plotted against atomic number. The table shows where the
   * values are; the graph shows that they repeat — a peak or a trough in the
   * same place every period, which is what "periodic" means.
   */
  App.prototype.renderChart = function () {
    const box = this.chart, st = this.st, prop = PROP[st.colour];
    if (!box) return;
    const pts = [];
    if (!prop.kind) model().forEach((e) => { const v = prop.get(e); if (v != null && Number.isFinite(v) && (!prop.log || v > 0)) pts.push({ e: e, v: v }); });
    if (pts.length < 3) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    /* A phone draws the graph at a readable 640 px and lets it scroll sideways,
       instead of shrinking 118 points and their labels to a smudge. */
    const narrow = this.chartNarrow = this.isNarrowChart();
    const f = (v) => (prop.log ? Math.log10(v) : v);
    let lo = Infinity, hi = -Infinity;
    pts.forEach((p) => { lo = Math.min(lo, f(p.v)); hi = Math.max(hi, f(p.v)); });
    // Start a positive quantity at zero when that doesn't squash the data flat.
    if (!prop.log && lo >= 0 && lo < hi * 0.35) lo = 0;
    const y0 = lo, y1 = hi + (hi - lo) * 0.06 || hi + 1;
    const zmax = Math.max.apply(null, pts.map((p) => p.e.n));
    const W = narrow ? 640 : 900, H = 250, L = 56, R = 14, T = 18, B = 36;
    const X = (z) => L + ((z - 1) / Math.max(1, zmax - 1)) * (W - L - R);
    const Y = (v) => T + (1 - (f(v) - y0) / Math.max(1e-9, y1 - y0)) * (H - T - B);
    const unit = prop.unit === 'temp' ? (st.unit === 'K' ? ' K' : ' °C') : prop.unit ? ' ' + prop.unit : '';
    const show = (v) => (prop.unit === 'temp' ? this.tempText(v, true) : String(prop.f ? prop.f(v) : fmt(v)));
    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="fpt-chart-svg' + (narrow ? ' is-fixed' : '') + '" role="img" aria-label="' + esc(prop.label) + ' against atomic number">';
    // Value axis: round numbers in the unit being shown.
    const shift = prop.unit === 'temp' && st.unit === 'C' ? 273.15 : 0;
    let ticks;
    if (prop.log) { ticks = []; for (let q = Math.ceil(y0); q <= Math.floor(y1); q++) ticks.push(Math.pow(10, q)); }
    else ticks = niceTicks(y0 - shift, y1 - shift, 5).map((t) => t + shift);
    ticks.forEach((v) => {
      const y = Y(v);
      if (y < T - 1 || y > H - B + 1) return;
      const lab = prop.unit === 'temp' ? this.tempText(v, true) : fmt(v, 3);
      s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '" class="fpt-cgrid"/>'
        + '<text x="' + (L - 6) + '" y="' + (y + 3.5).toFixed(1) + '" class="fpt-cax">' + esc(lab) + '</text>';
    });
    // Where each period ends, at its noble gas.
    PERIOD_ENDS.forEach((pe) => {
      if (pe[0] > zmax) return;
      const x = X(pe[0] + 0.5);
      s += '<line x1="' + x.toFixed(1) + '" x2="' + x.toFixed(1) + '" y1="' + T + '" y2="' + (H - B) + '" class="fpt-cbound"/>'
        + '<text x="' + X(pe[0]).toFixed(1) + '" y="' + (T - 5) + '" class="fpt-cax fpt-cax--m">' + pe[1] + '</text>';
    });
    // The line, broken where elements have no value.
    let d = '', prev = null;
    pts.forEach((p) => {
      d += (prev && p.e.n === prev + 1 ? 'L' : 'M') + X(p.e.n).toFixed(1) + ' ' + Y(p.v).toFixed(1);
      prev = p.e.n;
    });
    s += '<path d="' + d + '" class="fpt-cline"/>';
    let selPt = null;
    pts.forEach((p) => {
      const sel = st.sel === p.e.n;
      if (sel) selPt = p;
      const dim = st.hl && !st.hl.has(p.e.n);
      s += '<circle class="fpt-pt' + (sel ? ' is-sel' : '') + (dim ? ' is-dim' : '') + '" data-n="' + p.e.n + '" cx="' + X(p.e.n).toFixed(1) + '" cy="' + Y(p.v).toFixed(1) + '" r="' + (sel ? 5.5 : 3.2)
        + '" style="--c:' + CAT[p.e.cat].colour + '"><title>' + esc(p.e.name + ' (' + p.e.n + '): ' + show(p.v) + unit) + '</title></circle>';
    });
    if (selPt) {
      const x = X(selPt.e.n), y = Y(selPt.v), right = x > W - 140;
      s += '<text x="' + (x + (right ? -9 : 9)).toFixed(1) + '" y="' + (y - 8).toFixed(1) + '" class="fpt-clab' + (right ? ' is-end' : '') + '">' + esc(selPt.e.s + ' ' + show(selPt.v) + unit) + '</text>';
    }
    // Atomic number axis.
    for (let z = 10; z <= zmax; z += 10) s += '<text x="' + X(z).toFixed(1) + '" y="' + (H - B + 15) + '" class="fpt-cax fpt-cax--m">' + z + '</text>';
    s += '<text x="' + ((L + W - R) / 2) + '" y="' + (H - 4) + '" class="fpt-cax fpt-cax--m">atomic number →</text></svg>';
    box.innerHTML = '<div class="fpt-chart-h"><b>' + esc(prop.label) + (unit ? ' <small>(' + esc(unit.trim()) + (prop.log ? ', log scale' : '') + ')</small>' : prop.log ? ' <small>(log scale)</small>' : '')
      + '</b><span>against atomic number</span></div><div class="fpt-chart-wrap">' + s + '</div>'
      + '<p class="fpt-note">The same rise and fall comes back in every period — that repeating pattern is what makes the table periodic. Dashed lines end each period at its noble gas; click a point to open that element.</p>';
    if (narrow && selPt) {
      const wrap = box.querySelector('.fpt-chart-wrap');
      wrap.scrollLeft = Math.max(0, X(selPt.e.n) - wrap.clientWidth / 2);
    }
  };

  App.prototype.isNarrowChart = function () {
    const w = this.chart ? this.chart.clientWidth : 0;
    return w > 0 && w < 660;
  };

  App.prototype.tempText = function (K, short) {
    if (K == null) return '—';
    const dp = (v) => (Math.abs(v) >= 1000 ? 0 : Math.abs(v) >= 100 ? 1 : 2);
    if (this.st.unit === 'K') return trim0(K.toFixed(dp(K))) + (short ? '' : ' K');
    const c = +(K - 273.15).toFixed(4);
    return trim0(c.toFixed(dp(c))) + (short ? '' : ' °C');
  };

  /* ── The legend under the controls ──────────────────────────────────── */

  App.prototype.tempLabel = function () {
    const K = this.st.temp;
    return esc(this.tempText(K)) + (this.st.unit === 'C' ? ' <small>(' + Math.round(K) + ' K)</small>' : ' <small>(' + Math.round(K - 273.15) + ' °C)</small>');
  };
  App.prototype.renderLegend = function () {
    const st = this.st, prop = PROP[st.colour];
    let h = '';
    if (st.hl) {
      h += '<div class="fpt-hlbar"><span>Showing <b>' + st.hl.size + '</b> ' + (st.hlLabel ? 'for ' + esc(st.hlLabel) : 'elements') + '</span>'
        + '<button type="button" class="fpt-link" data-act="clearhl">Show all</button></div>';
    }
    if (prop.kind === 'cat') {
      h += '<div class="fpt-chips">' + CATS.map((c) => '<button type="button" class="fpt-chip' + (st.catFilter === c[0] ? ' is-on' : '') + '" data-act="cat" data-cat="' + c[0] + '">'
        + '<i style="background:' + c[2] + '"></i>' + esc(c[1]) + '</button>').join('') + '</div>';
    } else if (prop.kind === 'block') {
      h += '<div class="fpt-chips">' + Object.keys(BLOCKS).map((k) => '<span class="fpt-chip is-static"><i style="background:' + BLOCKS[k][1] + '"></i>' + BLOCKS[k][0] + '</span>').join('')
        + '<span class="fpt-note">The block is the subshell the last electron goes into.</span></div>';
    } else if (prop.kind === 'state') {
      const counts = { s: 0, l: 0, g: 0, u: 0 };
      model().forEach((e) => { counts[stateAt(e, st.temp)]++; });
      const presets = [[298.15, 'Room'], [310.15, 'Body'], [373.15, 'Water boils'], [1811, 'Iron melts'], [5778, 'Sun’s surface']];
      h += '<div class="fpt-temp"><label><span>Temperature</span><input class="fpt-in fpt-range" type="range" min="0" max="6000" step="1" value="' + Math.round(st.temp) + '" aria-label="Temperature in kelvin"></label>'
        + '<b class="fpt-temp-v">' + this.tempLabel() + '</b>'
        + '<span class="fpt-presets">' + presets.map((p) => '<button type="button" class="fpt-chip" data-act="temp" data-k="' + p[0] + '">' + p[1] + '</button>').join('') + '</span></div>'
        + '<div class="fpt-chips fpt-states">' + ['s', 'l', 'g', 'u'].map((k) => '<span class="fpt-chip is-static"><i style="background:' + STATES[k][1] + '"></i>' + STATES[k][0] + ' <b>' + counts[k] + '</b></span>').join('') + '</div>';
    } else {
      const lo = this.range.lo, hi = this.range.hi;
      const end = (t) => {
        const v = prop.log ? Math.pow(10, t) : t;
        return prop.unit === 'temp' ? this.tempText(v) : (prop.f ? prop.f(v) : fmt(v)) + (prop.unit ? ' ' + prop.unit : '');
      };
      const stops = [0, 0.25, 0.5, 0.75, 1].map((f) => P().trendColor(f)).join(',');
      // A reversed scale (metallic character) runs from the highest value to the lowest.
      const a = prop.reverse ? hi : lo, b = prop.reverse ? lo : hi;
      const endText = (t, k) => (Number.isFinite(t) ? (prop.ends ? '<b>' + prop.ends[k] + '</b> ' : '') + esc(end(t)) : '');
      h += '<div class="fpt-key"><div class="fpt-scale"><span>' + endText(a, 0) + '</span><i style="background:linear-gradient(90deg,' + stops + ')"></i>'
        + '<span>' + endText(b, 1) + '</span><span class="fpt-nodata"><i></i>no data</span></div>';
      const across = text(prop.across), down = text(prop.down), note = text(prop.note);
      if (across || down) h += '<div class="fpt-dirs">' + (across ? '<div><b>Across a period</b> ' + esc(across) + '</div>' : '') + (down ? '<div><b>Down a group</b> ' + esc(down) + '</div>' : '') + '</div>';
      if (note) h += '<div class="fpt-note">' + esc(note) + '</div>';
      h += '</div>';
    }
    this.legend.innerHTML = h;
    const range = this.legend.querySelector('.fpt-range');
    if (range) {
      range.addEventListener('input', () => {
        st.temp = +range.value;
        this.paint();
        const v = this.legend.querySelector('.fpt-temp-v');
        if (v) v.innerHTML = this.tempLabel();
        const counts = { s: 0, l: 0, g: 0, u: 0 };
        model().forEach((e) => { counts[stateAt(e, st.temp)]++; });
        this.legend.querySelectorAll('.fpt-states .fpt-chip b').forEach((b, i) => { b.textContent = counts['slgu'[i]]; });
      });
    }
  };

  /* ── Views and actions ──────────────────────────────────────────────── */

  App.prototype.select = function (n) {
    this.st.sel = n;
    if (n && this.cells[n]) Object.keys(this.cells).forEach((k) => { this.cells[k].tabIndex = +k === n ? 0 : -1; });
    if (this.o.hash) this.writeHash();
    this.paint();
    this.renderSide();
    // On a narrow screen the details sit under the table: bring them into view.
    if (n && this.root.clientWidth < 1100 && this.o.scrollToDetail !== false && this.side.getBoundingClientRect().top > window.innerHeight - 80) {
      this.side.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  };
  App.prototype.action = function (act, el) {
    const st = this.st;
    switch (act) {
      case 'clearhl': this.q.value = ''; st.query = ''; this.highlight(null); return;
      case 'cat': st.catFilter = st.catFilter === el.dataset.cat ? null : el.dataset.cat; this.paint(); this.renderLegend(); return;
      case 'temp': st.temp = +el.dataset.k; this.paint(); this.renderLegend(); return;
      case 'tab': st.tab = el.dataset.tab; this.save(); this.renderSide(); return;
      case 'close': this.select(null); return;
      case 'step': this.select(Math.max(1, Math.min(118, st.sel + +el.dataset.d))); return;
      case 'order': st.filling = !st.filling; this.renderSide(); return;
      case 'spectrum': st.spectrum = el.dataset.mode; this.renderSide(); return;
      case 'goto': this.select(+el.dataset.n); return;
      case 'colour': st.colour = el.dataset.c; st.catFilter = null; this.save(); if (this.o.hash) this.writeHash(); this.refresh(); return;
      default:
    }
  };

  App.prototype.renderTabs = function () {
    this.root.querySelectorAll('.fpt-unit button').forEach((b) => b.classList.toggle('is-on', b.dataset.unit === this.st.unit));
  };
  App.prototype.refresh = function () {
    this.sel.value = this.st.colour;
    this.renderTabs();
    this.paint();
    this.renderLegend();
    this.renderSide();
  };

  /* ── Keyboard on the table ──────────────────────────────────────────── */

  App.prototype.gridKey = function (ev) {
    const cell = ev.target.closest && ev.target.closest('.fpt-el');
    if (!cell) return;
    const e = byN(+cell.dataset.n);
    let target = null;
    const at = (r, c) => model().find((x) => x.row === r && x.col === c);
    if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') {
      const d = ev.key === 'ArrowRight' ? 1 : -1;
      for (let c = e.col + d; c >= 1 && c <= 18 && !target; c += d) target = at(e.row, c);
    } else if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      const d = ev.key === 'ArrowDown' ? 1 : -1;
      for (let r = e.row + d; r >= 1 && r <= 10 && !target; r += d) target = at(r, e.col);
    } else if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      this.select(e.n);
      return;
    } else if (ev.key === 'Home') target = byN(1);
    else if (ev.key === 'End') target = byN(118);
    if (!target) return;
    ev.preventDefault();
    const b = this.cells[target.n];
    Object.keys(this.cells).forEach((k) => { this.cells[k].tabIndex = -1; });
    b.tabIndex = 0;
    b.focus();
    if (this.st.sel) this.select(target.n);
  };

  /* ── The side panel ─────────────────────────────────────────────────── */

  App.prototype.renderSide = function () {
    const st = this.st;
    this.root.classList.toggle('has-detail', !!st.sel);
    if (!st.sel) { this.side.innerHTML = this.introHTML(); return; }
    const e = byN(st.sel);
    this.side.innerHTML = this.detailHTML(e);
    const cv = this.side.querySelector('.fpt-bohr');
    if (cv) cv.innerHTML = bohrSVG(e);
  };

  App.prototype.introHTML = function () {
    const card = (act, data, icon, title, sub) => '<button type="button" class="fpt-card" data-act="' + act + '" ' + data + '><span class="fpt-card-i" aria-hidden="true">' + icon + '</span><span><b>' + title + '</b><small>' + sub + '</small></span></button>';
    return '<div class="fpt-intro"><h2>Pick an element</h2><p>Click any element for its electrons, ionization energies, isotopes and emission spectrum. Arrow keys move around the table; <kbd>/</kbd> searches.</p>'
      + '<p>Or colour the table by a trend — ' + (PROPS.length - 3) + ' of them are under “Colour by”, each with a graph against atomic number.</p>'
      + '<div class="fpt-cards">'
      + card('colour', 'data-c="rc"', '◎', 'Atomic radius', 'Smaller across, bigger down')
      + card('colour', 'data-c="ie"', '⚡', 'Ionization energy', 'The dips at groups 13 and 16')
      + card('colour', 'data-c="en"', '±', 'Electronegativity', 'Climbing to fluorine')
      + card('colour', 'data-c="zeff"', '⊕', 'Effective nuclear charge', 'And the shielding behind it')
      + card('colour', 'data-c="metal"', '◆', 'Metallic character', 'Down and to the left')
      + card('colour', 'data-c="state"', '🌡', 'Melt the table', 'Drag the temperature')
      + '</div></div>';
  };

  App.prototype.detailHTML = function (e) {
    const st = this.st;
    const tabs = [['overview', 'Overview'], ['electrons', 'Electrons'], ['energy', 'Energy'], ['isotopes', 'Isotopes'], ['spectrum', 'Spectrum']];
    const body = { overview: this.overviewHTML, electrons: this.electronsHTML, energy: this.energyHTML, isotopes: this.isotopesHTML, spectrum: this.spectrumHTML }[st.tab] || this.overviewHTML;
    return '<div class="fpt-detail" style="--c:' + CAT[e.cat].colour + '">'
      + '<div class="fpt-dhead"><div class="fpt-tile"><span class="fpt-tile-n">' + e.n + '</span><span class="fpt-tile-s">' + esc(e.s) + '</span><span class="fpt-tile-m">' + esc(massText(e)) + '</span></div>'
      + '<div class="fpt-dname"><h2>' + esc(e.name) + '</h2><span class="fpt-dcat">' + esc(CAT[e.cat].label.replace(/s$/, '')) + ' · ' + block(e) + '-block</span>'
      + '<div class="fpt-dacts"><button type="button" class="fpt-ibtn" data-act="step" data-d="-1" aria-label="Previous element"' + (e.n === 1 ? ' disabled' : '') + '>‹</button>'
      + '<button type="button" class="fpt-ibtn" data-act="step" data-d="1" aria-label="Next element"' + (e.n === 118 ? ' disabled' : '') + '>›</button>'
      + '<button type="button" class="fpt-ibtn" data-act="close" aria-label="Close">✕</button></div></div></div>'
      + '<div class="fpt-dtabs" role="tablist">' + tabs.map((t) => '<button type="button" role="tab" aria-selected="' + (st.tab === t[0]) + '" class="fpt-dtab' + (st.tab === t[0] ? ' is-on' : '') + '" data-act="tab" data-tab="' + t[0] + '">' + t[1] + '</button>').join('') + '</div>'
      + '<div class="fpt-dbody">' + body.call(this, e) + '</div></div>';
  };

  const row = (k, v) => '<div class="fpt-kv"><span>' + k + '</span><b>' + v + '</b></div>';
  /** Where a value ranks among the elements that have one. */
  function rank(prop, e) {
    const vals = model().map((x) => ({ n: x.n, v: prop.get(x) })).filter((x) => x.v != null && Number.isFinite(x.v)).sort((a, b) => b.v - a.v);
    const i = vals.findIndex((x) => x.n === e.n);
    if (i < 0) return '';
    const place = i + 1, n = vals.length;
    if (place === 1) return 'highest of ' + n;
    if (place === n) return 'lowest of ' + n;
    // Counted from whichever end is nearer: "6th lowest", not "103rd highest".
    return place <= n / 2 ? ordinal(place) + ' highest of ' + n : ordinal(n - place + 1) + ' lowest of ' + n;
  }

  App.prototype.overviewHTML = function (e) {
    const s25 = stateAt(e, 298.15);
    const ox = oxStates(e);
    const flame = FLAME[e.s];
    const year = typeof e.year === 'number' ? (e.year < 0 ? Math.abs(e.year) + ' BCE' : String(e.year)) : (e.x.yr || '—');
    const d = e.x.d != null ? e.x.d : e.d;
    const en = e.x.en != null ? e.x.en : e.en;
    let h = '<p class="fpt-fact">' + esc(e.fact || '') + '</p><div class="fpt-kvs">'
      + row('Atomic number', e.n)
      + (neutrons(e) != null ? row('Protons · neutrons · electrons', e.n + ' · ' + neutrons(e) + ' · ' + e.n) : '')
      + row('Relative atomic mass', esc(e.mass === Math.round(e.mass) ? '[' + e.mass + '] — most stable isotope' : String(e.mass)))
      + row('Group · period', (e.g || '—') + ' · ' + e.p)
      + row('State at 25 °C', STATES[s25][0] + (e.x.stNote ? ' (predicted)' : ''))
      + row('Melting point', esc(this.tempText(mpK(e))))
      + row('Boiling point', esc(this.tempText(bpK(e))))
      + row('Density', d != null ? fmt(d, 4) + ' g/cm³' : '—')
      + row('Electronegativity', en != null ? en.toFixed(2) : '—')
      + row('Oxidation states', ox.length ? ox.map((q) => (q > 0 ? '+' + q : q)).join(', ') : '—')
      + row('Discovered', esc(year + (e.by ? ' · ' + e.by : '')))
      + (e.x.abC ? row('In Earth\'s crust', fmt(e.x.abC, 3) + ' mg/kg') : '')
      + (e.x.hl ? row('Longest-lived isotope', esc(e.s + '-' + e.x.hl[0] + ': ' + halfText(e.x.hl[1]))) : '')
      + '</div>';
    if (flame) h += '<div class="fpt-flame"><i style="background:' + flame[1] + '"></i>Flame test: <b>' + flame[0] + '</b></div>';
    h += '<div class="fpt-more">' + ['electrons', 'energy', 'isotopes', 'spectrum'].map((t) => '<button type="button" class="fpt-chip" data-act="tab" data-tab="' + t + '">' + t.charAt(0).toUpperCase() + t.slice(1) + ' →</button>').join('') + '</div>';
    return h;
  };

  App.prototype.electronsHTML = function (e) {
    const F = C();
    let occ;
    try { occ = F.occupancy(e.ec); } catch (err) { return '<p class="fpt-note">No configuration on record.</p>'; }
    const t = F.configText(occ, { filling: this.st.filling });
    const shells = {};
    Object.keys(occ).forEach((k) => { shells[k[0]] = (shells[k[0]] || 0) + occ[k]; });
    const perShell = Object.keys(shells).sort().map((n) => shells[n]);
    const orb = F.orbitals(occ);
    const unpaired = orb.reduce((a, o) => a + o.unpaired, 0);
    const z = P().zeff(e), outer = P().trendValue('outer', e);
    let h = '<div class="fpt-config"><div class="fpt-config-t">' + esc(t.short) + '</div>'
      + (t.full !== t.short ? '<div class="fpt-config-f">' + esc(t.full) + '</div>' : '')
      + '<button type="button" class="fpt-link" data-act="order">' + (this.st.filling ? 'Show in shell order' : 'Show in filling order (4s before 3d)') + '</button></div>';
    h += '<div class="fpt-sub">Orbital boxes</div><div class="fpt-orbs">' + orb.map((o) => '<div class="fpt-orb"><div class="fpt-boxes">'
      + o.boxes.map((b) => '<span class="fpt-box">' + (b === 2 ? '↑↓' : b === 1 ? '↑' : '') + '</span>').join('') + '</div><span>' + o.sub + '</span></div>').join('') + '</div>';
    h += '<div class="fpt-kvs">' + row('Electrons per shell', perShell.join(', '))
      + row('Outer-shell electrons', outer != null ? outer : '—')
      + row('Unpaired electrons', unpaired + (unpaired ? ' — paramagnetic' : ' — diamagnetic'))
      + row('Effective nuclear charge', z != null ? z.toFixed(2) + ' <small>(Slater)</small>' : '—') + '</div>';
    h += '<div class="fpt-bohr" aria-hidden="true"></div>';
    // The ions it forms, with where their electrons went.
    const ions = oxStates(e).filter((q) => q !== 0 && Math.abs(q) <= 4 && (q < 0 ? e.n - q <= 118 : q <= e.n));
    if (ions.length) {
      h += '<div class="fpt-sub">Its common ions</div><div class="fpt-ions">' + ions.map((q) => {
        let r;
        try { r = F.ionConfig(e.ec, e.n, q); } catch (err) { return ''; }
        const lab = e.s + F.toSup((Math.abs(q) > 1 ? Math.abs(q) : '') + (q > 0 ? '+' : '-'));
        return '<div class="fpt-ion"><b>' + esc(lab) + '</b><span>' + esc(r.text.short) + '</span></div>';
      }).join('') + '</div>';
      if (block(e) === 'd') h += '<p class="fpt-note">Transition metals lose their outer s electrons before d — the outer shell empties first.</p>';
    }
    return h;
  };

  App.prototype.energyHTML = function (e) {
    const ie = ievals(e);
    const en = PROP.en.get(e), ea = PROP.ea.get(e), ie1 = ie[0];
    let h = '<div class="fpt-kvs">'
      + row('First ionization energy', ie1 != null ? Math.round(ie1 * KJ) + ' kJ/mol <small>(' + ie1 + ' eV · ' + rank(PROP.ie, e) + ')</small>' : '—')
      + (ie[1] != null ? row('Second ionization energy', Math.round(ie[1] * KJ) + ' kJ/mol') : '')
      + row('Electron affinity', ea != null ? Math.round(ea) + ' kJ/mol' : '—')
      + row('Electronegativity (Pauling)', en != null ? en.toFixed(2) + ' <small>(' + rank(PROP.en, e) + ')</small>' : '—')
      + (e.x.enA != null ? row('Electronegativity (Allen)', e.x.enA.toFixed(2)) : '')
      + row('Atomic radius (covalent)', e.x.rc != null ? e.x.rc + ' pm <small>(' + rank(PROP.rc, e) + ')</small>' : '—')
      + (e.x.re != null ? row('Empirical radius', e.x.re + ' pm') : '')
      + row('Van der Waals radius', e.x.rv != null ? e.x.rv + ' pm' : '—')
      + row('Effective nuclear charge', P().zeff(e) != null ? P().zeff(e).toFixed(2) + ' <small>(shielding σ = ' + shielding(e).toFixed(2) + ')</small>' : '—')
      + '</div>';
    if (ie.length > 1) h += ieChart(e, ie);
    return h;
  };

  App.prototype.isotopesHTML = function (e) {
    const iso = e.x.iso;
    if (!iso) {
      let h = '<p class="fpt-lead">' + esc(e.name) + ' has no stable isotopes' + (e.x.abC ? ' — what exists in nature is left over from, or made by, radioactive decay' : ' — it is made, not found') + '.</p>';
      if (e.x.hl) h += '<div class="fpt-kvs">' + row('Longest-lived isotope', esc(e.s + '-' + e.x.hl[0])) + row('Half-life', esc(halfText(e.x.hl[1])) + (e.x.hl[3] ? ' <small>(estimated)</small>' : '')) + '</div>';
      return h;
    }
    const sum = iso.reduce((a, x) => a + x[1] * x[2], 0);
    const max = Math.max.apply(null, iso.map((x) => x[2]));
    const pct = (a) => (a * 100 >= 0.01 ? trim0((a * 100).toFixed(a >= 0.1 ? 2 : 3)) : fmt(a * 100, 2));
    let h = '<table class="fpt-iso"><thead><tr><th>Isotope</th><th>Mass (u)</th><th>Abundance</th></tr></thead><tbody>'
      + iso.map((x) => '<tr><td><sup>' + x[0] + '</sup>' + esc(e.s) + '</td><td>' + x[1].toFixed(4) + '</td><td><span class="fpt-meter"><i style="width:' + (x[2] / max * 100).toFixed(1) + '%"></i></span>' + pct(x[2]) + '%</td></tr>').join('')
      + '</tbody></table>';
    // How the atomic mass comes from them: the working an exam asks for.
    if (iso.length > 1) {
      const terms = iso.filter((x) => x[2] >= 0.001).map((x) => '(' + x[1].toFixed(2) + ' × ' + pct(x[2]) + ')');
      h += '<div class="fpt-sub">Why the atomic mass is ' + esc(String(e.mass)) + '</div><div class="fpt-work">A<sub>r</sub> = [' + terms.join(' + ') + '] ÷ 100 = <b>' + sum.toFixed(3) + '</b></div>'
        + '<p class="fpt-note">The average of its isotopes\' masses, weighted by how common each one is.</p>';
    } else h += '<p class="fpt-note">It has only one stable isotope, so its atomic mass is that isotope\'s mass.</p>';
    return h;
  };

  App.prototype.spectrumHTML = function (e) {
    const ln = e.x.ln;
    if (!ln) return '<p class="fpt-lead">No visible emission lines are on record for ' + esc(e.name) + '.</p>';
    const mode = this.st.spectrum;
    let h = '<div class="fpt-seg">' + [['emission', 'Emission'], ['absorption', 'Absorption']].map((m) => '<button type="button" class="fpt-chip' + (mode === m[0] ? ' is-on' : '') + '" data-act="spectrum" data-mode="' + m[0] + '">' + m[1] + '</button>').join('') + '</div>';
    h += spectrumSVG(e, ln, mode);
    const strongest = ln.slice().sort((a, b) => b[1] - a[1]).slice(0, 5).sort((a, b) => a[0] - b[0]);
    h += '<div class="fpt-sub">Strongest lines</div><div class="fpt-lines">' + strongest.map((l) => '<span><i style="background:' + wlColour(l[0]) + '"></i>' + l[0].toFixed(1) + ' nm <small>' + (HC / l[0]).toFixed(2) + ' eV</small></span>').join('') + '</div>';
    if (e.s === 'H') {
      h += '<p class="fpt-note">This is the Balmer series: an electron falling to the second energy level from level 3 (red, 656 nm), 4, 5, 6 and on. The lines crowd towards the violet because the levels get closer together as n grows.</p>';
    } else h += '<p class="fpt-note">Each element\'s lines are its fingerprint — helium was found in the Sun\'s spectrum before it was found on Earth. Wavelengths in air, from NIST.</p>';
    return h;
  };

  /* ── Drawings ───────────────────────────────────────────────────────── */

  function halfText(t) {
    const m = /^([\d.]+)\s*(\S+)$/.exec(t || '');
    if (!m) return t || '';
    const U = { ys: 'yoctoseconds', zs: 'zeptoseconds', as: 'attoseconds', fs: 'femtoseconds', ps: 'picoseconds', ns: 'nanoseconds', us: 'microseconds', 'μs': 'microseconds',
      ms: 'milliseconds', s: 'seconds', m: 'minutes', h: 'hours', d: 'days', y: 'years', ky: 'thousand years', My: 'million years', Gy: 'billion years', Ty: 'trillion years' };
    return m[1] + ' ' + (U[m[2]] || m[2]);
  }

  /** Electrons shell by shell, from the configuration — potassium is 2, 8, 8, 1, not 2, 8, 9. */
  function bohrSVG(e) {
    let occ;
    try { occ = C().occupancy(e.ec); } catch (err) { return ''; }
    const shells = {};
    Object.keys(occ).forEach((k) => { shells[k[0]] = (shells[k[0]] || 0) + occ[k]; });
    const counts = Object.keys(shells).sort().map((n) => shells[n]);
    const S = 220, c = S / 2, maxR = c - 8;
    let s = '<svg viewBox="0 0 ' + S + ' ' + S + '" class="fpt-bohr-svg" role="img" aria-label="Electron shells: ' + counts.join(', ') + '">';
    s += '<circle cx="' + c + '" cy="' + c + '" r="12" class="fpt-nuc"/><text x="' + c + '" y="' + (c + 4) + '" class="fpt-nuc-t">' + esc(e.s) + '</text>';
    counts.forEach((k, i) => {
      const r = 20 + (i + 1) / counts.length * (maxR - 20);
      s += '<circle cx="' + c + '" cy="' + c + '" r="' + r.toFixed(1) + '" class="fpt-orbit"/>';
      for (let j = 0; j < k; j++) {
        const a = (j / k) * Math.PI * 2 - Math.PI / 2 + i * 0.35;
        s += '<circle cx="' + (c + r * Math.cos(a)).toFixed(1) + '" cy="' + (c + r * Math.sin(a)).toFixed(1) + '" r="' + (k > 18 ? 1.8 : 2.6) + '" class="fpt-e"/>';
      }
    });
    return s + '</svg><div class="fpt-note fpt-center">Shells: ' + counts.join(', ') + '</div>';
  }

  const ordinal = (k) => k + (k % 100 >= 11 && k % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][k % 10] || 'th');
  /** Successive ionization energies on a log scale, with the jumps that reveal the shells. */
  function ieChart(e, ie) {
    const n = Math.min(ie.length, 30);
    const vals = ie.slice(0, n).map((v) => v * KJ);
    const lmin = Math.log10(Math.min.apply(null, vals)), lmax = Math.log10(Math.max.apply(null, vals));
    const span = Math.max(1e-9, lmax - lmin);
    const W = 320, H = 170, pad = 32, bw = (W - pad - 6) / n;
    // Shell boundaries: where one more electron costs far more than the last.
    const jumps = [];
    for (let k = 1; k < n; k++) if (vals[k] / vals[k - 1] > 2.2) jumps.push(k);
    let s = '<div class="fpt-sub">Successive ionization energies</div><svg viewBox="0 0 ' + W + ' ' + (H + 24) + '" class="fpt-ie" role="img" aria-label="Successive ionization energies">';
    for (let p = Math.ceil(lmin); p <= Math.floor(lmax); p++) {
      const y = H - (p - lmin) / span * (H - 12) - 4;
      const lab = p >= 3 ? Math.pow(10, p - 3) + 'k' : String(Math.pow(10, p));
      s += '<line x1="' + pad + '" x2="' + W + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '" class="fpt-grid-l"/><text x="' + (pad - 4) + '" y="' + (y + 3).toFixed(1) + '" class="fpt-ax">' + lab + '</text>';
    }
    vals.forEach((v, k) => {
      const h = Math.max(2, (Math.log10(v) - lmin) / span * (H - 12) + 4);
      const x = pad + k * bw + 1;
      s += '<rect x="' + x.toFixed(1) + '" y="' + (H - h).toFixed(1) + '" width="' + Math.max(1, bw - 2).toFixed(1) + '" height="' + h.toFixed(1) + '" class="fpt-iebar' + (jumps.indexOf(k) >= 0 ? ' is-jump' : '') + '"><title>'
        + ordinal(k + 1) + ': ' + Math.round(v).toLocaleString('en') + ' kJ/mol</title></rect>';
      if (n <= 20 || (k + 1) % 5 === 0 || k === 0) s += '<text x="' + (x + bw / 2 - 1).toFixed(1) + '" y="' + (H + 11) + '" class="fpt-ax fpt-ax--x">' + (k + 1) + '</text>';
    });
    s += '<text x="' + ((W + pad) / 2) + '" y="' + (H + 22) + '" class="fpt-ax fpt-ax--x">electron removed · kJ/mol, log scale</text></svg>';
    const b = block(e);
    if (jumps.length && (b === 's' || b === 'p') && e.n > 2) {
      const first = jumps[0];
      s += '<p class="fpt-note"><b>The first big jump comes after electron ' + first + '.</b> The ' + ordinal(first + 1)
        + ' electron has to come out of a full inner shell — so ' + esc(e.name) + ' has ' + first + ' outer-shell electron' + (first > 1 ? 's' : '') + ', which puts it in group ' + (first <= 2 ? first : first + 10) + '.</p>';
    } else if (jumps.length) {
      s += '<p class="fpt-note">The tall bars are where an inner shell is broken into — each big jump marks a shell boundary.</p>';
    }
    return s;
  }

  /** The colour of light at a wavelength (nm): the usual piecewise approximation, dimmed at the ends of vision. */
  function wlColour(wl) {
    let r = 0, g = 0, b = 0;
    if (wl >= 380 && wl < 440) { r = -(wl - 440) / 60; b = 1; }
    else if (wl < 490) { g = (wl - 440) / 50; b = 1; }
    else if (wl < 510) { g = 1; b = -(wl - 510) / 20; }
    else if (wl < 580) { r = (wl - 510) / 70; g = 1; }
    else if (wl < 645) { r = 1; g = -(wl - 645) / 65; }
    else if (wl <= 750) { r = 1; }
    let f = 1;
    if (wl < 420) f = 0.3 + 0.7 * (wl - 380) / 40;
    else if (wl > 700) f = 0.3 + 0.7 * (750 - wl) / 50;
    const c = (x) => Math.round(255 * Math.pow(Math.max(0, x) * f, 0.8));
    return 'rgb(' + c(r) + ',' + c(g) + ',' + c(b) + ')';
  }
  let specId = 0;
  function spectrumSVG(e, ln, mode) {
    const W = 370, H = 64, x = (wl) => ((wl - 380) / 370) * W;
    const Imax = Math.max.apply(null, ln.map((l) => l[1]));
    const gid = 'fptRainbow' + (++specId);
    let s = '<svg viewBox="0 0 ' + W + ' ' + (H + 18) + '" class="fpt-spec" role="img" aria-label="' + esc(e.name) + ' ' + mode + ' spectrum"><defs><linearGradient id="' + gid + '">';
    for (let wl = 380; wl <= 750; wl += 10) s += '<stop offset="' + ((wl - 380) / 370).toFixed(3) + '" stop-color="' + wlColour(wl) + '"/>';
    s += '</linearGradient></defs>';
    if (mode === 'absorption') {
      s += '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="url(#' + gid + ')"/>';
      ln.forEach((l) => { s += '<rect x="' + (x(l[0]) - 0.7).toFixed(2) + '" y="0" width="1.4" height="' + H + '" fill="#000" opacity="' + Math.max(0.35, Math.pow(l[1] / Imax, 0.3)).toFixed(2) + '"><title>' + l[0] + ' nm</title></rect>'; });
    } else {
      s += '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#05060a"/>';
      ln.forEach((l) => {
        const a = Math.max(0.18, Math.pow(l[1] / Imax, 0.35));
        s += '<rect x="' + (x(l[0]) - 0.8).toFixed(2) + '" y="0" width="1.6" height="' + H + '" fill="' + wlColour(l[0]) + '" opacity="' + a.toFixed(2) + '"><title>' + l[0] + ' nm</title></rect>';
      });
    }
    for (let wl = 400; wl <= 700; wl += 50) s += '<text x="' + x(wl).toFixed(1) + '" y="' + (H + 13) + '" class="fpt-ax fpt-ax--x">' + wl + '</text>';
    s += '<text x="' + W + '" y="' + (H + 13) + '" class="fpt-ax">nm</text>';
    return s + '</svg>';
  }

  /* ── Links: periodic.html#Fe ────────────────────────────────────────── */

  App.prototype.readHash = function () {
    const h = decodeURIComponent((location.hash || '').slice(1));
    if (!h) return;
    // #Fe opens an element; #trend/ie colours the table by a trend; both can be given: #trend/ie/Fe.
    const parts = h.split('/');
    let rest = parts;
    if (parts[0] === 'trend' && PROP[parts[1]]) { this.st.colour = parts[1]; rest = parts.slice(2); }
    const e = rest[0] ? (/^\d+$/.test(rest[0]) ? byN(+rest[0]) : bySym(rest[0])) : null;
    this.st.sel = e ? e.n : null;
  };
  App.prototype.writeHash = function () {
    const st = this.st;
    const h = (st.colour !== 'cat' ? '#trend/' + st.colour + (st.sel ? '/' : '') : st.sel ? '#' : '') + (st.sel ? byN(st.sel).s : '');
    try { history.replaceState(null, '', location.pathname + location.search + h); } catch (err) { /* sandboxed */ }
  };

  App.prototype.destroy = function () {
    document.removeEventListener('keydown', this.onKey);
    this.host.innerHTML = '';
  };

  function mount(host, opts) {
    if (!host || !P() || !P().ELEMENTS) return null;
    if (host._fpt) host._fpt.destroy();
    const app = new App(host, opts);
    host._fpt = app;
    return app;
  }

  window.FluxPTable = {
    mount: mount,
    core: {
      esc: esc, fmt: fmt, trim0: trim0, CAT: CAT, CATS: CATS, PROPS: PROPS, PROP: PROP, KJ: KJ, block: block, stateAt: stateAt,
      mpK: mpK, bpK: bpK, oxStates: oxStates, massText: massText, model: model, wlColour: wlColour, halfText: halfText, STATES: STATES,
    },
  };
})();
