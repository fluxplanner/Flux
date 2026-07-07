#!/usr/bin/env node
/*
 * Guard: public/bundles/* must be in sync with public/js source.
 *
 * index.html loads 3 built bundles (flux-vendor/core/features), NOT the
 * per-file public/js/*.js scripts. Editing public/js without rebuilding
 * means the change never ships. This check rebuilds the bundles and then
 * asserts the working-tree output matches what is staged/committed
 * (`git diff` of public/bundles is empty). Used by both CI and the
 * pre-commit hook.
 *
 * Exit 0 = bundles fresh. Exit 1 = stale (someone edited public/js without
 * running `npm run build:web`).
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

// Compare the freshly built working-tree bundles against the index (what is
// staged/committed). Non-empty diff ⇒ committed bundles do not match source.
let stale = false;
let changed = '';
try {
  sh('git diff --quiet -- public/bundles');
} catch (e) {
  stale = true;
  try { changed = sh('git diff --name-only -- public/bundles').trim(); } catch (_) {}
}

if (stale) {
  console.error('\n✖ Bundles are STALE — public/js changes are not reflected in public/bundles/.');
  console.error('  Fix:');
  console.error('    1. npm run build:web');
  console.error('    2. git add public/bundles/');
  console.error('    3. bump the STATIC version in service-worker.js');
  if (changed) console.error('  Out-of-date bundle files:\n' + changed.split('\n').map((l) => '    ' + l).join('\n'));
  process.exit(1);
}

console.log('✓ Bundles are up to date with public/js source.');
