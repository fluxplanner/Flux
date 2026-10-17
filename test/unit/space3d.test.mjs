import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * The maths of the Grapher's 3D mode (public/js/flux-space3d.js): reading a
 * row, a plane's intercepts and traces, where planes meet, cutting things to
 * the box, the camera, the order things are painted in, and links.
 *
 * The plane answers are checked against systems worked by hand — the kind a
 * CPM lesson on three equations in three unknowns uses — not against numbers
 * read back out of the code.
 */

const w = {};
for (const f of ['flux-expr.js', 'flux-space3d.js']) new Function('window', fs.readFileSync('public/js/' + f, 'utf8'))(w);
const S = w.FluxSpace3D;

const close = (got, want, what, tol = 1e-9) =>
  assert.ok(Math.abs(got - want) <= tol * Math.max(1, Math.abs(want)), `${what}: got ${got}, want ${want}`);
const closeV = (got, want, what) => want.forEach((v, i) => close(got[i], v, `${what}[${i}]`));
/** True when the point satisfies the plane. */
const onPlane = (p, pl) => Math.abs(S.dot(pl.n, p) - pl.d) < 1e-7 * (1 + Math.abs(pl.d));
const plane = (src) => { const r = S.parseRow(src); assert.equal(r.kind, 'plane', `${src}: ${r.error || r.kind}`); return r; };
const BOX = { xMin: -10, xMax: 10, yMin: -10, yMax: 10, zMin: -10, zMax: 10 };

/* ── Reading rows ─────────────────────────────────────────────────────── */

test('points: plain, labelled, listed, and worked out', () => {
  assert.deepEqual(S.parseRow('(1, 2, 3)'), { kind: 'points', pts: [{ p: [1, 2, 3], label: null }] });
  assert.equal(S.parseRow('A = (1, 2, 3)').pts[0].label, 'A');
  assert.equal(S.parseRow('A(1, 2, 3)').pts[0].label, 'A');
  assert.equal(S.parseRow('P1: (0, 0, 0)').pts[0].label, 'P1');
  const two = S.parseRow('A(1,2,3), B(4, 5, 6)');
  assert.equal(two.pts.length, 2);
  assert.deepEqual(two.pts[1], { p: [4, 5, 6], label: 'B' });
  // What the maths field hands over: no spaces, fractions bracketed.
  const mf = S.parseRow('P1=((1/2),-3,4)');
  assert.deepEqual(mf.pts[0].p, [0.5, -3, 4]);
  close(S.parseRow('(sqrt(2), pi, -1/4)').pts[0].p[1], Math.PI, 'π');
  assert.deepEqual(S.parseRow('(−1, 2, −3)').pts[0].p, [-1, 2, -3], 'typeset minus signs read as minus');
});

test('points that are not quite points say why', () => {
  assert.match(S.parseRow('(1, 2)').error, /three coordinates/);
  assert.match(S.parseRow('(1, 2, 3, 4)').error, /three coordinates/);
  assert.match(S.parseRow('(1, 2, 3').error, /closing bracket/);
  assert.match(S.parseRow('(x, 2, 3)').error, /numbers/);
  assert.match(S.parseRow('z = (1, 2, 3)').error, /something other than z/);
});

test('planes in every form a lesson writes them', () => {
  const p = plane('x + y + z = 6');
  assert.deepEqual(p.n, [1, 1, 1]);
  assert.equal(p.d, 6);
  // z = 2x − y + 3 is 2x − y − z = −3, whichever way it is read.
  const q = plane('z = 2x - y + 3');
  [[0, 0, 3], [1, 0, 5], [0, 1, 2]].forEach((pt) => assert.ok(onPlane(pt, q), `${pt} on z = 2x − y + 3`));
  assert.equal(S.planeText(q), '−2x + y + z = 3');
  assert.equal(S.planeText(plane('-x - y - z = -6')), 'x + y + z = 6', 'mostly-negative is flipped');
  const v = plane('x = 4');
  assert.deepEqual(v.n, [1, 0, 0]);
  assert.equal(v.d, 4);
  assert.equal(S.planeText(plane('y = x')), 'x − y = 0');
  assert.ok(onPlane([1, 1, 7], plane('2(x - 1) + 3(y - 1) = 0')), 'brackets and a point-normal form');
  assert.equal(S.planeText(plane('2x+3y-z=6')), '2x + 3y − z = 6', 'the maths field’s spacing');
  assert.equal(S.planeText(plane('x/2 + y/3 + z/4 = 1')), '0.5x + (1/3)y + 0.25z = 1');
  assert.equal(plane('X + Y + Z = 6').d, 6, 'capitals');
});

test('equations that are not planes or surfaces explain themselves', () => {
  assert.match(S.parseRow('x + y + z').error, /= and a number/);
  assert.match(S.parseRow('5').error, /That is a number/);
  assert.match(S.parseRow('x + y = x + y').error, /every point/);
  assert.match(S.parseRow('x - x = 3').error, /No point/);
  assert.match(S.parseRow('ax + by = 3').error, /Only x, y and z/);
  assert.match(S.parseRow('x + y + z < 6').error, /inequalities/);
  assert.match(S.parseRow('x = 4, y = 2').error, /two rows/);
  assert.match(S.parseRow('x^2 + y^2 + z^2 = 9').error, /Only planes/);
  assert.match(S.parseRow('x + 2t = 1').error, /line/);
  assert.match(S.parseRow('x + = 3').error, /./);
  assert.equal(S.parseRow('   ').kind, 'empty');
});

test('surfaces: z = f(x, y), a bare expression, and solved for z, y or x', () => {
  const s = S.parseRow('z = x^2 - y^2');
  assert.equal(s.kind, 'surface');
  assert.equal(s.axis, 'z');
  closeV(S.surfacePoint(s, 3, 2), [3, 2, 5], 'z = 9 − 4');
  const bare = S.parseRow('sin(x)cos(y)');
  assert.equal(bare.kind, 'surface');
  close(S.surfacePoint(bare, Math.PI / 2, 0)[2], 1, 'sin(π/2)cos(0)');
  const solved = S.parseRow('x^2 + y^2 - z = 0');
  assert.equal(solved.axis, 'z');
  close(solved.h(1, 2), 5, 'paraboloid');
  close(S.parseRow('2z = x^2').h(2, 0), 2, '2z = x² is z = x²/2');
  const cyl = S.parseRow('y = x^2');
  assert.equal(cyl.axis, 'y', 'y = x² is a parabolic cylinder');
  assert.deepEqual(S.surfacePoint(cyl, 3, 7), [3, 9, 7]);
  assert.equal(S.parseRow('x = y^2 + z^2').axis, 'x');
  assert.equal(S.parseRow('z = 2x - y').kind, 'plane', 'a linear z = … is a plane, with intercepts and traces');
});

test('lines through two points, from a point in a direction, and in parts', () => {
  const a = S.parseRow('line (1, 2, 3), (4, 6, 8)');
  assert.equal(a.kind, 'line');
  assert.deepEqual(a.p0, [1, 2, 3]);
  assert.deepEqual(a.dir, [3, 4, 5]);
  assert.deepEqual(a.through, [[1, 2, 3], [4, 6, 8]]);
  assert.deepEqual(S.parseRow('line((1,2,3),(4,6,8))').dir, [3, 4, 5], 'the maths field’s brackets');
  assert.deepEqual(S.parseRow('line through (0,0,0) and (1,1,1)').dir, [1, 1, 1]);
  const b = S.parseRow('(1, 2, 3) + t(4, 5, 6)');
  assert.deepEqual([b.p0, b.dir], [[1, 2, 3], [4, 5, 6]]);
  assert.deepEqual(S.parseRow('(x, y, z) = (1, 2, 3) + t<4, 5, 6>').dir, [4, 5, 6]);
  assert.deepEqual(S.parseRow('r = (1,2,3) - s(1,0,0)').dir, [-1, 0, 0]);
  assert.deepEqual(S.parseRow('(1,2,3)+(0,0,2)t').dir, [0, 0, 2]);
  assert.equal(S.parseRow('L = (0,0,0) + t(1,2,3)').name, 'L');
  const c = S.parseRow('x = 1 + 2t, y = 3t, z = 4 - t');
  assert.deepEqual([c.p0, c.dir], [[1, 0, 4], [2, 3, -1]]);
  assert.deepEqual(S.parseRow('z = 5, x = s, y = 2s').dir, [1, 2, 0], 'any order, and s');
});

test('lines that cannot be drawn say why', () => {
  assert.match(S.parseRow('line (1, 2, 3), (1, 2, 3)').error, /same point/);
  assert.match(S.parseRow('(1, 2, 3) + t(0, 0, 0)').error, /single point/);
  assert.match(S.parseRow('x = cos(t), y = sin(t), z = t').error, /curve/);
  assert.match(S.parseRow('x = 1, y = 2, z = 3').error, /one point/);
  assert.match(S.parseRow('line (1, 2, 3)').error, /two points/);
  assert.match(S.parseRow('line (1, 2), (3, 4, 5)').error, /three numbers/);
});

/* ── Planes: intercepts and traces ────────────────────────────────────── */

test('intercepts: a point on each axis, none when parallel, all when the axis is in the plane', () => {
  const i = S.intercepts(plane('2x + 3y + 6z = 12'));
  assert.deepEqual(i.map((k) => k.v), [6, 4, 2]);
  assert.deepEqual(i[0].p, [6, 0, 0]);
  const par = S.intercepts(plane('y + z = 4'));
  assert.equal(par[0].kind, 'none', 'y + z = 4 never meets the x axis');
  assert.equal(S.intercepts(plane('y + z = 0'))[0].kind, 'all', 'y + z = 0 contains the x axis');
  assert.deepEqual(S.intercepts(plane('x + y + z = 0')).map((k) => k.v), [0, 0, 0]);
});

test('traces: the line in each coordinate plane, written as its equation', () => {
  const t = S.traces(plane('2x + 3y + 6z = 12'));
  assert.deepEqual(t.map((k) => k.plane), ['xy', 'xz', 'yz']);
  assert.deepEqual(t.map((k) => k.text), ['2x + 3y = 12', '2x + 6z = 12', '3y + 6z = 12']);
  t.forEach((k) => {
    // Each drawn trace lies in the plane and in its coordinate plane.
    const coord = { xy: 2, xz: 1, yz: 0 }[k.plane];
    for (const s of [0, 1, -2.5]) {
      const p = S.add(k.p, S.mul(k.dir, s));
      assert.ok(onPlane(p, plane('2x + 3y + 6z = 12')), `${k.plane} trace on the plane`);
      close(p[coord], 0, `${k.plane} trace in its coordinate plane`);
    }
  });
  const flat = S.traces(plane('z = 3'));
  assert.equal(flat[0].kind, 'none', 'z = 3 never meets the xy-plane');
  assert.equal(flat[1].text, 'z = 3');
  assert.equal(S.traces(plane('z = 0'))[0].kind, 'same');
});

/* ── Where planes meet ────────────────────────────────────────────────── */

test('two planes meet in a line that lies in both, written with tidy numbers', () => {
  const A = plane('x + y + z = 6'), B = plane('x - y + 2z = 4');
  const m = S.meet2(A, B);
  assert.equal(m.kind, 'line');
  assert.ok(m.p.every(Number.isInteger), 'a point with whole-number coordinates: ' + m.p);
  assert.deepEqual(m.dir, [3, -1, -2]);
  for (const t of [0, 1, -3.5]) {
    const p = S.add(m.p, S.mul(m.dir, t));
    assert.ok(onPlane(p, A) && onPlane(p, B), 'every point of the line is on both planes');
  }
  assert.equal(S.lineText([5, 1, 0], m.dir), '(x, y, z) = (5, 1, 0) + t(3, −1, −2)');
  assert.equal(S.meet2(A, plane('2x + 2y + 2z = 5')).kind, 'parallel');
  assert.equal(S.meet2(A, plane('2x + 2y + 2z = 12')).kind, 'same');
  assert.equal(S.meet2(A, plane('-x - y - z = -6')).kind, 'same');
});

test('three planes: one point, the CPM way', () => {
  const sys = ['x + y + z = 6', '2x - y + z = 3', 'x + 2y - z = 2'].map(plane);
  const m = S.meetAll(sys);
  assert.equal(m.kind, 'point');
  assert.deepEqual(m.p, [1, 2, 3]);
  const frac = S.meetAll(['x + y + z = 1', 'x - y = 0', 'z = 2x'].map(plane));
  assert.equal(S.fmtPoint(frac.p), '(0.25, 0.25, 0.5)');
});

test('three planes with no common point say which kind of no', () => {
  const par = S.meetAll(['x + y + z = 6', 'x + y + z = 2', 'x - y = 0'].map(plane));
  assert.deepEqual(par, { kind: 'none', parallel: [0, 1] });
  // Each pair meets, but the three lines run side by side: a prism.
  const prism = S.meetAll(['x + y = 1', 'x - y = 1', 'x = 3'].map(plane));
  assert.equal(prism.kind, 'none');
  assert.equal(prism.parallel, null);
  ['x + y = 1', 'x - y = 1', 'x = 3'].map(plane).forEach((p, i, all) => {
    all.forEach((q, j) => { if (i < j) assert.equal(S.meet2(p, q).kind, 'line'); });
  });
});

test('three planes with infinitely many points in common: a shared line, or one plane', () => {
  const book = S.meetAll(['z = 0', 'y = 0', 'y = z'].map(plane));
  assert.equal(book.kind, 'line', 'three pages of a book share the spine');
  assert.deepEqual(book.dir, [1, 0, 0]);
  assert.equal(S.meetAll(['x + y + z = 6', '2x + 2y + 2z = 12', '3x + 3y + 3z = 18'].map(plane)).kind, 'plane');
  // Two the same and a third crossing them: the line where it crosses.
  assert.equal(S.meetAll(['x + y + z = 6', '2x + 2y + 2z = 12', 'x = 0'].map(plane)).kind, 'line');
});

/* ── Numbers ──────────────────────────────────────────────────────────── */

test('numbers read the way they are written on paper', () => {
  assert.equal(S.fmtNum(10 / 3), '10/3');
  assert.equal(S.fmtNum(2.5), '2.5');
  assert.equal(S.fmtNum(0.1 + 0.2), '0.3');
  assert.equal(S.fmtNum(-6), '−6');
  assert.equal(S.fmtNum(1e-14), '0');
  assert.equal(S.fmtNum(Math.PI), '3.1416');
});

/* ── The box ──────────────────────────────────────────────────────────── */

test('a plane is cut to the box as one flat polygon on the box’s faces', () => {
  const pl = plane('x + y + z = 6');
  const poly = S.planeInBox(pl, BOX);
  assert.ok(poly && poly.pts.length >= 3);
  poly.pts.forEach((p) => {
    assert.ok(onPlane(p, pl), 'every corner is on the plane');
    assert.ok(S.inBox(p, BOX, 1e-6), 'every corner is in the box');
  });
  assert.ok(poly.edges.every(Boolean), 'every edge is on a face of the box, so worth drawing');
  // z = 0 across the whole box is the square floor-through-the-middle.
  const sq = S.planeInBox(plane('z = 0'), BOX);
  assert.equal(sq.pts.length, 4);
  assert.equal(S.planeInBox(plane('z = 11'), BOX), null, 'a plane above the box is not drawn');
});

test('lines are cut to the box', () => {
  const seg = S.lineInBox([0, 0, 0], [1, 2, 0], BOX);
  closeV(seg[0], [-5, -10, 0], 'enters');
  closeV(seg[1], [5, 10, 0], 'leaves');
  assert.equal(S.lineInBox([0, 0, 20], [1, 0, 0], BOX), null);
});

test('a surface becomes patches inside the box, and leaves gaps where it is undefined', () => {
  const sf = S.parseRow('z = x^2 + y^2');
  const mesh = S.surfaceMesh(sf, BOX, 20);
  assert.ok(mesh.length > 20, 'patches: ' + mesh.length);
  mesh.forEach((m) => m.pts.forEach((p) => {
    assert.ok(S.inBox(p, BOX, 1e-6), 'patches stay in the box');
  }));
  const dome = S.surfaceMesh(S.parseRow('z = sqrt(25 - x^2 - y^2)'), BOX, 20);
  assert.ok(dome.length > 0);
  dome.forEach((m) => m.pts.forEach((p) => assert.ok(p[0] * p[0] + p[1] * p[1] <= 25 + 1e-6, 'nothing outside the dome’s rim')));
});

/* ── The camera ───────────────────────────────────────────────────────── */

test('the standard view: x comes towards you down and left, y runs right, z points up', () => {
  const cam = S.camera(BOX, S.DEFAULT_VIEW, 800, 600, true);
  const o = cam.project([0, 0, 0]);
  const X = cam.project([5, 0, 0]), Y = cam.project([0, 5, 0]), Z = cam.project([0, 0, 5]);
  assert.ok(X[0] < o[0] && X[1] > o[1], 'x: left and down');
  assert.ok(Y[0] > o[0], 'y: right');
  assert.ok(Z[1] < o[1] && Math.abs(Z[0] - o[0]) < 1e-9, 'z: straight up');
  assert.ok(X[2] < o[2], '+x is nearer than the origin');
});

test('the preset views look straight down each axis', () => {
  const at = (v) => S.camera(BOX, Object.assign({ zoom: 1 }, S.PRESETS[v]), 800, 800, true);
  const top = at('z');
  const o = top.project([0, 0, 0]);
  const tx = top.project([1, 0, 0]), ty = top.project([0, 1, 0]), tz = top.project([0, 0, 1]);
  assert.ok(tx[0] > o[0] && Math.abs(tx[1] - o[1]) < 1e-9, 'from above, x points right');
  assert.ok(ty[1] < o[1] && Math.abs(ty[0] - o[0]) < 1e-9, 'from above, y points up');
  assert.ok(Math.abs(tz[0] - o[0]) < 1e-9 && Math.abs(tz[1] - o[1]) < 1e-9, 'z points at you');
  const front = at('y');
  assert.ok(front.project([1, 0, 0])[0] > front.project([0, 0, 0])[0], 'along y: x points right');
  assert.ok(front.project([0, 0, 1])[1] < front.project([0, 0, 0])[1], 'along y: z points up');
  const side = at('x');
  assert.ok(side.project([0, 1, 0])[0] > side.project([0, 0, 0])[0], 'along x: y points right');
});

test('the whole box fits on screen at any angle', () => {
  for (const yaw of [-170, -60, 0, 32, 95, 180]) {
    for (const pitch of [-90, -30, 0, 22, 70, 90]) {
      const cam = S.camera(BOX, { yaw, pitch, zoom: 1 }, 700, 400, true);
      for (const c of [[-10, -10, -10], [10, 10, 10], [10, -10, 10], [-10, 10, -10]]) {
        const p = cam.project(c);
        assert.ok(p[0] >= 0 && p[0] <= 700 && p[1] >= 0 && p[1] <= 400, `corner ${c} off screen at ${yaw}°, ${pitch}°`);
      }
    }
  }
});

/* ── Painting order ───────────────────────────────────────────────────── */

/** Where each drawn thing sits in the painting order, by tag. */
function paintOrder(planes, items, view) {
  const polys = planes.map((src, i) => {
    const pl = plane(src);
    return Object.assign(S.planeInBox(pl, BOX), { plane: pl, tag: 'P' + i, t: 'poly' });
  });
  const cam = S.camera(BOX, view, 800, 800, true);
  return S.sceneOrder(S.planeTree(polys, BOX), items, cam.g, BOX);
}

test('a point above the floor is painted after it from above, and before it from below', () => {
  const items = [{ t: 'dot', p: [0, 0, 5], tag: 'up' }, { t: 'dot', p: [0, 0, -5], tag: 'down' }];
  const fromAbove = paintOrder(['z = 0'], items, { yaw: -90, pitch: 90, zoom: 1 }).map((i) => i.tag);
  assert.deepEqual(fromAbove, ['down', 'P0', 'up']);
  const fromBelow = paintOrder(['z = 0'], items, { yaw: -90, pitch: -90, zoom: 1 }).map((i) => i.tag);
  assert.deepEqual(fromBelow, ['up', 'P0', 'down']);
});

test('two crossing planes are each cut where they cross, and the nearer half of each is painted last', () => {
  const order = paintOrder(['z = 0', 'x = 0'], [], S.DEFAULT_VIEW);
  assert.equal(order.length, 3, 'x = 0 is cut in two by z = 0');
  const cam = S.camera(BOX, S.DEFAULT_VIEW, 800, 800, true);
  // Whatever covers the middle of the screen last is what you see there; check
  // along rays through several screen points that the last piece hit is the nearest.
  const depthAt = (poly, ray) => {
    const pl = poly.plane;
    const t = (pl.d - S.dot(pl.n, ray.o)) / S.dot(pl.n, ray.v);
    return t;
  };
  const rays = [[2, 3, 0], [-4, 2, 0], [0, -3, 4], [0, 5, -6]].map((p) => ({ o: S.sub(p, S.mul(cam.g, 100)), v: cam.g }));
  rays.forEach((ray) => {
    const hits = order.map((poly, k) => ({ k, t: depthAt(poly, ray), poly }))
      .filter((h) => Number.isFinite(h.t))
      .filter((h) => {
        // Does the ray pass through this piece? Check against its own polygon by angle sum.
        const p = S.add(ray.o, S.mul(ray.v, h.t));
        const pts = h.poly.pts;
        let ang = 0;
        for (let i = 0; i < pts.length; i++) {
          const a = S.sub(pts[i], p), b = S.sub(pts[(i + 1) % pts.length], p);
          const la = S.len(a), lb = S.len(b);
          if (la < 1e-9 || lb < 1e-9) return true;
          ang += Math.acos(Math.max(-1, Math.min(1, S.dot(a, b) / (la * lb))));
        }
        return Math.abs(ang - 2 * Math.PI) < 1e-6;
      });
    if (hits.length < 2) return;
    const nearest = hits.reduce((a, b) => (b.t < a.t ? b : a));
    const lastPainted = hits.reduce((a, b) => (b.k > a.k ? b : a));
    assert.equal(lastPainted.k, nearest.k, 'the piece painted last on this ray is the nearest one');
  });
});

test('something lying in a plane is painted on the side facing you', () => {
  const trace = { t: 'seg', a: [-5, 0, 0], b: [5, 0, 0], tag: 'on' };
  const above = paintOrder(['z = 0'], [trace], { yaw: 30, pitch: 40, zoom: 1 }).map((i) => i.tag);
  assert.deepEqual(above, ['P0', 'on']);
  const below = paintOrder(['z = 0'], [trace], { yaw: 30, pitch: -40, zoom: 1 }).map((i) => i.tag);
  assert.deepEqual(below, ['P0', 'on']);
});

test('a segment crossing a plane is cut there, each half on its own side', () => {
  const axis = { t: 'seg', a: [0, 0, -8], b: [0, 0, 8], tag: 'z' };
  const order = paintOrder(['z = 0'], [axis], { yaw: -90, pitch: 90, zoom: 1 });
  assert.deepEqual(order.map((i) => i.tag), ['z', 'P0', 'z']);
  close(order[0].b[2], 0, 'the lower half ends at the plane');
  assert.ok(order[0].a[2] < 0 && order[2].b[2] > 0);
});

/* ── The document and links ───────────────────────────────────────────── */

test('a saved or linked graph is cleaned before it is trusted', () => {
  const d = S.normaliseDoc({
    title: 'x'.repeat(500),
    win: { xMin: 5, xMax: -5, zMin: -3, zMax: 3, box: false, gridXZ: 'yes' },
    view: { yaw: 450, pitch: 200, zoom: 1e9 },
    items: [{ src: 'x + y = 1', colour: 'red', hidden: 1 }, 'junk', { src: 7, colour: '#ABCDEF', traces: true }],
  });
  assert.equal(d.title.length, 120);
  assert.equal(d.win.xMin, -10, 'a back-to-front range is refused');
  assert.equal(d.win.zMax, 3);
  assert.equal(d.win.box, false);
  assert.equal(d.win.gridXZ, false, 'only true or false');
  assert.equal(d.view.yaw, 90);
  assert.equal(d.view.pitch, 90);
  assert.equal(d.view.zoom, 20);
  assert.equal(d.items.length, 2);
  assert.equal(d.items[0].colour, S.PALETTE[0]);
  assert.equal(d.items[0].hidden, false);
  assert.equal(d.items[1].src, '7');
  assert.equal(d.items[1].colour, '#abcdef');
  assert.equal(d.items[1].traces, true);
  assert.equal(S.normaliseDoc(null).kind, '3d');
});

test('a link carries the whole graph and the view, and a damaged one is refused', () => {
  const doc = S.normaliseDoc({
    title: 'Three planes — système',
    win: { xMin: -5, xMax: 8, yMin: -10, yMax: 10, zMin: 0, zMax: 12, gridXZ: true, key: false },
    view: { yaw: -47.25, pitch: 61.5, zoom: 1.75 },
    items: [
      { src: 'x + y + z = 6', colour: '#56b4e9', traces: true },
      { src: 'A = (1, 2, 3)', colour: '#e69f00', guides: false },
      { src: 'z = x^2', colour: '#cc79a7', hidden: true },
    ],
  });
  const code = S.encodeShare(doc);
  assert.match(code, /^[A-Za-z0-9_-]+$/, 'safe in a URL as it is');
  const back = S.decodeShare(code);
  assert.equal(back.title, doc.title);
  assert.deepEqual(back.win, doc.win);
  assert.deepEqual(back.view, doc.view);
  assert.deepEqual(back.items.map((i) => [i.src, i.colour, i.hidden, i.icpt, i.traces, i.guides]),
    doc.items.map((i) => [i.src, i.colour, i.hidden, i.icpt, i.traces, i.guides]));
  assert.equal(S.decodeShare('not*base64'), null);
  assert.equal(S.decodeShare('eyJ2IjoyfQ'), null, 'a version it does not know');
  assert.equal(S.decodeShare(code.slice(0, -7)), null, 'cut short');
});

test('steps and ticks fall on round numbers', () => {
  assert.equal(S.niceStep(20, 8), 5);
  assert.equal(S.niceStep(20, 10), 2);
  assert.deepEqual(S.ticks(-10, 10, 5), [-10, -5, 0, 5, 10]);
});
