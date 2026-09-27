#!/usr/bin/env node
/*
 * Build public/js/flux-ptable-data.js — the measured data behind the Flux
 * Periodic Table — from public, citable sources. Nothing in the output is
 * typed from memory: a revision tool that shows a confident wrong constant is
 * worse than one that shows nothing.
 *
 *   node scripts/build-ptable-data.mjs --src <dir>
 *
 * <dir> holds the downloads (all public: US government works, or data tables):
 *   pubchem-pt.json   https://pubchem.ncbi.nlm.nih.gov/rest/pug/periodictable/JSON
 *   pv/<Z>.json       https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/element/<Z>/JSON
 *   nist-iso.txt      https://physics.nist.gov/cgi-bin/Compositions/stand_alone.pl?ele=&ascii=ascii2&isotype=some
 *   nist-ie.csv       NIST ASD ionization energies, spectra=H-Ds, eV, CSV
 *                     (https://physics.nist.gov/PhysRefData/ASD/ionEnergy.html)
 *   lines/<Z>.csv     NIST ASD lines for "<Symbol> I", 380–750 nm air, CSV with
 *                     intensities (https://physics.nist.gov/PhysRefData/ASD/lines_form.html)
 *
 * What comes from where:
 *   mass, colour (CPK), configuration, Pauling electronegativity, van der Waals
 *   radius, first ionization energy, electron affinity, oxidation states,
 *   state, melting/boiling point, density, discovery year   — PubChem table
 *   covalent radius (Cordero et al. 2008), empirical radius (Slater 1964),
 *   Allen electronegativity (1989), crust and ocean abundance,
 *   longest-lived isotope's half-life (IAEA AMDC)             — PubChem records
 *   isotope masses and natural abundances                     — NIST
 *   every successive ionization energy                        — NIST ASD
 *   visible emission lines and their relative intensities     — NIST ASD
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argi = process.argv.indexOf('--src');
if (argi < 0) { console.error('usage: node scripts/build-ptable-data.mjs --src <download dir>'); process.exit(1); }
const SRC = path.resolve(process.argv[argi + 1]);
const OUT = path.join(ROOT, 'public/js/flux-ptable-data.js');
const read = (f) => fs.readFileSync(path.join(SRC, f), 'utf8');
const num = (s) => { const v = parseFloat(String(s).replace(/[^\d.eE+-]/g, '')); return Number.isFinite(v) ? v : null; };
const sig = (v, n) => (v == null ? null : +(+v).toPrecision(n));

/* ── PubChem's periodic table ─────────────────────────────────────────── */

const pt = JSON.parse(read('pubchem-pt.json')).Table;
const COL = pt.Columns.Column;
const rows = pt.Row.map((r) => Object.fromEntries(COL.map((c, i) => [c, r.Cell[i]])));
const EL = {};
const bySym = {};
for (const r of rows) {
  const z = +r.AtomicNumber;
  bySym[r.Symbol] = z;
  EL[z] = {
    m: r.AtomicMass,                                 // kept as text: its digits are its precision
    cpk: r.CPKHexColor || null,
    ec: r.ElectronConfiguration || null,
    en: num(r.Electronegativity),
    rv: num(r.AtomicRadius),                         // van der Waals, pm
    ea: r.ElectronAffinity === '' ? null : num(r.ElectronAffinity),
    ox: r.OxidationStates || null,
    st: r.StandardState || null,
    mp: num(r.MeltingPoint),                         // K
    bp: num(r.BoilingPoint),                         // K
    d: num(r.Density),                               // g/cm³
    yr: r.YearDiscovered || null,
  };
}

/* ── PubChem's element records ────────────────────────────────────────── */

function find(sec, name) {
  for (const s of sec.Section || []) {
    if (s.TOCHeading === name) return s;
    const r = find(s, name);
    if (r) return r;
  }
  return null;
}
const strings = (inf) => ((inf.Value && inf.Value.StringWithMarkup) || []).map((x) => x.String || '');
const infoText = (sec, name) => {
  const inf = sec && (sec.Information || []).find((i) => !name || i.Name === name);
  if (!inf) return null;
  if (inf.Value && inf.Value.Number) return inf.Value.Number.join(' ');
  return strings(inf).join(' ');
};
/** "5.63×104" → 56300, "4×10-3" → 0.004 (PubChem writes the exponent unmarked). */
function sciText(s) {
  const m = /^\s*~?([\d.]+)\s*(?:×\s*10\s*(-?\d+))?/.exec(s || '');
  if (!m) return null;
  return +(parseFloat(m[1]) * Math.pow(10, m[2] ? +m[2] : 0)).toPrecision(4);
}
const UNIT_S = { ys: 1e-24, zs: 1e-21, as: 1e-18, fs: 1e-15, ps: 1e-12, ns: 1e-9, us: 1e-6, 'μs': 1e-6, ms: 1e-3, s: 1, m: 60, h: 3600, d: 86400,
  y: 31556952, ky: 31556952e3, My: 31556952e6, Gy: 31556952e9, Ty: 31556952e12, Py: 31556952e15, Ey: 31556952e18, Zy: 31556952e21, Yy: 31556952e24 };
function halfLife(s) {
  if (/^Stable/.test(s)) return { sec: Infinity, text: 'stable' };
  const m = /^~?([\d.]+(?:[eE][+-]?\d+)?)\s*([a-zμ]+|[kMGTPEZY]y)\b/i.exec(s.trim());
  if (!m || !(m[2] in UNIT_S)) return null;
  return { sec: parseFloat(m[1]) * UNIT_S[m[2]], text: m[1] + ' ' + m[2], est: /Estimated/.test(s) };
}

for (let z = 1; z <= 118; z++) {
  const rec = JSON.parse(read('pv/' + z + '.json')).Record;
  const e = EL[z];
  const rad = find(rec, 'Atomic Radius');
  const cov = rad && infoText(rad, 'Covalent Atomic Radius');
  // "132(3)[l.s.], 152(6)[h.s.]" and "76(1)[sp3], …" — the first value is the one tables quote.
  e.rc = cov ? num(/^\s*(\d+)/.exec(cov) && /^\s*(\d+)/.exec(cov)[1]) : null;
  // Slater's empirical radii (1964), and the Allen electronegativity scale (1989) — which, unlike Pauling's, gives the noble gases values.
  const emp = rad && infoText(rad, 'Empirical Atomic Radius');
  e.re = emp ? num(emp) : null;
  const allen = infoText(find(rec, 'Electronegativity'), 'Allen Scale Electronegativity');
  e.enA = allen ? num(allen) : null;
  const crust = infoText(find(rec, 'Estimated Crustal Abundance'));
  e.abC = crust && !/Not Applicable/.test(crust) ? sciText(crust) : null;          // mg/kg
  const ocean = infoText(find(rec, 'Estimated Oceanic Abundance'));
  e.abO = ocean && !/Not Applicable/.test(ocean) ? sciText(ocean) : null;          // mg/L
  const phys = infoText(find(rec, 'Physical Description'));
  if (phys && /Expected/i.test(phys)) e.stNote = phys;

  // The longest-lived ground-state nuclide, for elements that have no stable one.
  const hl = find(rec, 'Atomic Mass, Half Life, and Decay');
  if (hl) {
    const nuc = (hl.Information || []).find((i) => i.Name === 'Nuclide');
    const life = (hl.Information || []).find((i) => i.Name === 'Half Life and Uncertainty');
    if (nuc && life) {
      const names = strings(nuc), lives = strings(life);
      let best = null, stable = false;
      if (names.length === lives.length) {
        names.forEach((name, i) => {
          const mm = /^(\d+)([A-Z][a-z]*)$/.exec(name.trim());   // ground states only: no m/n/p isomers
          if (!mm) return;
          const h = halfLife(lives[i]);
          if (!h) return;
          if (h.sec === Infinity) { stable = true; return; }
          if (!best || h.sec > best.sec) best = { a: +mm[1], sec: h.sec, text: h.text, est: h.est };
        });
      }
      if (!stable && best) e.hl = [best.a, best.text, best.sec].concat(best.est ? [1] : []);
    }
  }
}

/* ── NIST: isotopes ───────────────────────────────────────────────────── */

const isoText = read('nist-iso.txt').replace(/<[^>]+>/g, '');
for (const block of isoText.split(/\n\s*\n/)) {
  const g = (k) => { const m = new RegExp('^' + k + ' = (.*)$', 'm').exec(block); return m ? m[1].trim() : null; };
  const z = +g('Atomic Number');
  const comp = g('Isotopic Composition');
  if (!z || !comp || comp === '&nbsp;') continue;
  const a = +g('Mass Number');
  const mass = parseFloat(g('Relative Atomic Mass'));
  const ab = parseFloat(comp);
  if (!Number.isFinite(ab) || !EL[z]) continue;
  (EL[z].iso = EL[z].iso || []).push([a, mass, ab]);
}

/* ── NIST: every ionization energy ────────────────────────────────────── */

const clean = (c) => c.replace(/^"?="?/, '').replace(/"+$/, '').replace(/^"+/, '');
const csvRows = (text) => text.trim().split(/\r?\n/).map((line) => {
  const out = []; let cur = '', q = false;
  for (const ch of line) {
    if (ch === '"') { q = !q; cur += ch; continue; }
    if (ch === ',' && !q) { out.push(clean(cur)); cur = ''; continue; }
    cur += ch;
  }
  out.push(clean(cur));
  return out;
});
{
  const [head, ...body] = csvRows(read('nist-ie.csv'));
  const iZ = head.indexOf('At. num'), iQ = head.indexOf('Ion Charge'), iE = head.findIndex((h) => /^Ionization Energy/.test(h));
  for (const r of body) {
    const z = +r[iZ], q = +String(r[iQ]).replace('+', ''), ev = parseFloat(r[iE]);
    if (!EL[z] || !Number.isFinite(ev)) continue;
    (EL[z].ie = EL[z].ie || [])[q] = sig(ev, 6);
  }
  // Only keep a run with no gaps from the first electron.
  for (const z in EL) {
    const ie = EL[z].ie;
    if (!ie) continue;
    let k = 0;
    while (k < ie.length && ie[k] != null) k++;
    EL[z].ie = ie.slice(0, k);
    if (!EL[z].ie.length) delete EL[z].ie;
  }
}

/* ── NIST: visible emission lines ─────────────────────────────────────── */

for (let z = 1; z <= 118; z++) {
  const f = path.join(SRC, 'lines', z + '.csv');
  if (!fs.existsSync(f)) continue;
  const text = fs.readFileSync(f, 'utf8');
  if (!/^obs_wl/.test(text)) continue;
  const [head, ...body] = csvRows(text);
  const iObs = head.indexOf('obs_wl_air(nm)'), iRitz = head.indexOf('ritz_wl_air(nm)'), iI = head.indexOf('intens');
  const lines = [];
  for (const r of body) {
    const wl = parseFloat(r[iObs]) || parseFloat(r[iRitz]);
    const m = /(\d+(?:\.\d+)?)/.exec(r[iI] || '');
    if (!Number.isFinite(wl) || !m) continue;
    const I = parseFloat(m[1]);
    if (!(I > 0) || wl < 380 || wl > 750) continue;
    lines.push([+wl.toFixed(2), I]);
  }
  // Observed and Ritz entries can repeat a line; keep each wavelength once, at its strongest.
  const seen = new Map();
  for (const l of lines) if (!seen.has(l[0]) || seen.get(l[0])[1] < l[1]) seen.set(l[0], l);
  lines.length = 0;
  seen.forEach((l) => lines.push(l));
  lines.sort((a, b) => b[1] - a[1]);
  // The strongest forty: enough to look like the real spectrum, not the whole atlas.
  const top = lines.slice(0, 40).sort((a, b) => a[0] - b[0]);
  if (top.length) EL[z].ln = top;
}

/* ── Write ────────────────────────────────────────────────────────────── */

for (const z in EL) for (const k in EL[z]) if (EL[z][k] == null) delete EL[z][k];
const out = '/* Generated by scripts/build-ptable-data.mjs — do not edit by hand.\n'
  + '   Sources: PubChem (NIH) periodic table and element records; NIST Atomic\n'
  + '   Weights and Isotopic Compositions; NIST Atomic Spectra Database\n'
  + '   (ionization energies, lines); IAEA AMDC half-lives via PubChem;\n'
  + '   covalent radii: Cordero et al., Dalton Trans. 2008, via PubChem. */\n'
  + 'window.FluxPTableData = ' + JSON.stringify({ built: new Date().toISOString().slice(0, 10), el: EL }) + ';\n';
fs.writeFileSync(OUT, out);
console.log('wrote', path.relative(ROOT, OUT), (out.length / 1024).toFixed(0) + ' KB');
