#!/usr/bin/env node
/**
 * Builds the Flux change log from git history.
 *
 *   node scripts/build-changelog.mjs      (or: npm run changelog)
 *
 * Writes two things:
 *   CHANGELOG.md               — for humans reading the repo
 *   public/data/changelog.json — for the in-app "What's changed" view
 *
 * Most of this project's early history was written through the GitHub web
 * editor, which auto-names commits "Update app.js" / "Add files via upload".
 * Those say nothing about what changed, so they are filtered out — otherwise
 * the log is hundreds of lines of "Update app.js" and the real work is
 * invisible. Everything with a descriptive subject is kept, back to the very
 * first commit.
 */

import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Unit/record separators — cannot occur inside a commit subject.
const FIELD = '';
const RECORD = '';

function gitLog() {
  const out = execFileSync(
    'git',
    ['log', '--no-merges', `--format=%h${FIELD}%ad${FIELD}%s${RECORD}`, '--date=short'],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  return out
    .split(RECORD)
    .map((r) => r.replace(/^\s+/, ''))
    .filter(Boolean)
    .map((r) => {
      const [hash, date, subject] = r.split(FIELD);
      return { hash, date, subject: (subject || '').trim() };
    })
    .filter((c) => c.hash && c.date);
}

/** Auto-generated subjects from the GitHub web editor, and other pure noise. */
const NOISE = [
  /^(update|delete|create|rename|upload)\b/i,
  /^add files via upload$/i,
  /^merge\b/i,
  /^wip\b/i,
  /^\.+$/,
  /^(test|testing|temp|tmp|asdf|x)$/i,
  /^initial commit$/i,
  // A bare path with no sentence around it ("Icons/icon-512.png") is a file
  // upload, not a description of a change.
  /^[\w./-]+\.(png|jpe?g|svg|ico|gif|webp|json|md|txt|css|js|ts|html)$/i,
];

const isNoise = (s) => !s || s.length < 12 || NOISE.some((re) => re.test(s));

/** Conventional prefix when present, otherwise infer from the wording. */
const TYPE_RULES = [
  [/^feat(\(|:)/i, 'Added'],
  [/^fix(\(|:)/i, 'Fixed'],
  [/^perf(\(|:)/i, 'Performance'],
  [/^(a11y|access)(\(|:)/i, 'Accessibility'],
  [/^(docs?|chore|build|ci|style|refactor|test)(\(|:)/i, 'Housekeeping'],
  [/\b(add|added|introduce|new|support|implement)\b/i, 'Added'],
  [/\b(fix|fixed|fixes|repair|resolve|correct|broken|bug)\b/i, 'Fixed'],
  [/\b(perf|performance|faster|speed|lag|jank|optimi[sz]e)\b/i, 'Performance'],
  [/\b(a11y|accessib|keyboard|screen reader|contrast)\b/i, 'Accessibility'],
  [/\b(remove|removed|delete|drop|retire)\b/i, 'Removed'],
];

function classify(subject) {
  for (const [re, type] of TYPE_RULES) if (re.test(subject)) return type;
  return 'Changed';
}

/** Strip the conventional prefix and sentence-case what's left. */
function clean(subject) {
  const s = subject.replace(/^[a-z]+(\([^)]*\))?:\s*/i, '').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const SECTION_ORDER = ['Added', 'Fixed', 'Performance', 'Accessibility', 'Removed', 'Changed', 'Housekeeping'];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function monthLabel(ym) {
  const [y, m] = ym.split('-');
  return `${MONTHS[Number(m) - 1]} ${y}`;
}

function main() {
  const all = gitLog();
  const kept = all
    .filter((c) => !isNoise(c.subject))
    .map((c) => ({ ...c, type: classify(c.subject), title: clean(c.subject) }));

  // Group by month, newest first (git log is already newest-first).
  const byMonth = new Map();
  for (const c of kept) {
    const ym = c.date.slice(0, 7);
    if (!byMonth.has(ym)) byMonth.set(ym, []);
    byMonth.get(ym).push(c);
  }

  const first = all.length ? all[all.length - 1].date : '—';
  const today = new Date().toISOString().slice(0, 10);

  const lines = [
    '# Flux Planner — change log',
    '',
    `Every substantive change, newest first. Generated from git history on ${today}.`,
    '',
    `**${kept.length} changes** recorded, from ${first} to ${today}.`,
    '',
    `Regenerate with \`npm run changelog\`. ${all.length - kept.length} commits are omitted:`,
    'they were made through the GitHub web editor, which names them "Update app.js"',
    'and similar, so they carry no description of what actually changed.',
    '',
  ];

  for (const [ym, commits] of byMonth) {
    lines.push(`## ${monthLabel(ym)}`, '');
    const bySection = new Map();
    for (const c of commits) {
      if (!bySection.has(c.type)) bySection.set(c.type, []);
      bySection.get(c.type).push(c);
    }
    for (const section of SECTION_ORDER) {
      const items = bySection.get(section);
      if (!items || !items.length) continue;
      lines.push(`### ${section}`, '');
      for (const c of items) lines.push(`- ${c.title} — \`${c.date}\` (${c.hash})`);
      lines.push('');
    }
  }

  writeFileSync(join(ROOT, 'CHANGELOG.md'), lines.join('\n'), 'utf8');

  mkdirSync(join(ROOT, 'public', 'data'), { recursive: true });
  writeFileSync(
    join(ROOT, 'public', 'data', 'changelog.json'),
    JSON.stringify(
      {
        generated: today,
        firstCommit: first,
        total: kept.length,
        omitted: all.length - kept.length,
        entries: kept.map(({ date, type, title, hash }) => ({ date, type, title, hash })),
      },
      null,
      2,
    ),
    'utf8',
  );

  const counts = SECTION_ORDER
    .map((s) => [s, kept.filter((c) => c.type === s).length])
    .filter(([, n]) => n);
  console.log(`changelog: ${kept.length} entries across ${byMonth.size} months (${all.length - kept.length} noise commits skipped)`);
  for (const [s, n] of counts) console.log(`  ${String(n).padStart(4)}  ${s}`);
}

main();
