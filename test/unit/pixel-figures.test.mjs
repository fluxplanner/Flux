import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * Flux Pixel's maths figures and vectors (public/js/flux-figures.js).
 *
 * Teachers print these on tests, so "drawn to scale" has to be true, a
 * label has to sit outside the side it names and inside the angle it
 * names, and a vector's direction has to be right in every quadrant. A
 * wrong bearing on a worksheet is a wrong answer key.
 */

const w = {};
new Function('window', fs.readFileSync('public/js/flux-expr.js', 'utf8'))(w);
new Function('window', fs.readFileSync('public/js/flux-figures.js', 'utf8'))(w);
const F = w.FluxFigures;
const V = F.vec;

const close = (got, want, what, tol = 1e-9) =>
  assert.ok(Math.abs(got - want) <= tol, `${what}: got ${got}, want ${want}`);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const tri = (s) => F.solveTriangle({ ...F.defaults('triangle'), ...s });

/* ── Triangles ─────────────────────────────────────────────────────── */

test('SSS: 3, 4, 5 has a right angle opposite the 5', () => {
  const t = tri({ method: 'sss', a: 3, b: 4, c: 5 });
  close(t.C, 90, 'C', 1e-9);
  close(t.A, Math.asin(3 / 5) * 180 / Math.PI, 'A', 1e-9);
  close(t.A + t.B + t.C, 180, 'sum');
});

test('SSS that cannot close says why, in plain words', () => {
  const t = tri({ method: 'sss', a: 2, b: 3, c: 6 });
  assert.match(t.error, /^Those three sides can't make a triangle: 2 \+ 3 is not more than 6\./);
  assert.equal(t.field, 'c');
  assert.match(tri({ method: 'sss', a: 2, b: 3, c: 5 }).error, /2 \+ 3 is not more than 5/, 'a flat triangle is not a triangle');
  assert.match(tri({ method: 'sss', a: 0, b: 3, c: 3 }).error, /Side BC needs a length more than 0/);
});

test('SAS: two sides and the angle between them', () => {
  const t = tri({ method: 'sas', b: 5, c: 7, A: 60 });
  close(t.a, Math.sqrt(39), 'a = √(25 + 49 − 35)');
  close(t.A + t.B + t.C, 180, 'sum');
  assert.match(tri({ method: 'sas', b: 5, c: 7, A: 180 }).error, /Angle A needs to be more than 0° and less than 180°/);
});

test('ASA and AAS', () => {
  const t = tri({ method: 'asa', A: 50, B: 60, c: 10 });
  close(t.C, 70, 'C');
  close(t.a, 10 * Math.sin(50 * Math.PI / 180) / Math.sin(70 * Math.PI / 180), 'a by the sine rule');
  const u = tri({ method: 'aas', A: 30, B: 90, a: 4 });
  close(u.c, 4 * Math.sin(60 * Math.PI / 180) / Math.sin(30 * Math.PI / 180), 'c');
  assert.match(tri({ method: 'asa', A: 100, B: 80, c: 3 }).error, /add up to 180°\. A triangle’s three angles make 180°/);
});

test('three angles must make 180; a right triangle from its legs', () => {
  assert.match(tri({ method: 'aaa', A: 50, B: 60, C: 80 }).error, /Those angles add up to 190°/);
  const r = tri({ method: 'right', a: 5, b: 12 });
  close(r.c, 13, 'hypotenuse');
  close(r.C, 90, 'C');
});

test('triangles are drawn to scale, whatever the turn or flip', () => {
  for (const [rot, flip] of [[0, false], [37, false], [200, true]]) {
    const s = { ...F.defaults('triangle'), method: 'sss', a: 7, b: 5, c: 6, rot, flip };
    const p = F.trianglePoints(F.solveTriangle(s), s);
    const AB = dist(p[0], p[1]), BC = dist(p[1], p[2]), CA = dist(p[2], p[0]);
    close(BC / AB, 7 / 6, `BC:AB at ${rot}°`, 1e-9);
    close(CA / AB, 5 / 6, `CA:AB at ${rot}°`, 1e-9);
  }
});

/* ── Polygons ──────────────────────────────────────────────────────── */

test('regular polygons: equal sides and the right interior angle', () => {
  for (const n of [3, 5, 6, 8, 12]) {
    const p = F.regularPoints(n, 4);
    for (let i = 0; i < n; i++) close(dist(p[i], p[(i + 1) % n]), 4, `side ${i} of ${n}-gon`, 1e-9);
    const a = p[0], b = p[1], c = p[2];
    const ang = Math.acos(((a[0] - b[0]) * (c[0] - b[0]) + (a[1] - b[1]) * (c[1] - b[1])) / 16) * 180 / Math.PI;
    close(ang, (n - 2) * 180 / n, `interior angle of ${n}-gon`, 1e-9);
    close(p[0][1], p[1][1], 'the first side lies flat along the bottom', 1e-9);
  }
});

test('parallelogram, trapezoid and kite corners', () => {
  const p = F.paraPoints(8, 5, 60);
  close(dist(p[0], p[3]), 5, 'slanted side');
  close(p[3][1], 5 * Math.sin(Math.PI / 3), 'height');
  close(p[2][0] - p[3][0], 8, 'top is as long as the base');
  const iso = F.trapPoints(10, 6, 5, F.trapOffset({ type: 'iso', b1: 10, b2: 6 }));
  close(dist(iso[0], iso[3]), dist(iso[1], iso[2]), 'isosceles legs are equal');
  const k = F.kitePoints(6, 3, 7);
  close(dist(k[0], k[1]), dist(k[0], k[3]), 'top pair equal');
  close(dist(k[2], k[1]), Math.hypot(3, 7), 'bottom side');
});

/* ── Labels ────────────────────────────────────────────────────────── */

test('a side label sits outside the shape, clear of the side; an angle label sits inside the corner', () => {
  const pts = [[0, 0], [300, 0], [120, 200]];
  const ccw = F.area(pts) > 0;
  const box = { w: 50, h: 25 };
  for (let i = 0; i < 3; i++) {
    const a = pts[i], b = pts[(i + 1) % 3];
    const at = F.sideLabelPos(a, b, F.outward(a, b, ccw), box, 9);
    assert.ok(!F.insidePoly(at, pts), `label of side ${i} is outside`);
    // distance from the side's line is at least the gap plus the half box
    const L = dist(a, b), d = Math.abs((b[0] - a[0]) * (a[1] - at[1]) - (a[0] - at[0]) * (b[1] - a[1])) / L;
    assert.ok(d >= 9 + 12, `label of side ${i} clears the line (${d})`);
  }
  for (let i = 0; i < 3; i++) {
    const v = pts[i], p = pts[(i + 2) % 3], q = pts[(i + 1) % 3];
    const wdg = F.wedge(v, p, q);
    const at = F.wedgeLabelPos(v, wdg.a, wdg.s, { w: 40, h: 24 }, 20, 200);
    assert.ok(F.insidePoly(at, pts), `angle label at corner ${i} is inside`);
    const nm = F.vertexNamePos(v, p, q, { w: 14, h: 24 });
    assert.ok(!F.insidePoly(nm, pts), `letter at corner ${i} is outside`);
  }
});

test('equal sides get the same number of ticks; one on its own gets none', () => {
  assert.deepEqual(F.groups([5, 3, 5]), [1, 0, 1]);
  assert.deepEqual(F.groups([2, 2, 2, 4, 4]), [1, 1, 1, 2, 2]);
  assert.deepEqual(F.groups([1, 2, 3]), [0, 0, 0]);
});

test('a typed label replaces the number, and a dash hides it', () => {
  const s = { kind: 'triangle', method: 'sss', a: 3, b: 4, c: 5, u: 'cm', sAB: 'x + 2', sBC: '-' };
  const r = F.build(s);
  assert.ok(!r.error, r.error);
  assert.match(r.svg, /<tspan font-style="italic">x<\/tspan> \+ 2/, 'x is set in italics');
  assert.ok(r.svg.includes('4 cm'), 'CA keeps its measurement');
  assert.ok(!r.svg.includes('>3 cm<'), 'BC is hidden');
  assert.equal(r.auto.sBC, '3 cm', 'the form still learns what BC would say');
  assert.match(r.svg, /<polyline points="[^"]+" fill="none"[^>]*stroke-width="1.8"/, 'right-angle box is drawn');
});

test('label runs: subscripts, superscripts, italics and units', () => {
  const r = F.runs('F_1 = 5 m');
  assert.deepEqual(r.map((x) => [x.t, x.k, !!x.i]), [['F', 'n', false], ['1', 'sub', false], [' = 5 m', 'n', false]]);
  assert.deepEqual(F.runs('cm^2').map((x) => x.k), ['n', 'sup']);
  assert.ok(F.runs('2x').some((x) => x.t === 'x' && x.i), 'the x in 2x is a variable');
});

/* ── Solids ────────────────────────────────────────────────────────── */

test('a cuboid seen from the front, right and above hides the three edges at its back-left-bottom corner', () => {
  const g = F.SOLIDS.cuboid({ l: 6, w: 4, h: 3 });
  const hidden = F.solidEdges(g.V, g.F).filter((e) => !e.seen);
  assert.equal(hidden.length, 3);
  // corner 4 is (0, 0, depth): back, left, bottom
  for (const e of hidden) assert.ok(e.a === 4 || e.b === 4, `hidden edge ${e.a}-${e.b} meets the back corner`);
  const p = F.SOLIDS.pyramid({ l: 6, w: 4, h: 5 });
  const ph = F.solidEdges(p.V, p.F).filter((e) => !e.seen);
  assert.ok(ph.length >= 2 && ph.every((e) => e.a === 3 || e.b === 3), 'the pyramid hides edges at its back-left corner');
});

test('depth is drawn up and to the right at half length', () => {
  const q = F.project([0, 0, 10]);
  close(Math.hypot(q[0], q[1]), 5, 'half length');
  assert.ok(q[0] > 0 && q[1] > 0);
});

test('every solid draws hidden parts dashed, or not at all when asked', () => {
  for (const shape of ['cube', 'cuboid', 'triprism', 'pyramid', 'cylinder', 'cone', 'sphere', 'hemi']) {
    const r = F.build({ kind: 'solid', shape });
    assert.ok(!r.error, `${shape}: ${r.error}`);
    assert.match(r.svg, /stroke-dasharray/, `${shape} has dashed hidden edges`);
    assert.ok(!/NaN|Infinity/.test(r.svg + r.vb), `${shape} has no NaN`);
  }
  assert.ok(!/stroke-dasharray/.test(F.build({ kind: 'solid', shape: 'cuboid', hid: 'hide' }).svg));
  assert.match(F.build({ kind: 'solid', shape: 'cylinder', r: 2, h: 0 }).error, /The height needs to be more than 0/);
});

/* ── Grids and number lines ────────────────────────────────────────── */

test('grid: equations use the shared parser; mistakes are named by line', () => {
  const ok = F.parseEquations('y = 2x + 1\ny = x^2 - 4\nx = 3');
  assert.equal(ok.items.length, 3);
  close(ok.items[0].fn(2), 5, 'y = 2x + 1 at 2');
  close(ok.items[1].fn(3), 5, 'y = x^2 − 4 at 3');
  assert.equal(ok.items[2].kind, 'vline');
  assert.match(F.parseEquations('y = 2x +').error, /^Line 1 of the equations \(“y = 2x \+”\): /);
  assert.match(F.parseEquations('y = 1\ny = (x').error, /^Line 2/);
});

test('grid: maths the way students write it', () => {
  const at = (src, x) => { const r = F.parseEquations(src); assert.ok(!r.error, src + ': ' + r.error); return r.items[0].fn(x); };
  close(at('y = |x - 1|', -2), 3, '|x − 1|');
  close(at('y = ln x', Math.E), 1, 'ln without brackets');
  close(at('y = 3sin 2x', Math.PI / 4), 3, 'sin 2x is sin(2x)');
  close(at('y = cos^2 x', 1), Math.cos(1) ** 2, 'cos^2 x');
  close(at('y = √x', 9), 3, '√x');
  close(at('y = x² − 4', 3), 5, '² and a real minus');
  close(at('f(x) = x^3', 2), 8, 'f(x) =');
  close(at('x^2 - 4', 3), 5, 'a bare expression is y =');
  assert.equal(F.parseEquations('x^2 - 4').items[0].text, 'y = x^2 - 4');
  assert.equal(F.tidyMath('||x| - 1|'), 'abs(abs(x) - 1)', 'nested bars');
});

test('grid: any straight equation is solved for y; x alone makes an up-and-down line', () => {
  const one = (src) => F.parseEquations(src).items[0];
  close(one('2x + 3y = 6').fn(3), 0, '2x + 3y = 6 at x = 3');
  close(one('y - 2 = 3(x - 1)').fn(2), 5, 'point-slope form');
  close(one('x = y').fn(4), 4, 'x = y is the line y = x');
  close(one('xy = 1').fn(4), 0.25, 'xy = 1');
  assert.equal(one('2x = 6').kind, 'vline');
  close(one('2x = 6').x, 3, '2x = 6 is x = 3');
  assert.equal(one('x^2 + y^2 = 25').kind, 'implicit');
  assert.match(F.parseEquations('3 = 4').error, /no x or y/);
});

test('grid: inequalities shade the side that holds, dashed when the line is not included', () => {
  const one = (src) => F.parseEquations(src).items[0];
  assert.equal(one('y > 2x').above, true);
  assert.equal(one('y <= x + 1').above, false);
  assert.equal(one('-y > x').above, false, 'dividing by a negative turns it round');
  assert.equal(one('2x + 3y < 6').above, false);
  assert.equal(one('x > 2').right, true);
  assert.equal(one('x ≤ -1').right, false);
  assert.equal(one('y > 2x').strict, true);
  assert.equal(one('y ≥ 2x').strict, false);
  assert.equal(one('xy > 1').kind, 'implicit', 'a slope that changes sign cannot be shaded as above or below');
  const g = F.build({ ...F.defaults('grid'), eqs: 'y > 2x - 1' });
  assert.ok(!g.error, g.error);
  assert.match(g.svg, /fill-opacity="0\.16"/);
  assert.match(g.svg, /stroke-dasharray="10 7"/);
  const solid = F.build({ ...F.defaults('grid'), eqs: 'y >= 2x - 1' });
  assert.doesNotMatch(solid.svg, /stroke-dasharray/);
  const disc = F.build({ ...F.defaults('grid'), eqs: 'x^2 + y^2 < 9' });
  assert.match(disc.svg, /<path d="M[^"]+" fill="#2563eb" fill-opacity="0\.16"/, 'the inside of the circle is filled');
});

test('grid: a limit draws part of a line, with filled or open ends', () => {
  const d = F.splitDomain('y = 2x for -3 < x ≤ 4');
  assert.equal(d.rest, 'y = 2x');
  assert.deepEqual(d.lim, { lo: -3, hi: 4, loIn: false, hiIn: true });
  assert.deepEqual(F.splitDomain('y = x^2 {0 <= x <= 5}').lim, { lo: 0, hi: 5, loIn: true, hiIn: true });
  assert.equal(F.splitDomain('y = √x, x ≥ 0').lim.lo, 0);
  assert.equal(F.splitDomain('y = min(x, 2)').lim, null, 'a comma inside brackets is not a limit');
  assert.match(F.splitDomain('y = x for 5 < x < 1').error, /no x that fits/);
  const g = F.build({ ...F.defaults('grid'), eqs: 'y = 2x for -3 < x ≤ 4' });
  assert.equal((g.svg.match(/<circle[^>]+fill="#ffffff"/g) || []).length, 1, 'one open end');
  assert.equal((g.svg.match(/<circle[^>]+fill="#2563eb"/g) || []).length, 1, 'one filled end');
  assert.doesNotMatch(g.svg, />[^<]*for -3/, 'the limit stays out of the label');
});

test('grid: points typed among the equations are points', () => {
  const g = F.build({ ...F.defaults('grid'), eqs: 'y = x\nA(2, 3)' });
  assert.ok(!g.error, g.error);
  assert.match(g.svg, />A</);
});

test('grid: a curve off the grid is named, and fitRange brings it into view', () => {
  const s = { ...F.defaults('grid'), eqs: 'y = x^2 + 50' };
  assert.deepEqual(F.build(s).info.offgrid, ['y = x^2 + 50']);
  const fit = F.fitRange(s);
  assert.equal(fit.ymin, 0, 'starts at the x axis');
  assert.ok(fit.ymax >= 140 && fit.ymax <= 170, 'tops out just above 150: ' + fit.ymax);
  assert.deepEqual(F.build(fit).info.offgrid, []);
  const pts = F.fitRange({ ...F.defaults('grid'), pts: 'A(30, 40)' });
  assert.ok(pts.xmax >= 30 && pts.ymax >= 40, 'points far out widen the grid');
});

/* ── Circles ───────────────────────────────────────────────────────── */

test('circle: radius, sector, diameter, chord and tangent', () => {
  const b = F.build({ ...F.defaults('circle'), r: 5, sector: 60, diam: true, chord: true, tangent: true, calc: true });
  assert.ok(!b.error, b.error);
  assert.match(b.svg, />5 cm</, 'the radius');
  assert.match(b.svg, />60°</, 'the sector angle');
  assert.match(b.svg, />10 cm</, 'the diameter, worked out');
  assert.match(b.svg, />7\.1 cm</, 'the chord, worked out (2r sin 45°)');
  assert.match(b.svg, /fill-opacity="0\.1"/, 'the sector is shaded');
  assert.equal(F.describe({ ...F.defaults('circle'), r: 4, sector: 90 }), 'Circle, radius 4 cm, with a sector of 90°');
  assert.match(F.build({ ...F.defaults('circle'), r: 0 }).error, /The radius needs to be more than 0/);
  assert.match(F.build({ ...F.defaults('circle'), sector: 360 }).error, /less than 360°/);
  assert.equal(F.decode(F.encode({ ...F.defaults('circle'), r: 7, tangent: true })).r, 7, 'share links carry a circle');
});

/* ── Describe it ───────────────────────────────────────────────────── */

test('describe it: a sentence becomes the figure it names', () => {
  const k = (text) => { const r = F.fromText(text); assert.ok(!r.error, text + ': ' + r.error); return r.spec; };
  const rt = k('right triangle 3 4 5');
  assert.deepEqual([rt.kind, rt.method, rt.a, rt.b], ['triangle', 'right', 3, 4]);
  const sss = k('triangle 5 6 7 mm');
  assert.deepEqual([sss.method, sss.c, sss.a, sss.b, sss.u], ['sss', 5, 6, 7, 'mm']);
  const asa = k('triangle 7, 40°, 60°');
  assert.deepEqual([asa.method, asa.c, asa.A, asa.B], ['asa', 7, 40, 60]);
  const named = k('triangle AB=7 A=40 B=60');
  assert.deepEqual([named.method, named.c, named.A, named.B], ['asa', 7, 40, 60]);
  assert.deepEqual([k('equilateral triangle 6').a, k('equilateral triangle 6').c], [6, 6]);
  const rect = k('rectangle 8 by 5');
  assert.deepEqual([rect.kind, rect.w, rect.h], ['rect', 8, 5]);
  assert.deepEqual([k('square 4').w, k('square 4').h], [4, 4]);
  assert.deepEqual([k('hexagon side 4').n, k('hexagon side 4').s], [6, 4]);
  const cyl = k('cylinder r 3 h 8');
  assert.deepEqual([cyl.kind, cyl.shape, cyl.r, cyl.h], ['solid', 'cylinder', 3, 8]);
  assert.equal(k('sphere diameter 10').r, 5);
  assert.deepEqual([k('cuboid 6 4 3').l, k('cuboid 6 4 3').w, k('cuboid 6 4 3').h], [6, 4, 3]);
  const circ = k('circle radius 4 with a diameter and a tangent');
  assert.deepEqual([circ.kind, circ.r, circ.diam, circ.tangent], ['circle', 4, true, true]);
  assert.equal(k('circle r 5 sector 60').sector, 60);
  const nl = k('number line -5 to 5, x > 2');
  assert.deepEqual([nl.kind, nl.from, nl.to, nl.marks], ['numline', -5, 5, 'x > 2']);
  const ang = k('angles on a straight line 40 70');
  assert.deepEqual([ang.mode, ang.parts, ang.a1, ang.a2], ['line', 3, 40, 70]);
  assert.equal(k('vertically opposite angles 70').mode, 'vertical');
  assert.equal(k('parallel lines 60°').ang, 60);
  const g = k('graph y = 2x + 1 and y = -x + 4');
  assert.deepEqual([g.kind, g.eqs], ['grid', 'y = 2x + 1\ny = -x + 4']);
  assert.equal(k('plot A(2,3) B(-1,4)').pts, 'A(2,3) B(-1,4)');
  assert.equal(k('y = x^2 + 50').ymin, 0, 'a graph off the usual grid gets a grid that fits');
  assert.match(F.fromText('banana').error, /could not tell which figure/);
  assert.match(F.fromText('triangle').error, /Give the triangle its sizes/);
  assert.match(F.fromText('triangle 2 3 9').error, /can't make a triangle/, 'an impossible figure says why');
});

test('grid: points and shapes', () => {
  const r = F.parsePoints('A(2, 3) B(-1, 4)\npolygon P(0,0) Q(4,0) R(4,3)\nsegment (0,0) (3,4)\n(1/2, −2)');
  assert.deepEqual(r.items.map((i) => i.kind), ['pts', 'poly', 'path', 'pts']);
  assert.deepEqual(r.items[0].pts[1], { name: 'B', x: -1, y: 4 });
  assert.equal(r.items[1].pts[0].name, 'P', 'the word polygon is not a point name');
  close(r.items[3].pts[0].x, 0.5, 'fractions');
  close(r.items[3].pts[0].y, -2, 'a real minus sign');
  assert.match(F.parsePoints('hello').error, /I could not find a point there/);
  assert.match(F.build({ kind: 'grid', pts: 'A(12, 3)' }).error, /is off the grid/);
});

test('grid: a curve breaks at an asymptote instead of drawing a wall', () => {
  const G = F.gridLayout({ ...F.defaults('grid') });
  const pieces = F.sampleCurve((x) => 1 / x, G.x0, G.x1, G.X, G.Y, G.W, G.H, 400);
  assert.equal(pieces.length, 2, 'two branches of 1/x');
  for (const pc of pieces) for (const p of pc) assert.ok(p[0] >= -1e-6 && p[0] <= G.W + 1e-6 && p[1] >= -1e-6 && p[1] <= G.H + 1e-6, 'clipped to the grid');
  assert.equal(F.clipSeg([-10, 5], [10, 5], 4, 10)[0][0], 0);
  assert.equal(F.clipSeg([-10, 50], [10, 50], 4, 10), null);
  assert.match(F.build({ kind: 'grid', xmin: 5, xmax: 1 }).error, /5 is not less than 1/);
  assert.match(F.build({ kind: 'grid', xstep: 0.01 }).error, /2000 squares across/);
});

test('number line marks: dots, rays and pieces from inequalities', () => {
  const m = F.parseMarks('3\nopen −2\nP = 1/2\nx > 2\nx <= -1\n-1 <= x < 3\nx < -4 or x >= 4');
  assert.deepEqual(m.items[0], { t: 'dot', v: 3, open: false, label: '' });
  assert.equal(m.items[1].open, true);
  assert.deepEqual(m.items[2], { t: 'dot', v: 0.5, open: false, label: 'P' });
  assert.deepEqual(m.items[3], { t: 'ray', v: 2, dir: 1, open: true });
  assert.deepEqual(m.items[4], { t: 'ray', v: -1, dir: -1, open: false });
  assert.deepEqual(m.items[5], { t: 'seg', a: -1, b: 3, oa: false, ob: true });
  assert.equal(m.items.length, 8, 'the last line gives two');
  assert.match(F.parseMarks('x >> 2').error, /^Line 1 of the marks/);
  assert.match(F.build({ kind: 'numline', marks: '9' }).error, /9 is off the number line: it runs from −5 to 5/);
  assert.deepEqual(F.fraction(0.75), { n: 3, d: 4 });
  assert.deepEqual(F.fraction(-1.5), { n: -3, d: 2 });
});

test('angles: the last part is worked out from the total', () => {
  const p = F.angleParts({ ...F.defaults('angle'), mode: 'line', parts: 3, a1: 40, a2: 60 });
  assert.deepEqual(p.vals, [40, 60, 80]);
  assert.match(F.angleParts({ ...F.defaults('angle'), mode: 'right', parts: 2, a1: 95 }).error, /angles that make a right angle make 90°/);
  const q = F.parallelAngles(60);
  assert.deepEqual(q.map((a) => a.size), [120, 60, 60, 120, 120, 60, 60, 120], 'corresponding and alternate angles match');
});

/* ── Every figure, and share links ─────────────────────────────────── */

test('every kind of figure builds from its defaults, with no NaN', () => {
  for (const [kind] of F.KINDS) {
    const r = F.build({ kind });
    assert.ok(!r.error, `${kind}: ${r.error}`);
    assert.ok(r.w > 50 && r.h > 50, `${kind} has a size`);
    assert.ok(!/NaN|undefined|Infinity/.test(r.svg + r.vb.join()), `${kind} is clean`);
    assert.ok(F.describe({ kind }).length > 4);
  }
});

test('share links keep the settings, and only the ones that changed', () => {
  const s = { ...F.defaults('triangle'), method: 'sas', b: 5, c: 8, A: 60, sAB: 'x + 2', names: false };
  const link = F.encode(s);
  assert.equal(link, 'triangle?method=sas&b=5&c=8&A=60&sAB=x%20%2B%202&names=0');
  assert.deepEqual(F.decode(link), s);
  const g = { ...F.defaults('grid'), eqs: 'y = 2x + 1\ny = x^2', pts: 'A(1, 3)' };
  assert.deepEqual(F.decode(F.encode(g)), g);
  assert.equal(F.decode('nonsense?x=1'), null);
  assert.equal(F.decode('rect?w=abc&zzz=1').w, 8, 'bad numbers and unknown keys are ignored');
});

/* ── Vectors ───────────────────────────────────────────────────────── */

test('components from length and angle, and back, in every quadrant', () => {
  const v = V.fromPolar(5, Math.atan2(3, 4) * 180 / Math.PI);
  close(v.x, 4, 'x', 1e-12); close(v.y, 3, 'y', 1e-12);
  const cases = [[[3, 4], 53.13010235415598], [[-3, 4], 126.86989764584402], [[-3, -4], 233.13010235415598], [[3, -4], 306.86989764584405],
    [[0, 5], 90], [[-5, 0], 180], [[0, -5], 270], [[5, 0], 0]];
  for (const [[x, y], deg] of cases) {
    close(V.direction({ x, y }), deg, `direction of (${x}, ${y})`, 1e-9);
    close(V.magnitude({ x, y }), 5, `length of (${x}, ${y})`);
  }
  const up = V.fromPolar(2, 90);
  assert.equal(up.x, 0, 'no 1e-16 left over');
  assert.equal(V.direction({ x: 0, y: 0 }), 0);
});

test('bearings: clockwise from north, three figures', () => {
  assert.equal(V.toBearing(90), 0);
  assert.equal(V.toBearing(0), 90);
  assert.equal(V.toBearing(180), 270);
  assert.equal(V.toBearing(270), 180);
  close(V.toBearing(36.87), 53.13, 'NE-ish', 1e-9);
  close(V.fromBearing(V.toBearing(123.4)), 123.4, 'round trip', 1e-9);
  assert.equal(V.fmtBearing(53.13, 0), '053°');
  assert.equal(V.fmtBearing(5.25, 1), '005.3°');
  assert.equal(V.fmtBearing(359.96, 1), '000.0°');
  assert.equal(V.compass(36.87, 1), 'N 53.1° E');
  assert.equal(V.compass(126.87, 1), 'N 36.9° W');
  assert.equal(V.compass(233.13, 1), 'S 36.9° W');
  assert.equal(V.compass(306.87, 1), 'S 36.9° E');
  assert.equal(V.compass(90, 1), 'due N');
  assert.equal(V.compass(179.99, 1), 'due W', 'rounds before it names');
});

test('resultants, subtraction and multiples', () => {
  const A = { x: 3, y: 4 }, B = { x: -1, y: 2 }, C = { x: 2, y: -6 };
  assert.deepEqual(V.sum([A, B, C]), { x: 4, y: 0 });
  assert.deepEqual(V.sub(A, B), { x: 4, y: 2 });
  assert.deepEqual(V.sum([A, V.scale(B, -1)]), V.sub(A, B), 'A − B is A + (−B)');
  const k = V.scale(A, -2);
  assert.deepEqual(k, { x: -6, y: -8 });
  close(V.direction(k), V.direction(A) + 180, '−2A points the other way');
  close(V.magnitude(k), 10, 'twice as long');
});

test('percent error for the lab check', () => {
  close(V.pctError(5.2, 5), 4, '5.2 against 5', 1e-9);
  close(V.pctError(4.8, 5), 4, 'under counts the same', 1e-9);
  assert.ok(Number.isNaN(V.pctError(1, 0)));
  close(V.angleGap(359, 1), 2, 'across north', 1e-9);
  close(V.angleGap(10, 200), 170, 'the short way', 1e-9);
  const r = V.labCheck({ mag: 5.1, dir: 38 }, { x: 4, y: 3 }, 'angle');
  close(r.mag, 5, 'worked-out length');
  close(r.magErr, 2, 'length error', 1e-9);
  close(r.dirGap, 38 - 36.86989764584402, 'direction gap', 1e-9);
  const b = V.labCheck({ mag: 5, dir: 55 }, { x: 4, y: 3 }, 'bearing');
  close(b.dir, 53.13010235415598, 'bearing worked out', 1e-9);
  close(b.dirGap, 55 - 53.13010235415598, 'bearing gap', 1e-9);
});

test('a vector item: its value, its words, and its drawing', () => {
  const it = { x1: 100, y1: 500, x2: 260, y2: 380, sx: 40, sy: 40, label: 'F_1', unit: 'N', prec: 1, showMag: true, showDir: true, dirFmt: 'angle' };
  assert.deepEqual(V.value(it), { x: 4, y: 3 }, 'page y goes down, maths y goes up');
  assert.equal(V.text(it), 'F_1 = 5.0 N at 36.9°');
  assert.equal(V.text({ ...it, dirFmt: 'bearing' }), 'F_1 = 5.0 N, bearing 053.1°');
  assert.equal(V.text({ ...it, dirFmt: 'compass', prec: 0 }), 'F_1 = 5 N, N 53° E');
  assert.equal(V.text({ ...it, showMag: false, showDir: false }), 'F_1');
  const d = V.draw({ ...it, comps: true });
  assert.match(d.svg, /<polygon/, 'a filled arrowhead');
  assert.match(d.svg, /stroke-dasharray/, 'dashed component legs');
  assert.match(d.svg, /italic">x<\/tspan><tspan dy="-[\d.]+"> = 4\.0 N/, 'x component labelled');
  assert.ok(d.box.x <= 100 && d.box.x + d.box.w >= 260 && d.box.y <= 380 && d.box.y + d.box.h >= 500, 'the box holds the arrow');
  assert.equal(d.ink.length, 2, 'shaft and head, for the eraser');
});

test('text naming no figure describes the figure being edited', () => {
  const k = (text, cur) => { const r = F.fromText(text, cur); assert.ok(!r.error, text + ': ' + r.error); return r.spec; };
  assert.equal(k('34', { kind: 'angle', mode: 'single' }).a1, 34);
  assert.equal(k('30 50', { kind: 'angle', mode: 'line' }).mode, 'line');
  assert.equal(k('5 6 7', { kind: 'triangle' }).kind, 'triangle');
  assert.equal(k('r 4', { kind: 'circle' }).r, 4);
  assert.equal(k('circle 5', { kind: 'angle', mode: 'single' }).kind, 'circle', 'a named figure still wins');
  assert.match(F.fromText('34').error, /could not tell which figure/, 'with nothing open, still asks');
});
