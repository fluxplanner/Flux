/* ════════════════════════════════════════════════════════════════════════
   FLUX · Periodic Table — flux-ptable.js
   ------------------------------------------------------------------------
   The periodic table as its own tool: periodic.html, and the same thing in
   Study tools ▸ Chemistry ▸ Table, the way the grapher is both.

   Tabs along the top:
     Table        the periodic table, and everything about an element when
                  you click it.
     Trends       colour the table by any periodic trend — size, nuclear
                  charge, shielding, ionization energies, electronegativity,
                  metallic character, mass, density, melting point and more —
                  with the trend across a period and down a group, and a
                  graph against atomic number where the repeats show.
     Temperature  melt and boil the table: every element's state at any
                  temperature from absolute zero to the Sun's surface.
     Electrons, Spectra, Isotopes, 3D
                  one element in depth (flux-ptable-explore.js), and its atom
                  to turn round (flux-ptable-atom3d.js).

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
    /* Spaced so no two read alike, even as the faint tints the cells use:
       metalloids were a violet beside the noble gases' purple, halogens a
       cyan beside the post-transition teal, and actinides the alkali red. */
    ['metalloid', 'Metalloids', '#9fbf3b'], ['nonmetal', 'Other nonmetals', '#25a97c'],
    ['halogen', 'Halogens', '#f0c93e'], ['noble', 'Noble gases', '#a855e8'],
    ['lanthanide', 'Lanthanides', '#d94aa0'], ['actinide', 'Actinides', '#f29ac4'],
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
  function reducedMotion() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }

  /* ── The tabs ───────────────────────────────────────────────────────── */

  const VIEWS = [
    ['table', 'Table'], ['trends', 'Trends'], ['temp', 'Temperature'],
    ['electrons', 'Electrons'], ['spectra', 'Spectra'], ['isotopes', 'Isotopes'], ['3d', '3D'],
  ];
  const VIEW_IDS = VIEWS.map((v) => v[0]);
  /** The tabs about one element, and the element each starts on when none is picked. */
  const EXPLORE = { electrons: 26, spectra: 1, isotopes: 17, '3d': 6 };
  const isExplore = (v) => Object.prototype.hasOwnProperty.call(EXPLORE, v);
  /** Link words: #trend/ie/Fe, #electrons/Fe, #3d/C. */
  const HASH_WORD = { trends: 'trend', temp: 'temperature' };

  /* ── The app ────────────────────────────────────────────────────────── */

  function loadPrefs() {
    try { return JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch (e) { return {}; }
  }

  function App(host, opts) {
    this.host = host;
    this.o = opts || {};
    const pref = loadPrefs();
    const trendOk = (id) => PROP[id] && !PROP[id].kind;
    this.st = {
      view: VIEW_IDS.indexOf(pref.view) >= 0 ? pref.view : 'table',
      // The trend on the Trends tab (older saves kept it as "colour").
      trend: trendOk(pref.trend) ? pref.trend : trendOk(pref.colour) ? pref.colour : 'ie',
      tcolour: pref.tcolour === 'block' ? 'block' : 'cat',
      unit: pref.unit === 'K' ? 'K' : 'C',
      temp: 298.15, sel: null, tab: pref.tab === 'energy' ? 'energy' : 'overview', query: '', hl: null, hlLabel: '', catFilter: null,
      // The deeper tabs (flux-ptable-explore.js).
      filling: false, ion: 0, spectrum: 'emission', compare: Array.isArray(pref.compare) ? pref.compare.filter((n) => n >= 1 && n <= 118).slice(0, 6) : [1, 2, 11],
      hLo: 2, hHi: 3, isoMode: pref.isoMode === 'rel' ? 'rel' : 'pct', atomMode: pref.atomMode === 'orbitals' ? 'orbitals' : 'bohr', orb: null, orbM: null,
    };
    /* simple: the planner's table. Just the table and what an element is —
       the tabs, trends and search live on the full page (periodic.html). */
    if (this.o.simple) Object.assign(this.st, { view: 'table', tcolour: 'cat', tab: 'overview' });
    this.build();
    if (this.o.hash && !this.o.simple) this.readHash();
    if (isExplore(this.st.view) && !this.st.sel) this.st.sel = EXPLORE[this.st.view];
    this.refresh();
  }
  App.prototype.save = function () {
    if (this.o.simple) return;       // the planner's table must not change what the full page opens on
    const s = this.st;
    try {
      localStorage.setItem(STORE, JSON.stringify({
        view: s.view, trend: s.trend, tcolour: s.tcolour, unit: s.unit, tab: s.tab,
        compare: s.compare, isoMode: s.isoMode, atomMode: s.atomMode,
      }));
    } catch (e) { /* private window */ }
  };
  /** What the table is coloured by on this tab. */
  App.prototype.colourId = function () {
    const v = this.st.view;
    return v === 'trends' ? this.st.trend : v === 'temp' ? 'state' : v === 'table' ? this.st.tcolour : 'cat';
  };
  App.prototype.els = function () { return model(); };
  App.prototype.byN = byN;
  App.prototype.bySym = bySym;

  App.prototype.build = function () {
    const groups = [];
    PROPS.forEach((p) => {
      if (p.kind) return;              // categories, blocks and states have tabs of their own
      let g = groups.find((x) => x[0] === p.g);
      if (!g) groups.push(g = [p.g, []]);
      g[1].push(p);
    });
    const opts = groups.map((g) => '<optgroup label="' + esc(g[0]) + '">' + g[1].map((p) => '<option value="' + p.id + '">' + esc(p.label) + '</option>').join('') + '</optgroup>').join('');
    /* No tabindex on the root. Safari never focuses a tapped button, so it
       focused this instead — and scrolled the page up to show all of it,
       which threw a reader back to the top on every tap of Overview. */
    this.host.innerHTML = '<div class="fpt' + (this.o.simple ? ' is-simple' : '') + '">'
      + '<nav class="fpt-views" role="tablist" aria-label="Periodic table views"><span class="fpt-views-glide" aria-hidden="true"></span>'
      + VIEWS.map((v) => '<button type="button" role="tab" class="fpt-view" data-view="' + v[0] + '">' + v[1] + '</button>').join('') + '</nav>'
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
      + '<section class="fpt-explore" aria-live="polite"></section>'
      + '</div></div>';
    this.root = this.host.querySelector('.fpt');
    this.explore = this.host.querySelector('.fpt-explore');
    if (window.ResizeObserver) {
      new ResizeObserver(() => this.placeGlide(false)).observe(this.host.querySelector('.fpt-views'));
    }
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
        + '<span class="fpt-nm" style="--len:' + e.name.length + '">' + esc(e.name) + '</span><span class="fpt-v"></span></button>';
    });
    // Where the f-block comes from.
    h += '<div class="fpt-fmark" style="grid-row:10;grid-column:1/4">57–71</div><div class="fpt-fmark" style="grid-row:11;grid-column:1/4">89–103</div>';
    // The printed key sits in the gap above the transition metals, where a
    // data booklet puts it. Empty, and hidden on screen, until setPrint asks.
    h += '<div class="fpt-printkey" style="grid-row:2/5;grid-column:4/14" aria-hidden="true"></div>';
    this.grid.innerHTML = h;
    this.cells = {};
    this.grid.querySelectorAll('.fpt-el').forEach((b) => { this.cells[b.dataset.n] = b; });
  };

  App.prototype.wire = function () {
    const self = this;
    /* A tap never scrolls: if the page moved between finger down and the
       click, the browser did it — Safari scrolling to whatever it chose to
       focus — so put it back before anything else happens. Not for fields:
       there iOS scrolls on purpose, to keep the keyboard off the box. */
    let down = null;
    const scroller = (el) => {
      let box = el && el.parentElement;
      while (box && box !== document.body && !(box.scrollHeight > box.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(box).overflowY))) box = box.parentElement;
      return box && box !== document.body ? box : null;
    };
    this.root.addEventListener('pointerdown', (ev) => {
      const t = ev.target;
      if (!(t instanceof Element) || t.closest('input, select, textarea')) { down = null; return; }
      const box = scroller(t);
      down = { box: box, y: box ? box.scrollTop : window.scrollY, at: Date.now() };
    }, true);
    this.root.addEventListener('click', () => {
      const d = down;
      down = null;
      if (!d || Date.now() - d.at > 1000) return;
      const now = d.box ? d.box.scrollTop : window.scrollY;
      if (Math.abs(now - d.y) < 30) return;
      if (d.box) d.box.scrollTop = d.y; else window.scrollTo(0, d.y);
    }, true);
    this.root.addEventListener('click', (ev) => {
      const t = ev.target;
      const cell = t.closest('.fpt-el');
      if (cell && this.grid.contains(cell)) {
        const n = +cell.dataset.n;
        // On the tabs about one element there is always one showing: a click changes it.
        self.select(self.st.sel === n && !isExplore(self.st.view) ? null : n);
        return;
      }
      const tab = t.closest('.fpt-view');
      if (tab) { self.setView(tab.dataset.view); return; }
      // A point on the trend graph is that element.
      const pt = t.closest('.fpt-pt');
      if (pt) { self.select(+pt.dataset.n); return; }
      const u = t.closest('[data-unit]');
      if (u && u.closest('.fpt-unit')) { self.st.unit = u.dataset.unit; self.save(); self.refresh(); return; }
      const act = t.closest('[data-act]');
      if (act) { self.action(act.dataset.act, act); }
    });
    this.root.querySelector('.fpt-views').addEventListener('keydown', (ev) => {
      if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return;
      const i = VIEW_IDS.indexOf(this.st.view) + (ev.key === 'ArrowRight' ? 1 : -1);
      if (i < 0 || i >= VIEW_IDS.length) return;
      ev.preventDefault();
      this.setView(VIEW_IDS[i]);
      const b = this.root.querySelector('.fpt-view[data-view="' + VIEW_IDS[i] + '"]');
      if (b) b.focus();
    });
    this.sel.addEventListener('change', () => { this.st.trend = this.sel.value; this.save(); if (this.o.hash) this.writeHash(); this.refresh(); });
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
      if (ev.key === '/' && !inField && !this.o.simple) { ev.preventDefault(); this.q.focus(); }
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
    const st = this.st, cid = this.colourId(), prop = PROP[cid];
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
      const dim = (st.hl && !st.hl.has(e.n)) || (st.catFilter && e.cat !== st.catFilter && cid === 'cat');
      b.classList.toggle('is-dim', !!dim);
      b.classList.toggle('is-hl', !!(st.hl && st.hl.has(e.n)));
      b.classList.toggle('is-sel', st.sel === e.n);
    });
    this.root.dataset.colour = cid;
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
    const box = this.chart, st = this.st, prop = PROP[this.colourId()];
    if (!box) return;
    const pts = [];
    if (!prop.kind && st.view === 'trends') model().forEach((e) => { const v = prop.get(e); if (v != null && Number.isFinite(v) && (!prop.log || v > 0)) pts.push({ e: e, v: v }); });
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
    const st = this.st, cid = this.colourId(), prop = PROP[cid], view = st.view;
    let h = '';
    if (st.hl) {
      h += '<div class="fpt-hlbar"><span>Showing <b>' + st.hl.size + '</b> ' + (st.hlLabel ? 'for ' + esc(st.hlLabel) : 'elements') + '</span>'
        + '<button type="button" class="fpt-link" data-act="clearhl">Show all</button></div>';
    }
    if (isExplore(view)) {
      const e = byN(st.sel);
      h += '<div class="fpt-pickhint">Pick any element' + (e ? ' — showing <b>' + esc(e.name) + '</b>' : '') + '. Arrow keys move along the table.</div>';
    } else if (view === 'table' && this.o.simple) {
      h += '<div class="fpt-chips">' + CATS.map((c) => '<span class="fpt-chip is-static"><i style="background:' + c[2] + '"></i>' + esc(c[1]) + '</span>').join('') + '</div>';
    } else if (view === 'table') {
      h += '<div class="fpt-seg fpt-tcolour" role="group" aria-label="Colour the table by">'
        + [['cat', 'Categories'], ['block', 'Blocks']].map((c) => '<button type="button" class="fpt-chip' + (cid === c[0] ? ' is-on' : '') + '" data-act="tcolour" data-c="' + c[0] + '">' + c[1] + '</button>').join('') + '</div>';
      if (cid === 'cat') {
        h += '<div class="fpt-chips">' + CATS.map((c) => '<button type="button" class="fpt-chip' + (st.catFilter === c[0] ? ' is-on' : '') + '" data-act="cat" data-cat="' + c[0] + '">'
          + '<i style="background:' + c[2] + '"></i>' + esc(c[1]) + '</button>').join('') + '</div>';
      } else {
        h += '<div class="fpt-chips">' + Object.keys(BLOCKS).map((k) => '<span class="fpt-chip is-static"><i style="background:' + BLOCKS[k][1] + '"></i>' + BLOCKS[k][0] + '</span>').join('')
          + '<span class="fpt-note">The block is the subshell the last electron goes into.</span></div>';
      }
    } else if (view === 'temp') {
      const presets = [[0, 'Absolute zero'], [273.15, 'Ice melts'], [298.15, 'Room'], [310.15, 'Body'], [373.15, 'Water boils'], [1811, 'Iron melts'], [5778, 'Sun’s surface']];
      h += '<div class="fpt-temp"><label><span>Temperature</span><input class="fpt-in fpt-range" type="range" min="0" max="6000" step="1" value="' + Math.round(st.temp) + '" aria-label="Temperature in kelvin"></label>'
        + '<b class="fpt-temp-v">' + this.tempLabel() + '</b>'
        + '<button type="button" class="fpt-chip fpt-play' + (this.playing ? ' is-on' : '') + '" data-act="tplay" aria-pressed="' + !!this.playing + '">' + (this.playing ? '❚❚ Pause' : '▶ Heat it up') + '</button></div>'
        + '<div class="fpt-presets">' + presets.map((p) => '<button type="button" class="fpt-chip" data-act="temp" data-k="' + p[0] + '">' + p[1] + '</button>').join('') + '</div>'
        + '<div class="fpt-chips fpt-states">' + ['s', 'l', 'g', 'u'].map((k) => '<span class="fpt-chip is-static"><i style="background:' + STATES[k][1] + '"></i>' + STATES[k][0] + ' <b></b></span>').join('') + '</div>'
        + '<div class="fpt-events"></div>';
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
        this.updateTemp();
      });
      this.updateTemp();
    }
  };

  /** The temperature readouts, updated in place so the slider keeps its grip. */
  App.prototype.updateTemp = function () {
    const L = this.legend, st = this.st;
    const range = L.querySelector('.fpt-range');
    if (range && +range.value !== Math.round(st.temp)) range.value = Math.round(st.temp);
    const v = L.querySelector('.fpt-temp-v');
    if (v) v.innerHTML = this.tempLabel();
    const counts = { s: 0, l: 0, g: 0, u: 0 };
    model().forEach((e) => { counts[stateAt(e, st.temp)]++; });
    L.querySelectorAll('.fpt-states .fpt-chip b').forEach((b, i) => { b.textContent = counts['slgu'[i]]; });
    const ev = L.querySelector('.fpt-events');
    if (ev) ev.innerHTML = this.tempEvents();
  };
  /** The melting or boiling just below the current temperature, and the next one above it. */
  App.prototype.tempEvents = function () {
    const T = this.st.temp;
    let next = null, last = null;
    model().forEach((e) => {
      [[mpK(e), 'melt'], [bpK(e), 'boil']].forEach((x) => {
        const K = x[0];
        if (K == null || (e.s === 'He' && x[1] === 'melt')) return;       // helium only freezes under pressure
        if (K > T && (!next || K < next.K)) next = { K: K, what: x[1], e: e };
        if (K <= T && (!last || K > last.K)) last = { K: K, what: x[1], e: e };
      });
    });
    const say = (x, done) => '<b>' + esc(x.e.name) + '</b> ' + (done ? x.what + 'ed' : x.what + 's') + ' at ' + esc(this.tempText(x.K));
    return (last ? '<span><i>Just now</i> ' + say(last, true) + '</span>' : '') + (next ? '<span><i>Next</i> ' + say(next, false) + '</span>' : '')
      + '<span class="fpt-note">At normal atmospheric pressure. Elements with no measured values are striped.</span>';
  };
  /** Heat the table from where it is to the surface of the Sun, faster as it gets hotter. */
  App.prototype.togglePlay = function () {
    if (this.playing) { cancelAnimationFrame(this.playing); this.playing = null; this.renderLegend(); return; }
    if (this.st.temp >= 5990) this.st.temp = 0;
    let last = performance.now();
    const step = (now) => {
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      this.st.temp = Math.min(6000, this.st.temp + dt * (40 + this.st.temp * 0.35));
      this.paint();
      this.updateTemp();
      if (this.st.temp >= 6000 || !this.root.isConnected || this.st.view !== 'temp') { this.playing = null; this.renderLegend(); return; }
      this.playing = requestAnimationFrame(step);
    };
    this.playing = requestAnimationFrame(step);
    this.renderLegend();
  };

  /* ── Views and actions ──────────────────────────────────────────────── */

  App.prototype.select = function (n) {
    const view = this.st.view;
    if (!n && isExplore(view)) return;          // the tabs about one element always show one
    this.st.sel = n;
    if (n && this.cells[n]) Object.keys(this.cells).forEach((k) => { this.cells[k].tabIndex = +k === n ? 0 : -1; });
    if (this.o.hash) this.writeHash();
    /* Picking another element — a cell, the ‹ › arrows, a link — redraws the
       panel you are reading, and the page must not move while it does. Chrome
       hides this with scroll anchoring; Safari has none, so on an iPhone every
       arrow tap after scrolling down threw the reader back up the page
       (Azfer, 2026-09-30). keepPlace pins the panel's top where it was. */
    if (isExplore(view)) {
      this.keepPlace('.fpt-explore', () => { this.paint(); this.renderLegend(); this.renderExplore(); });
      return;
    }
    // On a narrow screen the details sit under the table: bring them into view.
    const reveal = n && this.root.clientWidth < 1100 && this.o.scrollToDetail !== false && this.side.getBoundingClientRect().top > window.innerHeight - 80;
    if (reveal) {
      this.paint();
      this.renderSide();
      this.side.scrollIntoView({ block: 'start', behavior: 'smooth' });
      return;
    }
    this.keepPlace('.fpt-side', () => { this.paint(); this.renderSide(); });
  };
  /** Switch tab. The element on show stays chosen across tabs. */
  App.prototype.setView = function (v) {
    if (VIEW_IDS.indexOf(v) < 0 || v === this.st.view) return;
    const was = this.st.view;
    this.st.view = v;
    if (was === '3d' && window.FluxPTableExplore) window.FluxPTableExplore.leave(this);
    if (isExplore(v) && !this.st.sel) this.st.sel = EXPLORE[v];
    this.st.catFilter = null;
    this.save();
    if (this.o.hash) this.writeHash();
    this.refresh();
    this.slideIn(VIEW_IDS.indexOf(v) > VIEW_IDS.indexOf(was) ? 1 : -1);
  };
  /** The highlight behind the tabs slides to the one chosen. animate: false places it outright. */
  App.prototype.placeGlide = function (animate) {
    const bar = this.root.querySelector('.fpt-views');
    const glide = bar && bar.querySelector('.fpt-views-glide');
    const on = bar && bar.querySelector('.fpt-view.is-on');
    if (!glide || !on || !on.offsetWidth) return;
    const moveOnly = animate && this.glided;
    glide.classList.toggle('is-instant', !moveOnly);
    glide.style.width = on.offsetWidth + 'px';
    glide.style.transform = 'translateX(' + on.offsetLeft + 'px)';
    this.glided = true;
    // On a phone the bar scrolls: keep the chosen tab in sight.
    if (bar.scrollWidth > bar.clientWidth) {
      const left = on.offsetLeft - (bar.clientWidth - on.offsetWidth) / 2;
      bar.scrollTo({ left: Math.max(0, left), behavior: moveOnly && !reducedMotion() ? 'smooth' : 'auto' });
    }
  };
  /** The page under the tabs comes in from the side of the tab it came from. */
  App.prototype.slideIn = function (dir) {
    if (reducedMotion()) return;
    [this.root.querySelector('.fpt-bar'), this.root.querySelector('.fpt-body')].forEach((el, i) => {
      if (!el || typeof el.animate !== 'function') return;
      el.animate([{ opacity: 0, transform: 'translateX(' + dir * 28 + 'px)' }, { opacity: 1, transform: 'none' }],
        { duration: 320, delay: i * 40, easing: 'cubic-bezier(.22, .8, .24, 1)', fill: 'backwards' });
    });
  };
  App.prototype.action = function (act, el) {
    const st = this.st;
    switch (act) {
      case 'clearhl': this.q.value = ''; st.query = ''; this.highlight(null); return;
      case 'cat': st.catFilter = st.catFilter === el.dataset.cat ? null : el.dataset.cat; this.paint(); this.renderLegend(); return;
      case 'tcolour': st.tcolour = el.dataset.c === 'block' ? 'block' : 'cat'; st.catFilter = null; this.save(); this.paint(); this.renderLegend(); return;
      case 'temp': st.temp = +el.dataset.k; this.paint(); this.updateTemp(); return;
      case 'tplay': this.togglePlay(); return;
      case 'tab': st.tab = el.dataset.tab; this.save(); this.keepPlace('.fpt-dtabs', () => this.renderSide()); return;
      case 'close': this.select(null); return;
      case 'step': this.select(Math.max(1, Math.min(118, st.sel + +el.dataset.d))); return;
      case 'order': st.filling = !st.filling; this.keepPlace('[data-act="order"]', () => { if (isExplore(st.view)) this.renderExplore(); else this.renderSide(); }); return;
      case 'spectrum': st.spectrum = el.dataset.mode; this.keepPlace('[data-act="spectrum"]', () => { if (isExplore(st.view)) this.renderExplore(); else this.renderSide(); }); return;
      case 'goto': this.select(+el.dataset.n); return;
      case 'view': this.setView(el.dataset.view); return;
      case 'trend': st.trend = el.dataset.c; this.save(); if (this.st.view !== 'trends') this.setView('trends'); else { if (this.o.hash) this.writeHash(); this.refresh(); } return;
      default:
        if (window.FluxPTableExplore) window.FluxPTableExplore.action(this, act, el);
    }
  };

  App.prototype.renderTabs = function () {
    const v = this.st.view;
    this.root.querySelectorAll('.fpt-view').forEach((b) => {
      const on = b.dataset.view === v;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
    });
    this.root.querySelectorAll('.fpt-unit button').forEach((b) => b.classList.toggle('is-on', b.dataset.unit === this.st.unit));
    // Only the Trends tab has a trend to pick; only temperatures need a unit.
    this.root.querySelector('.fpt-colour').hidden = v !== 'trends';
    this.root.querySelector('.fpt-unit').hidden = !(v === 'temp' || (v === 'trends' && PROP[this.st.trend].unit === 'temp') || v === 'table');
    this.root.dataset.view = v;
    this.root.classList.toggle('is-explore', isExplore(v));
    this.placeGlide(true);
  };
  App.prototype.refresh = function () {
    this.sel.value = this.st.trend;
    this.renderTabs();
    this.paint();
    this.renderLegend();
    if (isExplore(this.st.view)) this.renderExplore();
    else {
      if (window.FluxPTableExplore) window.FluxPTableExplore.leave(this);
      this.renderSide();
    }
  };
  App.prototype.renderExplore = function () {
    const X2 = window.FluxPTableExplore;
    if (!X2) { this.explore.innerHTML = '<p class="fpt-lead">This part of the table could not load. Try refreshing.</p>'; return; }
    X2.render(this, this.st.view, byN(this.st.sel), this.explore);
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
    if (!st.sel) { this.side.innerHTML = this.o.simple ? this.simpleIntroHTML() : this.introHTML(); return; }
    this.side.innerHTML = this.detailHTML(byN(st.sel));
  };
  /** Redraw without the page moving: what was under the finger stays under it.
      Held for half a second as well, because charts and the 3D view finish
      laying out after the redraw returns, and Safari (no scroll anchoring)
      lets that late growth or shrinkage slide the page. A wheel, touch or key
      from the reader ends the hold at once, so it never fights them. */
  App.prototype.keepPlace = function (sel, redraw) {
    const was = this.root.querySelector(sel);
    const y = was ? was.getBoundingClientRect().top : null;
    redraw();
    if (y == null) return;
    const fix = () => {
      const now = this.root.querySelector(sel);
      if (!now) return;
      const d = now.getBoundingClientRect().top - y;
      if (Math.abs(d) < 1) return;
      let box = now.parentElement;
      while (box && box !== document.body && !(box.scrollHeight > box.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(box).overflowY))) box = box.parentElement;
      if (box && box !== document.body) box.scrollTop += d;
      else window.scrollBy(0, d);
    };
    fix();
    if (this._holdStop) this._holdStop();
    let live = true;
    const until = Date.now() + 500;
    const kinds = ['wheel', 'touchstart', 'keydown'];
    const stop = () => { live = false; kinds.forEach((k) => window.removeEventListener(k, stop, true)); if (this._holdStop === stop) this._holdStop = null; };
    kinds.forEach((k) => window.addEventListener(k, stop, { capture: true, passive: true }));
    this._holdStop = stop;
    const tick = () => {
      if (!live) return;
      if (Date.now() > until) { stop(); return; }
      fix();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    // A hidden tab runs no frames; the timer still ends the hold.
    setTimeout(() => { if (live) { fix(); stop(); } }, 520);
  };

  App.prototype.simpleIntroHTML = function () {
    return '<div class="fpt-intro"><h2>Tap an element</h2><p>Tap any element to see what it is, its electrons and its key numbers.</p></div>';
  };

  App.prototype.introHTML = function () {
    const card = (act, data, icon, title, sub) => '<button type="button" class="fpt-card" data-act="' + act + '" ' + data + '><span class="fpt-card-i" aria-hidden="true">' + icon + '</span><span><b>' + title + '</b><small>' + sub + '</small></span></button>';
    const v = this.st.view;
    if (v === 'trends') {
      return '<div class="fpt-intro"><h2>Trends</h2><p>' + PROPS.filter((p) => !p.kind).length + ' properties under “Colour by”. Each one colours the table, says which way it goes across a period and down a group, and is graphed against atomic number underneath. Click an element for its values.</p>'
        + '<div class="fpt-cards">'
        + card('trend', 'data-c="rc"', '◎', 'Atomic radius', 'Smaller across, bigger down')
        + card('trend', 'data-c="ie"', '⚡', 'Ionization energy', 'The dips at groups 13 and 16')
        + card('trend', 'data-c="en"', '±', 'Electronegativity', 'Climbing to fluorine')
        + card('trend', 'data-c="zeff"', '⊕', 'Effective nuclear charge', 'And the shielding behind it')
        + card('trend', 'data-c="metal"', '◆', 'Metallic character', 'Down and to the left')
        + card('trend', 'data-c="mp"', '▲', 'Melting point', 'Peaks at carbon and silicon')
        + '</div></div>';
    }
    if (v === 'temp') {
      return '<div class="fpt-intro"><h2>Melt the table</h2><p>Drag the temperature, or press ▶ to heat everything from absolute zero to the surface of the Sun. At room temperature only two elements are liquid — bromine and mercury — and eleven are gases.</p>'
        + '<p>Click an element to see its melting and boiling points.</p></div>';
    }
    return '<div class="fpt-intro"><h2>Pick an element</h2><p>Click any element for what it is, its numbers and its electrons. Arrow keys move around the table; <kbd>/</kbd> searches.</p>'
      + '<div class="fpt-cards">'
      + card('view', 'data-view="trends"', '↗', 'Trends', 'Colour the table by 30 properties')
      + card('view', 'data-view="temp"', '🌡', 'Temperature', 'Melt and boil the table')
      + card('view', 'data-view="electrons"', '⇅', 'Electrons', 'Configurations and orbital diagrams')
      + card('view', 'data-view="spectra"', '▥', 'Spectra', 'Line spectra and hydrogen\'s levels')
      + card('view', 'data-view="isotopes"', '⚖', 'Isotopes', 'Mass spectra and relative atomic mass')
      + card('view', 'data-view="3d"', '⚛', '3D', 'Every atom, to turn round')
      + '</div></div>';
  };

  App.prototype.detailHTML = function (e) {
    const st = this.st;
    const tabs = [['overview', 'Overview'], ['energy', 'Energy and size']];
    const body = st.tab === 'energy' ? this.energyHTML : this.overviewHTML;
    return '<div class="fpt-detail" style="--c:' + CAT[e.cat].colour + '">'
      + '<div class="fpt-dhead"><div class="fpt-tile"><span class="fpt-tile-n">' + e.n + '</span><span class="fpt-tile-s">' + esc(e.s) + '</span><span class="fpt-tile-m">' + esc(massText(e)) + '</span></div>'
      + '<div class="fpt-dname"><h2>' + esc(e.name) + '</h2><span class="fpt-dcat">' + esc(CAT[e.cat].label.replace(/s$/, '')) + ' · ' + block(e) + '-block</span>'
      + '<div class="fpt-dacts"><button type="button" class="fpt-ibtn" data-act="step" data-d="-1" aria-label="Previous element"' + (e.n === 1 ? ' disabled' : '') + '>‹</button>'
      + '<button type="button" class="fpt-ibtn" data-act="step" data-d="1" aria-label="Next element"' + (e.n === 118 ? ' disabled' : '') + '>›</button>'
      + '<button type="button" class="fpt-ibtn" data-act="close" aria-label="Close">✕</button></div></div></div>'
      + (this.o.simple ? '<div class="fpt-dbody">' + this.overviewHTML(e) + '</div>' + this.fullLinksHTML(e) + '</div>'
        : '<div class="fpt-more" aria-label="More on ' + esc(e.name.toLowerCase()) + '">'
      + [['electrons', 'Electrons'], ['spectra', 'Spectrum'], ['isotopes', 'Isotopes'], ['3d', 'In 3D']].map((t) => '<button type="button" class="fpt-chip" data-act="view" data-view="' + t[0] + '">' + t[1] + ' →</button>').join('')
      + '</div>'
      + '<div class="fpt-dtabs" role="tablist">' + tabs.map((t) => '<button type="button" role="tab" aria-selected="' + (st.tab === t[0]) + '" class="fpt-dtab' + (st.tab === t[0] ? ' is-on' : '') + '" data-act="tab" data-tab="' + t[0] + '">' + t[1] + '</button>').join('') + '</div>'
      + '<div class="fpt-dbody">' + body.call(this, e) + '</div></div>');
  };
  /** The planner's table stops at the basics; the rest of this element is a tap away on the full page. */
  App.prototype.fullLinksHTML = function (e) {
    return '<div class="fpt-fulllinks"><span>More on ' + esc(e.name.toLowerCase()) + ' in the full Periodic Table</span><div class="fpt-more">'
      + [['electrons', 'Electrons'], ['spectra', 'Spectrum'], ['isotopes', 'Isotopes'], ['3d', 'In 3D'], ['trend/ie', 'Trends']].map((t) =>
        '<a class="fpt-chip" href="periodic.html#' + t[0] + '/' + encodeURIComponent(e.s) + '" target="_blank" rel="noopener">' + t[1] + ' ↗</a>').join('')
      + '</div></div>';
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
    let config = null;
    try { config = C().configText(C().occupancy(e.ec)).short; } catch (err) { config = e.ec || null; }
    const s25 = stateAt(e, 298.15);
    const ox = oxStates(e);
    const flame = FLAME[e.s];
    const year = typeof e.year === 'number' ? (e.year < 0 ? Math.abs(e.year) + ' BCE' : String(e.year)) : (e.x.yr || '—');
    const d = e.x.d != null ? e.x.d : e.d;
    const en = e.x.en != null ? e.x.en : e.en;
    let h = '<p class="fpt-fact">' + esc(e.fact || '') + '</p><div class="fpt-kvs">'
      + row('Atomic number', e.n)
      + (config ? row('Electron configuration', '<span class="fpt-mono">' + esc(config) + '</span>') : '')
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
    // The shell diagram: the model the 3D tab turns round.
    h += '<div class="fpt-bohr" aria-hidden="true">' + bohrSVG(e) + '</div>';
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
  /** A line spectrum, 380–750 nm. opts: { h: strip height, axis: false to leave off the scale }. */
  function spectrumSVG(e, ln, mode, opts) {
    const o = opts || {};
    const W = 370, H = o.h || 64, x = (wl) => ((wl - 380) / 370) * W;
    const axis = o.axis !== false;
    const Imax = Math.max.apply(null, ln.map((l) => l[1]));
    const gid = 'fptRainbow' + (++specId);
    let s = '<svg viewBox="0 0 ' + W + ' ' + (H + (axis ? 18 : 2)) + '" class="fpt-spec" role="img" aria-label="' + esc(e.name) + ' ' + mode + ' spectrum"><defs><linearGradient id="' + gid + '">';
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
    if (axis) {
      for (let wl = 400; wl <= 700; wl += 50) s += '<text x="' + x(wl).toFixed(1) + '" y="' + (H + 13) + '" class="fpt-ax fpt-ax--x">' + wl + '</text>';
      s += '<text x="' + W + '" y="' + (H + 13) + '" class="fpt-ax">nm</text>';
    }
    return s + '</svg>';
  }

  /* ── Links: periodic.html#Fe ────────────────────────────────────────── */

  App.prototype.readHash = function () {
    const h = decodeURIComponent((location.hash || '').slice(1));
    if (!h) return;
    /* #Fe opens an element on the table. A tab comes first when it is not the
       table: #trend/ie/Fe, #temperature/Hg, #electrons/Cr, #spectra/H,
       #isotopes/Cl, #3d/C. */
    let parts = h.split('/');
    const word = parts[0].toLowerCase();
    const view = VIEW_IDS.find((v) => v === word || HASH_WORD[v] === word);
    if (view) {
      this.st.view = view;
      parts = parts.slice(1);
      if (view === 'trends' && PROP[parts[0]] && !PROP[parts[0]].kind) { this.st.trend = parts[0]; parts = parts.slice(1); }
    } else this.st.view = 'table';
    const e = parts[0] ? (/^\d+$/.test(parts[0]) ? byN(+parts[0]) : bySym(parts[0])) : null;
    this.st.sel = e ? e.n : (isExplore(this.st.view) ? EXPLORE[this.st.view] : null);
  };
  App.prototype.writeHash = function () {
    const st = this.st;
    const bits = [];
    if (st.view !== 'table') bits.push(HASH_WORD[st.view] || st.view);
    if (st.view === 'trends') bits.push(st.trend);
    if (st.sel) bits.push(byN(st.sel).s);
    const h = bits.length ? '#' + bits.join('/') : '';
    try { history.replaceState(null, '', location.pathname + location.search + h); } catch (err) { /* sandboxed */ }
  };

  /* ── Printing ───────────────────────────────────────────────────────── */

  /** How the table prints: ink 'colour' or 'bw', and whether a key names the
      colours (black and white has none to name). */
  App.prototype.setPrint = function (opts) {
    const bw = !!opts && opts.ink === 'bw';
    const key = !!opts && !!opts.key && !bw;
    this.root.classList.toggle('print-bw', bw);
    this.root.classList.toggle('print-key', key);
    const box = this.grid.querySelector('.fpt-printkey');
    if (box) box.innerHTML = key ? this.printKeyHTML() : '';
  };
  /** The key for whatever the table is coloured by right now. */
  /** What the printed key says: a title, and either named colours or, for a
      trend, its scale from lowest to highest. */
  App.prototype.printKeyData = function () {
    const prop = PROP[this.colourId()];
    if (prop.kind === 'cat') return { title: 'Key', items: CATS.map((c) => [c[2], c[1]]) };
    if (prop.kind === 'block') return { title: 'Key', items: Object.keys(BLOCKS).map((k) => [BLOCKS[k][1], BLOCKS[k][0]]) };
    if (prop.kind === 'state') return { title: 'State at ' + this.tempText(this.st.temp), items: ['s', 'l', 'g', 'u'].map((k) => [STATES[k][1], STATES[k][0]]) };
    return { title: prop.label, stops: [0, .25, .5, .75, 1].map((x) => P().trendColor(prop.reverse ? 1 - x : x)) };
  };
  App.prototype.printKeyHTML = function () {
    const k = this.printKeyData();
    const body = k.items
      ? '<ul>' + k.items.map((it) => '<li><i style="--c:' + it[0] + '"></i>' + esc(it[1]) + '</li>').join('') + '</ul>'
      : '<div class="fpt-pk-grad" style="background:linear-gradient(90deg, ' + k.stops.join(', ') + ')"></div>'
        + '<div class="fpt-pk-ends"><span>Lowest</span><span>Highest</span></div>';
    return '<b class="fpt-pk-h">' + esc(k.title) + '</b>' + body;
  };

  /** The printed table as a PNG, for a phone that cannot print a page (a
      home-screen app on an iPhone or iPad; see FluxHub.canPrint). The same
      layout, ink and key as on paper, drawn cell by cell onto a canvas. */
  App.prototype.printImage = function (opts) {
    const o = opts || {};
    const bw = o.ink === 'bw', key = !bw && !!o.key;
    const W = 3000, H = 1980, M = 70, lab = 64, head = 96, labRow = 48;
    const cw = (W - 2 * M - lab) / 18, ch = cw * 1.12, gap = ch * 0.35;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    const font = (weight, px) => weight + ' ' + Math.round(px) + 'px -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif';
    const rgbOf = (c) => {
      g.fillStyle = '#000'; g.fillStyle = c || '#ffffff';
      const v = g.fillStyle;
      if (v[0] === '#') return [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16));
      const m = /rgba?\(([^)]+)\)/.exec(v);
      return m ? m[1].split(',').slice(0, 3).map((x) => +x) : [255, 255, 255];
    };
    const tint = (c, k) => 'rgb(' + rgbOf(c).map((v) => Math.round(v * k + 255 * (1 - k))).join(',') + ')';
    const box = (x, y, w, h, r) => {
      g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
      g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
    };
    const fit = (text, weight, px, max) => {
      g.font = font(weight, px);
      const w = g.measureText(text).width;
      if (w > max) g.font = font(weight, px * max / w);
    };
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    // The Flux mark, top left, as on paper.
    g.fillStyle = '#0b0f1a'; box(M, 30, 44, 44, 10); g.fill();
    g.fillStyle = '#7fe3ff'; g.font = font('800', 26); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('F', M + 22, 53);
    g.fillStyle = '#333'; g.textAlign = 'left'; g.font = font('700', 28); g.fillText('Flux Periodic Table', M + 58, 53);
    const x0 = M + lab, y0 = head + labRow;
    const colX = (col) => x0 + (col - 1) * cw;
    const rowY = (row) => (row <= 7 ? y0 + (row - 1) * ch : y0 + 7 * ch + gap + (row - 9) * ch);
    // Group and period numbers, black.
    g.fillStyle = '#000'; g.font = font('700', 30); g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let c = 1; c <= 18; c++) g.fillText(String(c), colX(c) + cw / 2, head + labRow / 2);
    for (let r = 1; r <= 7; r++) g.fillText(String(r), M + lab / 2, rowY(r) + ch / 2);
    g.textAlign = 'right'; g.font = font('700', 28);
    g.fillText('57–71', colX(3) - 18, rowY(9) + ch / 2);
    g.fillText('89–103', colX(3) - 18, rowY(10) + ch / 2);
    // The cells.
    model().forEach((e) => {
      const cell = this.cells[e.n];
      const c = cell ? cell.style.getPropertyValue('--c').trim() : '';
      const heat = cell && cell.classList.contains('is-heat');
      const x = colX(e.col) + 3, y = rowY(e.row) + 3, w = cw - 6, h = ch - 6;
      box(x, y, w, h, 9);
      g.fillStyle = bw || !c ? '#fff' : tint(c, heat ? 0.55 : 0.2);
      g.fill();
      if (!bw && c) {
        g.save(); box(x, y, w, h, 9); g.clip();
        g.fillStyle = c; g.fillRect(x, y, w, h * 0.07);
        g.restore();
      }
      box(x, y, w, h, 9);
      g.lineWidth = 2; g.strokeStyle = bw ? '#555' : '#777'; g.stroke();
      g.fillStyle = '#000';
      g.textAlign = 'left'; g.textBaseline = 'top'; g.font = font('600', 22);
      g.fillText(String(e.n), x + 9, y + h * 0.1);
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = font('800', 56);
      g.fillText(e.s, x + w / 2, y + h * 0.43);
      fit(e.name, '500', 19, w - 12);
      g.fillText(e.name, x + w / 2, y + h * 0.68);
      const v = cell ? (cell.querySelector('.fpt-v') || {}).textContent || '' : '';
      if (v) { fit(v, '600', 19, w - 12); g.fillText(v, x + w / 2, y + h * 0.85); }
    });
    // The key, in the gap above the transition metals.
    if (key) {
      const k = this.printKeyData();
      const kx = colX(4) + 10, ky = rowY(1) + 20, kw = colX(13) - colX(4) - 20;
      g.fillStyle = '#000'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.font = font('700', 30);
      g.fillText(k.title, kx, ky + 14);
      g.font = font('500', 26);
      if (k.items) {
        const per = Math.ceil(k.items.length / 3), colW = kw / 3;
        k.items.forEach((it, i) => {
          const ix = kx + Math.floor(i / per) * colW, iy = ky + 62 + (i % per) * 46;
          box(ix, iy - 15, 30, 32, 4); g.fillStyle = tint(it[0], 0.2); g.fill();
          g.fillStyle = it[0]; g.fillRect(ix, iy - 15, 30, 8);
          box(ix, iy - 15, 30, 32, 4); g.strokeStyle = '#777'; g.lineWidth = 2; g.stroke();
          g.fillStyle = '#000'; g.fillText(it[1], ix + 42, iy);
        });
      } else {
        const gw = Math.min(kw, 900), gy = ky + 60;
        const grad = g.createLinearGradient(kx, 0, kx + gw, 0);
        k.stops.forEach((s, i) => grad.addColorStop(i / (k.stops.length - 1), s));
        g.fillStyle = grad; g.fillRect(kx, gy, gw, 36);
        g.strokeStyle = '#777'; g.lineWidth = 2; g.strokeRect(kx, gy, gw, 36);
        g.fillStyle = '#000'; g.font = font('500', 24);
        g.fillText('Lowest', kx, gy + 62); g.textAlign = 'right'; g.fillText('Highest', kx + gw, gy + 62);
      }
    }
    return new Promise((resolve, reject) => cv.toBlob((b) => (b ? resolve(b) : reject(new Error('png'))), 'image/png'));
  };

  App.prototype.destroy = function () {
    document.removeEventListener('keydown', this.onKey);
    if (this.playing) cancelAnimationFrame(this.playing);
    if (this.atom) this.atom.destroy();
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
      byN: byN, neutrons: neutrons, bohrSVG: bohrSVG, spectrumSVG: spectrumSVG, VIEWS: VIEWS,
    },
  };
})();
