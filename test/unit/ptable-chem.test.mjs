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
