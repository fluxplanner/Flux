/**
 * Google Calendar two-way sync + overload-aware scheduling.
 * Flag: enable_gcal_2way (default off). Extends flux-gcal-push.js when present.
 */
(function () {
  'use strict';

  const LS_LINKED = 'flux_gcal_2way_linked';
  const LS_SETTINGS = 'flux_gcal_2way_settings';
  const LS_LAST_SYNC = 'flux_gcal_2way_last_sync';

  let _legacySync = null;

  function enabled() {
    try {
      return !!window.FluxFeatureFlags?.isEnabled('enable_gcal_2way', false);
    } catch (_) {
      return false;
    }
  }

  function load(k, def) {
    if (typeof window.load === 'function') return window.load(k, def);
    try {
      const raw = localStorage.getItem(k);
      return raw ? JSON.parse(raw) : def;
    } catch (_) {
      return def;
    }
  }

  function save(k, v) {
    if (typeof window.save === 'function') window.save(k, v);
    else {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch (_) {}
    }
  }

  function esc(s) {
    if (typeof window.esc === 'function') return window.esc(s);
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function toast(msg, kind) {
    if (typeof window.showToast === 'function') window.showToast(msg, kind || 'info');
    else console.log('[gcal-2way]', msg);
  }

  function getToken() {
    return window.gmailToken || sessionStorage.getItem('flux_gmail_token') || null;
  }

  function taskList() {
    return Array.isArray(window.tasks) ? window.tasks : [];
  }

  function settings() {
    const s = load(LS_SETTINGS, {});
    return {
      importMode: s.importMode === 'tasks' ? 'tasks' : 'events',
      pushOpen: !!s.pushOpen,
      overloadAware: s.overloadAware !== false,
    };
  }

  function saveSettings(patch) {
    save(LS_SETTINGS, { ...settings(), ...patch });
  }

  function linkedMap() {
    const m = load(LS_LINKED, {});
    return m && typeof m === 'object' ? m : {};
  }

  function saveLinked(m) {
    save(LS_LINKED, m || {});
  }

  function todayStr() {
    if (typeof window.todayStr === 'function') return window.todayStr();
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function estMins(t) {
    const m = parseInt(t.estTime, 10);
    return Number.isFinite(m) && m > 0 ? m : 30;
  }

  function isRestDay(ds) {
    try {
      if (typeof window.isBreak === 'function' && window.isBreak(ds)) return true;
    } catch (_) {}
    return false;
  }

  /** Next 7 days workload from open tasks (matches dashboard week strip heuristic). */
  function computeWeekLoad() {
    const start = todayStr();
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(`${start}T12:00:00`);
      d.setDate(d.getDate() + i);
      days.push(d.toISOString().slice(0, 10));
    }
    const weekStart = days[0];
    const byDay = days.map((ds) => {
      let mins = 0;
      let n = 0;
      taskList().forEach((t) => {
        if (!t || t.done || !t.date) return;
        const effective = t.date < weekStart ? weekStart : t.date;
        if (effective !== ds) return;
        mins += estMins(t);
        n += 1;
      });
      return { date: ds, mins, count: n, rest: isRestDay(ds) };
    });
    const totalMins = byDay.reduce((a, x) => a + x.mins, 0);
    const avg = totalMins > 0 ? totalMins / 7 : 0;
    const enriched = byDay.map((row) => {
      if (row.rest) return { ...row, level: 'rest' };
      let level = 'ok';
      if (row.mins >= 240 || row.count >= 12) level = 'high';
      else if (row.mins >= Math.max(120, avg * 1.4) || row.count >= Math.max(6, Math.ceil(avg / 30)))
        level = 'elevated';
      return { ...row, level };
    });
    const weekLevel = enriched.some((d) => d.level === 'high')
      ? 'high'
      : enriched.some((d) => d.level === 'elevated')
        ? 'elevated'
        : 'ok';
    return { days: enriched, weekLevel, totalMins };
  }

  function dayLevel(ds) {
    const w = computeWeekLoad();
    const row = w.days.find((d) => d.date === ds);
    return row ? row.level : 'ok';
  }

  function schedulingHint(ds) {
    const lvl = dayLevel(ds);
    if (lvl === 'rest') return 'Rest day — consider a lighter schedule.';
    if (lvl === 'high') return 'Heavy workload day — avoid adding major deadlines here.';
    if (lvl === 'elevated') return 'Busy day — stagger due dates if you can.';
    return 'Lighter load day — good candidate for new deadlines.';
  }

  function suggestDueDate(taskId) {
    const t = taskList().find((x) => String(x.id) === String(taskId));
    if (!t) {
      toast('Task not found', 'error');
      return null;
    }
    const w = computeWeekLoad();
    const candidates = w.days
      .filter((d) => d.level !== 'rest' && d.level !== 'high')
      .sort((a, b) => a.mins - b.mins || a.count - b.count);
    const pick = candidates[0] || w.days.filter((d) => d.level !== 'rest').sort((a, b) => a.mins - b.mins)[0];
    if (!pick) {
      toast('No open days in the next week', 'warning');
      return null;
    }
    t.date = pick.date;
    if (typeof window.calcUrgency === 'function') t.urgencyScore = window.calcUrgency(t);
    save('tasks', taskList());
    if (typeof window.syncKey === 'function') window.syncKey('tasks', taskList());
    if (typeof window.renderTasks === 'function') window.renderTasks();
    if (typeof window.renderCalendar === 'function') window.renderCalendar();
    if (typeof window.renderStats === 'function') window.renderStats();
    toast(`Due date set to ${pick.date} (${schedulingHint(pick.date).split('—')[0].trim()})`, 'success');
    return pick.date;
  }

  async function fetchGCalEvents(daysAhead) {
    const token = getToken();
    if (!token) return { ok: false, needsSignIn: true };
    const now = new Date();
    const end = new Date();
    end.setDate(end.getDate() + (daysAhead || 35));
    try {
      const url =
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(now.toISOString())}` +
        `&timeMax=${encodeURIComponent(end.toISOString())}&maxResults=50&singleEvents=true&orderBy=startTime`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) return { ok: false, expired: true };
      if (!res.ok) return { ok: false, error: `Calendar API ${res.status}` };
      const data = await res.json();
      return { ok: true, items: data.items || [] };
    } catch (e) {
      return { ok: false, error: String(e.message || e) };
    }
  }

  function gcalEventDate(ev) {
    const start = ev.start?.dateTime || ev.start?.date || '';
    return start ? String(start).slice(0, 10) : '';
  }

  function importEvent(ev, mode) {
    const gcalId = ev.id;
    if (!gcalId) return { skipped: true };
    const linked = linkedMap();
    if (linked[gcalId]) return { skipped: true };

    const date = gcalEventDate(ev);
    const title = ev.summary || '(no title)';
    if (!date) return { skipped: true };

    if (mode === 'tasks') {
      const task = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        name: title,
        date,
        subject: '',
        priority: 'med',
        type: 'hw',
        done: false,
        rescheduled: 0,
        createdAt: Date.now(),
        gcalId,
        source: 'gcal',
      };
      if (typeof window.calcUrgency === 'function') task.urgencyScore = window.calcUrgency(task);
      const list = taskList();
      list.unshift(task);
      save('tasks', list);
      linked[gcalId] = { type: 'task', localId: task.id };
      saveLinked(linked);
      return { imported: true, kind: 'task' };
    }

    const events = load('flux_events', []);
    const time = ev.start?.dateTime ? String(ev.start.dateTime).slice(11, 16) : '';
    const id = String(Date.now() + Math.floor(Math.random() * 1000));
    events.push({
      id,
      title,
      date,
      time: time || '',
      notes: 'Imported from Google Calendar',
      scope: 'outside',
      gcalId,
      source: 'gcal',
    });
    save('flux_events', events);
    if (typeof window.syncKey === 'function') window.syncKey('events', 1);
    linked[gcalId] = { type: 'event', localId: id };
    saveLinked(linked);
    return { imported: true, kind: 'event' };
  }

  async function pushOpenTasks(limit) {
    const max = limit || 8;
    let pushed = 0;
    if (typeof window.fluxPushTaskToGCal !== 'function') return pushed;
    const open = taskList().filter((t) => t && !t.done && t.date);
    const map = typeof window.fluxGCalPushedMap === 'function' ? window.fluxGCalPushedMap() : {};
    for (const t of open) {
      if (pushed >= max) break;
      if (map[t.id]) continue;
      if (settings().overloadAware && dayLevel(t.date) === 'high') continue;
      await window.fluxPushTaskToGCal(t.id);
      pushed += 1;
    }
    return pushed;
  }

  function renderWeekStrip() {
    const w = computeWeekLoad();
    const maxM = Math.max(1, ...w.days.map((d) => (d.rest ? 0 : d.mins)));
    return `<div class="flux-gcal-2way-week" role="img" aria-label="Your workload next 7 days">${w.days
      .map((d) => {
        const h = d.rest ? 8 : Math.round(Math.max(10, (d.mins / maxM) * 36));
        const lbl = new Date(`${d.date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'narrow' });
        return `<div class="flux-gcal-2way-day flux-gcal-2way-day--${esc(d.level)}" title="${esc(d.date)}: ${d.count} tasks · ~${d.mins}m">
          <div class="flux-gcal-2way-day-bar" style="height:${h}px"></div>
          <span class="flux-gcal-2way-day-lbl">${esc(lbl)}</span>
        </div>`;
      })
      .join('')}</div>`;
  }

  function renderEventsList(items) {
    if (!items.length) {
      return '<div style="color:var(--muted);font-size:.68rem">No upcoming Google events</div>';
    }
    const aware = settings().overloadAware;
    return items
      .slice(0, 12)
      .map((ev) => {
        const date = gcalEventDate(ev);
        const lvl = aware ? dayLevel(date) : 'ok';
        const start = ev.start?.dateTime || ev.start?.date || '';
        const d = start
          ? new Date(start).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
          : '';
        const enc = encodeURIComponent(ev.summary || '');
        return `<div class="flux-gcal-2way-ev">
          <div class="flux-gcal-2way-ev-dot flux-gcal-2way-ev-dot--${esc(lvl === 'rest' ? 'ok' : lvl)}"></div>
          <div class="flux-gcal-2way-ev-body">
            <div class="flux-gcal-2way-ev-title">${esc(ev.summary || '(no title)')}</div>
            <div class="flux-gcal-2way-ev-meta">${esc(d)}${aware && lvl !== 'ok' ? ` · ${esc(lvl)} load` : ''}</div>
          </div>
          <div class="flux-gcal-2way-ev-actions">
            <button type="button" data-gcal-import="${esc(ev.id)}" data-gcal-title="${esc(ev.summary || '')}" data-gcal-date="${esc(date)}">+ Import</button>
          </div>
        </div>`;
      })
      .join('');
  }

  function mountPanel() {
    const wrap = document.querySelector('.cal-gcal-inline');
    if (!wrap || !enabled()) return;
    wrap.classList.add('flux-gcal-2way-host');
    const title = wrap.querySelector('.cal-gcal-inline-title');
    if (title) title.textContent = 'Google Calendar · 2-way';
    let strip = document.getElementById('fluxGcal2wayWeek');
    if (!strip) {
      strip = document.createElement('div');
      strip.id = 'fluxGcal2wayWeek';
      const status = document.getElementById('gcalStatus');
      if (status && status.parentNode === wrap) {
        status.insertAdjacentElement('beforebegin', strip);
      } else {
        wrap.prepend(strip);
      }
    }
    strip.innerHTML = renderWeekStrip();

    let opts = document.getElementById('fluxGcal2wayOpts');
    if (!opts) {
      opts = document.createElement('div');
      opts.id = 'fluxGcal2wayOpts';
      opts.className = 'flux-gcal-2way-opts';
      strip.insertAdjacentElement('afterend', opts);
    }
    const cfg = settings();
    opts.innerHTML = `
      <label><input type="radio" name="fluxGcal2Import" value="events"${cfg.importMode === 'events' ? ' checked' : ''}> Import as events</label>
      <label><input type="radio" name="fluxGcal2Import" value="tasks"${cfg.importMode === 'tasks' ? ' checked' : ''}> Import as tasks</label>
      <label><input type="checkbox" id="fluxGcal2PushOpen"${cfg.pushOpen ? ' checked' : ''}> Push open tasks</label>
      <label><input type="checkbox" id="fluxGcal2Overload"${cfg.overloadAware ? ' checked' : ''}> Overload-aware</label>`;

    opts.querySelectorAll('input[name="fluxGcal2Import"]').forEach((inp) => {
      inp.addEventListener('change', () => {
        if (inp.checked) saveSettings({ importMode: inp.value });
      });
    });
    document.getElementById('fluxGcal2PushOpen')?.addEventListener('change', (e) => {
      saveSettings({ pushOpen: !!e.target.checked });
    });
    document.getElementById('fluxGcal2Overload')?.addEventListener('change', (e) => {
      saveSettings({ overloadAware: !!e.target.checked });
      const s = document.getElementById('fluxGcal2wayWeek');
      if (s) s.innerHTML = renderWeekStrip();
    });

    let actions = document.getElementById('fluxGcal2wayActions');
    if (!actions) {
      actions = document.createElement('div');
      actions.id = 'fluxGcal2wayActions';
      actions.className = 'flux-gcal-2way-actions';
      opts.insertAdjacentElement('afterend', actions);
    }
    actions.innerHTML = `
      <button type="button" class="flux-gcal-2way-btn flux-gcal-2way-btn--primary" id="fluxGcal2SyncBtn">↻ Sync two-way</button>
      <button type="button" class="flux-gcal-2way-btn" id="fluxGcal2SuggestBtn">Suggest lighter dates</button>`;
    document.getElementById('fluxGcal2SyncBtn')?.addEventListener('click', () => sync());
    document.getElementById('fluxGcal2SuggestBtn')?.addEventListener('click', () => {
      const open = taskList().filter((t) => t && !t.done && !t.date);
      if (!open.length) {
        toast('No open tasks without a due date', 'info');
        return;
      }
      let n = 0;
      open.slice(0, 5).forEach((t) => {
        if (suggestDueDate(t.id)) n += 1;
      });
      if (n) mountPanel();
    });

    let hint = document.getElementById('fluxGcal2wayHint');
    if (!hint) {
      hint = document.createElement('p');
      hint.id = 'fluxGcal2wayHint';
      hint.className = 'flux-gcal-2way-hint';
      actions.insertAdjacentElement('afterend', hint);
    }
    hint.textContent =
      'Pull imports new Google events; push sends open Flux tasks (skips heavy days when overload-aware). You stay in control — nothing deletes automatically.';

    const syncBtn = wrap.querySelector('.cal-gcal-sync-btn');
    if (syncBtn) syncBtn.textContent = 'Quick refresh';
  }

  function bindEventImports(host) {
    host?.querySelectorAll('[data-gcal-import]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-gcal-import');
        const fake = { id, summary: btn.getAttribute('data-gcal-title'), start: { date: btn.getAttribute('data-gcal-date') } };
        const res = importEvent(fake, settings().importMode);
        if (res.imported) {
          toast(`Imported as ${res.kind}`, 'success');
          if (typeof window.renderCalendar === 'function') window.renderCalendar();
          if (typeof window.renderTasks === 'function') window.renderTasks();
          btn.textContent = '✓';
        } else {
          toast('Already linked', 'info');
        }
      });
    });
  }

  async function sync(opts) {
    const statusEl = (opts && opts.statusEl) || document.getElementById('gcalStatus');
    const eventsEl = (opts && opts.eventsEl) || document.getElementById('gcalEvents');
    if (!enabled()) {
      if (_legacySync) return _legacySync(opts);
      return;
    }

    mountPanel();

    if (!getToken()) {
      if (statusEl) statusEl.innerHTML = '<div class="sync-badge offline">○ Sign in with Google to sync</div>';
      return;
    }

    if (statusEl) statusEl.innerHTML = '<div class="sync-badge syncing">↻ Two-way sync…</div>';

    const fetched = await fetchGCalEvents(35);
    if (!fetched.ok) {
      if (fetched.needsSignIn || fetched.expired) {
        if (statusEl) statusEl.innerHTML = '<div class="sync-badge offline">○ Sign in again for Calendar</div>';
      } else if (statusEl) statusEl.innerHTML = `<div style="color:var(--red);font-size:.78rem">${esc(fetched.error)}</div>`;
      return;
    }

    const cfg = settings();
    let imported = 0;
    (fetched.items || []).forEach((ev) => {
      const r = importEvent(ev, cfg.importMode);
      if (r.imported) imported += 1;
    });

    let pushed = 0;
    if (cfg.pushOpen) {
      pushed = await pushOpenTasks(8);
    }

    save(LS_LAST_SYNC, Date.now());
    const w = computeWeekLoad();

    if (statusEl) {
      statusEl.innerHTML = `<div class="sync-badge synced">✓ ${(fetched.items || []).length} events · ${imported} new · ${pushed} pushed · ${esc(w.weekLevel)} week</div>`;
    }
    if (eventsEl) {
      eventsEl.innerHTML = renderEventsList(fetched.items || []);
      bindEventImports(eventsEl);
    }

    const strip = document.getElementById('fluxGcal2wayWeek');
    if (strip) strip.innerHTML = renderWeekStrip();

    if (imported || pushed) {
      if (typeof window.renderCalendar === 'function') window.renderCalendar();
      if (typeof window.renderTasks === 'function') window.renderTasks();
    }
  }

  function install() {
    if (!enabled()) return false;
    if (!_legacySync && typeof window.syncGoogleCalendar === 'function') {
      _legacySync = window.syncGoogleCalendar;
      window.syncGoogleCalendar = function (opts) {
        return sync(opts);
      };
    }
    return true;
  }

  window.FluxGCal2Way = {
    enabled,
    install,
    sync,
    mountPanel,
    computeWeekLoad,
    suggestDueDate,
    schedulingHint,
    dayLevel,
  };
  window.fluxGCal2WaySuggestDueDate = suggestDueDate;
})();
