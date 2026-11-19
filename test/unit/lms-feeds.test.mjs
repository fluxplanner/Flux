// Parser for Schoology / Moodle calendar feeds (public/js/flux-lms-feeds.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('../../public/js/flux-lms-feeds.js', import.meta.url), 'utf8');
const ctx = { window: {}, localStorage: { getItem: () => null, setItem() {} } };
vm.runInNewContext(src, ctx);
const { parseIcs } = ctx.window.FluxLmsFeeds;

const MOODLE = [
  'BEGIN:VCALENDAR',
  'BEGIN:VEVENT',
  'UID:42@moodle.example.edu',
  'SUMMARY:Lab report 3 is due',
  'DESCRIPTION:Upload as PDF\\, please\\nThanks',
  'CATEGORIES:CHEM101',
  'DTSTART;VALUE=DATE:20261112',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:43@moodle.example.edu',
  'SUMMARY:A very long title that the server',
  '  folded onto two lines',
  'DTSTART;TZID=America/New_York:20261120T235900',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'SUMMARY:No uid is dropped',
  'DTSTART:20261121',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

test('reads uid, title, course, and all-day date', () => {
  const [a] = parseIcs(MOODLE);
  assert.equal(a.uid, '42@moodle.example.edu');
  assert.equal(a.title, 'Lab report 3 is due');
  assert.equal(a.course, 'CHEM101');
  assert.equal(a.description, 'Upload as PDF, please\nThanks');
  assert.deepEqual({ ...a.start }, { date: '2026-11-12', time: '' });
});

test('unfolds long lines and keeps local wall-clock times', () => {
  const b = parseIcs(MOODLE)[1];
  assert.equal(b.title, 'A very long title that the server folded onto two lines');
  assert.deepEqual({ ...b.start }, { date: '2026-11-20', time: '23:59' });
});

test('skips events without a uid', () => {
  assert.equal(parseIcs(MOODLE).length, 2);
});

test('UTC times land on a real date', () => {
  const [e] = parseIcs('BEGIN:VEVENT\nUID:x\nDTSTART:20261112T120000Z\nEND:VEVENT');
  assert.match(e.start.date, /^2026-11-1[12]$/);
});
