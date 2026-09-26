/**
 * Reads crawl.mjs output and lists what needs a human look: errors first,
 * then "NaN"/"undefined" in a tool's text, controls something else covers,
 * controls that changed nothing, and fields nothing reacted to. The last
 * three have false positives (a toggle already on, a field waiting for its
 * Solve button), so treat them as leads, not failures.
 *
 *   node scripts/ui-crawl/summarize.mjs .ui-crawl/*.jsonl
 */
import fs from 'node:fs';

const errs = new Map(); const bad = []; const covered = []; const dead = []; const quiet = []; const fatal = []; const empty = [];
let clicks = 0; let fields = 0; const jobs = new Set();
for (const f of process.argv.slice(2)) {
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const o = JSON.parse(line);
    if (o.fatal) fatal.push(`${o.job}: ${o.fatal}`);
    if (o.done && !o.clicked && !o.fields) empty.push(o.job);
    const add = (e, where) => { if (/ERR_FAILED/.test(e)) return; const k = e.slice(0, 220); if (!errs.has(k)) errs.set(k, []); errs.get(k).push(where); };
    if ('field' in o) {
      fields++;
      (o.errors || []).forEach((e) => add(e, `${o.job} :: field ${o.field}`));
      if (o.badText) bad.push(`${o.job} :: field ${o.field}`);
      if (!o.reacted) quiet.push(`${o.job} :: ${o.field} (${o.type})`);
      continue;
    }
    if (!('n' in o)) continue;
    clicks++; jobs.add(o.job);
    (o.errors || []).forEach((e) => add(e, `${o.job} :: ${o.text}`));
    if (o.badText) bad.push(`${o.job} :: ${o.text}`);
    if (o.covered) covered.push(`${o.job} :: ${o.text} ← ${o.covered}`);
    if (o.dead) dead.push(`${o.job} :: ${o.text}`);
  }
}
const list = (title, arr) => { console.log(`\n== ${title} (${arr.length}) ==`); arr.forEach((x) => console.log('  ' + x)); };
console.log(`${clicks} clicks, ${fields} fields, ${jobs.size} views`);
list('could not open', fatal);
console.log(`\n== errors (${errs.size}) ==`);
[...errs].sort((a, b) => b[1].length - a[1].length).forEach(([e, w]) => console.log(`  ${w.length}× ${e}\n     e.g. ${w.slice(0, 3).join(' | ')}`));
list('NaN / undefined shown', bad);
list('covered by something else', covered);
list('changed nothing', dead);
list('no controls at all (reference pages?)', empty);
list('fields nothing reacted to', quiet);
