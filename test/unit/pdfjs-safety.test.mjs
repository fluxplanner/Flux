import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

/**
 * pdf.js before 4.2.67 runs script hidden in a crafted PDF's font data when a
 * document is opened with the default isEvalSupported: true (CVE-2024-4367).
 * Flux loads 3.x builds, and students open PDFs other people made, so every
 * place that opens one has to switch that off.
 */
const dir = new URL('../../public/js/', import.meta.url);

test('every pdf.js getDocument() call opens the file with isEvalSupported: false', () => {
  const calls = [];
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.js'))) {
    const src = readFileSync(new URL(f, dir), 'utf8');
    src.split('\n').forEach((line, i) => {
      if (/\.getDocument\(/.test(line)) calls.push({ where: `${f}:${i + 1}`, line });
    });
  }
  assert.ok(calls.length > 0, 'no getDocument() calls found: the check would pass for nothing');
  const unsafe = calls.filter((c) => !/isEvalSupported\s*:\s*false/.test(c.line)).map((c) => c.where);
  assert.deepEqual(unsafe, []);
});
