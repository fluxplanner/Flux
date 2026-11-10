import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';

/* CI runs Node 20, which cannot import a .ts file, so strip the types first. */
const tsSrc = readFileSync(new URL('../../supabase/functions/_shared/schoology-feed.ts', import.meta.url), 'utf8');
const { code } = transformSync(tsSrc, { loader: 'ts', format: 'esm' });
const { normalizeFeedUrl, looksLikeCalendar, isPrivateAddress } =
  await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));

test('a name that resolves to a private address is refused', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1',
    '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', '::', 'fd00::1', 'fe80::1',
    '::ffff:127.0.0.1', '::ffff:7f00:1', 'not-an-address']) {
    assert.equal(isPrivateAddress(ip), true, ip);
  }
  for (const ip of ['8.8.8.8', '172.15.0.1', '172.32.0.1', '100.63.0.1', '192.167.1.1',
    '2606:4700:4700::1111']) {
    assert.equal(isPrivateAddress(ip), false, ip);
  }
});

const moduleSrc = readFileSync(new URL('../../public/js/flux-schoology.js', import.meta.url), 'utf8');
const fakeWindow = {};
new Function('window', 'document', moduleSrc)(fakeWindow, undefined);
const { _parseIcs: parseIcs, _mergeEvents: mergeEvents } = fakeWindow.FluxSchoology;

const TODAY = new Date(2026, 10, 5);
const ev = (uid, summary, date, extra = {}) => ({ uid, summary, date, ...extra });
const merge = (tasks, events, seen = [], classes = []) =>
  mergeEvents(tasks, events, seen, { today: TODAY, classes, calcUrgency: null });

test('accepts a calendar link and turns webcal into https', () => {
  assert.equal(
    normalizeFeedUrl(' webcal://school.schoology.com/feed/a.ics?t=1 '),
    'https://school.schoology.com/feed/a.ics?t=1',
  );
  assert.equal(normalizeFeedUrl('https://lms.district.org/feed.ics'), 'https://lms.district.org/feed.ics');
});

test('refuses addresses that could reach something private', () => {
  for (const bad of [
    '', 'not a url', 'ftp://school.org/a.ics', 'file:///etc/passwd',
    'https://localhost/a', 'https://127.0.0.1/a', 'https://2130706433/a', 'https://[::1]/a',
    'https://169.254.169.254/latest/meta-data', 'https://printer.local/a', 'https://db.internal/a',
    'https://user:pass@school.org/a', 'https://school.org:8443/a',
    'https://abc.supabase.co/rest/v1/users',
  ]) {
    assert.equal(normalizeFeedUrl(bad), null, bad);
  }
});

test('only a real calendar response counts', () => {
  assert.equal(looksLikeCalendar('﻿BEGIN:VCALENDAR\r\nEND:VCALENDAR'), true);
  assert.equal(looksLikeCalendar('<html>Log in to Schoology</html>'), false);
});

test('reads folded lines, escapes and all-day dates', () => {
  const [a] = parseIcs([
    'BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:a1',
    'SUMMARY:Essay\\, part 1: the', ' long title', 'DESCRIPTION:Line one\\nLine two',
    'DTSTART;VALUE=DATE:20261110', 'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n'));
  assert.deepEqual(a, {
    uid: 'a1', summary: 'Essay, part 1: thelong title', description: 'Line one\nLine two', date: '2026-11-10',
  });
});

test('a UTC due time lands on the local day', () => {
  const [a] = parseIcs('BEGIN:VEVENT\nUID:u\nSUMMARY:x\nDTSTART:20261111T045900Z\nEND:VEVENT');
  const local = new Date(Date.UTC(2026, 10, 11, 4, 59));
  const y = local.getFullYear(), m = String(local.getMonth() + 1).padStart(2, '0'), d = String(local.getDate()).padStart(2, '0');
  assert.equal(a.date, `${y}-${m}-${d}`);
});

test('a local time with a timezone keeps its written date', () => {
  const [a] = parseIcs('BEGIN:VEVENT\nUID:u\nSUMMARY:x\nDTSTART;TZID=America/New_York:20261110T235900\nEND:VEVENT');
  assert.equal(a.date, '2026-11-10');
});

test('events without an id, title or date are dropped', () => {
  assert.deepEqual(parseIcs('BEGIN:VEVENT\nSUMMARY:x\nDTSTART:20261110\nEND:VEVENT'), []);
});

test('adds new work with type, priority and a matched class', () => {
  const tasks = [];
  const r = merge(tasks, [ev('q', 'Biology Quiz 4', '2026-11-10')], [], [{ id: 7.5, name: 'Biology' }]);
  assert.equal(r.added, 1);
  assert.equal(tasks[0].type, 'quiz');
  assert.equal(tasks[0].priority, 'high');
  assert.equal(tasks[0].subject, 'CLS7.5');
  assert.deepEqual(r.seen, ['q']);
});

test('syncing twice adds nothing the second time', () => {
  const tasks = [];
  const first = merge(tasks, [ev('a', 'Essay', '2026-11-10')]);
  const second = merge(tasks, [ev('a', 'Essay', '2026-11-10')], first.seen);
  assert.equal(second.added, 0);
  assert.equal(second.updated, 0);
  assert.equal(tasks.length, 1);
});

test('two devices give the same event the same task id', () => {
  const a = [], b = [];
  merge(a, [ev('same', 'Essay', '2026-11-10')]);
  merge(b, [ev('same', 'Essay', '2026-11-10')]);
  assert.equal(a[0].id, b[0].id);
  assert.ok(Number.isSafeInteger(a[0].id));
});

test('a task deleted in Flux does not come back', () => {
  const tasks = [];
  const { seen } = merge(tasks, [ev('a', 'Essay', '2026-11-10')]);
  tasks.length = 0;
  assert.equal(merge(tasks, [ev('a', 'Essay', '2026-11-10')], seen).added, 0);
  assert.equal(tasks.length, 0);
});

test('a task moved in Flux stays moved until the teacher changes the date', () => {
  const tasks = [];
  merge(tasks, [ev('a', 'Essay', '2026-11-10')]);
  tasks[0].date = '2026-11-08';
  merge(tasks, [ev('a', 'Essay', '2026-11-10')]);
  assert.equal(tasks[0].date, '2026-11-08');
  assert.equal(merge(tasks, [ev('a', 'Essay', '2026-11-12')]).updated, 1);
  assert.equal(tasks[0].date, '2026-11-12');
});

test('a renamed task keeps the student\'s own name', () => {
  const tasks = [];
  merge(tasks, [ev('a', 'Essay', '2026-11-10')]);
  merge(tasks, [ev('a', 'Essay v2', '2026-11-10')]);
  assert.equal(tasks[0].name, 'Essay v2');
  tasks[0].name = 'My essay';
  merge(tasks, [ev('a', 'Essay v3', '2026-11-10')]);
  assert.equal(tasks[0].name, 'My essay');
});

test('finished tasks are left alone', () => {
  const tasks = [];
  merge(tasks, [ev('a', 'Essay', '2026-11-10')]);
  tasks[0].done = true;
  assert.equal(merge(tasks, [ev('a', 'Essay', '2026-11-12')]).updated, 0);
  assert.equal(tasks[0].date, '2026-11-10');
});

test('skips old events and school-wide days', () => {
  const tasks = [];
  const r = merge(tasks, [
    ev('old', 'Essay', '2026-10-01'),
    ev('edge', 'Recent', '2026-10-29'),
    ev('hol', 'No School - Veterans Day', '2026-11-11'),
    ev('brk', 'Winter Break', '2026-12-21'),
  ]);
  assert.deepEqual(tasks.map((t) => t.schoologyUid), ['edge']);
  assert.equal(r.added, 1);
});
