#!/usr/bin/env node
/*
 * Guard: public/bundles/* must be in sync with public/js + public/css source.
 *
 * index.html loads 4 built bundles (flux-vendor/core/features JS + flux.css),
 * NOT the per-file public/js/*.js scripts or public/css/*.css stylesheets.
 * Editing public/js or public/css without rebuilding means the change never
 * ships. This check rebuilds the bundles and then asserts the working-tree
 * output matches what is staged/committed (`git diff` of public/bundles is
 * empty — covers every bundle, JS and CSS alike). Used by both CI and the
 * pre-commit hook.
 *
 * Exit 0 = bundles fresh. Exit 1 = stale (someone edited public/js or
 * public/css without running `npm run build:web`).
 */
import { execSync } from 'node:child_process';

function sh(cmd, opts = {}) {
  return execSync(cmd, { encoding: 'utf8', ...opts });
}

try {
  sh('node scripts/build-web-bundles.mjs', { stdio: 'inherit' });
} catch (e) {
  console.error('✖ bundle build failed — cannot verify freshness.');
  process.exit(1);
}

// Compare the freshly built working-tree outputs against the index (what is
// staged/committed). The build also rewrites index.html bundle refs and
// stamps BUILD into service-worker.js (B5.4), so those are part of the
// freshness contract. Non-empty diff ⇒ committed outputs do not match source.
const WATCH = ['public/bundles', 'index.html', 'service-worker.js'];
let stale = false;
let changed = '';
try {
  sh(`git diff --quiet -- ${WATCH.join(' ')}`);
} catch (e) {
  stale = true;
  try { changed = sh(`git diff --name-only -- ${WATCH.join(' ')}`).trim(); } catch (_) {}
}

if (stale) {
  console.error('\n✖ Bundles are STALE — public/js or public/css changes are not reflected in the built outputs.');
  console.error('  Fix:');
  console.error('    1. npm run build:web');
  console.error('    2. git add public/bundles/ index.html service-worker.js');
  console.error('  (STATIC/BUILD versioning is automatic now — never bump by hand.)');
  if (changed) console.error('  Out-of-date files:\n' + changed.split('\n').map((l) => '    ' + l).join('\n'));
  process.exit(1);
}

console.log('✓ Bundles are up to date with public/js + public/css source.');
