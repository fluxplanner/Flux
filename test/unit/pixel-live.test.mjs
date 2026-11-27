import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * Flux Pixel live sharing (public/js/flux-pixel-live.js): the item-level
 * changes sent between screens, and the merge run after being apart.
 * Getting these wrong loses someone's drawing, or brings deleted things back.
 */

const w = { crypto: globalThis.crypto };
new Function('window', fs.readFileSync('public/js/flux-pixel-live.js', 'utf8'))(w);
const L = w.FluxPixelLive;

const it = (id, x = 0) => ({ id, type: 'box', x });
const ids = (items) => items.map((i) => i.id);

test('diff finds added, changed, removed and reordered items', () => {
  const before = [it('a'), it('b'), it('c')];
  const after = [it('c'), it('a', 5), it('d')];
  const ops = L.diff(L.index(before), ids(before), after);
  assert.deepEqual(ids(ops.up), ['a', 'd']);
  assert.deepEqual(ops.del, ['b']);
  assert.deepEqual(ops.order, ['c', 'a', 'd']);
});

test('diff of an unchanged page is empty', () => {
  const items = [it('a'), it('b')];
  const ops = L.diff(L.index(items), ids(items), JSON.parse(JSON.stringify(items)));
  assert.equal(ops.up.length + ops.del.length, 0);
  assert.equal(ops.order, null);
});

test('apply then diff round-trips between two screens', () => {
  const start = [it('a'), it('b'), it('c')];
  const mine = [it('b', 9), it('e'), it('a')];
  const ops = L.diff(L.index(start), ids(start), mine);
  assert.deepEqual(L.apply(start, ops), mine);
});

test('apply keeps untouched items as the same objects (a drag in progress survives)', () => {
  const a = it('a'), b = it('b');
  const out = L.apply([a, b], { up: [it('b', 3)], del: [] });
  assert.equal(out[0], a);
  assert.equal(out[1].x, 3);
});

test('apply puts items the sender had not seen after the ordered ones', () => {
  const out = L.apply([it('a'), it('mine'), it('b')], { up: [], del: [], order: ['b', 'a'] });
  assert.deepEqual(ids(out), ['b', 'a', 'mine']);
});

test('apply ignores junk items', () => {
  const out = L.apply([it('a')], { up: [null, { x: 1 }, it('b')], del: [] });
  assert.deepEqual(ids(out), ['a', 'b']);
});

test('merge3: each side keeps the changes only it made', () => {
  const base = [it('a'), it('b'), it('c'), it('d')];
  const local = [it('a', 1), it('b'), it('d'), it('n1')];       // moved a, deleted c, added n1
  const server = [it('a'), it('b', 2), it('c'), it('n2')];      // moved b, deleted d, added n2
  const out = L.merge3(L.index(base), local, server);
  const byId = Object.fromEntries(out.map((i) => [i.id, i]));
  assert.equal(byId.a.x, 1);
  assert.equal(byId.b.x, 2);
  assert.ok(!byId.c, 'deleted here stays deleted');
  assert.ok(!byId.d, 'deleted there stays deleted');
  assert.ok(byId.n1 && byId.n2, 'both new items kept');
});

test('merge3: both changed the same item, this screen wins', () => {
  const out = L.merge3(L.index([it('a')]), [it('a', 1)], [it('a', 2)]);
  assert.equal(out[0].x, 1);
});

test('merge3 with no shared history keeps everything from both', () => {
  const out = L.merge3(new Map(), [it('a', 1), it('x')], [it('a', 2), it('y')]);
  assert.deepEqual(ids(out).sort(), ['a', 'x', 'y']);
  assert.equal(out.find((i) => i.id === 'a').x, 1);
});

test('room ids are long, random and pass the server check', () => {
  const a = L.newRoomId(), b = L.newRoomId();
  assert.match(a, /^[A-Za-z0-9]{24}$/);
  assert.notEqual(a, b);
  assert.ok(L.isRoom(a));
  assert.ok(!L.isRoom('short'));
  assert.ok(!L.isRoom('../../etc/passwd/aaaaaaaaaaaaaa'));
});

test('a __proto__ id from another browser is dropped and pollutes nothing', () => {
  const evil = JSON.parse('[{"id":"__proto__","polluted":true},{"id":"ok"}]');
  const out = L.apply([], { up: evil, del: ['__proto__'], order: ['__proto__', 'ok'] });
  assert.deepEqual(ids(out), ['ok']);
  assert.equal({}.polluted, undefined);
  const idx = L.index(evil);
  assert.ok(idx instanceof Map);
  assert.equal({}.polluted, undefined);
});
