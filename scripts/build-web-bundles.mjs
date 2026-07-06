#!/usr/bin/env node
/*
 * Build 3 web bundles from scripts/web-bundle-manifest.json:
 *   - flux-vendor.js   ESM module bundle of the 6 type=module scripts
 *                      (animejs stays external, resolved by the importmap);
 *                      flux-kit-bootstrap's ./core|features|ui|utils tree is
 *                      bundled in.
 *   - flux-core.js     classic concat of the 27 defer scripts up to & incl.
 *                      app.js, minified.
 *   - flux-features.js classic concat of the remaining 164 defer scripts,
 *                      minified.
 *
 * The classic bundles are LITERAL concatenation (join with "\n;\n" to kill
 * trailing line-comments + guard against ASI) then esbuild transform-minify.
 * No module wrapping, no bundling, no tree-shaking — global scope and load
 * order are preserved exactly, which the 191 global-coupled scripts require.
 * console.log/info/debug are dropped; console.warn/error kept for prod.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'bundles');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'web-bundle-manifest.json'), 'utf8'));

const PURE = ['console.log', 'console.info', 'console.debug'];

fs.mkdirSync(OUT, { recursive: true });

async function buildClassic(name, files) {
  const parts = files.map((rel) => {
    const abs = path.join(ROOT, rel);
    return `/* ==== ${rel} ==== */\n${fs.readFileSync(abs, 'utf8')}`;
  });
  const concatenated = parts.join('\n;\n');
  const res = await esbuild.transform(concatenated, {
    minify: true,
    pure: PURE,
    legalComments: 'none',
    // No `format` — keep top-level global scope untouched.
  });
  const outFile = path.join(OUT, name);
  fs.writeFileSync(outFile, res.code);
  return { name, files: files.length, bytes: res.code.length };
}

async function buildVendor(name, files) {
  // Synthetic entry that imports each module in original order.
  const entry = files.map((f) => `import ${JSON.stringify(path.join(ROOT, f))};`).join('\n');
  const entryPath = path.join(OUT, '.vendor-entry.mjs');
  fs.writeFileSync(entryPath, entry);
  const res = await esbuild.build({
    entryPoints: [entryPath],
    bundle: true,
    format: 'esm',
    minify: true,
    pure: PURE,
    legalComments: 'none',
    external: ['animejs'], // resolved at runtime via the importmap
    write: false,
  });
  fs.unlinkSync(entryPath);
  const code = res.outputFiles[0].text;
  const outFile = path.join(OUT, name);
  fs.writeFileSync(outFile, code);
  return { name, files: files.length, bytes: code.length };
}

const results = [];
results.push(await buildVendor('flux-vendor.js', manifest.vendor));
results.push(await buildClassic('flux-core.js', manifest.core));
results.push(await buildClassic('flux-features.js', manifest.features));

for (const r of results) {
  console.log(`  ${r.name.padEnd(20)} ${String(r.files).padStart(3)} files  ${(r.bytes / 1024).toFixed(0)} KB`);
}
console.log('Bundles written to public/bundles/');
