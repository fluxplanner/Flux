/**
 * C1 — FluxNow: bell-aware "now" engine (canonical owner for school-time).
 * Flag: enable_now_engine (default off).
 *
 * One module answers "where are we in the school day?" for every surface:
 * the glanceable strip (top bar area), the AI planner context line, and the
 * next-class pill (which defers to this module when the flag is on).
 *
 * Source of truth: the user's classes (period/periodLabel/days/timeStart/
 * timeEnd/room from flux_classes) + the cycle-day engine
 * (getCycleDayLabel) + REST_DAYS_KEY rest days (isBreak/restDayKind).
 * C2's district bell-schedule variants plug in through resolveLive.
 *
 * States: before | period | passing | after | weekend | holiday | untimed |
 * none — each with ONE calm sentence. Never a countdown-panic tone.
 */
(function () {
  'use strict';
  if (window.FluxNow) return;

  const FLAG = 'enable_now_engine';

  function enabled() {
    try { return !!window.FluxFeatureFlags?.isEnabled(FLAG, false); } catch (_) { return false; }
  }

  /* ── pure helpers (unit-tested via source extraction) ── */

  function hmToMin(hm) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(hm || '').trim());
    if (!m) return null;
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  }

  function minToLabel(mins) {
    if (mins >= 90) return Math.round(mins / 60 * 10) / 10 + ' h';
    return mins + ' min';
  }

  /** Classes that meet on a given cycle label ('' = no cycle info). */
  function classesForDay(classes, cycleLabel) {
    return (classes || []).filter((c) => {
      if (!c || !c.name) return false;
      const d = String(c.days || '');
      if (!d || d === 'Mon-Fri' || d.includes('Mon-Fri')) return true;
      if (cycleLabel && d.includes(cycleLabel + ' Day')) return true;
      if (!cycleLabel && (d.includes('A Day') || d.includes('B Day'))) return false;
      return !d.includes('A Day') && !d.includes('B Day');
    });
  }

  /**
   * Pure resolver. ctx:
   *   now        Date
   *   classes    planner class rows
   *   cycleLabel '' | 'A' | 'B' | …   (for now's date)
   *   isRest     boolean              (REST_DAYS_KEY holiday/sick/lazy)
   *   isEducator boolean              (phrasing: "You teach …")
   * Returns { state, sentence, cls?, next?, minutesLeft?, minutesUntil? }.
   */
  function resolveNow(ctx) {
    const now = ctx.now instanceof Date ? ctx.now : new Date();
    const dow = now.getDay();
    if (dow === 0 || dow === 6) {
      return { state: 'weekend', sentence: 'Weekend — no bells today.' };
    }
    if (ctx.isRest) {
      return { state: 'holiday', sentence: 'No school today — rest up.' };
    }
    const todays = classesForDay(ctx.classes, ctx.cycleLabel || '')
      .map((c) => ({ c, start: hmToMin(c.timeStart), end: hmToMin(c.timeEnd) }))
      .filter((x) => x.start != null)
      .map((x) => ({ ...x, end: x.end != null && x.end > x.start ? x.end : x.start + 50 }))
      .sort((a, b) => a.start - b.start);

    if (!todays.length) {
      const count = classesForDay(ctx.classes, ctx.cycleLabel || '').length;
      if (!count) return { state: 'none', sentence: '' };
      return {
        state: 'untimed',
        sentence: (ctx.cycleLabel ? ctx.cycleLabel + ' day — ' : '') + count + ' class' + (count === 1 ? '' : 'es') + ' today.',
      };
    }

    const mins = now.getHours() * 60 + now.getMinutes();
    const verb = ctx.isEducator ? 'You teach' : 'You have';

    if (mins < todays[0].start) {
      const first = todays[0];
      return {
        state: 'before',
        next: first.c,
        minutesUntil: first.start - mins,
        sentence: `${verb} ${first.c.name}${first.c.room ? ' in Rm ' + first.c.room : ''} in ${minToLabel(first.start - mins)}.`,
      };
    }

    for (let i = 0; i < todays.length; i++) {
      const p = todays[i];
      if (mins >= p.start && mins < p.end) {
        const left = p.end - mins;
        return {
          state: 'period',
          cls: p.c,
          minutesLeft: left,
          next: todays[i + 1] ? todays[i + 1].c : null,
          sentence: `${p.c.name}${p.c.room ? ' · Rm ' + p.c.room : ''} — ${minToLabel(left)} left.`,
        };
      }
      const nxt = todays[i + 1];
      if (nxt && mins >= p.end && mins < nxt.start) {
        return {
          state: 'passing',
          next: nxt.c,
          minutesUntil: nxt.start - mins,
          sentence: `${verb} ${nxt.c.name}${nxt.c.room ? ' in Rm ' + nxt.c.room : ''} in ${minToLabel(nxt.start - mins)}.`,
        };
      }
    }

    return { state: 'after', sentence: 'School day is done — plan on your own time.' };
  }

  /* ── app-context resolver ── */

  function resolveLive(now) {
    const d = now || new Date();
    const dateStr = (typeof fluxLocalYMD === 'function')
      ? fluxLocalYMD(d)
      : d.toISOString().slice(0, 10);
    let cycleLabel = '';
    try { if (typeof getCycleDayLabel === 'function') cycleLabel = getCycleDayLabel(dateStr) || ''; } catch (_) {}
    // C2 hook: a published district variant/closure overrides the local view.
    try {
      if (window.FluxSchoolSchedules?.enabled?.()) {
        const ov = window.FluxSchoolSchedules.todayOverride(dateStr);
        if (ov && ov.closed) return { state: 'holiday', sentence: ov.note || 'School is closed today.' };
      }
    } catch (_) {}
    let isRest = false;
    try { isRest = typeof isBreak === 'function' && isBreak(dateStr); } catch (_) {}
    let isEducator = false;
    try { isEducator = !!(window.FluxRole?.isEducator?.()); } catch (_) {}
    const cls = (typeof classes !== 'undefined' && Array.isArray(classes)) ? classes : [];
    return resolveNow({ now: d, classes: cls, cycleLabel, isRest, isEducator });
  }

  /* ── strip UI ── */

  let _timer = null;

  function ensureStrip() {
    let el = document.getElementById('fluxNowStrip');
    if (el) return el;
    const topbar = document.querySelector('.topbar');
    if (!topbar || !topbar.parentNode) return null;
    el = document.createElement('button');
    el.id = 'fluxNowStrip';
    el.type = 'button';
    el.className = 'flux-now-strip';
    el.setAttribute('aria-live', 'off');
    el.title = "Open today's timeline";
    el.addEventListener('click', () => {
      try { window.FluxTelemetry?.track?.('now_strip_opened', {}); } catch (_) {}
      try { nav('calendar'); } catch (_) {}
    });
    topbar.parentNode.insertBefore(el, topbar.nextSibling);
    return el;
  }

  function renderStrip() {
    if (!enabled()) { stop(); return; }
    const el = ensureStrip();
    if (!el) return;
    const r = resolveLive();
    if (!r.sentence) { el.style.display = 'none'; return; }
    el.style.display = '';
    el.dataset.state = r.state;
    el.textContent = r.sentence;
  }

  function start() {
    if (!enabled()) return;
    renderStrip();
    if (_timer) return;
    _timer = setInterval(() => {
      if (document.hidden) return;
      renderStrip();
    }, 30000);
  }

  function stop() {
    if (_timer) { clearInterval(_timer); _timer = null; }
    const el = document.getElementById('fluxNowStrip');
    if (el) el.style.display = 'none';
  }

  /** One line for the AI planner context ('' when off/idle). */
  function aiContext() {
    if (!enabled()) return '';
    const r = resolveLive();
    return r.sentence ? `School time right now: ${r.sentence}` : '';
  }

  /** Minutes of free gap until the next class, or null (gap-task surfaces). */
  function gapUntilNext(now) {
    if (!enabled()) return null;
    const r = resolveLive(now);
    if (r.state === 'passing' || r.state === 'before') return r.minutesUntil ?? null;
    return null;
  }

  function boot() {
    // Flags load async; re-check shortly after boot and on nav.
    setTimeout(start, 1200);
    document.addEventListener('flux-nav', () => { if (enabled()) renderStrip(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.FluxNow = { FLAG, enabled, resolveNow, resolveLive, renderStrip, start, stop, aiContext, gapUntilNext };
})();
