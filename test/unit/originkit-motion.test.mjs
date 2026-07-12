/*
 * Unit test — OriginKit motion pure helpers.
 *
 * countUp's math (easeOutCubic), the "57+" target parser, and the formatter
 * are the deterministic core of the count-up primitive. Extraction pattern
 * (same as the other classic-IIFE modules): rebuild from source.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..', '..', 'public', 'js', 'flux-originkit-motion.js',
);

function extractHelpers() {
  const src = fs.readFileSync(SRC, 'utf8');
  const start = src.indexOf('function easeOutCubic');
  const end = src.indexOf('/* ── primitives ── */');
  assert.ok(start >= 0 && end > start, 'could not locate pure-helper block in flux-originkit-motion.js');
  return new Function(`"use strict";${src.slice(start, end)}
    return { easeOutCubic, parseTarget, formatCount };`)();
}

const { easeOutCubic, parseTarget, formatCount } = extractHelpers();

test('easeOutCubic endpoints and monotonic', () => {
  assert.equal(easeOutCubic(0), 0);
  assert.equal(easeOutCubic(1), 1);
  assert.ok(easeOutCubic(0.5) > 0.5); // eased toward the end early
  assert.ok(easeOutCubic(0.9) > easeOutCubic(0.4));
});

test('parseTarget splits number, suffix, prefix, decimals', () => {
  assert.deepEqual(parseTarget('57+'), { prefix: '', value: 57, suffix: '+', decimals: 0 });
  assert.deepEqual(parseTarget('4'), { prefix: '', value: 4, suffix: '', decimals: 0 });
  assert.deepEqual(parseTarget('11'), { prefix: '', value: 11, suffix: '', decimals: 0 });
  assert.deepEqual(parseTarget('$1,200'), { prefix: '$', value: 1200, suffix: '', decimals: 0 });
  assert.deepEqual(parseTarget('3.14'), { prefix: '', value: 3.14, suffix: '', decimals: 2 });
  assert.deepEqual(parseTarget('98%'), { prefix: '', value: 98, suffix: '%', decimals: 0 });
});

test('parseTarget on junk is inert (value 0)', () => {
  assert.equal(parseTarget('').value, 0);
  assert.equal(parseTarget('abc').value, 0);
  assert.equal(parseTarget(null).value, 0);
});

test('formatCount rounds integers, fixes decimals, keeps affixes', () => {
  assert.equal(formatCount(56.7, { suffix: '+' }), '57+');
  assert.equal(formatCount(3.14159, { decimals: 2 }), '3.14');
  assert.equal(formatCount(1200, { prefix: '$' }), '$1200');
  assert.equal(formatCount(4, {}), '4');
});

test('count-up frame at t maps target correctly (parse → ease → format round-trip)', () => {
  const meta = parseTarget('57+');
  // Final frame lands exactly on the parsed target with its suffix.
  assert.equal(formatCount(meta.value * easeOutCubic(1), meta), '57+');
  // Start frame is 0 with the suffix preserved.
  assert.equal(formatCount(meta.value * easeOutCubic(0), meta), '0+');
});
