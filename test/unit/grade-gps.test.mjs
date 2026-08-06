/*
 * Unit test — Grade GPS pure math (C4).
 *
 * gradeToGpa (4.0-scale banding), sparklineSvg (trajectory path), and
 * planBlocks (study-block pacing by category weight) are the deterministic
 * core of the Grade GPS card. Extraction pattern (same as
 * study-math-parser / parse-class-level / now-engine): the functions live in
 * a classic IIFE, so we rebuild them from source rather than copying.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..', '..', 'public', 'js', 'flux-grade-gps.js',
);

function extractMath() {
  const src = fs.readFileSync(SRC, 'utf8');
  const start = src.indexOf('function gradeToGpa');
  const end = src.indexOf('/* ── history recorder');
  assert.ok(start >= 0 && end > start, 'could not locate math block in flux-grade-gps.js');
  return new Function(`"use strict";${src.slice(start, end)}
    return { gradeToGpa, sparklineSvg, planBlocks };`)();
}

const { gradeToGpa, sparklineSvg, planBlocks } = extractMath();

test('gradeToGpa banding', () => {
  assert.equal(gradeToGpa(96), 4.0);
  assert.equal(gradeToGpa(93), 4.0);   // band edge inclusive
  assert.equal(gradeToGpa(92.4), 3.7);
  assert.equal(gradeToGpa(87), 3.3);
  assert.equal(gradeToGpa(70), 1.7);
  assert.equal(gradeToGpa(50), 0.0);
  assert.equal(gradeToGpa('nope'), null);
  assert.equal(gradeToGpa(null), null);
});

test('weighted GPA composes with the A1 level boost', () => {
  // The card computes gradeToGpa(score) + fluxCourseWeightBoost(level).
  // 92.4 in an AP class → 3.7 + 1.0 = 4.7 (asserted end-to-end in
  // e2e/grade-gps.spec.ts; here we pin the unweighted half).
  assert.equal(gradeToGpa(92.4) + 1.0, 4.7);
});

test('sparkline needs ≥2 points and tracks direction', () => {
  assert.equal(sparklineSvg([]), '');
  assert.equal(sparklineSvg([{ date: '2026-07-01', score: 90 }]), '');
  const up = sparklineSvg([
    { date: '2026-07-01', score: 88 },
    { date: '2026-07-06', score: 92 },
  ]);
  assert.match(up, /^<svg /);
  assert.match(up, /var\(--green\)/); // rising → green
  const down = sparklineSvg([
    { date: '2026-07-01', score: 92 },
    { date: '2026-07-06', score: 88 },
  ]);
  assert.match(down, /var\(--gold\)/); // falling → gold, never a panic red
  // Junk scores are filtered, not NaN-ed into the path
  const mixed = sparklineSvg([
    { date: '2026-07-01', score: 88 },
    { date: '2026-07-02', score: 'x' },
    { date: '2026-07-06', score: 92 },
  ]);
  assert.doesNotMatch(mixed, /NaN/);
});

test('planBlocks paces by category weight', () => {
  const open = ['2026-07-06', '2026-07-07', '2026-07-08', '2026-07-09'];
  // ≥20% → 3 blocks, ≥10% → 2, else 1 — taken from the LAST open days
  // (closest to the assessment), never all dumped on today.
  assert.equal(planBlocks('Unit test', '2026-07-10', 40, open).length, 3);
  assert.equal(planBlocks('Quiz', '2026-07-10', 15, open).length, 2);
  assert.equal(planBlocks('Homework check', '2026-07-10', 5, open).length, 1);
  const blocks = planBlocks('Quiz', '2026-07-10', 15, open);
  assert.deepEqual(blocks.map((b) => b.date), ['2026-07-08', '2026-07-09']);
  // Priority inherits calm defaults — never HIGH, never due today by fiat.
  assert.ok(blocks.every((b) => b.priority === 'med' && b.estTime === 45));
  assert.ok(blocks.every((b) => /Quiz/.test(b.name)));
});

test('planBlocks with no open days proposes nothing', () => {
  assert.deepEqual(planBlocks('Quiz', '2026-07-10', 15, []), []);
});
