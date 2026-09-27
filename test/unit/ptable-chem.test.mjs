import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

/**
 * The Flux Periodic Table's numbers and its chemistry tools. A revision tool
 * that shows a confident wrong answer is worse than none, so each answer here
 * is one a textbook or exam mark scheme prints.
 */

const doc = { getElementById: () => null, addEventListener() {}, querySelectorAll: () => [] };
const sandbox = { window: {}, document: doc, console };
vm.createContext(sandbox);
for (const f of ['flux-periodic.js', 'flux-ptable-data.js', 'flux-chem.js']) {
  vm.runInContext(readFileSync(new URL('../../public/js/' + f, import.meta.url), 'utf8'), sandbox, { filename: f });
}
const W = sandbox.window;
const C = W.FluxChem, E = W.fluxPeriodic.ELEMENTS, D = W.FluxPTableData.el;
const bySym = Object.fromEntries(E.map((e) => [e.s, e]));
const same = (a, b, msg) => assert.deepEqual(JSON.parse(JSON.stringify(a)), b, msg);
const t = (f) => { try { return f(); } catch (e) { return 'ERR: ' + e.message; } };

test('the data file covers the table and agrees with it', () => {
  assert.equal(Object.keys(D).length, 118);
  // Every configuration accounts for every electron.
  for (const e of E) {
    const occ = C.occupancy(e.ec);
    const n = Object.values(occ).reduce((a, b) => a + b, 0);
    assert.equal(n, e.n, e.s + ' ' + e.ec);
  }
  assert.equal(D[1].ie[0], 13.5984);                          // hydrogen, NIST
  assert.equal(D[11].ie.length, 11);                          // every electron of sodium
  assert.ok(D[1].ln.some((l) => Math.abs(l[0] - 656.28) < 0.01), 'H-alpha is in hydrogen\'s spectrum');
  assert.ok(D[11].ln.some((l) => Math.abs(l[0] - 588.99) < 0.01), 'the sodium D line');
  // Natural abundances add to one; their weighted mass is the atomic mass.
  const cu = D[29].iso;
  assert.ok(Math.abs(cu.reduce((a, x) => a + x[2], 0) - 1) < 1e-6);
  assert.ok(Math.abs(cu.reduce((a, x) => a + x[1] * x[2], 0) - bySym.Cu.mass) < 0.01);
  assert.equal(D[43].hl[0], 97);                              // technetium's longest-lived isotope
  assert.equal(D[92].hl[1], '4.463 Gy');                      // uranium-238
});

test('molar mass, with hydrates, brackets and ions', () => {
  const M = (f, o) => +C.molarMass(f, o).total.toFixed(2);
  assert.equal(M('H2O'), 18.02);
  assert.equal(M('H2SO4'), 98.07);
  assert.equal(M('Ca(OH)2'), 74.09);
  assert.equal(M('CuSO4·5H2O'), 249.68);
  assert.equal(M('CuSO4.5H2O'), 249.68);
  assert.equal(M('[Cu(NH3)4]SO4'), 227.73);
  assert.equal(M('Fe2(SO4)3'), 399.86);
  assert.equal(M('SO4^2-'), 96.06);
  // 2 d.p. masses, as data booklets print them: Fe is 55.85, not 55.84.
  assert.equal(C.massOf('Fe', { dp2: true }), 55.85);
  const pct = C.molarMass('C6H12O6').parts.find((p) => p.s === 'C').pct;
  assert.equal(+pct.toFixed(1), 40.0);
  assert.match(t(() => C.molarMass('Xx2')), /no element "Xx"/);
  assert.match(t(() => C.molarMass('2H2O')), /number off the front/);
  assert.match(t(() => C.molarMass('Mg(OH')), /not closed/);
});

test('charges are read the way chemists write them', () => {
  const q = (f) => { const p = C.parse(f); return [JSON.parse(JSON.stringify(p.atoms)), p.charge]; };
  same(q('SO42-'), [{ S: 1, O: 4 }, -2]);
  same(q('SO4^2-'), [{ S: 1, O: 4 }, -2]);
  same(q('Fe3+'), [{ Fe: 1 }, 3]);
  same(q('NH4+'), [{ N: 1, H: 4 }, 1]);
  same(q('Hg22+'), [{ Hg: 2 }, 2]);
  same(q('O2-'), [{ O: 1 }, -2]);
  assert.equal(C.pretty('Cr2O72-'), 'Cr₂O₇²⁻');
  assert.equal(C.pretty('CuSO4.5H2O'), 'CuSO₄·5H₂O');
});

test('equations balance exactly, ions and electrons too', () => {
  const b = (eq) => t(() => C.balance(eq).text);
  assert.equal(b('Fe + O2 -> Fe2O3'), '4Fe + 3O₂ → 2Fe₂O₃');
  assert.equal(b('C3H8 + O2 -> CO2 + H2O'), 'C₃H₈ + 5O₂ → 3CO₂ + 4H₂O');
  assert.equal(b('KMnO4 + HCl -> KCl + MnCl2 + H2O + Cl2'), '2KMnO₄ + 16HCl → 2KCl + 2MnCl₂ + 8H₂O + 5Cl₂');
  assert.equal(b('MnO4- + Fe2+ + H+ -> Mn2+ + Fe3+ + H2O'), 'MnO₄⁻ + 5Fe²⁺ + 8H⁺ → Mn²⁺ + 5Fe³⁺ + 4H₂O');
  assert.equal(b('Fe3+ + e- -> Fe2+'), 'Fe³⁺ + e⁻ → Fe²⁺');
  assert.equal(C.balance('2H2 + O2 -> 2H2O').givenCorrect, true);
  assert.equal(C.balance('H2 + O2 -> 2H2O').givenCorrect, false);
  assert.equal(C.balance('C3H8 + O2 -> CO2 + H2O').type, 'Combustion');
  assert.match(b('H2 + O2 -> H2O + H2O2'), /more than one way/);
  assert.match(b('Na + Cl2'), /arrow/);
});

test('empirical and molecular formulas', () => {
  const r = C.empirical([{ s: 'C', v: 40 }, { s: 'H', v: 6.7 }, { s: 'O', v: 53.3 }], { M: 180 });
  assert.equal(r.formula, 'CH2O');
  assert.equal(r.molecular.formula, 'C6H12O6');
  assert.equal(C.empirical([{ s: 'Fe', v: 69.94 }, { s: 'O', v: 30.06 }]).formula, 'Fe2O3');
  assert.equal(C.empirical([{ s: 'C', v: 85.6 }, { s: 'H', v: 14.4 }], { M: 56 }).molecular.formula, 'C4H8');
});

test('ions lose their outer shell first', () => {
  const ion = (s, q) => C.ionConfig(bySym[s].ec, bySym[s].n, q).text.short;
  assert.equal(ion('Fe', 2), '[Ar] 3d⁶');
  assert.equal(ion('Fe', 3), '[Ar] 3d⁵');
  assert.equal(ion('Cu', 1), '[Ar] 3d¹⁰');
  assert.equal(ion('Sn', 2), '[Kr] 4d¹⁰ 5s²');
  assert.equal(ion('Eu', 3), '[Xe] 4f⁶');
  assert.equal(ion('O', -2), '[He] 2s² 2p⁶');
  assert.equal(ion('Cl', -1), '[Ne] 3s² 3p⁶');
  const orb = C.orbitals(C.occupancy(bySym.Fe.ec));
  assert.equal(orb.reduce((a, o) => a + o.unpaired, 0), 4, 'iron has four unpaired 3d electrons');
});

test('ionic compounds: charges cross over, names follow', () => {
  const I = C.ions();
  const find = (list, f, q) => list.find((x) => x.f === f && x.charge === q);
  const name = (a, b) => { const r = C.ionic(find(I.cations, ...a), find(I.anions, ...b)); return r.formula + ' ' + r.name; };
  assert.equal(name(['Fe', 3], ['SO4', -2]), 'Fe2(SO4)3 iron(III) sulfate');
  assert.equal(name(['NH4', 1], ['PO4', -3]), '(NH4)3PO4 ammonium phosphate');
  assert.equal(name(['Ca', 2], ['OH', -1]), 'Ca(OH)2 calcium hydroxide');
  assert.equal(name(['Al', 3], ['O', -2]), 'Al2O3 aluminum oxide');
  assert.equal(name(['Na', 1], ['Cl', -1]), 'NaCl sodium chloride');
});

test('the trends worked out from the data', () => {
  vm.runInContext(readFileSync(new URL('../../public/js/flux-ptable.js', import.meta.url), 'utf8'), sandbox, { filename: 'flux-ptable.js' });
  const K = W.FluxPTable.core, P = K.PROP;
  const el = (s) => K.model().find((e) => e.s === s);
  const top = (id, dir) => K.model().filter((e) => P[id].get(e) != null).sort((a, b) => dir * (P[id].get(b) - P[id].get(a)))[0].s;
  assert.equal(P.shield.get(el('Na')), 8.8);                  // σ = 11 − 2.20
  // Palladium has no 5s electron, so its outermost is 4d: 46 − 36 − 9 × 0.35.
  assert.equal(P.zeff.get(el('Pd')), 6.85);
  assert.equal(P.zeff.get(el('Ag')), 3.7);
  assert.equal(P.core.get(el('Na')), 10);
  assert.equal(P.unpaired.get(el('Cr')), 6);                  // 3d⁵ 4s¹
  assert.equal(P.unpaired.get(el('Gd')), 8);                  // 4f⁷ 5d¹
  assert.equal(P.neutrons.get(el('Pb')), 126);                // lead-208
  assert.equal(P.iso.get(el('Sn')), 10);                      // the most natural isotopes
  assert.ok(P.vol.get(el('Cs')) > 65, 'Lothar Meyer\'s peak at caesium');
  assert.equal(P.vol.get(el('O')), null, 'gases are left out of atomic volume');
  assert.ok(P.liq.get(el('Ga')) > 2000, 'gallium is liquid for over 2000 degrees');
  assert.equal(top('enA', 1), 'Ne');                          // Allen's scale puts neon on top
  assert.equal(top('metal', -1), 'Cs');                       // lowest ionization energy: most metallic
  const p3 = ['Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl', 'Ar'];
  const peak = (id) => { const v = p3.map((s) => P[id].get(el(s))); return p3[v.indexOf(Math.max.apply(null, v))]; };
  assert.equal(peak('ie2'), 'Na', 'the second ionization energy peaks in group 1');
  assert.equal(peak('ie3'), 'Mg', 'the third peaks in group 2');
  assert.equal(peak('ie'), 'Ar');
});

test('the deeper tabs: Aufbau exceptions, hydrogen\'s lines, Cl₂, and the atom in 3D', () => {
  if (!W.FluxPTable) vm.runInContext(readFileSync(new URL('../../public/js/flux-ptable.js', import.meta.url), 'utf8'), sandbox, { filename: 'flux-ptable.js' });
  for (const f of ['flux-ptable-atom3d.js', 'flux-ptable-explore.js']) {
    vm.runInContext(readFileSync(new URL('../../public/js/' + f, import.meta.url), 'utf8'), sandbox, { filename: f });
  }
  const X = W.FluxPTableExplore, A3 = W.FluxAtom3D, K = W.FluxPTable.core;
  const el = (s) => K.model().find((e) => e.s === s);

  // Chromium and copper break the Aufbau order; iron does not.
  const cr = X.exception(el('Cr'));
  assert.equal(cr.predicted, '[Ar] 3d⁴ 4s²');
  assert.equal(cr.actual, '[Ar] 3d⁵ 4s¹');
  assert.equal(cr.halfOrFull, true);
  assert.equal(X.exception(el('Cu')).dCount, 10);
  assert.equal(X.exception(el('Fe')), null);
  // Every element the data says is an exception really differs from Aufbau.
  const odd = K.model().filter((e) => X.exception(e)).map((e) => e.s);
  for (const s of ['Cr', 'Cu', 'Mo', 'Ag', 'Au', 'Pd']) assert.ok(odd.includes(s), s + ' should be an exception');

  // Hydrogen: Balmer's red line, the Lyman limit, and the ionization energy it gives.
  assert.equal(+X.hLine(3, 2).nm.toFixed(2), 656.46);                // vacuum (NIST 656.461); 656.28 in air
  assert.equal(+X.hLine(3, 2).air.toFixed(1), 656.3);
  assert.equal(+X.hLine(Infinity, 1).nm.toFixed(1), 91.2);
  assert.equal(Math.round(X.hLine(Infinity, 1).kJ), 1312);
  assert.equal(+X.hLevel(2).toFixed(2), -3.40);

  // Cl₂: three molecular-ion peaks, about 9 : 6 : 1.
  const peaks = X.diatomicPeaks(el('Cl').x.iso);
  same(peaks.map((p) => p[0]), [70, 72, 74]);
  assert.ok(Math.abs(peaks.reduce((a, p) => a + p[1], 0) - 1) < 1e-9);
  assert.ok(Math.abs(peaks[0][1] / peaks[2][1] - 9.76) < 0.05);

  // The 3D atom: iron-56, and potassium's shells from its configuration (2, 8, 8, 1 — not 2, 8, 9).
  const fe = X.atomParts(el('Fe'));
  assert.equal(fe.A, 56);
  same(fe.shells, [2, 8, 14, 2]);
  same(X.atomParts(el('K')).shells, [2, 8, 8, 1]);
  const nuc = A3.nucleus(26, 56);
  assert.equal(nuc.length, 56);
  assert.equal(nuc.filter((n) => n.p).length, 26);
  // A p_x orbital is a dumbbell along x.
  const px = A3.orbitalCloud(1, 0, 600, 3);
  const mean = (k) => px.reduce((a, p) => a + Math.abs(p[k]), 0) / px.length;
  assert.ok(mean('x') > 2 * mean('y') && mean('x') > 2 * mean('z'));
});
