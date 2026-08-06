/*
 * Unit test — FluxNow period math (C1).
 *
 * resolveNow() is the pure core of the bell-aware engine: given a clock, the
 * class list, the cycle label, and rest-day state, it names the school-time
 * state with one calm sentence. These tests pin the edges Phase D calls out
 * (midnight, weekends) plus the period/passing boundaries.
 *
 * Extraction pattern (same as study-math-parser / parse-class-level): the
 * function lives in a classic IIFE, so we rebuild it from source.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..', '..', 'public', 'js', 'flux-now-engine.js',
);

function extractResolver() {
  const src = fs.readFileSync(SRC, 'utf8');
  const start = src.indexOf('function hmToMin');
  const end = src.indexOf('/* ── app-context resolver ── */');
  assert.ok(start >= 0 && end > start, 'could not locate resolver block in flux-now-engine.js');
  return new Function(`"use strict";${src.slice(start, end)}
    return { resolveNow, hmToMin, classesForDay };`)();
}

const { resolveNow, hmToMin } = extractResolver();

// Wednesday 2026-07-08 is a weekday; the 11th/12th are Sat/Sun.
const at = (dateStr, hm) => new Date(`${dateStr}T${hm}:00`);
const CLASSES = [
  { name: 'AP Biology', room: '204', days: 'A Day', timeStart: '08:15', timeEnd: '09:05' },
  { name: 'Spanish 3', room: '110', days: 'A Day', timeStart: '09:15', timeEnd: '10:05' },
  { name: 'Gym', days: 'B Day', timeStart: '08:15', timeEnd: '09:05' },
];
const ctx = (now, extra = {}) => ({ now, classes: CLASSES, cycleLabel: 'A', isRest: false, isEducator: false, ...extra });

test('hmToMin parses and rejects', () => {
  assert.equal(hmToMin('08:15'), 495);
  assert.equal(hmToMin('0:05'), 5);
  assert.equal(hmToMin(''), null);
  assert.equal(hmToMin('25:99'), 25 * 60 + 99); // clock math is caller's concern; format-only parse
});

test('weekend wins over everything', () => {
  const r = resolveNow(ctx(at('2026-07-11', '09:00')));
  assert.equal(r.state, 'weekend');
});

test('rest day → holiday (calm sentence)', () => {
  const r = resolveNow(ctx(at('2026-07-08', '09:00'), { isRest: true }));
  assert.equal(r.state, 'holiday');
  assert.match(r.sentence, /rest/i);
});

test('before school names the first class and wait', () => {
  const r = resolveNow(ctx(at('2026-07-08', '07:45')));
  assert.equal(r.state, 'before');
  assert.equal(r.next.name, 'AP Biology');
  assert.equal(r.minutesUntil, 30);
  assert.doesNotMatch(r.sentence, /hurry|late|!$/i); // never panic-toned
});

test('midnight is "before", not "after" or negative math', () => {
  const r = resolveNow(ctx(at('2026-07-08', '00:00')));
  assert.equal(r.state, 'before');
  assert.equal(r.minutesUntil, 495);
});

test('in period: minutes left + room', () => {
  const r = resolveNow(ctx(at('2026-07-08', '08:30')));
  assert.equal(r.state, 'period');
  assert.equal(r.cls.name, 'AP Biology');
  assert.equal(r.minutesLeft, 35);
  assert.match(r.sentence, /Rm 204/);
});

test('period boundary: start minute is in, end minute is out', () => {
  assert.equal(resolveNow(ctx(at('2026-07-08', '08:15'))).state, 'period');
  assert.equal(resolveNow(ctx(at('2026-07-08', '09:05'))).state, 'passing');
});

test('passing period points at the next class', () => {
  const r = resolveNow(ctx(at('2026-07-08', '09:07')));
  assert.equal(r.state, 'passing');
  assert.equal(r.next.name, 'Spanish 3');
  assert.equal(r.minutesUntil, 8);
});

test('after the last bell', () => {
  const r = resolveNow(ctx(at('2026-07-08', '15:30')));
  assert.equal(r.state, 'after');
});

test('cycle filtering: B-day classes only on B days', () => {
  const rB = resolveNow(ctx(at('2026-07-08', '08:30'), { cycleLabel: 'B' }));
  assert.equal(rB.state, 'period');
  assert.equal(rB.cls.name, 'Gym');
});

test('educator phrasing says "You teach"', () => {
  const r = resolveNow(ctx(at('2026-07-08', '07:45'), { isEducator: true }));
  assert.match(r.sentence, /^You teach /);
});

test('no timed classes → untimed summary; no classes → silent', () => {
  const untimed = resolveNow(ctx(at('2026-07-08', '08:30'), {
    classes: [{ name: 'AP Biology', days: 'A Day' }],
  }));
  assert.equal(untimed.state, 'untimed');
  const none = resolveNow(ctx(at('2026-07-08', '08:30'), { classes: [] }));
  assert.equal(none.state, 'none');
  assert.equal(none.sentence, '');
});
