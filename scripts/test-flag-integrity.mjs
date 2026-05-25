#!/usr/bin/env node
/**
 * Phase 37.2 — Feature flag registry integrity.
 *
 * Ensures flux_feature_flags keys in supabase/migrations match
 * public/js/flux-feature-flags.js defaults(), and that isEnabled()
 * call sites reference registered keys.
 *
 * Usage:
 *   node scripts/test-flag-integrity.mjs
 *
 * Exit 0 = OK, 1 = mismatch.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const CLIENT_PATH = path.join(ROOT, 'public/js/flux-feature-flags.js');
const MIGRATIONS_DIR = path.join(ROOT, 'supabase/migrations');
const JS_DIR = path.join(ROOT, 'public/js');

const FLAG_KEY_RE = /enable_[a-z0-9_]+/g;

/** Keys removed by PR-A; still appear in foundation migration INSERT. */
const RETIRED_KEYS = new Set([
  'enable_counselor_insights',
  'enable_cognitive_predictions',
]);

function readClientDefaults() {
  const src = fs.readFileSync(CLIENT_PATH, 'utf8');
  const match = src.match(/function defaults\(\)\s*\{\s*return\s*\{([\s\S]*?)\};\s*\}/);
  if (!match) throw new Error('Could not parse defaults() in flux-feature-flags.js');
  const body = match[1];
  const keys = new Set();
  for (const m of body.matchAll(/^\s*(enable_[a-z0-9_]+)\s*:/gm)) {
    keys.add(m[1]);
  }
  if (!keys.size) throw new Error('No enable_* keys found in flux-feature-flags.js defaults()');
  return keys;
}

function extractInsertKeys(sql) {
  const keys = new Set();
  if (!/flux_feature_flags/i.test(sql)) return keys;

  // ('enable_foo', ...) tuples
  for (const m of sql.matchAll(/\(\s*'(enable_[a-z0-9_]+)'/g)) {
    keys.add(m[1]);
  }
  // Multi-line VALUES ('enable_foo', ...)
  for (const m of sql.matchAll(/^\s*'(enable_[a-z0-9_]+)'/gm)) {
    if (sql.includes('flux_feature_flags')) keys.add(m[1]);
  }

  // UPDATE ... WHERE key IN ('a', 'b')
  const inBlock = sql.match(/WHERE key IN\s*\(([^)]+)\)/i);
  if (inBlock && /flux_feature_flags/i.test(sql)) {
    for (const m of inBlock[1].matchAll(/'(enable_[a-z0-9_]+)'/g)) {
      keys.add(m[1]);
    }
  }

  return keys;
}

function extractDeleteKeys(sql) {
  const keys = new Set();
  if (!/DELETE FROM public\.flux_feature_flags/i.test(sql)) return keys;
  const where = sql.match(/WHERE key IN\s*\(([^)]+)\)/i);
  if (!where) return keys;
  for (const m of where[1].matchAll(/'(enable_[a-z0-9_]+)'/g)) {
    keys.add(m[1]);
  }
  return keys;
}

function readMigrationRegistry() {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const keys = new Set();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    for (const k of extractInsertKeys(sql)) keys.add(k);
    for (const k of extractDeleteKeys(sql)) keys.delete(k);
  }
  for (const k of RETIRED_KEYS) keys.delete(k);
  return keys;
}

function readCodeReferences() {
  const refs = new Set();
  const files = fs.readdirSync(JS_DIR).filter((f) => f.endsWith('.js'));
  for (const file of files) {
    const src = fs.readFileSync(path.join(JS_DIR, file), 'utf8');
    for (const m of src.matchAll(/isEnabled\(\s*['"](enable_[a-z0-9_]+)['"]/g)) {
      refs.add(m[1]);
    }
    for (const m of src.matchAll(/const FLAG = ['"](enable_[a-z0-9_]+)['"]/g)) {
      refs.add(m[1]);
    }
  }
  return refs;
}

function diff(label, onlyInA, onlyInB) {
  if (!onlyInA.size && !onlyInB.size) return true;
  console.error(`\n✗ ${label}`);
  if (onlyInA.size) {
    console.error(`  Only in migrations/registry (${onlyInA.size}):`);
    for (const k of [...onlyInA].sort()) console.error(`    - ${k}`);
  }
  if (onlyInB.size) {
    console.error(`  Only in client defaults (${onlyInB.size}):`);
    for (const k of [...onlyInB].sort()) console.error(`    - ${k}`);
  }
  return false;
}

function main() {
  console.log('Flux feature flag integrity check\n');

  const client = readClientDefaults();
  const migrations = readMigrationRegistry();
  const codeRefs = readCodeReferences();

  console.log(`  Client defaults:     ${client.size} keys`);
  console.log(`  Migration registry:  ${migrations.size} keys`);
  console.log(`  Code references:     ${codeRefs.size} unique keys`);

  let ok = true;

  ok =
    diff(
      'Client defaults ↔ migration registry mismatch',
      new Set([...migrations].filter((k) => !client.has(k))),
      new Set([...client].filter((k) => !migrations.has(k))),
    ) && ok;

  const unregisteredRefs = [...codeRefs].filter(
    (k) => !client.has(k) && !RETIRED_KEYS.has(k),
  );
  if (unregisteredRefs.length) {
    ok = false;
    console.error('\n✗ isEnabled/FLAG references missing from flux-feature-flags.js defaults():');
    for (const k of unregisteredRefs.sort()) console.error(`    - ${k}`);
  }

  const orphanClient = [...client].filter(
    (k) => !codeRefs.has(k) && !isHardcodedOrGlobalOnly(k),
  );
  if (orphanClient.length) {
    console.warn('\n⚠ Registered in client defaults but no isEnabled/FLAG reference (informational):');
    for (const k of orphanClient.sort()) console.warn(`    - ${k}`);
  }

  if (ok) {
    console.log('\n✓ Feature flag registry is consistent.');
    process.exit(0);
  }
  console.error('\nFix mismatches before merging (see docs/P37-FLAG-AUDIT.md).');
  process.exit(1);
}

/** Flags promoted to core or resolved only via RPC/school overrides — may have no isEnabled call. */
function isHardcodedOrGlobalOnly(key) {
  const core = new Set([
    'enable_staff_google_hub',
    'enable_dashboard_widget_picker',
    'enable_site_enhancements_pack',
    'enable_staff_productivity_suite',
    'enable_classroom_tools',
    'enable_caseload_engine',
    'enable_personal_hub',
    'enable_staff_command_v2',
    'enable_locale_foundation',
    'enable_syllabus_conflict_check',
    'enable_e2e_harness',
    'enable_cognitive_ui',
    'enable_teacher_ai',
    'enable_cognitive_predictions',
    'enable_counselor_insights',
  ]);
  return core.has(key);
}

main();
