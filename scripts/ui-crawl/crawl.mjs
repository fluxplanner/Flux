/**
 * Clicks every button in the planner, one at a time, and records what happened.
 *
 * Not part of CI — a sweep to run by hand after a big change. For each job in
 * a plan (a tab, a Settings page, a study tool…) it opens a fresh e2e session,
 * fills every field with a plausible value, then clicks each visible control
 * and logs: page errors, console errors, local 4xx/5xx, anything covering the
 * control, whether the click changed anything, and any "NaN" / "undefined" /
 * "[object Object]" that appears in the tool's text. Then it types into each
 * field on its own and checks the same things.
 *
 * External requests are aborted, so nothing reaches Supabase or any API.
 * Controls of one kind that repeat many times (118 elements, 35 calendar
 * days) are sampled, not all clicked.
 *
 *   npx serve -l 4395 .                                  # in another terminal
 *   node scripts/ui-crawl/plan.mjs .ui-crawl              # writes plans
 *   node scripts/ui-crawl/crawl.mjs .ui-crawl/plan-0.json .ui-crawl/out-0.jsonl
 *   node scripts/ui-crawl/crawl.mjs .ui-crawl/plan-mobile-0.json .ui-crawl/m-0.jsonl student-semester 390 844
 *   node scripts/ui-crawl/summarize.mjs .ui-crawl/*.jsonl
 *
 * Run several plan files in parallel to go faster. BASE overrides the server.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
const [planFile, outFile, scenario = 'student-semester', W = '1440', H = '900'] = process.argv.slice(2);
const BASE = process.env.BASE || 'http://localhost:4395';
const plan = JSON.parse(fs.readFileSync(planFile, 'utf8'));
const out = fs.createWriteStream(outFile, { flags: 'a' });
const log = (o) => out.write(JSON.stringify(o) + '\n');
const browser = await chromium.launch();

const FILL_FN = (f) => {
  const e = document.querySelector('[data-crawl-in="' + f.i + '"]'); if (!e) return 'gone';
  const set = (v) => { const proto = e.tagName === 'SELECT' ? HTMLSelectElement.prototype : e.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(e, v); };
  if (f.type === 'select') { if (e.options.length > 1) e.selectedIndex = (e.selectedIndex + 1) % e.options.length; }
  else if (f.type === 'range') { const mn = +e.min || 0, mx = e.max === '' ? 100 : +e.max; set(String(mn + (mx - mn) * 0.7)); }
  else if (f.type === 'number') set(e.min !== '' && +e.min > 3 ? e.min : '3');
  else if (f.type === 'date') set('2026-10-15');
  else if (f.type === 'time') set('09:30');
  else if (/search/.test(f.type) || /search|find|filter/i.test(f.ph)) set('a');
  else if (/formula|equation|compound|reaction|→|->/i.test(f.ph + f.id)) set('H2 + O2 -> H2O');
  else if (/codon|dna|rna|sequence|strand/i.test(f.ph + f.id)) set('ATGGCC');
  else if (/genotype|parent|cross|allele/i.test(f.ph + f.id)) set('Aa');
  else if (/\d/.test(e.placeholder || '') || /number|value|mass|amount|temp|time|speed|vel|acc|dist|freq|volt|curr|resist|^[a-z]{1,3}_?[a-z0-9]{0,3}$/i.test(f.ph + ' ' + f.id)) set('12');
  else set('Test');
  e.dispatchEvent(new Event('input', { bubbles: true }));
  e.dispatchEvent(new Event('change', { bubbles: true }));
  return 'ok';
};
const CANDIDATES = 'button, [role=button], [role=tab], [role=switch], [role=menuitem], [role=menuitemradio], [role=option], summary, a[href], input[type=checkbox], input[type=radio], [onclick], .chip, .pill';

async function boot(ctx) {
  const page = await ctx.newPage();
  page.__errs = [];
  page.__ext = [];
  page.__dialogs = [];
  page.on('pageerror', (e) => page.__errs.push('PAGEERROR: ' + (e.message || String(e)).slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error') page.__errs.push('CONSOLE: ' + m.text().slice(0, 300)); });
  page.on('response', (r) => { const u = r.url(); if (u.startsWith(BASE) && r.status() >= 400) page.__errs.push('HTTP ' + r.status() + ' ' + u.replace(BASE, '')); });
  page.on('dialog', async (d) => { page.__dialogs.push(d.type() + ': ' + d.message().slice(0, 120)); try { d.type() === 'prompt' ? await d.accept('Test 1') : await d.accept(); } catch (e) {} });
  page.on('filechooser', (fc) => { page.__dialogs.push('filechooser'); });
  await page.goto(`${BASE}/?e2e=1&scenario=${scenario}`);
  await page.waitForSelector('#app.visible', { timeout: 30000 });
  await page.waitForTimeout(1200);
  return page;
}

async function enter(page, steps) {
  for (const s of steps) {
    if (s.eval) await page.evaluate(s.eval);
    if (s.click) { const l = page.locator(s.click).first(); await l.waitFor({ state: 'visible', timeout: 8000 }); await l.click(); }
    await page.waitForTimeout(s.wait ?? 700);
  }
}

async function candidates(page, scope, exclude) {
  return page.evaluate(({ scope, CAND, exclude }) => {
    const root = document.querySelector(scope);
    if (!root) return null;
    const vis = (e) => { const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false; const s = getComputedStyle(e); return s.visibility !== 'hidden' && s.display !== 'none'; };
    const list = [...root.querySelectorAll(CAND)].filter((e) => vis(e) && !e.disabled && !(exclude && e.closest(exclude)) && !e.closest('[aria-hidden=true]'));
    // Keep only the outermost clickable (a chip inside a button is one control).
    const set = new Set(list);
    const outer = list.filter((e) => { let p = e.parentElement; while (p && p !== root) { if (set.has(p)) return false; p = p.parentElement; } return true; });
    return outer.map((e) => {
      const data = [...e.attributes].filter((a) => a.name.startsWith('data-') && a.name !== 'data-flux-icon').map((a) => a.name + '=' + a.value.slice(0, 30)).join(' ');
      const text = (e.getAttribute('aria-label') || e.textContent || e.value || '').trim().replace(/\s+/g, ' ').slice(0, 50);
      const cls = (typeof e.className === 'string' ? e.className : '').split(/\s+/).filter((c) => c && !/active|is-|open|selected|on$|hover|focus/.test(c)).sort().join('.');
      const family = e.tagName + '.' + cls;
      const tabby = e.getAttribute('role') === 'tab' || e.hasAttribute('aria-selected') || /(^|[\s-])(tab|tabs|stab|seg|snav|pill-item|tmode-btn|nav-item|fsh-unit|fsh-chem-tab|fsh-group|fsh-pill)([\s-]|$)/.test(typeof e.className === 'string' ? e.className : '');
      return { key: e.tagName + '#' + e.id + '.' + cls + '[' + data + ']' + text, family, text, id: e.id, tag: e.tagName.toLowerCase(), type: e.type || '', tabby };
    });
  }, { scope, CAND: CANDIDATES, exclude });
}

async function clickByKey(page, scope, key, exclude) {
  return page.evaluate(({ scope, key, CAND, exclude }) => {
    const root = document.querySelector(scope); if (!root) return 'no-scope';
    const vis = (e) => { const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false; const s = getComputedStyle(e); return s.visibility !== 'hidden' && s.display !== 'none'; };
    const list = [...root.querySelectorAll(CAND)].filter((e) => vis(e) && !e.disabled && !(exclude && e.closest(exclude)) && !e.closest('[aria-hidden=true]'));
    for (const e of list) {
      const data = [...e.attributes].filter((a) => a.name.startsWith('data-') && a.name !== 'data-flux-icon').map((a) => a.name + '=' + a.value.slice(0, 30)).join(' ');
      const text = (e.getAttribute('aria-label') || e.textContent || e.value || '').trim().replace(/\s+/g, ' ').slice(0, 50);
      const cls = (typeof e.className === 'string' ? e.className : '').split(/\s+/).filter((c) => c && !/active|is-|open|selected|on$|hover|focus/.test(c)).sort().join('.');
      if (e.tagName + '#' + e.id + '.' + cls + '[' + data + ']' + text !== key) continue;
      e.scrollIntoView({ block: 'center', inline: 'center' });
      const r = e.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const top = document.elementFromPoint(x, y);
      const covered = top && top !== e && !e.contains(top) && !top.contains(e) ? (top.id ? '#' + top.id : top.tagName.toLowerCase() + '.' + String(top.className).slice(0, 40)) : '';
      window.__mut = 0;
      if (!window.__mo) { window.__mo = new MutationObserver((ms) => { window.__mut += ms.length; }); window.__mo.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true }); }
      window.__beforeFocus = document.activeElement;
      window.__scopeSel = scope;
      window.__digest = () => { const sc = document.querySelector(window.__scopeSel); const ov = [...document.querySelectorAll('[role=dialog], .modal-overlay, .toast, .flux-toast, [class*=toast], [class*=popover], [class*=menu], [class*=sheet]')].filter((e) => e.offsetParent || getComputedStyle(e).position === 'fixed').map((e) => e.innerHTML).join('|'); const h = ((sc ? sc.innerHTML : '') + '§' + ov + '§' + ((document.querySelector('.panel.active') || {}).id || '')).replace(/\d+/g, '0').replace(/ style="[^"]*"/g, '').replace(/ class="[^"]*"/g, ''); let a = 0; for (let i = 0; i < h.length; i += 7) a = (a * 31 + h.charCodeAt(i)) | 0; const cls = [...document.querySelectorAll('[class]')].length; return a + ':' + h.length + ':' + cls; };
      window.__cls = () => { let a = 0; const sc = document.querySelector(window.__scopeSel); (sc ? sc.querySelectorAll('[class]') : []).forEach((e) => { if (/reveal|stagger|shimmer|anim|glow|pulse|tick/.test(e.getAttribute('class'))) return; const c = e.getAttribute('class'); for (let i = 0; i < c.length; i++) a = (a * 31 + c.charCodeAt(i)) | 0; }); return a; };
      window.__d0 = window.__digest(); window.__c0 = window.__cls(); window.__sy0 = scrollY; window.__cv0 = [...(document.querySelector(scope) || document).querySelectorAll('canvas')].map((c) => { try { return c.toDataURL().length; } catch (e) { return 0; } }).join(',');
      window.__val0 = [...document.querySelectorAll('input,select,textarea')].map((e) => e.type === 'checkbox' || e.type === 'radio' ? e.checked : e.value).join('|');
      return { x, y, covered };
    }
    return 'gone';
  }, { scope, key, CAND: CANDIDATES, exclude });
}


async function listFields(page, scope, exclude) {
  return page.evaluate(({ scope, exclude }) => {
    const root = document.querySelector(scope); if (!root) return [];
    return [...root.querySelectorAll('input:not([type=button]):not([type=submit]):not([type=checkbox]):not([type=radio]):not([type=color]):not([type=file]):not([type=hidden]), select, textarea')]
      .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2 && !e.disabled && !e.readOnly && !(exclude && e.closest(exclude)); })
      .slice(0, 40).map((e, i) => { e.setAttribute('data-crawl-in', String(i)); return { i, type: e.tagName === 'SELECT' ? 'select' : (e.type || 'text'), id: e.id, ph: (e.placeholder || e.getAttribute('aria-label') || '').slice(0, 40) }; });
  }, { scope, exclude }).catch(() => []);
}
const BAD_RE = /\bNaN\b|\bundefined\b|\[object Object\]|\bnull\b(?!\s*hypothesis)/g;
async function badCount(page, scope) {
  return page.evaluate(({ scope, src }) => { const r = document.querySelector(scope); if (!r) return 0; const m = (r.innerText || '').match(new RegExp(src, 'g')); return m ? m.length : 0; }, { scope, src: BAD_RE.source }).catch(() => 0);
}

async function cleanup(page) {
  for (const p of page.context().pages()) if (p !== page) { try { await p.close(); } catch (e) {} }
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(120);
  // Close anything modal that Escape left open.
  await page.evaluate(() => {
    const sels = ['.modal-overlay.open .modal-close', '.modal.open [data-close]', '[role=dialog] [aria-label="Close"]', '[role=dialog] .close', '.fx-sheet.open .close'];
    for (const s of sels) document.querySelectorAll(s).forEach((b) => { try { b.click(); } catch (e) {} });
  }).catch(() => {});
}

for (const job of plan) {
  const ctx = await browser.newContext({ viewport: { width: +W, height: +H }, acceptDownloads: true });
  await ctx.route(/^https?:\/\/(?!localhost)/, (r) => { r.abort(); });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE }).catch(() => {});
  let page;
  try { page = await boot(ctx); await enter(page, job.enter || []); }
  catch (e) { log({ job: job.name, fatal: 'enter failed: ' + e.message.slice(0, 200) }); await ctx.close(); continue; }
  const bootErrs = page.__errs.splice(0);
  if (bootErrs.length) log({ job: job.name, enterErrors: bootErrs });
  // Fill every field first, so a Solve/Convert button is pressed with real inputs.
  if (!job.noPrefill) {
    const pre = await listFields(page, job.scope, job.exclude);
    for (const f of pre) { if (f.type === 'search') continue; await page.evaluate(FILL_FN, f).catch(() => {}); }
    await page.waitForTimeout(250);
    const pe = page.__errs.splice(0).filter((e) => !/ERR_FAILED/.test(e));
    if (pe.length) log({ job: job.name, prefillErrors: pe });
  }
  const done = new Set();
  const famCount = {};
  let n = 0;
  const MAX = job.max || 220;
  while (n < MAX) {
    let list = await candidates(page, job.scope, job.exclude).catch(() => null);
    if (!list) {
      // Scope vanished (navigated away / signed out): rebuild the view.
      try { await page.close(); page = await boot(ctx); await enter(page, job.enter || []); list = await candidates(page, job.scope, job.exclude); } catch (e) { log({ job: job.name, fatal: 're-enter failed' }); break; }
      if (!list) { log({ job: job.name, fatal: 'scope missing after re-enter' }); break; }
    }
    if (!list.length && !job.__retried) { job.__retried = (job.__retried || 0) + 1; await page.waitForTimeout(1500); continue; }
    list.sort((a, b) => (a.tabby ? 1 : 0) - (b.tabby ? 1 : 0));
    const next = list.find((c) => {
      if (done.has(c.key)) return false;
      if ((famCount[c.family] || 0) >= (job.famCap || 6) && list.filter((d) => d.family === c.family).length > 12) { done.add(c.key); return false; }
      return true;
    });
    if (!next) break;
    done.add(next.key);
    famCount[next.family] = (famCount[next.family] || 0) + 1;
    n++;
    page.__errs.length = 0; page.__dialogs.length = 0;
    const url0 = page.url();
    const pages0 = ctx.pages().length;
    const extBefore = page.__extCount || 0;
    let reqs = 0; const onReq = (r) => { reqs++; if (!r.url().startsWith(BASE)) page.__ext.push(new URL(r.url()).host); };
    page.on('request', onReq);
    const bad0 = await badCount(page, job.scope);
    const pos = await clickByKey(page, job.scope, next.key, job.exclude).catch((e) => 'err ' + e.message.slice(0, 60));
    let res = { job: job.name, n, text: next.text, key: next.key.slice(0, 160) };
    if (typeof pos === 'string') { res.skip = pos; page.off('request', onReq); log(res); continue; }
    if (pos.covered) res.covered = pos.covered;
    const dl = page.waitForEvent('download', { timeout: 900 }).then((d) => d.suggestedFilename()).catch(() => null);
    try { await page.mouse.click(pos.x, pos.y); } catch (e) { res.clickError = e.message.slice(0, 120); }
    await page.waitForTimeout(job.settle || 550);
    const eff = await page.evaluate(() => ({ changed: window.__digest() !== window.__d0 || window.__cls() !== window.__c0 || scrollY !== window.__sy0 || [...(document.querySelector(window.__scopeSel) || document).querySelectorAll('canvas')].map((c) => { try { return c.toDataURL().length; } catch (e) { return 0; } }).join(',') !== window.__cv0 || [...document.querySelectorAll('input,select,textarea')].map((e) => e.type === 'checkbox' || e.type === 'radio' ? e.checked : e.value).join('|') !== window.__val0, mut: window.__mut || 0, focus: document.activeElement !== window.__beforeFocus, panel: (document.querySelector('.panel.active') || {}).id || '', modal: [...document.querySelectorAll('[role=dialog], .modal-overlay, .modal, .fx-modal, .flux-sheet, .fx-sheet')].filter((e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 40 && r.height > 40 && s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity > 0.1; }).map((e) => (e.id ? '#' + e.id : e.className.toString().slice(0, 30))).slice(0, 3) })).catch(() => ({ mut: -1 }));
    const file = await dl;
    page.off('request', onReq);
    Object.assign(res, { mut: eff.mut, focus: eff.focus, panel: eff.panel, modal: eff.modal && eff.modal.length ? eff.modal : undefined, reqs, download: file || undefined, dialogs: page.__dialogs.length ? page.__dialogs.slice() : undefined, popup: ctx.pages().length > pages0 || undefined, nav: page.url() !== url0 ? page.url().replace(BASE, '') : undefined });
    const ext = [...new Set(page.__ext.splice(0))];
    if (ext.length) res.external = ext;
    const errs = page.__errs.splice(0);
    if (errs.length) res.errors = errs;
    const bad1 = await badCount(page, job.scope);
    if (bad1 > bad0) res.badText = bad1 - bad0;
    res.dead = !(eff.changed || file || res.dialogs || res.popup || res.nav || (res.external && res.external.length)) || undefined;
    log(res);
    await cleanup(page);
    // If the click took us out of the view, go back in.
    const inView = await page.evaluate((sc) => !!document.querySelector(sc), job.scope).catch(() => false);
    const needPanel = job.panel ? await page.evaluate((id) => (document.querySelector('.panel.active') || {}).id === id, job.panel).catch(() => false) : true;
    if (!inView || !needPanel) { try { if (job.panel) { await page.evaluate((id) => window.nav(id), job.panel); await page.waitForTimeout(700); } if (job.reEnterSteps) await enter(page, job.reEnterSteps); } catch (e) {} }
  }
  // Inputs: type into every field and slider, and check the tool reacts without errors.
  let fields = 0;
  if (!job.noInputs) {
    const inputs = await listFields(page, job.scope, job.exclude);
    for (const f of inputs) {
      page.__errs.length = 0;
      const before = await page.evaluate((sc) => { const r = document.querySelector(sc); return r ? r.innerText.length + ':' + r.innerText.slice(0, 4000).replace(/\s+/g, ' ') : ''; }, job.scope).catch(() => '');
      const fb0 = await badCount(page, job.scope);
      const r = await page.evaluate(FILL_FN, f).catch((e) => 'err ' + e.message.slice(0, 80));
      await page.evaluate((i) => { const e = document.querySelector('[data-crawl-in="' + i + '"]'); if (e) e.dispatchEvent(new KeyboardEvent('keyup', { key: '2', bubbles: true })); }, f.i).catch(() => {});
      await page.waitForTimeout(350);
      if (f.type !== 'range' && f.type !== 'select' && f.type !== 'date' && f.type !== 'time') { await page.locator('[data-crawl-in="' + f.i + '"]').press('Enter').catch(() => {}); await page.waitForTimeout(300); }
      const after = await page.evaluate((sc) => { const r = document.querySelector(sc); return r ? r.innerText.length + ':' + r.innerText.slice(0, 4000).replace(/\s+/g, ' ') : ''; }, job.scope).catch(() => '');
      const errs = page.__errs.splice(0).filter((e) => !/ERR_FAILED/.test(e));
      fields++;
      const fb1 = await badCount(page, job.scope);
      log({ job: job.name, field: f.id || f.ph || f.type, type: f.type, result: r, reacted: before !== after, badText: fb1 > fb0 ? fb1 - fb0 : undefined, errors: errs.length ? errs : undefined });
      await cleanup(page);
    }
  }
  log({ job: job.name, clicked: n, fields, done: true });
  await ctx.close();
}
await browser.close();
out.end();
