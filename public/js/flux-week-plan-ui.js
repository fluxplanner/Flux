/* ============================================================================
   FLUX · PLAN MY WEEK (the dialog)  ·  flux-week-plan-ui.js
   The student's side of FluxWeekPlan (flux-week-plan.js): confirm study
   hours and what's already on, look over the suggested blocks and why, move
   or drop any, then approve. Opened from the Tasks header on the dashboard
   and the day card on the calendar.

   A study block is a task, the same shape Plan it out makes: a date, a start
   time and minutes, tied to the task it is for by planOf. weekBlock holds
   its key and where the plan put it, so "Plan again" finds it rather than
   adding a second one, and a block the student moved anywhere in Flux (the
   calendar, Edit, here) stays where they put it. Being tasks, blocks show in
   Tasks and on the calendar, sync like any task, start the focus timer and
   tick off, and every change goes through snapshotTasks(), the app's undo.
   The task a block is for is never changed.

   The study hours the student confirms are kept in settings.weekPlan, which
   syncs with the rest of their settings. A busy time added here is an
   ordinary calendar event.
   ========================================================================== */
(function () {
  'use strict';

  const W = () => window.FluxWeekPlan;
  let st = null; // { view, avail, maxPerDay, goal, fresh, plan, removed, hist, editing, busyFor, changed, release }

  /* ── small helpers ─────────────────────────────────────────────────────── */
  const h = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const safe = (fn, def) => { try { const v = fn(); return v === undefined ? def : v; } catch (_) { return def; } };
  const today = () => {
    if (typeof window.todayStr === 'function') return window.todayStr();
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  const dates = () => Array.from({ length: 7 }, (_, i) => W().addDays(today(), i));
  const loadKey = (k, d) => (typeof window.load === 'function' ? window.load(k, d) : d);
  const saveKey = (k, v) => { if (typeof window.save === 'function') window.save(k, v); };
  const sync = (k, v) => { try { if (typeof window.syncKey === 'function') window.syncKey(k, v); } catch (_) {} };
  const toast = (m, k) => { try { window.showToast(m, k || 'info'); } catch (_) {} };
  function ymd(s) { const p = String(s || '').split('-').map(Number); return new Date(p[0], (p[1] || 1) - 1, p[2] || 1); }
  /** "Wed, Oct 7" — and "Today" / "Tomorrow" up front where it helps. */
  function dayLabel(d, long) {
    const base = ymd(d).toLocaleDateString('en-US', { weekday: long ? 'long' : 'short', month: 'short', day: 'numeric' });
    const n = Math.round((ymd(d) - ymd(today())) / 864e5);
    return n === 0 ? 'Today · ' + base : n === 1 ? 'Tomorrow · ' + base : base;
  }
  function clock(hm) {
    const m = W().toMin(hm);
    if (m == null) return '';
    const hh = Math.floor(m / 60) % 24, mm = m % 60;
    return (hh % 12 || 12) + ':' + String(mm).padStart(2, '0') + ' ' + (hh >= 12 ? 'PM' : 'AM');
  }
  /** "4:00 – 4:45 PM", "11:30 AM – 12:15 PM". */
  function span(a, b) {
    const x = clock(a), y = clock(b);
    if (!x || !y) return x || y;
    return x.slice(-2) === y.slice(-2) ? x.slice(0, -3) + ' – ' + y : x + ' – ' + y;
  }
  function mins(n) { n = Math.round(n || 0); return n >= 60 ? Math.floor(n / 60) + ' h' + (n % 60 ? ' ' + (n % 60) + ' min' : '') : n + ' min'; }
  function announce(msg) { const el = document.getElementById('pwLive'); if (el) { el.textContent = ''; setTimeout(() => { el.textContent = msg; }, 30); } }
  const allTasks = () => (Array.isArray(window.tasks) ? window.tasks : []);
  const isBlock = (t) => !!(t && t.weekBlock && t.planOf != null);
  // Educators keep Work and Personal apart; students see everything.
  const visible = (t) => typeof window.fluxTaskVisibleInMode !== 'function' || safe(() => window.fluxTaskVisibleInMode(t), true);

  /* ── what Flux already knows ───────────────────────────────────────────── */
  function prefs() {
    const s = window.settings || {};
    const saved = s.weekPlan && Array.isArray(s.weekPlan.days) ? s.weekPlan : null;
    const goal = Math.max(15, Math.round((+s.dailyGoalHrs || 2) * 60));
    return {
      avail: saved ? W().normAvail(saved.days) : W().defaultAvail(window.classes),
      maxPerDay: saved && +saved.maxPerDay > 0 ? Math.round(+saved.maxPerDay) : goal,
      goal: goal, fresh: !saved,
    };
  }
  function savePrefs() {
    const s = window.settings;
    if (!s || !st) return;
    s.weekPlan = { days: st.avail.map((d) => ({ on: !!d.on, start: d.start, end: d.end })), maxPerDay: st.maxPerDay, at: Date.now() };
    saveKey('flux_settings', s);
    sync('settings', s);
  }

  /** Classes, calendar events and weekly activities on a date. */
  function commitmentsOn(d) {
    const out = [];
    const cyc = safe(() => window.getCycleDayLabel(d), '') || '';
    (window.classes || []).forEach((c) => {
      if (c && c.name && c.timeStart && c.timeEnd && W().classMeets(c, d, cyc)) out.push({ start: c.timeStart, end: c.timeEnd, label: c.name });
    });
    (loadKey('flux_events', []) || []).forEach((e) => {
      if (e && e.date === d) out.push({ start: e.time || '', end: e.endTime || '', label: e.title || 'Event' });
    });
    safe(() => window.weeklyVirtualEventsForDate(d), []).forEach((e) => out.push({ start: e.time || '', end: '', label: e.title || 'Activity' }));
    return out.sort((a, b) => (W().toMin(a.start) ?? 9999) - (W().toMin(b.start) ?? 9999));
  }

  /** Where the plan put a block last; if it isn't there now the student moved it. */
  function movedSince(t) {
    const wb = t.weekBlock || {};
    return wb.date != null && (wb.date !== t.date || wb.start !== (t.time || '') || +wb.minutes !== +t.estTime);
  }

  function gather() {
    const ds = dates();
    const all = allTasks();
    const shown = all.filter(visible);
    const doneMin = {}, planned = new Set(), load = {};
    // A block for work that is finished (or gone) is no longer needed, even one the student moved.
    const open = new Set(all.filter((t) => t && !t.done && t.planOf == null).map((t) => String(t.id)));
    all.forEach((p) => {
      if (!p || p.planOf == null) return;
      const pid = String(p.planOf);
      if (p.done) doneMin[pid] = (doneMin[pid] || 0) + (+p.estTime || 0);
      else if (!p.weekBlock || !visible(p)) {
        // Plan it out's sessions: already planned, and they take up their day.
        // So do the other planner's blocks, which are left alone.
        if (!p.weekBlock) planned.add(pid);
        if (ds.includes(p.date)) load[p.date] = (load[p.date] || 0) + (+p.estTime || 0);
      }
    });
    return Object.assign(around(), {
      today: today(), nowMin: nowMin(), days: 7, avail: st.avail, maxPerDay: st.maxPerDay, load: load,
      tasks: shown.filter((t) => t && !t.done && t.planOf == null).map((t) => ({
        id: t.id, name: t.name, date: t.date || '', time: t.time || '', estTime: +t.estTime || 0,
        type: t.type || 'hw', priority: t.priority || 'med', doneMin: doneMin[String(t.id)] || 0, planned: planned.has(String(t.id)),
      })),
      blocks: all.filter((t) => isBlock(t) && visible(t)).map((t) => ({
        id: t.id, key: t.weekBlock.key, taskId: t.planOf, name: String(t.name || '').replace(/ · Study$/, ''), date: t.date, start: t.time || '', minutes: +t.estTime || 0,
        done: !!t.done, pinned: open.has(String(t.planOf)) && (!!t.weekBlock.pinned || movedSince(t)),
      })),
    });
  }
  /** Rest days and what's already on, for each of the seven days. */
  function around() {
    const ds = dates(), commitments = {};
    ds.forEach((d) => { commitments[d] = commitmentsOn(d); });
    return { rest: ds.filter((d) => safe(() => window.isBreak(d), false)), commitments: commitments };
  }
  /** What's off about each applied block where it is now (it may have been
      moved, or something added on that day since): key → short reasons. */
  function liveWarnings(list) {
    const days = W().propose(Object.assign(around(), { today: today(), days: 7, avail: st.avail, maxPerDay: st.maxPerDay })).days;
    const out = {};
    list.forEach((t) => {
      const day = days.find((d) => d.date === t.date);
      if (t.done || !day) return;
      const parent = allTasks().find((x) => String(x.id) === String(t.planOf));
      const me = { key: t.weekBlock.key, date: t.date, start: t.time || '', minutes: +t.estTime || 0, due: parent && !parent.done ? parent.date || '' : '' };
      const others = list.filter((x) => x !== t && x.date === t.date).map((x) => ({ key: x.weekBlock.key, start: x.time || '', minutes: +x.estTime || 0 }));
      out[me.key] = W().warnings(me, day, others, st.maxPerDay, today());
    });
    return out;
  }

  /** Blocks of the week that are still on (and any left unticked from the last few days). */
  function appliedBlocks() {
    const td = today(), last = W().addDays(td, 6), back = W().addDays(td, -7);
    return allTasks().filter((t) => isBlock(t) && visible(t) && t.date && t.date <= last && (t.date >= td || (!t.done && t.date >= back)))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (W().toMin(a.time) || 0) - (W().toMin(b.time) || 0)));
  }

  /* ── open / close ──────────────────────────────────────────────────────── */
  function openPlanWeek() {
    if (!W()) return;
    closePlanWeek(true);
    const p = prefs();
    st = { view: appliedBlocks().length ? 'week' : 'avail', avail: p.avail, maxPerDay: p.maxPerDay, goal: p.goal, fresh: p.fresh, plan: null, removed: [], hist: [], editing: null, busyFor: null, changed: false };
    const ov = document.createElement('div');
    ov.id = 'planWeekModal';
    ov.className = 'modal-overlay';
    ov.style.display = 'flex';
    ov.innerHTML = `<div class="modal-card pw-card" role="dialog" aria-modal="true" aria-labelledby="pwTitle" aria-describedby="pwSub">
      <div class="pw-head">
        <h2 class="modal-title" id="pwTitle" tabindex="-1">Plan my week</h2>
        <button type="button" class="pw-x" data-act="close" data-flux-close aria-label="Close">✕</button>
      </div>
      <p class="pw-sub" id="pwSub"></p>
      <div class="pw-body" id="pwBody"></div>
      <div class="mactions pw-actions" id="pwActions"></div>
      <div class="pw-sr" id="pwLive" aria-live="polite"></div>
    </div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click', onClick);
    ov.addEventListener('change', onChange);
    ov.addEventListener('input', onInput);
    ov.addEventListener('keydown', onKey);
    document.addEventListener('click', onUndoBar, true);
    st.release = safe(() => window.FluxA11y.trapFocus(ov.querySelector('.pw-card')), null);
    // On the overlay stack: the app's single-key shortcuts stay quiet while it
    // is open, and an Escape that reaches the document closes this, not a
    // dialog under it.
    safe(() => window.FluxOverlays.push('planWeekModal', () => closePlanWeek()));
    render(true);
  }
  function closePlanWeek(quiet) {
    const m = document.getElementById('planWeekModal');
    if (m) {
      const card = m.querySelector('.pw-card');
      m.remove();
      // Hands focus back to whatever opened the dialog.
      safe(() => window.FluxA11y.releaseFocus(card));
    }
    safe(() => window.FluxOverlays.pop('planWeekModal'));
    document.removeEventListener('click', onUndoBar, true);
    if (!quiet) st = null;
  }

  /* ── views ─────────────────────────────────────────────────────────────── */
  function render(moveFocus) {
    const body = document.getElementById('pwBody'), act = document.getElementById('pwActions'), sub = document.getElementById('pwSub');
    if (!body || !st) return;
    if (st.view === 'avail') { sub.textContent = 'Step 1 of 2 · Your time'; body.innerHTML = availHtml(); act.innerHTML = availActions(); }
    else if (st.view === 'plan') { sub.textContent = 'Step 2 of 2 · Your plan'; body.innerHTML = planHtml(); act.innerHTML = planActions(); }
    else { sub.textContent = 'This week'; body.innerHTML = weekHtml(); act.innerHTML = weekActions(); }
    if (moveFocus) {
      body.scrollTop = 0;
      safe(() => document.getElementById('pwTitle').focus({ preventScroll: true }));
    }
  }
  function go(view) { st.view = view; st.editing = null; st.busyFor = null; render(true); }

  // Step 1: study hours, the daily limit, and what's on each day.
  function availHtml() {
    const ds = dates();
    const untimed = (window.classes || []).filter((c) => c && c.name && !(c.timeStart && c.timeEnd)).length;
    const rows = ds.map((d, i) => {
      const wd = ymd(d).getDay(), a = st.avail[wd];
      const rest = safe(() => window.isBreak(d), false);
      const items = commitmentsOn(d);
      const name = ymd(d).toLocaleDateString('en-US', { weekday: 'long' });
      const busy = items.length ? `<ul class="pw-commit" aria-label="Already on ${h(name)}">${items.map((c) => {
        const s = W().toMin(c.start), e = W().toMin(c.end);
        const when = s == null ? 'no time set' : e != null && e > s ? span(c.start, c.end) : clock(c.start) + ' (about 1 hr)';
        return `<li><span>${h(c.label)}</span> <span class="pw-muted">${h(when)}</span></li>`;
      }).join('')}</ul>` : '';
      const form = st.busyFor === d ? `<div class="pw-busy-form" role="group" aria-label="Add a busy time on ${h(name)}">
          <label>What<input type="text" id="pwBusyWhat" maxlength="60" placeholder="e.g. Practice"></label>
          <label>From<input type="time" id="pwBusyFrom"></label>
          <label>To<input type="time" id="pwBusyTo"></label>
          <button type="button" data-act="busy-add" data-date="${d}">Add</button>
          <button type="button" class="btn-sec" data-act="busy-cancel">Cancel</button>
          <p class="pw-muted pw-busy-note">It goes on your calendar too.</p>
        </div>` : '';
      return `<li class="pw-day${rest ? ' is-rest' : ''}" data-date="${d}">
        <div class="pw-day-top">
          <span class="pw-day-name">${h(dayLabel(d))}</span>
          ${rest ? '<span class="pw-tag">Rest day · nothing planned</span>' : `
          <label class="pw-on"><input type="checkbox" data-wd="${wd}" data-k="on"${a.on ? ' checked' : ''}> Study</label>
          <span class="pw-times"${a.on ? '' : ' hidden'}>
            <input type="time" data-wd="${wd}" data-k="start" value="${h(a.start)}" aria-label="${h(name)}: study from">
            <span aria-hidden="true">–</span>
            <input type="time" data-wd="${wd}" data-k="end" value="${h(a.end)}" aria-label="${h(name)}: study until">
          </span>`}
        </div>
        ${busy}
        ${rest ? '' : st.busyFor === d ? form : `<button type="button" class="btn-sm pw-busy-btn" data-act="busy" data-date="${d}" aria-label="Add a busy time on ${h(name)}">＋ Busy time</button>`}
      </li>`;
    }).join('');
    return `<p class="pw-intro">Flux suggests study blocks for the next 7 days around your classes and plans. Nothing changes until you approve it.</p>
      ${st.fresh ? '<p class="pw-note">These study times are a suggestion. Change them to fit your week.</p>' : ''}
      <div class="pw-limit">
        <label for="pwMax">Most study in a day</label>
        <span class="pw-limit-in"><input type="number" id="pwMax" min="15" max="720" step="15" value="${st.maxPerDay}"> min</span>
        <span class="pw-muted">Your daily goal in Settings is ${mins(st.goal)}.</span>
      </div>
      <ul class="pw-days">${rows}</ul>
      ${untimed ? `<p class="pw-note">${untimed === 1 ? '1 class has' : untimed + ' classes have'} no times set, so Flux only plans inside the study times above.</p>` : ''}`;
  }
  function availActions() {
    return `<button type="button" class="btn-sec" data-act="${appliedBlocks().length ? 'to-week' : 'close'}">${appliedBlocks().length ? 'Back' : 'Cancel'}</button>
      <button type="button" data-act="propose">Show my plan</button>`;
  }

  // Step 2: the proposal, by day, each block with its reason.
  function planBlocks() { return st.plan ? st.plan.blocks.filter((b) => !b.removed) : []; }
  function dayOf(d) { return st.plan.days.find((x) => x.date === d); }
  function blockWarnings(b) {
    const others = planBlocks().filter((x) => x.date === b.date && x !== b);
    return W().warnings(b, dayOf(b.date), others, st.plan.maxPerDay, today());
  }
  function planHtml() {
    const p = st.plan;
    const live = planBlocks();
    const todo = live.filter((b) => !b.kept);
    const total = todo.reduce((s, b) => s + b.minutes, 0);
    const nd = new Set(todo.map((b) => b.date)).size;
    const kept = live.filter((b) => b.kept).length;
    const sum = todo.length
      ? `<p class="pw-intro"><strong>${todo.length} study block${todo.length === 1 ? '' : 's'}</strong> · ${mins(total)} over ${nd} day${nd === 1 ? '' : 's'}.${kept ? ` Keeps ${kept} block${kept === 1 ? '' : 's'} you've done or moved.` : ''} Change anything you like, then approve.</p>`
      : `<p class="pw-intro">${kept ? 'Everything left is already in your plan.' : 'Nothing needs planning this week.'}</p>`;
    const days = p.days.map((d) => {
      const bl = live.filter((b) => b.date === d.date);
      const used = bl.reduce((s, b) => s + b.minutes, 0);
      const meta = d.rest ? 'Rest day' : d.off ? 'No study time' : !d.open && !used ? 'No study time left today' : used ? `${mins(used)} of ${mins(p.maxPerDay)}` : 'Nothing planned';
      const around = d.busy.length ? `<p class="pw-around pw-muted">Around ${d.busy.map((b) => h(b.label) + ' ' + h(span(b.start, b.end))).join(', ')}</p>` : '';
      return `<section class="pw-pday" aria-labelledby="pwd-${d.date}">
        <h3 class="pw-pday-h" id="pwd-${d.date}"><span>${h(dayLabel(d.date))}</span><span class="pw-muted">${h(meta)}</span></h3>
        ${bl.length ? around : ''}
        ${bl.length ? `<ul class="pw-blocks">${bl.map(blockHtml).join('')}</ul>` : ''}
      </section>`;
    }).join('');
    const un = p.unscheduled.map((u) => `<li><strong>${h(u.name)}</strong><span>${h(u.reason)}</span></li>`)
      .concat(st.removed.map((b) => `<li><strong>${h(b.name)}</strong><span>You took ${b.minutes} min on ${h(dayLabel(b.date))} out of the plan.</span>
        <button type="button" class="btn-sm" data-act="restore" data-key="${h(b.key)}" aria-label="Put back ${h(b.name)}, ${h(dayLabel(b.date))}">Put back</button></li>`));
    const extra = [];
    if (p.planned.length) extra.push(`<p class="pw-note">Already planned with Plan it out: ${p.planned.map((x) => h(x.name)).join(', ')}. Its sessions count toward your days.</p>`);
    if (p.later.length) extra.push(`<p class="pw-note">Not needed this week: ${p.later.map((x) => h(x.name) + ' (due ' + h(ymd(x.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })) + ')').join(', ')}.</p>`);
    if (p.drop.length) extra.push(`<p class="pw-note">${p.drop.length} unfinished block${p.drop.length === 1 ? ' is' : 's are'} no longer needed and will be taken off.</p>`);
    return sum + `<div class="pw-plan">${days}</div>`
      + (un.length ? `<section class="pw-unsched" aria-labelledby="pwUnH"><h3 id="pwUnH">Didn’t fit</h3><ul>${un.join('')}</ul>
        ${p.unscheduled.length ? '<p class="pw-muted">More study time or a higher daily limit in step 1 may make room.</p>' : ''}</section>` : '')
      + extra.join('');
  }
  function blockHtml(b) {
    const lbl = `${b.name}, ${dayLabel(b.date)} ${clock(b.start)}`;
    const warn = b.kept === 'done' ? [] : blockWarnings(b);
    const was = b.was && !b.kept ? `<span class="pw-was">${b.was.missed ? 'Missed' : 'Was'} ${h(dayLabel(b.was.date))} ${h(clock(b.was.start))}</span>` : '';
    const editing = st.editing === b.key;
    return `<li class="pw-block${b.kept ? ' is-kept' : ''}${b.kept === 'done' ? ' is-done' : ''}" data-key="${h(b.key)}">
      <div class="pw-b-time">${h(span(b.start, b.end))}</div>
      <div class="pw-b-main">
        <div class="pw-b-name">${h(b.name)}${b.of > 1 ? ` <span class="pw-muted">· ${b.part} of ${b.of}</span>` : ''}</div>
        <div class="pw-b-why">${h(b.reason)}${was ? ' · ' + was : ''}</div>
        ${warn.length ? `<div class="pw-b-warn">${warn.map(h).join(' · ')}</div>` : ''}
      </div>
      ${b.kept === 'done' ? '<span class="pw-tag">Done</span>' : editing ? '' : `<div class="pw-b-acts">
        <button type="button" class="btn-sm" data-act="edit" data-key="${h(b.key)}" aria-label="Change ${h(lbl)}">Change</button>
        <button type="button" class="btn-sm" data-act="remove" data-key="${h(b.key)}" aria-label="Remove ${h(lbl)}">Remove</button>
      </div>`}
      ${editing ? editorHtml(b, 'save-edit') : ''}
    </li>`;
  }
  /** Day, start and minutes for one block; shared by the plan and the week view. */
  function editorHtml(b, act) {
    const opts = dates().map((d) => `<option value="${d}"${d === b.date ? ' selected' : ''}>${h(dayLabel(d))}</option>`).join('');
    return `<div class="pw-edit" role="group" aria-label="Change ${h(b.name)}">
      <label>Day<select id="pwEdDay">${opts}</select></label>
      <label>Starts<input type="time" id="pwEdStart" value="${h(b.start)}"></label>
      <label>Minutes<input type="number" id="pwEdMin" min="5" max="240" step="5" value="${b.minutes}"></label>
      <div class="pw-edit-acts"><button type="button" data-act="${act}" data-key="${h(b.key)}">Save</button>
      <button type="button" class="btn-sec" data-act="cancel-edit">Cancel</button></div>
    </div>`;
  }
  function planActions() {
    const p = st.plan;
    const todo = planBlocks().filter((b) => !b.kept);
    const changes = todo.filter((b) => b.id == null || b.was || b.pinned).length + p.drop.length + st.removed.filter((b) => b.id != null).length;
    const back = '<button type="button" class="btn-sec" data-act="to-avail">Back</button>';
    if (!changes) return back + '<button type="button" data-act="close">Nothing to change · Close</button>';
    const label = todo.some((b) => b.id != null) || p.drop.length || st.removed.some((b) => b.id != null) ? 'Approve changes' : `Approve plan (${todo.length} block${todo.length === 1 ? '' : 's'})`;
    return back + `<button type="button" data-act="approve">${label}</button>`;
  }

  // During the week: tick off, move, take out, plan again.
  function weekHtml() {
    const list = appliedBlocks();
    const td = today();
    const missed = list.filter((t) => t.date < td);
    const now = list.filter((t) => t.date >= td);
    const warn = liveWarnings(now);
    const row = (t) => {
      const lbl = `${t.name}, ${dayLabel(t.date)} ${clock(t.time)}`;
      const end = W().toHM((W().toMin(t.time) || 0) + (+t.estTime || 0));
      const key = t.weekBlock.key;
      const editing = st.editing === key;
      return `<li class="pw-block${t.done ? ' is-done' : ''}" data-key="${h(key)}">
        <label class="pw-check"><input type="checkbox" data-act="done" data-id="${h(String(t.id))}"${t.done ? ' checked' : ''} aria-label="Done: ${h(lbl)}"></label>
        <div class="pw-b-time">${h(span(t.time, end))}</div>
        <div class="pw-b-main">
          <div class="pw-b-name">${h(t.name)}${t.planParts > 1 ? ` <span class="pw-muted">· ${t.planPart} of ${t.planParts}</span>` : ''}</div>
          ${reasonNow(t, td) ? `<div class="pw-b-why">${h(reasonNow(t, td))}</div>` : ''}
          ${(warn[key] || []).length ? `<div class="pw-b-warn">${warn[key].map(h).join(' · ')}</div>` : ''}
        </div>
        ${t.done || editing ? '' : `<div class="pw-b-acts">
          <button type="button" class="btn-sm" data-act="focus" data-id="${h(String(t.id))}" aria-label="Start the focus timer for ${h(lbl)}">Start</button>
          <button type="button" class="btn-sm" data-act="edit" data-key="${h(key)}" aria-label="Move ${h(lbl)}">Move</button>
          <button type="button" class="btn-sm" data-act="drop-one" data-id="${h(String(t.id))}" aria-label="Remove ${h(lbl)}">Remove</button>
        </div>`}
        ${editing ? editorHtml({ key: key, name: t.name, date: t.date >= td ? t.date : td, start: t.time || '16:00', minutes: +t.estTime || 30 }, 'save-move') : ''}
      </li>`;
    };
    const byDay = {};
    now.forEach((t) => (byDay[t.date] || (byDay[t.date] = [])).push(t));
    const done = list.filter((t) => t.done).length;
    return `<p class="pw-intro">${done} of ${list.length} block${list.length === 1 ? '' : 's'} done. Tick them off as you go, or move one if your day changes.</p>
      <div class="pw-plan">${missed.length ? `<section class="pw-pday" aria-labelledby="pwdMissed"><h3 class="pw-pday-h" id="pwdMissed"><span>Missed</span><span class="pw-muted">Plan again to fit ${missed.length === 1 ? 'it' : 'them'} back in</span></h3>
        <ul class="pw-blocks">${missed.map(row).join('')}</ul></section>` : ''}
      ${Object.keys(byDay).map((d) => `<section class="pw-pday" aria-labelledby="pwd-${d}"><h3 class="pw-pday-h" id="pwd-${d}"><span>${h(dayLabel(d))}</span>
        <span class="pw-muted">${mins(byDay[d].reduce((s, t) => s + (+t.estTime || 0), 0))}</span></h3>
        <ul class="pw-blocks">${byDay[d].map(row).join('')}</ul></section>`).join('')}</div>`;
  }
  /** Why a block is there, as of today: "Due tomorrow" on Monday is "Due today" by Tuesday. */
  function reasonNow(t, td) {
    const wb = t.weekBlock, parent = allTasks().find((x) => String(x.id) === String(t.planOf));
    if (wb.why == null || !parent || parent.done || !parent.date || /^You moved/.test(wb.reason || '')) return wb.reason || '';
    return W().dueLead(parent.date, td) + (wb.why ? ', ' + wb.why : '');
  }
  function weekActions() {
    const open = appliedBlocks().filter((t) => !t.done).length;
    return `${open ? '<button type="button" class="btn-sec" data-act="clear">Remove unfinished blocks</button>' : ''}
      ${st.changed ? '<button type="button" class="btn-sec" data-act="undo">Undo last change</button>' : ''}
      <button type="button" data-act="to-avail">Plan again</button>`;
  }

  /* ── actions ───────────────────────────────────────────────────────────── */
  function propose() {
    const max = Math.round(+(document.getElementById('pwMax') || {}).value || st.maxPerDay);
    st.maxPerDay = Math.max(15, Math.min(720, max));
    const bad = st.avail.findIndex((a) => a.on && !((W().toMin(a.end) || 0) > (W().toMin(a.start) || 0)));
    if (bad >= 0) {
      announce('A study time ends before it starts. Check ' + ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][bad] + '.');
      toast('A study time ends before it starts.', 'warning');
      return;
    }
    savePrefs();
    st.plan = W().propose(gather());
    st.removed = []; st.hist = [];
    go('plan');
    const n = st.plan.blocks.filter((b) => !b.kept).length;
    announce(`${n} study block${n === 1 ? '' : 's'} suggested.${st.plan.unscheduled.length ? ' ' + st.plan.unscheduled.length + ' didn’t fit.' : ''}`);
  }

  function blockName(parent) { return (parent && parent.name ? parent.name : 'Study') + ' · Study'; }

  function approve() {
    const p = st.plan;
    if (!p) return;
    const list = allTasks();
    const byId = new Map(list.map((t) => [String(t.id), t]));
    if (typeof window.snapshotTasks === 'function') window.snapshotTasks();
    const base = Date.now();
    let added = 0, moved = 0;
    const live = planBlocks();
    // "1 of 3" again, now that the student may have taken some out.
    const per = {};
    live.forEach((b) => (per[String(b.taskId)] || (per[String(b.taskId)] = [])).push(b));
    Object.keys(per).forEach((k) => per[k].sort((a, b) => (a.date + a.start < b.date + b.start ? -1 : 1)).forEach((b, i, arr) => { b.part = i + 1; b.of = arr.length; }));
    const next = list.slice();
    live.forEach((b, i) => {
      const old = b.id != null ? byId.get(String(b.id)) : null;
      if (old && !isBlock(old)) return; // never anything but a study block
      if (old) {
        if (old.done) return;
        if (b.kept) { Object.assign(old, { planPart: b.part, planParts: b.of }); return; }
        if (old.date !== b.date || (old.time || '') !== b.start || +old.estTime !== b.minutes) moved++;
        Object.assign(old, { date: b.date, time: b.start, estTime: b.minutes, planPart: b.part, planParts: b.of });
        // Where the plan puts it now; pinned only if the student just put it there.
        old.weekBlock = Object.assign({}, old.weekBlock, { key: b.key, pinned: !!b.pinned, reason: b.reason, why: b.detail, date: b.date, start: b.start, minutes: b.minutes });
        if (typeof window.calcUrgency === 'function') old.urgencyScore = window.calcUrgency(old);
        return;
      }
      if (b.kept) return;
      const parent = byId.get(String(b.taskId));
      if (!parent) return;
      const t = {
        id: base + i + Math.random(), name: blockName(parent), date: b.date, time: b.start,
        subject: parent.subject || '', priority: parent.priority || 'med', type: parent.type || 'hw',
        estTime: b.minutes, difficulty: parent.difficulty || 3, notes: '', subtasks: [], done: false, rescheduled: 0, createdAt: base,
        planOf: parent.id, planPart: b.part, planParts: b.of, scope: parent.scope,
        weekBlock: { key: b.key, pinned: !!b.pinned, reason: b.reason, why: b.detail, date: b.date, start: b.start, minutes: b.minutes, at: base },
      };
      if (typeof window.calcUrgency === 'function') t.urgencyScore = window.calcUrgency(t);
      next.push(t);
      added++;
    });
    // Blocks no longer needed, and ones the student took out. Never a done one,
    // never anything that isn't a block.
    const gone = new Set(p.drop.map((d) => String(d.id)).concat(st.removed.filter((b) => b.id != null).map((b) => String(b.id))));
    const kept = next.filter((t) => !(gone.has(String(t.id)) && isBlock(t) && !t.done));
    const removed = next.length - kept.length;
    window.tasks = kept;
    persist();
    closePlanWeek();
    const bits = [];
    if (added) bits.push(`Added ${added} study block${added === 1 ? '' : 's'}`);
    if (moved) bits.push(`moved ${moved}`);
    if (removed) bits.push(`took ${removed} off`);
    const msg = bits.length ? bits.join(', ').replace(/^./, (c) => c.toUpperCase()) : 'Plan saved';
    if (typeof window.showUndoSnackbar === 'function') window.showUndoSnackbar(msg, 'undoLastChange');
    else toast(msg, 'success');
  }

  function persist() {
    saveKey('tasks', window.tasks);
    sync('tasks', window.tasks);
    ['renderStats', 'renderTasks', 'renderCalendar'].forEach((f) => safe(() => window[f](), null));
  }

  function readEditor() {
    const d = (document.getElementById('pwEdDay') || {}).value;
    const s = (document.getElementById('pwEdStart') || {}).value;
    const m = Math.round(+(document.getElementById('pwEdMin') || {}).value || 0);
    if (!d || W().toMin(s) == null || m < 5) { toast('Pick a day, a start time and at least 5 minutes.', 'warning'); return null; }
    return { date: d, start: W().toHM(W().toMin(s)), minutes: Math.min(240, m) };
  }

  function saveEdit(key) {
    const b = planBlocks().find((x) => x.key === key);
    const v = readEditor();
    if (!b || !v) return;
    remember();
    Object.assign(b, v, { end: W().toHM(W().toMin(v.start) + v.minutes), pinned: true });
    if (b.kept === 'pinned' || b.kept === 'live') b.kept = null; // changed again: it's this plan's to write
    b.reason = b.reason && !/^You moved/.test(b.reason) ? b.reason : 'You moved this one';
    st.editing = null;
    render(false);
    const w = blockWarnings(b);
    announce(`Moved to ${dayLabel(b.date)} ${clock(b.start)}.${w.length ? ' ' + w.join('. ') + '.' : ''}`);
    focusBlock(key, 'edit');
  }

  function removeFromPlan(key) {
    const b = planBlocks().find((x) => x.key === key);
    if (!b) return;
    remember();
    b.removed = true;
    st.removed.push(b);
    render(false);
    announce(`${b.name} on ${dayLabel(b.date)} taken out of the plan.`);
    safe(() => document.querySelector('#planWeekModal [data-act="approve"]').focus(), null);
  }
  function restore(key) {
    const i = st.removed.findIndex((b) => b.key === key);
    if (i < 0) return;
    remember();
    const b = st.removed.splice(i, 1)[0];
    b.removed = false;
    render(false);
    announce(`${b.name} put back on ${dayLabel(b.date)}.`);
    focusBlock(key, 'edit');
  }
  function focusBlock(key, act) {
    safe(() => document.querySelector(`#planWeekModal .pw-block[data-key="${CSS.escape(key)}"] [data-act="${act}"]`).focus(), null);
  }

  // Week view changes go straight to the planner, each with undo.
  function weekTask(id) { return allTasks().find((t) => String(t.id) === String(id)); }
  function markDone(id) {
    const t = weekTask(id);
    if (!t) return;
    if (typeof window.toggleTask === 'function') window.toggleTask(t.id);
    st.changed = true;
    render(false);
    announce(t.done ? `${t.name} done.` : `${t.name} not done.`);
    safe(() => document.querySelector(`#planWeekModal [data-act="done"][data-id="${CSS.escape(String(id))}"]`).focus(), null);
  }
  function saveMove(key) {
    const t = allTasks().find((x) => isBlock(x) && x.weekBlock.key === key);
    const v = readEditor();
    if (!t || !v) return;
    if (typeof window.snapshotTasks === 'function') window.snapshotTasks();
    Object.assign(t, { date: v.date, time: v.start, estTime: v.minutes });
    t.weekBlock = Object.assign({}, t.weekBlock, { pinned: true, reason: 'You moved this one', why: null, date: v.date, start: v.start, minutes: v.minutes });
    if (typeof window.calcUrgency === 'function') t.urgencyScore = window.calcUrgency(t);
    persist();
    st.changed = true; st.editing = null;
    render(false);
    if (typeof window.showUndoSnackbar === 'function') window.showUndoSnackbar('Block moved', 'undoLastChange');
    const w = liveWarnings(appliedBlocks().filter((x) => x.date === v.date))[key] || [];
    announce(`Moved to ${dayLabel(v.date)} ${clock(v.start)}.${w.length ? ' ' + w.join('. ') + '.' : ''}`);
    focusBlock(key, 'edit');
  }
  function dropOne(id) {
    const t = weekTask(id);
    if (!t || !isBlock(t)) return;
    if (typeof window.snapshotTasks === 'function') window.snapshotTasks();
    window.tasks = allTasks().filter((x) => x !== t);
    persist();
    st.changed = true;
    render(false);
    if (typeof window.showUndoSnackbar === 'function') window.showUndoSnackbar('Block removed', 'undoLastChange');
    announce(`${t.name} removed.`);
    safe(() => document.getElementById('pwTitle').focus(), null);
  }
  function clearUnfinished() {
    const n = appliedBlocks().filter((t) => !t.done).length;
    if (!n) return;
    if (typeof window.snapshotTasks === 'function') window.snapshotTasks();
    const gone = new Set(appliedBlocks().filter((t) => !t.done));
    window.tasks = allTasks().filter((t) => !gone.has(t));
    persist();
    st.changed = true;
    if (typeof window.showUndoSnackbar === 'function') window.showUndoSnackbar(`Removed ${n} block${n === 1 ? '' : 's'}`, 'undoLastChange');
    if (!appliedBlocks().length) go('avail'); else render(true);
    announce(`Removed ${n} unfinished block${n === 1 ? '' : 's'}.`);
  }
  /** Before a move, a removal or a put-back in the suggestion, so Ctrl+Z can take it back. */
  function remember() {
    st.hist.push({ blocks: st.plan.blocks.map((b) => Object.assign({}, b)), removed: st.removed.map((b) => b.key) });
    if (st.hist.length > 20) st.hist.shift();
  }
  function undo() {
    if (st.view === 'plan') {
      // Nothing is in the planner yet, so this takes back the last change to
      // the suggestion, never something done elsewhere in Flux.
      const prev = st.hist.pop();
      if (!prev) { announce('Nothing to undo. Nothing changes until you approve.'); return; }
      st.plan.blocks = prev.blocks;
      st.removed = prev.removed.map((k) => st.plan.blocks.find((b) => b.key === k)).filter(Boolean);
      st.editing = null;
      render(false);
      announce('Last change undone.');
      safe(() => (document.querySelector('#planWeekModal [data-act="approve"]') || document.getElementById('pwTitle')).focus(), null);
      return;
    }
    safe(() => window.undoLastChange());
    afterUndo();
    safe(() => (document.querySelector('#planWeekModal [data-act="undo"]') || document.getElementById('pwTitle')).focus(), null);
  }
  /** The planner was just put back: show it as it is now. */
  function afterUndo() {
    if (st.view === 'plan') {
      // Under the suggestion: suggest again from it.
      st.plan = W().propose(gather()); st.removed = []; st.hist = []; st.editing = null;
      render(false);
    } else if (st.view === 'week' && !appliedBlocks().length) go('avail');
    else { st.editing = null; render(false); }
    announce('Last change undone.');
  }
  /** The app's Undo bar sits above this dialog (a block moved here shows one,
      and so does approving a moment ago). Its Undo is the app's undo; once it
      has run, bring the dialog up to date. */
  function onUndoBar(e) {
    const btn = e.target && e.target.closest ? e.target.closest('#undoSnackbar button') : null;
    if (!btn || !st || !/undoLastChange/.test(btn.getAttribute('onclick') || '')) return;
    setTimeout(() => {
      if (!st || !document.getElementById('planWeekModal')) return;
      afterUndo();
      safe(() => document.getElementById('pwTitle').focus({ preventScroll: true }), null);
    }, 0);
  }

  function addBusy(d) {
    const what = ((document.getElementById('pwBusyWhat') || {}).value || '').trim() || 'Busy';
    const from = (document.getElementById('pwBusyFrom') || {}).value, to = (document.getElementById('pwBusyTo') || {}).value;
    const s = W().toMin(from), e = W().toMin(to);
    if (s == null || e == null || e <= s) { toast('Add a start and an end time.', 'warning'); return; }
    const events = loadKey('flux_events', []) || [];
    // Life outside class, unless that would hide it from an educator's Work calendar.
    const scope = visible({ scope: 'outside' }) ? 'outside' : 'school';
    events.push({ id: String(Date.now()), title: what, date: d, time: W().toHM(s), endTime: W().toHM(e), notes: '', scope: scope });
    saveKey('flux_events', events);
    sync('events', 1);
    safe(() => window.renderCalendar(), null);
    st.busyFor = null;
    render(false);
    announce(`${what} added, ${span(from, to)}.`);
    safe(() => document.querySelector(`#planWeekModal .pw-day[data-date="${d}"] [data-act="busy"]`).focus(), null);
  }

  /* ── events ────────────────────────────────────────────────────────────── */
  function onClick(e) {
    const ov = document.getElementById('planWeekModal');
    if (e.target === ov) { closePlanWeek(); return; }
    const el = e.target.closest('[data-act]');
    if (!el || !st) return;
    const a = el.dataset.act, key = el.dataset.key;
    if (a === 'done') return; // a checkbox: handled on change
    if (a === 'close') closePlanWeek();
    else if (a === 'to-avail') go('avail');
    else if (a === 'to-week') go('week');
    else if (a === 'propose') propose();
    else if (a === 'approve') approve();
    else if (a === 'edit') { st.editing = key; render(false); safe(() => document.getElementById('pwEdDay').focus(), null); }
    else if (a === 'cancel-edit') { const k = st.editing; st.editing = null; render(false); focusBlock(k, 'edit'); }
    else if (a === 'save-edit') saveEdit(key);
    else if (a === 'save-move') saveMove(key);
    else if (a === 'remove') removeFromPlan(key);
    else if (a === 'restore') restore(key);
    else if (a === 'focus') { const t = weekTask(el.dataset.id); closePlanWeek(); if (t && typeof window.startTimerFromTask === 'function') window.startTimerFromTask(t.id); }
    else if (a === 'drop-one') dropOne(el.dataset.id);
    else if (a === 'clear') clearUnfinished();
    else if (a === 'undo') undo();
    else if (a === 'busy') { st.busyFor = el.dataset.date; render(false); safe(() => document.getElementById('pwBusyWhat').focus(), null); }
    else if (a === 'busy-cancel') { const d = st.busyFor; st.busyFor = null; render(false); safe(() => document.querySelector(`#planWeekModal .pw-day[data-date="${d}"] [data-act="busy"]`).focus(), null); }
    else if (a === 'busy-add') addBusy(el.dataset.date);
  }
  function onChange(e) {
    const t = e.target;
    if (!st) return;
    if (t.dataset.act === 'done') { markDone(t.dataset.id); return; }
    if (t.dataset.wd != null && t.dataset.k) {
      const a = st.avail[+t.dataset.wd];
      if (t.dataset.k === 'on') {
        a.on = t.checked;
        const times = t.closest('.pw-day-top').querySelector('.pw-times');
        if (times) times.hidden = !a.on;
      } else if (t.value) a[t.dataset.k] = t.value;
    }
  }
  function onInput(e) {
    if (st && e.target.id === 'pwMax') st.maxPerDay = Math.max(15, Math.round(+e.target.value || st.maxPerDay));
  }
  function onKey(e) {
    if (e.key === 'Escape') {
      // Handled here only. The app's document-level Escape handlers would
      // close the whole dialog, or press its first secondary button (which
      // in the week view is "Remove unfinished blocks").
      e.preventDefault();
      e.stopPropagation();
      if (st && st.editing) { const k = st.editing; st.editing = null; render(false); focusBlock(k, 'edit'); }
      else if (st && st.busyFor) { const d = st.busyFor; st.busyFor = null; render(false); safe(() => document.querySelector(`#planWeekModal .pw-day[data-date="${d}"] [data-act="busy"]`).focus(), null); }
      else closePlanWeek();
    } else if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && (e.key === 'z' || e.key === 'Z') && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) {
      // The app's undo, with this dialog brought up to date afterwards.
      e.preventDefault();
      e.stopPropagation();
      if (st) undo();
    } else if (e.key === 'Enter' && e.target.tagName !== 'BUTTON' && e.target.closest('.pw-edit, .pw-busy-form')) {
      // Enter in a small form saves it, like its button.
      e.preventDefault();
      const save = e.target.closest('.pw-edit, .pw-busy-form').querySelector('[data-act^="save-"], [data-act="busy-add"]');
      if (save) save.click();
    }
  }

  window.openPlanWeek = openPlanWeek;
  window.closePlanWeek = closePlanWeek;
  window.FluxWeekPlanUI = { open: openPlanWeek, close: closePlanWeek, gather: () => (st ? gather() : null) };
})();
