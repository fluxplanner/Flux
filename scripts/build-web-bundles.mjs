#!/usr/bin/env node
/*
 * Build 4 web bundles from scripts/web-bundle-manifest.json:
 *   - flux-vendor.js   ESM module bundle of the 7 type=module scripts. The npm
 *                      deps @supabase/supabase-js and animejs are bundled in
 *                      (both pinned exact in package.json — nothing loads from a
 *                      CDN at runtime); flux-kit-bootstrap's
 *                      ./core|features|ui|utils tree is bundled in too.
 *   - flux-core.js     classic concat of the 27 defer scripts up to & incl.
 *                      app.js, minified.
 *   - flux-features.js classic concat of the remaining 164 defer scripts,
 *                      minified.
 *   - flux.css         literal concat of the 139 per-page <link> stylesheets
 *                      in exact cascade order, css-minified. esbuild never
 *                      reorders rules across selectors, so overrides are
 *                      preserved. (Google Fonts stays a separate <link>.)
 *
 * The classic bundles are LITERAL concatenation (join with "\n;\n" to kill
 * trailing line-comments + guard against ASI) then esbuild transform-minify.
 * No module wrapping, no bundling, no tree-shaking — global scope and load
 * order are preserved exactly, which the 191 global-coupled scripts require.
 * console.log/info/debug are dropped; console.warn/error kept for prod.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'bundles');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'web-bundle-manifest.json'), 'utf8'));

const PURE = ['console.log', 'console.info', 'console.debug'];

fs.mkdirSync(OUT, { recursive: true });

/* B5.4: bundles ship under content-hashed names (flux-core.<sha1-8>.js).
 * index.html references and the service worker's BUILD constant are rewritten
 * here on every build — the manual "bump STATIC in service-worker.js" ritual
 * is dead. Hashed names are immutable, so the SW can cache-first them. */
const hash8 = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 8);
function hashedName(base, code) {
  const i = base.lastIndexOf('.');
  return `${base.slice(0, i)}.${hash8(code)}${base.slice(i)}`;
}

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
  const out = hashedName(name, res.code);
  fs.writeFileSync(path.join(OUT, out), res.code);
  return { name, out, files: files.length, bytes: res.code.length };
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
    write: false,
  });
  fs.unlinkSync(entryPath);
  const code = res.outputFiles[0].text;
  const out = hashedName(name, code);
  fs.writeFileSync(path.join(OUT, out), code);
  return { name, out, files: files.length, bytes: code.length };
}

async function buildCss(name, files) {
  // Literal concatenation in manifest order (== the original <link> sequence in
  // index.html), then esbuild css-minify. esbuild never reorders rules across
  // selectors, so the cascade / override order is preserved exactly. Safe here
  // because none of the sources use @import, @charset, @layer, or relative
  // url() file refs (verified) — so concatenation can't corrupt the CSS.
  const parts = files.map((rel) => {
    const abs = path.join(ROOT, rel);
    return `/* ==== ${rel} ==== */\n${fs.readFileSync(abs, 'utf8')}`;
  });
  const res = await esbuild.transform(parts.join('\n'), {
    loader: 'css',
    minify: true,
    legalComments: 'none',
  });
  const out = hashedName(name, res.code);
  fs.writeFileSync(path.join(OUT, out), res.code);
  return { name, out, files: files.length, bytes: res.code.length };
}

const results = [];
results.push(await buildVendor('flux-vendor.js', manifest.vendor));
results.push(await buildClassic('flux-core.js', manifest.core));
results.push(await buildClassic('flux-features.js', manifest.features));
results.push(await buildCss('flux.css', manifest.css));

/* ── Post-build wiring (B5.4) ── */

// 1. Prune stale bundle outputs (older hashes) so git status stays exact.
const keep = new Set([...results.map((r) => r.out), 'precache-manifest.json']);
for (const f of fs.readdirSync(OUT)) {
  if (!keep.has(f) && /^flux(-\w+)?\.[0-9a-f]{8}\.(js|css)$/.test(f)) fs.unlinkSync(path.join(OUT, f));
  if (!keep.has(f) && /^flux(-\w+)?\.(js|css)$/.test(f)) fs.unlinkSync(path.join(OUT, f)); // pre-hash era outputs
}

// 2. Rewrite index.html bundle references to the hashed names.
const INDEX = path.join(ROOT, 'index.html');
let indexHtml = fs.readFileSync(INDEX, 'utf8');
for (const r of results) {
  // Bundle base names are plain [a-z-] (flux, flux-core, …) — no escaping needed.
  const base = r.name.replace(/\.(js|css)$/, '');
  const ext = r.name.endsWith('.css') ? 'css' : 'js';
  const re = new RegExp(`public/bundles/${base}(\\.[0-9a-f]{8})?\\.${ext}`, 'g');
  indexHtml = indexHtml.replace(re, `public/bundles/${r.out}`);
}
fs.writeFileSync(INDEX, indexHtml);

// 3. Precache manifest + BUILD stamp in the service worker (auto-versioned —
//    never bump STATIC by hand again).
const build = hash8(results.map((r) => r.out).join('|'));
fs.writeFileSync(
  path.join(OUT, 'precache-manifest.json'),
  JSON.stringify({ build, assets: results.map((r) => 'public/bundles/' + r.out) }, null, 2) + '\n',
);
const SW = path.join(ROOT, 'service-worker.js');
let sw = fs.readFileSync(SW, 'utf8');
const stamped = sw.replace(/const BUILD = '[^']*';/, `const BUILD = '${build}';`);
if (stamped === sw && !sw.includes(`const BUILD = '${build}';`)) {
  console.warn('  ! service-worker.js has no BUILD constant to stamp — SW versioning skipped');
} else {
  fs.writeFileSync(SW, stamped);
}

for (const r of results) {
  console.log(`  ${r.out.padEnd(30)} ${String(r.files).padStart(3)} files  ${(r.bytes / 1024).toFixed(0)} KB`);
}
console.log(`Bundles written to public/bundles/ (build ${build})`);
