#!/usr/bin/env node
/**
 * Flux Planner — Capacitor build script
 * Copies all web assets into ./www so Capacitor can wrap them as a native app.
 *
 * Run:  npm run build
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEST = path.join(ROOT, 'www');

// Files at root
const FILES = [
  'index.html',
  'manifest.json',
  'service-worker.js',
  'favicon.ico',
];

// Whole directories
const DIRS = ['public', 'icons'];

// Things we never want copied into www
const SKIP_NAMES = new Set([
  '.DS_Store',
  '.git',
  'node_modules',
  'www',
  'ios',
  'android',
  'scripts',
]);

function rmrf(p) {
  if (!fs.existsSync(p)) return;
  if (fs.statSync(p).isDirectory()) {
    for (const item of fs.readdirSync(p)) rmrf(path.join(p, item));
    fs.rmdirSync(p);
  } else {
    fs.unlinkSync(p);
  }
}

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const item of fs.readdirSync(src)) {
    if (SKIP_NAMES.has(item)) continue;
    const s = path.join(src, item);
    const d = path.join(dest, item);
    if (fs.statSync(s).isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function patchIndexForNative(html) {
  // Inject Capacitor runtime + native flag right before </head>.
  // Capacitor injects capacitor.js automatically when running native, but referencing it
  // here lets us detect native mode early and short-circuit the service worker.
  if (html.includes('id="flux-native-shim"')) return html;
  const inject = `
  <script id="flux-native-shim">
    // Detect native shell (Capacitor injects window.Capacitor in the WebView)
    window.__FLUX_NATIVE__ = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
    // Don't register service worker inside native — Capacitor handles caching itself
    if (window.__FLUX_NATIVE__) {
      try { Object.defineProperty(navigator, 'serviceWorker', { value: undefined }); } catch (e) {}
    }
  </script>
`;
  return html.replace(/<\/head>/i, inject + '</head>');
}

console.log('▸ Flux build → www/');

// Wipe + rebuild www
rmrf(DEST);
fs.mkdirSync(DEST, { recursive: true });

// Copy root files
for (const f of FILES) {
  const src = path.join(ROOT, f);
  if (!fs.existsSync(src)) continue;
  const dest = path.join(DEST, f);
  if (f === 'index.html') {
    const html = fs.readFileSync(src, 'utf8');
    fs.writeFileSync(dest, patchIndexForNative(html));
  } else {
    fs.copyFileSync(src, dest);
  }
}

// Copy whole dirs
for (const d of DIRS) {
  const src = path.join(ROOT, d);
  if (!fs.existsSync(src)) continue;
  copyDir(src, path.join(DEST, d));
}

// Stamp the build for sanity
const buildId = new Date().toISOString();
fs.writeFileSync(path.join(DEST, 'build.txt'), buildId + '\n');

console.log(`✓ Built to ${path.relative(ROOT, DEST)}/  ·  ${buildId}`);
