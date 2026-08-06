/*
 * Unit test — course-identity parsing (A1 fix).
 *
 * cleanClassName used to strip AP/IB/Honors prefixes and trailing grade
 * digits, corrupting course identity (weighted GPA, transcript language,
 * AI context). The fix parses the level into a structured field and keeps
 * the full display name. These tests lock that in.
 *
 * Like study-math-parser.test.mjs, the functions live in a classic browser
 * script (public/js/app.js), so we extract the actual source block and
 * rebuild it via new Function — a copy would rot.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..', '..', 'public', 'js', 'app.js',
);

function extractCourseIdentityBlock() {
  const src = fs.readFileSync(SRC, 'utf8');
  const start = src.indexOf('const FLUX_CLASS_LEVEL_PREFIXES');
  const end = src.indexOf('window.parseClassLevel=', start);
  assert.ok(start >= 0 && end > start,
    'could not locate course-identity block in app.js — refactored?');
  const block = src.slice(start, end);
  return new Function(
    `"use strict";${block}
     return { parseClassLevel, cleanClassName, fluxClassMatchKey, fluxCourseWeightBoost };`,
  )();
}

const { parseClassLevel, cleanClassName, fluxClassMatchKey, fluxCourseWeightBoost } =
  extractCourseIdentityBlock();

// ── parseClassLevel: level extracted, FULL name preserved ──
test("parseClassLevel('AP Biology')", () => {
  const p = parseClassLevel('AP Biology');
  assert.equal(p.name, 'AP Biology');
  assert.equal(p.level, 'AP');
  assert.equal(p.baseName, 'Biology');
});

test("parseClassLevel('IB DP Chemistry HL')", () => {
  const p = parseClassLevel('IB DP Chemistry HL');
  assert.equal(p.name, 'IB DP Chemistry HL');
  assert.equal(p.level, 'IB DP HL');
  assert.equal(p.baseName, 'Chemistry');
});

test("parseClassLevel('Spanish 3') — trailing numeral that is part of the course name survives", () => {
  const p = parseClassLevel('Spanish 3');
  assert.equal(p.name, 'Spanish 3');
  assert.equal(p.level, '');
  assert.equal(p.baseName, 'Spanish 3');
});

test("parseClassLevel('Honors English 10')", () => {
  const p = parseClassLevel('Honors English 10');
  assert.equal(p.name, 'Honors English 10');
  assert.equal(p.level, 'Honors');
});

test("parseClassLevel('Biology SL') — bare IB tier suffix", () => {
  const p = parseClassLevel('Biology SL');
  assert.equal(p.name, 'Biology SL');
  assert.equal(p.level, 'IB SL');
  assert.equal(p.baseName, 'Biology');
});

test('parseClassLevel empty / junk input', () => {
  assert.equal(parseClassLevel('').level, '');
  assert.equal(parseClassLevel(null).name, '');
  // A lone level token keeps the raw string as baseName rather than emptying it
  assert.equal(parseClassLevel('AP').baseName, 'AP');
});

// ── cleanClassName: never strips again ──
test('cleanClassName preserves prefixes and grade digits', () => {
  assert.equal(cleanClassName('AP Biology'), 'AP Biology');
  assert.equal(cleanClassName('IB MYP Design 10'), 'IB MYP Design 10');
  assert.equal(cleanClassName('Spanish 3'), 'Spanish 3');
});

test('cleanClassName only normalizes whitespace', () => {
  assert.equal(cleanClassName('  Algebra   2  '), 'Algebra 2');
});

// ── fluxClassMatchKey: fuzzy matching still works without corrupting storage ──
test('match key equates leveled and bare course names', () => {
  assert.equal(fluxClassMatchKey('AP Biology'), fluxClassMatchKey('Biology'));
  assert.equal(fluxClassMatchKey('Honors English 10'), fluxClassMatchKey('English'));
});

// ── fluxCourseWeightBoost: level drives weighted GPA ──
test('course weight boost', () => {
  assert.equal(fluxCourseWeightBoost('AP'), 1.0);
  assert.equal(fluxCourseWeightBoost('IB DP HL'), 1.0);
  assert.equal(fluxCourseWeightBoost('Honors'), 0.5);
  assert.equal(fluxCourseWeightBoost(''), 0);
});
