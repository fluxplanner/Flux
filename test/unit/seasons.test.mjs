/*
 * Unit test — Seasons earn/streak math (C9).
 *
 * computeEarn() is the pure core: XP with daily caps, streak walking with
 * rest-day/weekend auto-freeze (never punish rest), threshold unlocks.
 * Extraction pattern (same as the other classic-IIFE modules).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..', '..', 'public', 'js', 'flux-seasons.js',
);

function extractCore() {
  const src = fs.readFileSync(SRC, 'utf8');
  const start = src.indexOf('const XP =');
  const end = src.indexOf('/* ── app wiring ── */');
  assert.ok(start >= 0 && end > start, 'could not locate seasons core in flux-seasons.js');
  return new Function(`"use strict";${src.slice(start, end)}
    return { computeEarn, seasonOf, XP, DAILY_CAP, SEASONS };`)();
}

const { computeEarn, seasonOf, SEASONS } = extractCore();

const never = () => false;           // every day is a school day
const fresh = () => ({ xp: 0, streak: 0, lastDay: '', earnedToday: {}, unlocks: [] });

// 2026-07: 06 Mon … 10 Fri, 11/12 weekend, 13 Mon. All summer.

test('seasonOf buckets months', () => {
  assert.equal(seasonOf('2026-07-11'), 'summer');
  assert.equal(seasonOf('2026-10-01'), 'autumn');
  assert.equal(seasonOf('2026-01-15'), 'winter');
  assert.equal(seasonOf('2026-04-15'), 'spring');
});

test('earning starts a streak and adds XP; input state is not mutated', () => {
  const s0 = fresh();
  const r = computeEarn(s0, 'focus_session', '2026-07-06', never);
  assert.equal(r.gained, 10);
  assert.equal(r.state.streak, 1);
  assert.equal(r.state.xp, 10);
  assert.equal(s0.xp, 0); // pure
});

test('daily caps: focus 3×, shutdown 1×; capped earns add nothing', () => {
  let s = fresh();
  for (let i = 0; i < 5; i++) s = computeEarn(s, 'focus_session', '2026-07-06', never).state;
  assert.equal(s.xp, 30); // 3 × 10, two capped
  s = computeEarn(s, 'shutdown_ritual', '2026-07-06', never).state;
  s = computeEarn(s, 'shutdown_ritual', '2026-07-06', never).state;
  assert.equal(s.xp, 45); // +15 once
});

test('consecutive school days grow the streak', () => {
  let s = computeEarn(fresh(), 'focus_session', '2026-07-06', never).state;
  s = computeEarn(s, 'focus_session', '2026-07-07', never).state;
  s = computeEarn(s, 'focus_session', '2026-07-08', never).state;
  assert.equal(s.streak, 3);
});

test('weekends and rest days freeze the streak — never punish rest', () => {
  const weekendAware = (ds) => [0, 6].includes(new Date(ds + 'T12:00:00').getDay());
  // Friday → Monday over a weekend: streak continues.
  let s = computeEarn(fresh(), 'focus_session', '2026-07-10', weekendAware).state;
  s = computeEarn(s, 'focus_session', '2026-07-13', weekendAware).state;
  assert.equal(s.streak, 2);
  // Sick day midweek (isBreak true) also freezes.
  const sickTue = (ds) => ds === '2026-07-07' || weekendAware(ds);
  let s2 = computeEarn(fresh(), 'focus_session', '2026-07-06', sickTue).state;
  s2 = computeEarn(s2, 'focus_session', '2026-07-08', sickTue).state;
  assert.equal(s2.streak, 2);
});

test('a missed school day (no rest recorded) resets the streak to 1', () => {
  let s = computeEarn(fresh(), 'focus_session', '2026-07-06', never).state;
  s = computeEarn(s, 'focus_session', '2026-07-08', never).state; // skipped the 7th
  assert.equal(s.streak, 1);
});

test('threshold unlocks fire once, in the active season, and are cosmetic-only', () => {
  let s = fresh();
  let unlocked = [];
  // 25 XP = first summer accent. 3 focus (30) crosses it.
  for (let i = 0; i < 3; i++) {
    const r = computeEarn(s, 'focus_session', '2026-07-06', never);
    s = r.state;
    unlocked = unlocked.concat(r.newUnlocks.map((c) => c.id));
  }
  assert.deepEqual(unlocked, ['accent_tidepool']);
  // Next day re-crossing does not re-unlock.
  const r2 = computeEarn(s, 'focus_session', '2026-07-07', never);
  assert.equal(r2.newUnlocks.length, 0);
  // Cosmetics carry no grade linkage anywhere in their definitions.
  for (const list of Object.values(SEASONS)) {
    for (const c of list) {
      assert.doesNotMatch(JSON.stringify(c), /grade|gpa|score/i);
    }
  }
});

test('unknown kinds are inert', () => {
  const r = computeEarn(fresh(), 'finished_homework_early', '2026-07-06', never);
  assert.equal(r.gained, 0);
  assert.equal(r.state.xp, 0);
});
