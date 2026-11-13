import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

/**
 * flux-paste-import-core.js: turning a pasted assignment sheet into task drafts.
 * The single-line parser lives in app.js, so a small stand-in is passed here; it
 * keeps the one contract the core relies on (name falls back to the whole line
 * when only a date was on it).
 */
const sandbox = { window: {}, Object, String, RegExp };
vm.createContext(sandbox);
vm.runInContext(readFileSync(new URL('../../public/js/flux-paste-import-core.js', import.meta.url), 'utf8'), sandbox);
const P = sandbox.window.FluxPasteImportCore;
const plain = (x) => JSON.parse(JSON.stringify(x));

function parseLine(line) {
  let t = line;
  let date = '';
  const m = t.match(/\b(?:due\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/);
  if (m) {
    date = `${m[3] || '2026'}-${String(m[1]).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`;
    t = t.replace(m[0], ' ');
  }
  const subject = /\bbiology\b/i.test(t) ? 'CLS1' : '';
  const name = t.replace(/\s+/g, ' ').replace(/^[\s,;:–—-]+|[\s,;:–—-]+$/g, '').trim() || line;
  return { name, date, time: '', type: /\bquiz\b/i.test(t) ? 'quiz' : 'hw', priority: 'med', estTime: 0, subject };
}

test('bullets, numbering and checkboxes are stripped', () => {
  assert.deepEqual(plain(P.splitLines('- Read ch 4\n* Lab report\n• Essay\n1. Problem set\n2) Worksheet\n[ ] Vocab\n- [x] Notes\n☐ Flashcards')),
    ['Read ch 4', 'Lab report', 'Essay', 'Problem set', 'Worksheet', 'Vocab', 'Notes', 'Flashcards']);
});

test('blank lines, rules and table headers are not tasks', () => {
  assert.deepEqual(plain(P.splitLines('\n\n---\n====\nAssignment\tDue Date\tPoints\n| Task | Due |\n|---|---|\nRead ch 4')), ['Read ch 4']);
});

test('table rows become one line and keep their date', () => {
  assert.equal(P.cleanLine('Lab report\t11/20\t50 pts'), 'Lab report - 11/20');
  assert.equal(P.cleanLine('| Essay draft | 12/01 | 100 points |'), 'Essay draft - 12/01');
});

test('point values and scores are removed, page ranges are not', () => {
  assert.equal(P.cleanLine('Problem set 3 (20 pts)'), 'Problem set 3');
  assert.equal(P.cleanLine('Quiz 2 - 15 points'), 'Quiz 2');
  assert.equal(P.cleanLine('Homework 5 - / 10'), 'Homework 5');
  assert.equal(P.cleanLine('Read pages 10-12'), 'Read pages 10-12');
});

test('ISO dates are rewritten and a weekday in front of a date is dropped', () => {
  assert.equal(P.cleanLine('Essay 2026-11-20'), 'Essay 11/20/2026');
  assert.equal(P.cleanLine('Mon 11/20 Read ch 4'), '11/20 Read ch 4');
  assert.equal(P.cleanLine('Friday, Nov 3 - Lab'), 'Nov 3 - Lab');
  assert.equal(P.cleanLine('Lab due Friday'), 'Lab due Friday'); // a weekday on its own is the date
});

test('a date on its own line dates the lines under it', () => {
  const d = plain(P.build('Monday 11/16\n- Read ch 4\n- Vocab quiz\n11/18\n- Lab report\n- Essay due 11/25', parseLine));
  assert.deepEqual(d.map((x) => [x.name, x.date]), [
    ['Read ch 4', '2026-11-16'], ['Vocab quiz', '2026-11-16'], ['Lab report', '2026-11-18'], ['Essay', '2026-11-25'],
  ]);
  assert.equal(d[1].type, 'quiz');
});

test('a class heading sets the class, and the next heading clears it', () => {
  const d = plain(P.build('Biology:\n- Lab report 11/20\n- Read ch 4\nOther stuff:\n- Buy binder', parseLine));
  assert.deepEqual(d.map((x) => [x.name, x.subject]), [['Lab report', 'CLS1'], ['Read ch 4', 'CLS1'], ['Buy binder', '']]);
});

test('a heading also ends the date carried from above', () => {
  const d = plain(P.build('11/16\n- Read ch 4\nLater:\n- Clean locker', parseLine));
  assert.deepEqual(d.map((x) => x.date), ['2026-11-16', '']);
});

test('duplicates are marked against the planner and within the paste', () => {
  const drafts = P.build('Read ch 4 11/16\nLab report\nlab  report', parseLine);
  const m = plain(P.markDuplicates(drafts, [{ name: 'read ch 4', date: '2026-11-16' }]));
  assert.deepEqual(m.map((x) => x.duplicate), [true, false, true]);
});

test('a huge paste is capped', () => {
  const text = Array.from({ length: 500 }, (_, i) => `Task ${i}`).join('\n');
  assert.equal(P.splitLines(text).length, P.MAX_LINES);
});

test('empty and junk input gives nothing', () => {
  assert.deepEqual(plain(P.build('', parseLine)), []);
  assert.deepEqual(plain(P.build('\n \n---\n', parseLine)), []);
  assert.deepEqual(plain(P.build(null, parseLine)), []);
});
