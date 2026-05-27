/**
 * extension/build.mjs — esbuild-driven bundler.
 *
 * Usage:
 *   node extension/build.mjs --target=chrome     → dist/chrome
 *   node extension/build.mjs --target=firefox    → dist/firefox
 *   node extension/build.mjs --target=safari     → dist/safari
 *
 * Each build:
 *   • Copies the matching manifest.<target>.json → dist/<target>/manifest.json
 *   • esbuilds background.js, content.js, sidebar/sidebar.js, popup/popup.js
 *   • Copies sidebar/sidebar.html + .css, popup/popup.html, icons/
 *
 * Requires `esbuild` installed (already a devDependency of the root project, or
 * install with `npm i -D esbuild`).
 */
import { mkdir, copyFile, readFile, writeFile, rm, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, resolve, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = __dirname;
const distRoot = resolve(root, '../dist');

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const m = a.match(/^--([a-zA-Z0-9-]+)(?:=(.*))?$/);
  return m ? [m[1], m[2] === undefined ? true : m[2]] : [a, true];
}));
const target = (args.target || 'chrome').toLowerCase();
if (!['chrome', 'firefox', 'safari'].includes(target)) {
  console.error('Unknown --target. Use chrome | firefox | safari.');
  process.exit(1);
}

const outDir = join(distRoot, target);

async function rmrf(p) {
  try { await rm(p, { recursive: true, force: true }); } catch (_) {}
}
async function mkdirp(p) { await mkdir(p, { recursive: true }); }
async function copyTree(src, dst) {
  await mkdirp(dst);
  for (const entry of await readdir(src, { withFileTypes: true })) {
    const s = join(src, entry.name);
    const d = join(dst, entry.name);
    if (entry.isDirectory()) await copyTree(s, d);
    else await copyFile(s, d);
  }
}

await rmrf(outDir);
await mkdirp(outDir);

// 1. Manifest
await copyFile(resolve(root, `manifest.${target}.json`), join(outDir, 'manifest.json'));

// 2. Icons
if (existsSync(resolve(root, 'icons'))) await copyTree(resolve(root, 'icons'), join(outDir, 'icons'));

// 3. Sidebar assets
await mkdirp(join(outDir, 'sidebar'));
await copyFile(resolve(root, 'src/sidebar/sidebar.html'), join(outDir, 'sidebar/sidebar.html'));
await copyFile(resolve(root, 'src/sidebar/sidebar.css'), join(outDir, 'sidebar/sidebar.css'));

// 4. Popup assets
await mkdirp(join(outDir, 'popup'));
await copyFile(resolve(root, 'src/popup/popup.html'), join(outDir, 'popup/popup.html'));

// 5. esbuild JS bundles
let esbuild;
try {
  esbuild = await import('esbuild');
} catch (e) {
  console.error('esbuild not installed. Run: npm i -D esbuild');
  process.exit(1);
}

const common = {
  bundle: true,
  format: 'esm',
  target: ['es2020'],
  minify: false,
  sourcemap: false,
  define: { 'process.env.NODE_ENV': '"production"' },
};

const builds = [
  { entry: 'src/background.js', out: 'background.js' },
  { entry: 'src/content.js', out: 'content.js' },
  { entry: 'src/sidebar/sidebar.js', out: 'sidebar/sidebar.js' },
  { entry: 'src/popup/popup.js', out: 'popup/popup.js' },
];

for (const b of builds) {
  await esbuild.build({
    ...common,
    entryPoints: [resolve(root, b.entry)],
    outfile: join(outDir, b.out),
  });
}

// Firefox: background must be a classic script in MV3 (no service_worker module support yet);
// our build emits ESM. Manifest already uses scripts:[background.js]. For Firefox we wrap in IIFE.
// Easiest: rebuild background as iife for Firefox.
if (target === 'firefox') {
  await esbuild.build({
    ...common,
    entryPoints: [resolve(root, 'src/background.js')],
    outfile: join(outDir, 'background.js'),
    format: 'iife',
  });
}

console.log(`✓ Built extension/${target} → ${outDir}`);
