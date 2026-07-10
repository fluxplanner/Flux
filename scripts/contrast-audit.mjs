#!/usr/bin/env node
/*
 * B3 — WCAG AA contrast gate for theme tokens.
 *
 * Parses the THEMES palette object out of public/js/app.js (the canonical
 * per-theme token source; stylesheet blocks mirror it) and checks the
 * muted-on-surface pairs that carry real text:
 *
 *   --text   on --card ≥ 4.5   (body text)
 *   --muted2 on --card ≥ 4.5   (secondary text: chips, descriptions)
 *   --muted  on --card ≥ 3.0   (de-emphasized micro-labels, uppercase+bold)
 *   --text   on --bg   ≥ 4.5
 *
 * Exit 1 with a table of failures — wire into CI so a theme edit that
 * regresses readability fails the build instead of shipping.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = fs.readFileSync(path.join(ROOT, 'public', 'js', 'app.js'), 'utf8');

function extractThemes(src) {
  const start = src.indexOf('const THEMES={');
  if (start < 0) throw new Error('THEMES not found in app.js — moved?');
  let depth = 0, end = -1;
  for (let i = src.indexOf('{', start); i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) { end = i + 1; break; }
  }
  const block = src.slice(start, end);
  return new Function(`"use strict";${block};return THEMES;`)();
}

function hexToRgbArr(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}

function luminance([r, g, b]) {
  const f = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(fgHex, bgHex) {
  const l1 = luminance(hexToRgbArr(fgHex));
  const l2 = luminance(hexToRgbArr(bgHex));
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

const PAIRS = [
  { fg: '--text', bg: '--card', min: 4.5, label: 'body text on card' },
  { fg: '--muted2', bg: '--card', min: 4.5, label: 'secondary text on card' },
  { fg: '--muted', bg: '--card', min: 3.0, label: 'micro-labels on card' },
  { fg: '--text', bg: '--bg', min: 4.5, label: 'body text on page bg' },
];

const THEMES = extractThemes(APP);
const failures = [];
for (const [key, theme] of Object.entries(THEMES)) {
  const v = theme.vars || {};
  for (const p of PAIRS) {
    const fg = v[p.fg], bg = v[p.bg];
    if (!fg || !bg || !fg.startsWith('#') || !bg.startsWith('#')) continue;
    const ratio = contrast(fg, bg);
    if (ratio < p.min) {
      failures.push({ theme: key, pair: `${p.fg} on ${p.bg}`, label: p.label, fg, bg, ratio: ratio.toFixed(2), min: p.min });
    }
  }
}

if (failures.length) {
  console.error('✖ WCAG AA contrast failures in THEMES (app.js):\n');
  for (const f of failures) {
    console.error(`  [${f.theme}] ${f.pair} (${f.label}): ${f.fg} on ${f.bg} = ${f.ratio}:1 (needs ≥ ${f.min}:1)`);
  }
  console.error(`\n${failures.length} failing pair(s). Brighten the muted token or darken the surface.`);
  process.exit(1);
}
console.log(`✓ Contrast audit passed: ${Object.keys(THEMES).length} themes × ${PAIRS.length} pairs meet WCAG AA.`);
