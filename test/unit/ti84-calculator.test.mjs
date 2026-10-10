import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

/**
 * The calculator has to give a student the same answer their TI-84 Plus CE
 * gives, digit for digit, or it is worse than useless in a test. These cases
 * were checked against the handheld's documented results: display format
 * (10 digits, ⁻ for negatives, ᴇ for powers of ten, no leading zero), the
 * order of operations it uses, its errors, its statistics and finance, and
 * programs in TI-BASIC.
 */

const sandbox = { window: {}, console, setTimeout, clearTimeout };
vm.createContext(sandbox);
for (const f of ['stats', 'engine', 'editor', 'menus', '', 'graph', 'apps', 'prgm']) {
  const name = f ? 'flux-ti84-' + f + '.js' : 'flux-ti84.js';
  vm.runInContext(readFileSync(new URL('../../public/js/' + name, import.meta.url), 'utf8'), sandbox, { filename: name });
}
const W = sandbox.window;
/** Arrays made inside the sandbox have its prototypes; compare them as plain data. */
const same = (a, b, msg) => assert.deepEqual(JSON.parse(JSON.stringify(a)), b, msg);
const T = W.FluxTI, S = W.FluxTIStats;

function show(src, st) {
  try {
    const r = T.run(src, st);
    return r.value !== undefined ? T.textOf(r.value, st.mode, { conv: r.conv }) : JSON.stringify(r);
  } catch (e) {
    if (e.ti) return 'ERR:' + e.ti;
    throw e;
  }
}

test('the home screen gives the handheld\'s answers', () => {
  const st = T.freshState();
  const cases = [
    ['2+3*4', '14'], ['⁻2²', '⁻4'], ['2^3^2', '64'], ['1/2π', '1.570796327'], ['2(3)', '6'], ['3→A', '3'], ['2A', '6'],
    ['A²+1', '10'], ['√(2)', '1.414213562'], ['sin(π/6)', '.5'], ['cos(π/2)', '0'], ['sin(π)', '0'],
    ['1/3', '.3333333333'], ['1/3▶Frac', '1/3'], ['.75▶Frac', '3/4'], ['10^(12)', '1ᴇ12'], ['1/8000', '.000125'],
    ['123456789012', '1.23456789ᴇ11'], ['ln(e^(2))', '2'], ['log(1000)', '3'],
    ['5!', '120'], ['.5!', '.8862269255'], ['5 nCr 2', '10'], ['5 nPr 2', '20'], ['{1,2,3}+1', '{2 3 4}'],
    ['{1,2,3}→L₁', '{1 2 3}'], ['sum(L₁)', '6'], ['L₁(2)', '2'], ['L₁²', '{1 4 9}'],
    ['[[1,2][3,4]]→⟦A⟧', '[[1 2][3 4]]'], ['det(⟦A⟧)', '⁻2'], ['⟦A⟧⁻¹', '[[⁻2 1][1.5 ⁻.5]]'],
    ['√(⁻4)', 'ERR:NONREAL ANSWERS'], ['√(⁻4)+0i', '2i'], ['(1+2i)(3-i)', '5+5i'], ['(⁻8)^(1/3)', '⁻2'],
    ['1/0', 'ERR:DIVIDE BY 0'], ['ln(0)', 'ERR:DOMAIN'], ['2+', 'ERR:SYNTAX'], ['(2+3', '5'], ['sin(30', '⁻.9880316241'],
    ['int(⁻2.5)', '⁻3'], ['iPart(⁻2.5)', '⁻2'], ['round(π,3)', '3.142'], ['gcd(12,18)', '6'],
    ['seq(X²,X,1,5)', '{1 4 9 16 25}'], ['Σ(N,N,1,100)', '5050'], ['fnInt(X²,X,0,3)', '9'],
    ['normalcdf(⁻1,1)', '.6826894921'], ['invNorm(.975)', '1.959963985'], ['invNorm(.95,0,1,CENTER)', '{⁻1.959963985 1.959963985}'],
    ['binompdf(10,.5,5)', '.24609375'], ['3>2', '1'], ['2>1 and 3>2', '1'], ['logBASE(8,2)', '3'], ['e^(iπ)', '⁻1'],
    ['rref([[2,1,5][1,⁻1,1]])', '[[1 0 2][0 1 1]]'], ['stdDev({1,2,3,4})', '1.290994449'],
    ['1ᴇ100', 'ERR:OVERFLOW'], ['sub("HELLO",2,3)', 'ELL'], ['4→B:B+1', '5'], ['Ans+1', '6'],
    ['{1,2}+{1,2,3}', 'ERR:DIM MISMATCH'], ['L₁(5)', 'ERR:INVALID DIM'],
  ];
  for (const [src, want] of cases) assert.equal(show(src, st), want, src);
});

test('degree mode, DMS and the display modes', () => {
  const st = T.freshState();
  st.mode.angle = 'deg';
  assert.equal(show('sin(30)', st), '.5');
  assert.equal(show('tan(90)', st), 'ERR:DOMAIN');
  assert.equal(show('30.5▶DMS', st), '30°30′0″');
  st.mode.angle = 'rad';
  st.mode.digits = 2;
  assert.equal(show('π', st), '3.14');
  st.mode.digits = 'float';
  st.mode.notation = 'sci';
  assert.equal(show('1234', st), '1234');
  assert.equal(show('32', st), '32');
  assert.equal(show('0.5', st), '.5');
});

test('rand matches a new TI-84 (seed 0)', () => {
  const st = T.freshState();
  assert.equal(show('rand', st), '.9435974025');
  assert.equal(show('rand', st), '.908318861');
});

test('sequence mode supports recursive u(n), v(n), w(n) values and initial terms', () => {
  const st = T.freshState();
  st.mode.graph = 'seq';
  st.y['u(n)'] = 'u(n-1)+u(n-2)';
  st.sequences.u = { nMin: 0, initial: [0, 1] };
  assert.equal(show('u(10)', st), '55');
  assert.equal(show('{u(0),u(1),u(2),u(3),u(4)}', st), '{0 1 1 2 3}');
  T.run('7→u(0)', st);
  assert.equal(show('u(2)', st), '8');
});

test('Evo separates intervals, groups distributions, and keeps stat wizards on', () => {
  const st = T.freshState();
  st.mode.model = 'evo';
  st.ui = { fmt: { thick: true }, wizards: false };
  const Core = W.FluxTI84.core;
  const stat = new Core.MenuApp({ st }, 'STAT');
  assert.ok(stat.tabs.some((tab) => tab.name === 'INTERVALS'));
  assert.equal(stat.tabs.find((tab) => tab.name === 'INTERVALS').items.length, 6);
  const distr = new Core.MenuApp({ st }, 'DISTR');
  same(distr.tabs.map((tab) => tab.name), ['NORMAL', 't', 'χ²', 'F', 'BINOMIAL', 'POISSON', 'GEOMETRIC', 'DRAW']);
  const modeRows = new Core.ModeApp({ st }).rows();
  assert.equal(modeRows.some((row) => row.label === 'STAT WIZARDS:'), false);
  const apps = new Core.AppsHomeApp({ st });
  assert.match(apps.render(), /Function Editor/);
  assert.match(apps.render(), /Python, unavailable/);
});

test('Evo exposes 17 zoom presets, fractional trace steps, and quick zoom keys', () => {
  const st = T.freshState();
  st.mode.model = 'evo';
  st.ui = { zoomPrev: null, yOn: {}, yCol: {}, yStyle: {}, plots: [] };
  const Core = W.FluxTI84.core;
  const zoomMenu = new Core.MenuApp({ st }, 'ZOOM');
  const zooms = zoomMenu.tabs[0].items;
  assert.equal(zooms.length, 17);
  assert.equal(zooms[0].l, 'Zoom Box');
  assert.equal(zooms[3].l, 'Zoom Default');
  assert.equal(zooms[11].l, 'Zoom Frac1/2');
  assert.equal(zooms[16].l, 'Zoom Frac1/10');

  const G = W.FluxTIGraph;
  assert.equal(G.applyZoom({ st }, 'ZoomFrac1/2'), true);
  assert.equal((st.win.Xmax - st.win.Xmin) / 319, 0.25);
  assert.equal((st.win.Ymax - st.win.Ymin) / 209, 0.25);
  assert.equal(st.win.TraceStep, 0.5);
  const before = st.win.Xmax - st.win.Xmin;
  const graph = new G.GraphApp({ st });
  assert.equal(graph.key('add'), true);
  assert.ok(st.win.Xmax - st.win.Xmin < before);
  assert.equal(graph.key('sub'), true);
  assert.equal(st.win.Xmax - st.win.Xmin, before);
});

test('distributions and the STAT tests', () => {
  const near = (a, b, tol = 5e-10) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);
  near(S.invT(0.975, 10), 2.228138852, 5e-9);
  near(S.chi2cdf(0, 3.841458821, 1), 0.95, 1e-9);
  const z = S.zTest(0, 1, 0.5, 25, 'ne');
  near(z.z, 2.5);
  near(z.p, 0.0124193306, 1e-9);
  near(S.onePropZTest(0.5, 60, 100, 'ne').p, 0.0455002639, 1e-9);
  const chi = S.chi2Test([[10, 20], [30, 40]]);
  near(chi.chi2, 0.7936507937, 1e-9);
  assert.equal(chi.df, 1);
  same(chi.expected.map((r) => r.map((v) => +v.toFixed(9))), [[12, 18], [28, 42]]);
});

test('TVM, polynomial roots and systems', () => {
  const pmt = S.tvmSolve({ N: 360, I: 6, PV: 200000, PMT: 0, FV: 0, PY: 12, CY: 12, begin: false }, 'PMT');
  assert.equal(+pmt.toFixed(6), -1199.10105);
  const i = S.tvmSolve({ N: 360, I: 0, PV: 200000, PMT: -1199.101050, FV: 0, PY: 12, CY: 12, begin: false }, 'I');
  assert.equal(+i.toFixed(6), 6);
  same(S.polyRoots([1, -5, 6]).map((r) => [+r[0].toFixed(9), r[1]]), [[3, 0], [2, 0]]);
  const im = S.polyRoots([1, 0, 1]).map((r) => [r[0], +r[1].toFixed(9)]).sort((a, b) => b[1] - a[1]);
  same(im, [[0, 1], [0, -1]]);
  const sys = S.solveSystem([[1, 1, 3], [1, -1, 1]]);
  assert.equal(sys.kind, 'unique');
  same(sys.x.map((v) => +v.toFixed(9)), [2, 1]);
  assert.equal(S.solveSystem([[1, 1, 3], [2, 2, 7]]).kind, 'none');
  assert.equal(S.solveSystem([[1, 1, 3], [2, 2, 6]]).kind, 'infinite');
});

test('the test forms compute from lists and store their results', () => {
  const st = T.freshState();
  st.ui = { history: [], ynodes: {}, yOn: {}, tests: {} };
  st.lists['L₁'] = [1, 2, 3, 4, 5];
  const c = { st };
  const A = W.FluxTIApps;
  const r = A.TESTS.ttest.run(c, { inpt: 'data', mu0: 2, list: 'L₁', freq: '', alt: 'ne' });
  const t = r.rows.find((x) => x[0] === 't')[1];
  assert.equal(+t.toFixed(9), 1.414213562);
  assert.equal(r.rows.find((x) => x[0] === 'df')[1], 4);
  // Freq:1 is the same as no frequency list.
  const r1 = A.TESTS.ttest.run(c, { inpt: 'data', mu0: 2, list: 'L₁', freq: '1', alt: 'ne' });
  assert.equal(r1.rows.find((x) => x[0] === 't')[1], t);
  st.mats.A = [[10, 20], [30, 40]];
  A.TESTS.chi2.run(c, { obs: 'A', exp: 'B' });
  same(st.mats.B, [[12, 18], [28, 42]]);
});

test('programs: blocks, loops, labels and the screen', async () => {
  const P = W.FluxTIPrgm, E = W.FluxTIEditor;
  const k = P._test.compile(['If A=1:Then', 'Disp 1', 'Else', 'Disp 2', 'End', 'While 0', 'End', 'Lbl Q']);
  assert.equal(k.endOf[1], 5);
  assert.equal(k.elseOf[1], 3);
  assert.equal(k.endOf[6], 7);
  assert.equal(k.labels.Q, 8);
  same(P._test.splitArgs('I,1,10)'), ['I', '1', '10']);
  same(P._test.splitArgs('"A,B",max(1,2),3'), ['"A,B"', 'max(1,2)', '3']);

  const st = T.freshState();
  st.ui = { history: [], prgms: {
    DEMO: ['ClrHome', 'Disp "HI"', 'For(I,1,3)', 'Disp I', 'End', 'If I=4:Then', 'Disp "FOUR"', 'Else', 'Disp "NO"', 'End',
      '0→S', 'While S<10', 'S+3→S', 'End', 'IS>(S,20):Disp "SKIPPED"', 'Goto Z', 'Disp "NOT HERE"', 'Lbl Z', 'S'],
  } };
  const c = {
    st, stack: [{}], host: { isConnected: true }, runner: null, errors: [],
    hooks() { return { getKey: () => 0 }; }, render() {}, save() {},
    push(a) { this.stack.push(a); }, top() { return this.stack[this.stack.length - 1]; }, error(kind) { this.errors.push(kind); },
  };
  P.run(c, 'DEMO', E.nodesFromCode('prgmDEMO'));
  // It runs in 12ms slices; on a busy machine one slice is not the whole program.
  for (let i = 0; i < 100 && c.runner; i++) await new Promise((res) => setTimeout(res, 10));
  same(c.errors, []);
  const h = st.ui.history[st.ui.history.length - 1];
  // Numbers from Disp sit at the right edge; text starts at the left.
  same(h.lines, [{ t: 'HI' }, { t: '1', r: true }, { t: '2', r: true }, { t: '3', r: true }, { t: 'FOUR' }, { t: 'SKIPPED' }]);
  // The last line was an expression, so its value shows instead of Done.
  assert.equal(T.displayText(h.out), '13');
  assert.equal(c.stack.length, 1);
});

test('programs: Input waits for an answer, errors stop with the line', async () => {
  const P = W.FluxTIPrgm;
  const st = T.freshState();
  st.ui = { history: [], prgms: { SQ: ['Input "N=",N', 'Disp N²'], BAD: ['Disp 1', 'Goto X'] } };
  const c = {
    st, stack: [{}], host: { isConnected: true }, runner: null, errors: [],
    hooks() { return { getKey: () => 0 }; }, render() {}, save() {},
    push(a) { this.stack.push(a); }, top() { return this.stack[this.stack.length - 1]; }, error(kind) { this.errors.push(kind); },
  };
  P.run(c, 'SQ');
  const r = c.runner;
  assert.equal(r.state, 'input');
  r.ed.insertTok('7');
  r.submit();
  // The program carries on in timer steps; wait for it to finish rather than
  // for a fixed 30ms, which a busy machine overshoots.
  for (let i = 0; i < 100 && c.runner; i++) await new Promise((res) => setTimeout(res, 10));
  const h = st.ui.history[st.ui.history.length - 1];
  same(h.lines, [{ t: 'N=7' }, { t: '49', r: true }]);
  assert.equal(c.runner, null);

  P.run(c, 'BAD');
  same(c.errors, ['LABEL']);
});
