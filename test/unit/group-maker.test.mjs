import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

/**
 * The group maker's arithmetic. A teacher asking for groups of 4 in a class
 * of 26 wants five 4s and two 3s — never six 4s and a lonely pair — and asking
 * for 5 groups must give 5 groups. The shuffle is seeded here so the split is
 * checked, not luck.
 */

const src = readFileSync(new URL('../../public/js/flux-classroom-tools.js', import.meta.url), 'utf8');
const sandbox = { window: {}, console };
vm.runInNewContext(src, sandbox);
// Arrays made in the sandbox belong to another realm, and deepStrictEqual
// compares prototypes, so bring every result over as plain JSON.
const make = sandbox.window.FluxClassroomTools.makeGroups;
const makeGroups = (...args) => JSON.parse(JSON.stringify(make(...args)));

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const names = (n) => Array.from({ length: n }, (_, i) => 'n' + (i + 1));
const sizes = (groups) => groups.map((g) => g.length).sort((a, b) => b - a);

test('groups of at most n, sizes within one of each other', () => {
  assert.deepEqual(sizes(makeGroups(names(26), 'size', 4, seeded(1))), [4, 4, 4, 4, 4, 3, 3]);
  assert.deepEqual(sizes(makeGroups(names(10), 'size', 3, seeded(2))), [3, 3, 2, 2]);
  assert.deepEqual(sizes(makeGroups(names(12), 'size', 4, seeded(3))), [4, 4, 4]);
});

test('a number of groups gives exactly that many, or one per name', () => {
  assert.equal(makeGroups(names(26), 'count', 5, seeded(4)).length, 5);
  assert.deepEqual(sizes(makeGroups(names(26), 'count', 5, seeded(4))), [6, 5, 5, 5, 5]);
  assert.equal(makeGroups(names(3), 'count', 6, seeded(5)).length, 3);
});

test('everyone is placed exactly once', () => {
  const list = names(29);
  const flat = makeGroups(list, 'size', 4, seeded(6)).flat();
  assert.equal(flat.length, 29);
  assert.deepEqual([...flat].sort(), [...list].sort());
});

test('empty and blank names make no groups, and nonsense sizes are clamped', () => {
  assert.deepEqual(makeGroups([], 'size', 4), []);
  assert.deepEqual(makeGroups(['', null], 'count', 3), []);
  assert.equal(makeGroups(names(5), 'size', 0, seeded(7)).length, 5, 'a size of 0 is treated as 1');
});

test('the shuffle changes the order but not who is in the class', () => {
  const a = makeGroups(names(20), 'size', 5, seeded(8)).flat().join();
  const b = makeGroups(names(20), 'size', 5, seeded(9)).flat().join();
  assert.notEqual(a, b);
});
