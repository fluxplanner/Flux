import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

/**
 * flux-music-theory.js: notes spelled the way musicians write them.
 * Every expectation here is standard theory a music student would check
 * against a textbook, not a value read back from the code.
 */
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(readFileSync(new URL('../../public/js/flux-music-theory.js', import.meta.url), 'utf8'), sandbox);
const T = sandbox.window.FluxMusicTheory;
const names = (ns) => Array.from(ns, (n) => T.name(n)).join(' ');
const scale = (root, type) => names(T.scale(T.parse(root), type));

test('scales use one letter each: B♭ major is not "A♯ C D D♯ F G A"', () => {
  assert.equal(scale('Bb', 'Major'), 'B♭ C D E♭ F G A');
  assert.equal(scale('G♭', 'Major'), 'G♭ A♭ B♭ C♭ D♭ E♭ F');
  assert.equal(scale('F#', 'Major'), 'F♯ G♯ A♯ B C♯ D♯ E♯');
  assert.equal(scale('A', 'Harmonic minor'), 'A B C D E F G♯');
  assert.equal(scale('D', 'Major pentatonic'), 'D E F♯ A B');
  assert.equal(scale('C', 'Blues'), 'C E♭ F G♭ G B♭');
  assert.equal(scale('E', 'Minor pentatonic'), 'E G A B D');
});

test('chords are stacked in thirds and spelled that way', () => {
  const chord = (r, t) => names(T.chord(T.parse(r), t));
  assert.equal(chord('Bb', 'Minor'), 'B♭ D♭ F');
  assert.equal(chord('F#', 'Diminished'), 'F♯ A C');
  assert.equal(chord('Ab', 'Major 7'), 'A♭ C E♭ G');
  assert.equal(chord('B', 'Diminished 7'), 'B D F A♭');
  assert.equal(chord('C#', 'Augmented'), 'C♯ E♯ G𝄪');
});

test('key signatures, relative keys and enharmonic keys', () => {
  const bb = T.keyFor('B♭', 'major');
  assert.equal(bb.signatureText, '2♭');
  assert.deepEqual(Array.from(bb.signatureNotes), ['B♭', 'E♭']);
  assert.equal(bb.relative, 'G minor');
  assert.equal(T.keyFor('C', 'major').relative, 'A minor');
  assert.equal(T.keyFor('C', 'minor').relative, 'E♭ major');
  assert.equal(T.keyFor('C♯', 'major').signatureText, '7♯');
  assert.equal(T.keyFor('C♭', 'major').signatureText, '7♭');
  const fs = T.keyFor('F♯', 'major');
  assert.equal(fs.signatureText, '6♯');
  assert.equal(fs.enharmonic.label, 'G♭ major');
  assert.equal(fs.enharmonic.signatureText, '6♭');
  assert.equal(T.keyFor('B', 'major').enharmonic.label, 'C♭ major');
  assert.equal(T.keyFor('D♭', 'major').enharmonic.label, 'C♯ major');
  assert.equal(T.keyFor('D♯', 'minor').enharmonic.label, 'E♭ minor');
  assert.equal(T.keyFor('G', 'major').enharmonic, undefined, 'G major has no real enharmonic key');
});

test('a theoretical key is written as its practical twin, with the reason', () => {
  const k = T.keyFor('A♯', 'major');
  assert.equal(k.label, 'B♭ major');
  assert.equal(k.respelledFrom, 'A♯ major');
  assert.match(k.why, /C𝄪/);
  assert.equal(T.keyFor('D♭', 'minor').label, 'C♯ minor');
  assert.equal(T.keyFor('G♯', 'major').label, 'A♭ major');
  assert.equal(T.keyFor('E♭', 'minor').label, 'E♭ minor', 'E♭ minor (6♭) is a real key and stays');
});

test('Roman numerals depend on the key: the same chord gets a new number in the relative minor', () => {
  const rows = T.relativeNumerals('C').map((r) => `${r.symbol}:${r.inMajor}/${r.inMinor}`).join(' ');
  assert.equal(rows, 'C:I/III Dm:ii/iv Em:iii/v F:IV/VI G:V/VII Am:vi/i B°:vii°/ii°');
  const minor = T.diatonicTriads('A', 'Natural minor').map((c) => c.numeral).join(' ');
  assert.equal(minor, 'i ii° III iv v VI VII');
  const harmonic = T.diatonicTriads('A', 'Harmonic minor');
  assert.equal(harmonic[4].numeral, 'V', 'the raised 7th makes the dominant major');
  assert.equal(harmonic[4].symbol, 'E');
  assert.equal(harmonic[6].numeral, 'vii°');
  assert.equal(harmonic[6].symbol, 'G♯°');
  const gb = T.diatonicTriads('G♭', 'Major').map((c) => c.symbol).join(' ');
  assert.equal(gb, 'G♭ A♭m B♭m C♭ D♭ E♭m F°', 'G♭ major\'s chords are spelled in flats');
});

test('inversions: bass note, slash chord and figured bass', () => {
  const c = T.inversions('C', 'Major');
  assert.deepEqual(Array.from(c, (i) => i.symbol), ['C', 'C/E', 'C/G']);
  assert.deepEqual(Array.from(c, (i) => i.figureShort), ['', '6', '6/4']);
  assert.equal(names(c[1].notes), 'E G C');
  const g7 = T.inversions('G', 'Dominant 7');
  assert.deepEqual(Array.from(g7, (i) => i.symbol), ['G7', 'G7/B', 'G7/D', 'G7/F']);
  assert.deepEqual(Array.from(g7, (i) => i.figure), ['7', '6/5', '4/3', '4/2']);
  assert.equal(g7[3].name, 'Third inversion');
});

test('parsing accepts what people type', () => {
  assert.equal(T.name(T.parse('bb')), 'B♭');
  assert.equal(T.name(T.parse('F#')), 'F♯');
  assert.equal(T.name(T.parse('Cx')), 'C𝄪');
  assert.equal(T.name(T.parse('Ebb')), 'E𝄫');
  assert.equal(T.parse('H'), null);
});
