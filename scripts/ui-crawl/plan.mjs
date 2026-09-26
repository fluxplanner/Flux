/**
 * Writes crawl plans for scripts/ui-crawl/crawl.mjs: every planner tab, each
 * Settings page, Time mode and College Prep section, the top bar and sidebar,
 * and every study tool (found by walking subject → unit → tool in a live
 * session, so a new tool is picked up without editing this file).
 *
 *   node scripts/ui-crawl/plan.mjs <out-dir> [parallel=5]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const [outDir = '.ui-crawl', parallel = '5'] = process.argv.slice(2);
const BASE = process.env.BASE || 'http://localhost:4395';
fs.mkdirSync(outDir, { recursive: true });

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
const p = await ctx.newPage();
await p.goto(`${BASE}/?e2e=1&scenario=student-semester`);
await p.waitForSelector('#app.visible', { timeout: 30000 });
await p.waitForTimeout(1000);
await p.evaluate(() => window.nav('toolbox'));
await p.waitForTimeout(900);

const tools = [];
const groups = await p.$$eval('#fshGroups .fsh-group', (els) => els.map((e) => e.dataset.group));
const subs = [];
for (const g of groups) {
  await p.locator(`#fshGroups .fsh-group[data-group="${g}"]`).click();
  await p.waitForTimeout(600);
  const got = await p.$$eval('#fshRail .fsh-pill', (els) => els.filter((e) => e.offsetParent).map((e) => ({ sub: e.dataset.sub, name: e.textContent.trim().replace(/\s+/g, ' ') })));
  for (const s of got) if (!subs.some((x) => x.sub === s.sub)) subs.push(s);
}
for (const s of subs) {
  await p.evaluate((id) => window.fluxStudyHub.selectSubject(id), s.sub);
  await p.waitForTimeout(700);
  const units = await p.$$eval('#fshUnits .fsh-unit[data-unit]', (els) => els.map((e) => ({ unit: e.dataset.unit, name: e.textContent.trim().replace(/\s+\d+$/, '') })));
  for (const u of units.length ? units : [{ unit: null, name: '-' }]) {
    if (u.unit) { await p.locator(`#fshUnits .fsh-unit[data-unit="${u.unit}"]`).click(); await p.waitForTimeout(500); }
    const ts = await p.$$eval('#fshChemTabs .fsh-chem-tab', (els) => els.map((e) => ({ attr: e.dataset.tool ? 'data-tool' : 'data-tab', id: e.dataset.tool || e.dataset.tab, name: e.textContent.trim().replace(/\s+/g, ' ') })));
    for (const t of ts) tools.push({ ...t, sub: s.sub, subName: s.name.replace(/^\W+/, ''), unit: u.unit, unitName: u.name });
  }
}
await b.close();

const job = (name, panel, extra, exclude) => ({
  name, panel, scope: `#${panel}.panel`, exclude: exclude || null, max: 300, famCap: 6,
  enter: [{ eval: `window.nav('${panel}')`, wait: 1200 }, ...(extra ? [{ click: extra, wait: 1000 }] : [])],
  reEnterSteps: extra ? [{ click: extra, wait: 900 }] : [],
});
const jobs = [];
for (const [k, label] of [['theme', 'Theme'], ['text', 'Text'], ['appearance', 'Layout'], ['account', 'Account'], ['data', 'Your data'], ['help', 'Help'], ['about', 'About']]) {
  jobs.push(job(`settings/${label}`, 'settings', `#settings button.stab[onclick*="'${k}'"]`, 'button.stab'));
}
for (const v of ['focus', 'clock', 'stopwatch', 'countdown', 'alarms']) jobs.push(job(`time/${v}`, 'timer', `#timer [data-ftt-view=${v}]`, '[data-ftt-view]'));
for (const k of ['activities', 'colleges', 'scores']) jobs.push(job(`collegeprep/${k}`, 'goals', `#goals button.stab[onclick*="'${k}'"]`, 'button.stab'));
for (const t of ['dashboard', 'calendar', 'school', 'canvas', 'profile', 'mood']) jobs.push(job(`panel/${t}`, t));
jobs.push({ name: 'chrome/topbar', enter: [], scope: 'div.topbar', max: 80 });
jobs.push({ name: 'chrome/sidebar', enter: [], scope: '#sidebar', max: 80 });
for (const t of tools) {
  const steps = [{ eval: `window.fluxStudyHub.selectSubject(${JSON.stringify(t.sub)})`, wait: 1000 }];
  if (t.unit) steps.push({ click: `#fshUnits .fsh-unit[data-unit="${t.unit}"]`, wait: 700 });
  steps.push({ click: `#fshChemTabs .fsh-chem-tab[${t.attr}="${t.id}"]`, wait: 1400 });
  jobs.push({ name: `study/${t.subName}/${t.unitName}/${t.name}`, panel: 'toolbox', scope: '#fshStage', exclude: '#fshUnits, .fsh-tabs-wrap', max: 160, famCap: 5,
    enter: [{ eval: "window.nav('toolbox')", wait: 1000 }, ...steps], reEnterSteps: steps });
}

const n = Math.max(1, +parallel);
for (let i = 0; i < n; i++) fs.writeFileSync(path.join(outDir, `plan-${i}.json`), JSON.stringify(jobs.filter((_, j) => j % n === i)));
// Phones: every tab, plus the first tool of each subject and the bottom bar.
const seen = new Set();
const mobile = jobs.filter((j) => j.name !== 'chrome/sidebar' && (!j.name.startsWith('study/') || (!seen.has(j.name.split('/')[1]) && seen.add(j.name.split('/')[1]))));
mobile.push({ name: 'mobile/bottom-nav', enter: [], scope: '.bottom-nav', max: 20 });
for (let i = 0; i < 2; i++) fs.writeFileSync(path.join(outDir, `plan-mobile-${i}.json`), JSON.stringify(mobile.filter((_, j) => j % 2 === i)));
console.log(`${jobs.length} jobs (${tools.length} study tools in ${subs.length} subjects), ${mobile.length} on phone → ${outDir}`);
