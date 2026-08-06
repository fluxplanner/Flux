/**
 * C2 — District Schedule Authority (flag enable_school_schedules).
 *
 * Admins publish bell-schedule variants + calendar exceptions for their
 * school (tables: flux_school_bell_schedules / flux_school_calendar_days,
 * RLS: members read, admins write). Every member's planner reflows:
 *   - FluxNow (C1) consumes todayOverride() — closures read as holidays
 *   - isBreak() in app.js treats closed days exactly like rest days
 *     (REST_DAYS_KEY machinery), so due-date spreading, calendar chips,
 *     and AI pacing all skip them with ZERO data mutation
 *   - new closures with due work trigger an undoable reflow proposal
 *   - admins get a variants + calendar-painter card in Admin Operations
 *     and a "Broadcast snow day" action riding the existing
 *     flux_school_broadcast / school_announcements pipeline
 *
 * Students are zero-config: joining a school stamps user_roles.school and
 * RLS scopes every SELECT to it — no school filter needed client-side.
 */
(function () {
  'use strict';
  if (window.FluxSchoolSchedules) return;

  const FLAG = 'enable_school_schedules';
  const CACHE_KEY = 'flux_school_sched_cache_v1'; // registered in FluxStorageKeys
  const HORIZON_DAYS = 45;

  function enabled() {
    try { return !!window.FluxFeatureFlags?.isEnabled(FLAG, false); } catch (_) { return false; }
  }
  function ls(k, d) { return typeof window.load === 'function' ? window.load(k, d) : d; }
  function lsSave(k, v) { if (typeof window.save === 'function') window.save(k, v); }
  function client() { return typeof window.getSB === 'function' ? window.getSB() : null; }
  function mySchool() {
    try {
      return String(window.FluxRole?.profile?.school || ls('profile', {}).school || '').trim();
    } catch (_) { return ''; }
  }
  function isAdmin() {
    try { return window.FluxRole?.current === 'admin' || (typeof getMyRole === 'function' && getMyRole() === 'admin'); } catch (_) { return false; }
  }

  function cache() {
    const c = ls(CACHE_KEY, null);
    return c && typeof c === 'object' ? c : { fetchedAt: 0, days: {}, variants: [] };
  }

  /* ── reads (RLS scopes rows to my school) ── */

  async function refresh() {
    if (!enabled()) return null;
    const sb = client();
    if (!sb || !window.currentUser) return null;
    const from = new Date();
    const to = new Date(Date.now() + HORIZON_DAYS * 864e5);
    const ymd = (d) => (typeof fluxLocalYMD === 'function' ? fluxLocalYMD(d) : d.toISOString().slice(0, 10));
    try {
      const [daysRes, varsRes] = await Promise.all([
        sb.from('flux_school_calendar_days').select('date,schedule_id,closed,note')
          .gte('date', ymd(from)).lte('date', ymd(to)),
        sb.from('flux_school_bell_schedules').select('id,label,periods,is_default'),
      ]);
      if (daysRes.error || varsRes.error) return null;
      const prev = cache();
      const days = {};
      (daysRes.data || []).forEach((r) => {
        days[r.date] = { closed: !!r.closed, note: r.note || '', scheduleId: r.schedule_id || null };
      });
      const next = { fetchedAt: Date.now(), days, variants: varsRes.data || [] };
      lsSave(CACHE_KEY, next);
      proposeReflowForNewClosures(prev.days || {}, days);
      return next;
    } catch (_) { return null; }
  }

  function dayInfo(dateStr) {
    if (!enabled()) return null;
    return cache().days[dateStr] || null;
  }

  function isClosed(dateStr) {
    const d = dayInfo(dateStr);
    return !!(d && d.closed);
  }

  /** FluxNow hook: closure/note or the published variant's periods. */
  function todayOverride(dateStr) {
    const d = dayInfo(dateStr);
    if (!d) return null;
    if (d.closed) return { closed: true, note: d.note ? d.note + ' — no school today.' : '' };
    if (d.scheduleId) {
      const v = cache().variants.find((x) => x.id === d.scheduleId);
      if (v) return { closed: false, variant: v.label, periods: v.periods || [] };
    }
    return null;
  }

  /* ── undoable reflow proposal for NEW closures ── */

  function nextOpenDay(fromStr) {
    const d = new Date(fromStr + 'T12:00:00');
    for (let i = 0; i < 21; i++) {
      d.setDate(d.getDate() + 1);
      const s = (typeof fluxLocalYMD === 'function') ? fluxLocalYMD(d) : d.toISOString().slice(0, 10);
      const dow = d.getDay();
      if (dow === 0 || dow === 6) continue;
      let rest = false;
      try { rest = typeof isBreak === 'function' && isBreak(s); } catch (_) {}
      if (!rest) return s;
    }
    return fromStr;
  }

  function proposeReflowForNewClosures(prevDays, nextDays) {
    try {
      if (typeof tasks === 'undefined' || !Array.isArray(tasks)) return;
      const newlyClosed = Object.keys(nextDays).filter(
        (d) => nextDays[d].closed && !(prevDays[d] && prevDays[d].closed)
      );
      if (!newlyClosed.length) return;
      const affected = tasks.filter((t) => !t.done && t.date && newlyClosed.includes(t.date));
      if (!affected.length) return;
      const label = nextDays[newlyClosed[0]].note || 'School closure';
      if (typeof showToast === 'function') {
        showToast(`${label}: ${affected.length} task${affected.length === 1 ? '' : 's'} due on a closed day — tap to move to the next open day.`, 'info', 10000, {
          kind: 'conflict',
          onClick: () => {
            try { if (typeof snapshotTasks === 'function') snapshotTasks(); } catch (_) {}
            affected.forEach((t) => { t.date = nextOpenDay(t.date); });
            try { save('tasks', tasks); syncKey('tasks', tasks); renderTasks(); renderCalendar(); } catch (_) {}
            try { if (typeof showUndoSnackbar === 'function') showUndoSnackbar(`Moved ${affected.length} off the closed day`); } catch (_) {}
          },
        });
      }
    } catch (_) {}
  }

  /* ── admin writes ── */

  async function saveVariant(v) {
    const sb = client();
    const school = mySchool();
    if (!sb || !school || !isAdmin()) return { ok: false, error: 'admin_only' };
    const row = {
      school,
      label: String(v.label || '').slice(0, 80),
      periods: Array.isArray(v.periods) ? v.periods : [],
      is_default: !!v.isDefault,
      created_by: window.currentUser?.id,
      updated_at: new Date().toISOString(),
    };
    const q = v.id
      ? sb.from('flux_school_bell_schedules').update(row).eq('id', v.id)
      : sb.from('flux_school_bell_schedules').insert(row);
    const { error } = await q;
    if (error) return { ok: false, error: error.message };
    await refresh();
    return { ok: true };
  }

  async function setCalendarDay(dateStr, opts) {
    const sb = client();
    const school = mySchool();
    if (!sb || !school || !isAdmin()) return { ok: false, error: 'admin_only' };
    const { error } = await sb.from('flux_school_calendar_days').upsert({
      school,
      date: dateStr,
      schedule_id: opts.scheduleId || null,
      closed: !!opts.closed,
      note: opts.note ? String(opts.note).slice(0, 200) : null,
      created_by: window.currentUser?.id,
      updated_at: new Date().toISOString(),
    });
    if (error) return { ok: false, error: error.message };
    await refresh();
    return { ok: true };
  }

  /** "Broadcast snow day" — rides the existing emergency/announcement pipeline. */
  async function broadcastSnowDay(dateStr, note) {
    const set = await setCalendarDay(dateStr, { closed: true, note: note || 'Snow day' });
    if (!set.ok) return set;
    try {
      const sb = client();
      if (window.FluxSchoolEmergency?.setBroadcast) {
        await FluxSchoolEmergency.setBroadcast(sb, 'calm', `${note || 'Snow day'} — school closed ${dateStr}.`);
      } else if (sb && window.currentUser) {
        await sb.from('school_announcements').insert({
          posted_by: window.currentUser.id,
          title: note || 'Snow day',
          body: `School is closed on ${dateStr}. Your planner has been updated automatically.`,
          priority: 'high',
          target_roles: ['student', 'teacher', 'counselor', 'staff', 'admin'],
          pinned: true,
        });
      }
    } catch (_) { /* closure row is the source of truth; broadcast is best-effort */ }
    return { ok: true };
  }

  /* ── Admin Operations card (injected, flag + role gated) ── */

  function renderAdminCard() {
    if (!enabled() || !isAdmin()) return;
    const root = document.querySelector('#adminOpsBody .ao-root');
    if (!root || document.getElementById('fluxSchedAuthority')) return;
    const c = cache();
    const card = document.createElement('div');
    card.id = 'fluxSchedAuthority';
    card.className = 'card';
    card.style.cssText = 'margin-top:14px;padding:16px';
    const varOpts = c.variants.map((v) => `<option value="${v.id}">${(v.label || '').replace(/</g, '&lt;')}</option>`).join('');
    const upcoming = Object.keys(c.days).sort().slice(0, 8).map((d) => {
      const x = c.days[d];
      const v = c.variants.find((q) => q.id === x.scheduleId);
      return `<div style="font-size:.78rem;padding:3px 0;color:var(--text2)">${d} — ${x.closed ? '❄ Closed' : (v ? v.label : 'variant')}${x.note ? ' · ' + String(x.note).replace(/</g, '&lt;') : ''}</div>`;
    }).join('') || '<div style="font-size:.78rem;color:var(--muted)">No exceptions published.</div>';
    card.innerHTML = `
      <div style="font-weight:800;margin-bottom:4px">Schedule authority</div>
      <div style="font-size:.75rem;color:var(--muted2);margin-bottom:12px">Bell variants and calendar exceptions publish to every planner in your school.</div>
      <div style="display:grid;gap:8px;grid-template-columns:1fr 1fr;align-items:end">
        <label style="font-size:.72rem;color:var(--muted)">New variant label
          <input id="fsaVarLabel" placeholder="2-hr delay" style="width:100%;margin-top:4px">
        </label>
        <label style="font-size:.72rem;color:var(--muted)">Periods (P1 09:15-10:05, …)
          <input id="fsaVarPeriods" placeholder="P1 10:15-10:55, P2 11:00-11:40" style="width:100%;margin-top:4px">
        </label>
      </div>
      <button type="button" id="fsaSaveVar" class="ao-action-btn" style="margin-top:8px">Save variant</button>
      <div style="display:grid;gap:8px;grid-template-columns:auto 1fr 1fr;align-items:end;margin-top:14px">
        <label style="font-size:.72rem;color:var(--muted)">Date
          <input id="fsaDate" type="date" style="margin-top:4px">
        </label>
        <label style="font-size:.72rem;color:var(--muted)">Assign
          <select id="fsaAssign" style="width:100%;margin-top:4px">
            <option value="">— pick —</option>
            <option value="closed">❄ Closed (no school)</option>
            ${varOpts}
          </select>
        </label>
        <label style="font-size:.72rem;color:var(--muted)">Note
          <input id="fsaNote" placeholder="Snow day" style="width:100%;margin-top:4px">
        </label>
      </div>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button type="button" id="fsaSaveDay" class="ao-action-btn">Publish day</button>
        <button type="button" id="fsaSnowDay" class="ao-action-btn primary">Broadcast snow day</button>
      </div>
      <div style="margin-top:12px">${upcoming}</div>`;
    root.appendChild(card);

    card.querySelector('#fsaSaveVar').addEventListener('click', async () => {
      const label = card.querySelector('#fsaVarLabel').value.trim();
      const raw = card.querySelector('#fsaVarPeriods').value.trim();
      if (!label) { showToast?.('Variant needs a label', 'warning'); return; }
      const periods = raw.split(',').map((s) => {
        const m = /^\s*(\S+)\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\s*$/.exec(s);
        return m ? { label: m[1], start: m[2], end: m[3] } : null;
      }).filter(Boolean);
      const r = await saveVariant({ label, periods });
      showToast?.(r.ok ? 'Variant published' : 'Failed: ' + r.error, r.ok ? 'success' : 'error');
      if (r.ok) { card.remove(); renderAdminCard(); }
    });
    card.querySelector('#fsaSaveDay').addEventListener('click', async () => {
      const date = card.querySelector('#fsaDate').value;
      const assign = card.querySelector('#fsaAssign').value;
      const note = card.querySelector('#fsaNote').value;
      if (!date || !assign) { showToast?.('Pick a date and an assignment', 'warning'); return; }
      const r = await setCalendarDay(date, assign === 'closed' ? { closed: true, note } : { scheduleId: assign, note });
      showToast?.(r.ok ? 'Published to your school' : 'Failed: ' + r.error, r.ok ? 'success' : 'error');
      if (r.ok) { card.remove(); renderAdminCard(); }
    });
    card.querySelector('#fsaSnowDay').addEventListener('click', async () => {
      const date = card.querySelector('#fsaDate').value;
      const note = card.querySelector('#fsaNote').value || 'Snow day';
      if (!date) { showToast?.('Pick the closure date', 'warning'); return; }
      const r = await broadcastSnowDay(date, note);
      showToast?.(r.ok ? 'Snow day broadcast to your school' : 'Failed: ' + r.error, r.ok ? 'success' : 'error');
      if (r.ok) { card.remove(); renderAdminCard(); }
    });
  }

  function boot() {
    setTimeout(() => { if (enabled()) refresh(); }, 2500);
    document.addEventListener('flux-nav', (e) => {
      if (e?.detail?.panel === 'adminOps') setTimeout(renderAdminCard, 400);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.FluxSchoolSchedules = {
    FLAG, enabled, refresh, dayInfo, isClosed, todayOverride,
    saveVariant, setCalendarDay, broadcastSnowDay, renderAdminCard,
    _cacheKey: CACHE_KEY,
  };
})();
