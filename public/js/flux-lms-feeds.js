/* ════════════════════════════════════════════════════════════════════════════
 * FluxLmsFeeds — Schoology and Moodle, connected through each student's
 * private calendar link.
 *
 * Both systems give every student an export link for their own calendar
 * (assignments, quizzes, due dates). The student pastes that link once; the
 * lms-feed edge function fetches it (browsers can't, no CORS) and we turn the
 * events into planner tasks. No school admin setup and no passwords.
 *
 * Renders into the Schoology / Moodle tabs of the Connect panel
 * (flux-google-hub.js). Links are kept on this device only.
 *
 * Public API on window.FluxLmsFeeds:
 *   .render(el, provider)     draw the tab ('schoology' | 'moodle')
 *   .isConnected(provider)
 *   .parseIcs(text)           pure parser, exported for tests
 * ──────────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  if (window.FluxLmsFeeds) return;

  const STORE_KEY = 'flux_lms_feeds';
  const UPCOMING_DAYS = 90;

  const PROVIDERS = {
    schoology: {
      name: 'Schoology',
      placeholder: 'webcal://yourschool.schoology.com/calendar/feed/ical/…',
      steps: [
        'Open Schoology and go to <strong>Calendar</strong>.',
        'Click <strong>Export</strong> (top right of the calendar).',
        'Copy the link it shows you and paste it below.',
      ],
    },
    moodle: {
      name: 'Moodle',
      placeholder: 'https://moodle.yourschool.edu/calendar/export_execute.php?…',
      steps: [
        'Open Moodle and go to <strong>Calendar</strong>.',
        'Click <strong>Import or export calendars</strong>, then <strong>Export calendar</strong>.',
        'Choose <strong>All events</strong> and <strong>Recent and next 60 days</strong>, then click <strong>Get calendar URL</strong>.',
        'Copy the link and paste it below.',
      ],
    },
  };

  const cache = { schoology: null, moodle: null }; // { events, fetchedAt }
  const busy = { schoology: false, moodle: false };
  const errors = { schoology: '', moodle: '' };

  /* ── helpers ── */
  function esc(s) {
    if (typeof window.esc === 'function') return window.esc(s);
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function toast(msg, kind) {
    if (typeof window.showToast === 'function') window.showToast(msg, kind || 'info');
  }
  function readStore() {
    try {
      const v = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      return v && typeof v === 'object' ? v : {};
    } catch (_) {
      return {};
    }
  }
  function writeStore(v) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(v)); } catch (_) {}
  }
  function feedUrl(provider) {
    const e = readStore()[provider];
    return e && typeof e.url === 'string' ? e.url : '';
  }
  function isConnected(provider) {
    return !!feedUrl(provider);
  }
  function taskList() {
    return Array.isArray(window.tasks) ? window.tasks : [];
  }
  function ymd(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  /* ── iCalendar parsing ── */
  function unescapeText(s) {
    return String(s || '')
      .replace(/\\n/gi, '\n')
      .replace(/\\([,;\\])/g, '$1')
      .trim();
  }

  /** DTSTART value + params → { date: 'YYYY-MM-DD', time: 'HH:MM' | '' } */
  function parseIcsDate(value, params) {
    const v = String(value || '').trim();
    const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(v);
    if (!m) return null;
    const [, y, mo, d, hh, mi, , z] = m;
    if (!hh || /VALUE=DATE(?!-)/i.test(params || '')) return { date: `${y}-${mo}-${d}`, time: '' };
    if (z) {
      // UTC instant → the student's local day and time.
      const dt = new Date(Date.UTC(+y, +mo - 1, +d, +hh, +mi));
      return { date: ymd(dt), time: `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}` };
    }
    return { date: `${y}-${mo}-${d}`, time: `${hh}:${mi}` };
  }

  function parseIcs(text) {
    // Unfold continuation lines (RFC 5545 §3.1).
    const lines = String(text || '').replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
    const events = [];
    let cur = null;
    for (const line of lines) {
      if (line === 'BEGIN:VEVENT') { cur = {}; continue; }
      if (line === 'END:VEVENT') {
        if (cur && cur.uid && cur.start) events.push(cur);
        cur = null;
        continue;
      }
      if (!cur) continue;
      const colon = line.indexOf(':');
      if (colon < 0) continue;
      const head = line.slice(0, colon);
      const value = line.slice(colon + 1);
      const semi = head.indexOf(';');
      const name = (semi < 0 ? head : head.slice(0, semi)).toUpperCase();
      const params = semi < 0 ? '' : head.slice(semi + 1);
      if (name === 'UID') cur.uid = value.trim();
      else if (name === 'SUMMARY') cur.title = unescapeText(value);
      else if (name === 'DESCRIPTION') cur.description = unescapeText(value);
      else if (name === 'URL') cur.url = value.trim();
      else if (name === 'CATEGORIES') cur.course = unescapeText(value.split(',')[0]);
      else if (name === 'DTSTART') cur.start = parseIcsDate(value, params);
    }
    return events;
  }

  /* ── network ── */
  async function fetchEvents(provider, url) {
    const base = (typeof SB_URL !== 'undefined' && SB_URL) || '';
    if (!base) throw new Error('Flux is still loading — try again in a moment.');
    const headers = typeof window.fluxAuthHeaders === 'function'
      ? await window.fluxAuthHeaders()
      : { 'Content-Type': 'application/json' };
    const res = await fetch(`${base}/functions/v1/lms-feed`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ provider, url }),
    });
    let data = null;
    try { data = await res.json(); } catch (_) {}
    if (res.status === 401) throw new Error('Sign in to Flux to connect ' + PROVIDERS[provider].name + '.');
    if (!res.ok || !data || typeof data.ics !== 'string') {
      throw new Error((data && data.error) || `Could not load your ${PROVIDERS[provider].name} calendar.`);
    }
    return parseIcs(data.ics);
  }

  async function refresh(provider, el) {
    const url = feedUrl(provider);
    if (!url || busy[provider]) return;
    busy[provider] = true;
    errors[provider] = '';
    render(el, provider);
    try {
      cache[provider] = { events: await fetchEvents(provider, url), fetchedAt: Date.now() };
    } catch (e) {
      errors[provider] = (e && e.message) || 'Something went wrong.';
    } finally {
      busy[provider] = false;
      render(el, provider);
    }
  }

  /* ── planner import ── */
  function taskFor(provider, uid) {
    return taskList().find((t) => t && t.lmsSource === provider && t.lmsUid === uid) || null;
  }

  function upcoming(provider) {
    const c = cache[provider];
    if (!c) return [];
    const from = ymd(new Date());
    const until = new Date();
    until.setDate(until.getDate() + UPCOMING_DAYS);
    const to = ymd(until);
    return c.events
      .filter((e) => e.start.date >= from && e.start.date <= to)
      .sort((a, b) => (a.start.date + a.start.time).localeCompare(b.start.date + b.start.time));
  }

  function inferType(title) {
    const t = String(title || '').toLowerCase();
    if (/\b(test|exam|midterm|final)\b/.test(t)) return 'test';
    if (/\bquiz\b/.test(t)) return 'quiz';
    if (/\b(project|essay|lab report|presentation)\b/.test(t)) return 'project';
    return 'hw';
  }

  function subjectKey(course) {
    if (!course || typeof window.canvasFluxSubjectKeyFromCourseName !== 'function') return '';
    try { return window.canvasFluxSubjectKeyFromCourseName(course) || ''; } catch (_) { return ''; }
  }

  function addEvent(provider, ev, opts) {
    if (taskFor(provider, ev.uid)) return false;
    const type = inferType(ev.title);
    const t = {
      id: Date.now() + Math.random(),
      name: String(ev.title || 'Assignment').slice(0, 240),
      date: ev.start.date,
      subject: subjectKey(ev.course),
      priority: type === 'test' ? 'high' : 'med',
      type,
      notes: [ev.course ? `${PROVIDERS[provider].name}: ${ev.course}` : `From ${PROVIDERS[provider].name}`,
        ev.start.time ? `Due ${ev.start.time}` : '',
        (ev.description || '').slice(0, 500),
        ev.url || ''].filter(Boolean).join('\n'),
      estTime: 45,
      done: false,
      rescheduled: 0,
      createdAt: Date.now(),
      lmsSource: provider,
      lmsUid: ev.uid,
    };
    if (typeof window.calcUrgency === 'function') t.urgencyScore = window.calcUrgency(t);
    const list = taskList();
    list.unshift(t);
    if (!(opts && opts.skipSave)) saveAndRender(list);
    return true;
  }

  function saveAndRender(list) {
    if (typeof window.save === 'function') window.save('tasks', list);
    if (typeof window.syncKey === 'function') window.syncKey('tasks', list);
    ['renderStats', 'renderTasks', 'renderCalendar', 'renderCountdown'].forEach((fn) => {
      try { if (typeof window[fn] === 'function') window[fn](); } catch (_) {}
    });
  }

  /* ── UI ── */
  function connectFormHtml(provider) {
    const p = PROVIDERS[provider];
    return `
      <div class="flux-lms-card">
        <h3 class="flux-lms-title">Connect ${p.name}</h3>
        <p class="g-hub-muted">Flux reads your ${p.name} calendar link to bring assignments and due dates into your planner. You only do this once.</p>
        <ol class="flux-lms-steps">${p.steps.map((s) => `<li>${s}</li>`).join('')}</ol>
        <form class="flux-lms-form" data-lms-connect="${provider}">
          <label class="flux-lms-label" for="fluxLmsUrl-${provider}">${p.name} calendar link</label>
          <input type="url" id="fluxLmsUrl-${provider}" class="flux-lms-input" inputmode="url" autocomplete="off" spellcheck="false" placeholder="${esc(p.placeholder)}" required>
          ${errors[provider] ? `<p class="flux-lms-error" role="alert">${esc(errors[provider])}</p>` : ''}
          <button type="submit" class="flux-lms-btn flux-lms-btn--primary" ${busy[provider] ? 'disabled' : ''}>${busy[provider] ? 'Connecting…' : 'Connect ' + p.name}</button>
        </form>
        <p class="g-hub-muted flux-lms-fine">This link is private to you — Flux keeps it on this device only.</p>
      </div>`;
  }

  function eventRowHtml(provider, ev) {
    const inPlanner = !!taskFor(provider, ev.uid);
    const when = new Date(ev.start.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    return `
      <li class="flux-lms-row">
        <div class="flux-lms-row-main">
          <div class="flux-lms-row-title">${esc(ev.title || 'Untitled')}</div>
          <div class="flux-lms-row-meta">${esc(when)}${ev.start.time ? ' · ' + esc(ev.start.time) : ''}${ev.course ? ' · ' + esc(ev.course) : ''}</div>
        </div>
        ${inPlanner
          ? '<span class="flux-lms-done">In planner ✓</span>'
          : `<button type="button" class="flux-lms-btn" data-lms-add="${esc(ev.uid)}">+ Task</button>`}
      </li>`;
  }

  function connectedHtml(provider) {
    const p = PROVIDERS[provider];
    const c = cache[provider];
    const list = upcoming(provider);
    const missing = list.filter((e) => !taskFor(provider, e.uid)).length;
    let body;
    if (busy[provider] && !c) body = `<p class="g-hub-muted">Loading your ${p.name} calendar…</p>`;
    else if (!c) body = '';
    else if (!list.length) body = `<p class="g-hub-muted">Nothing due in the next ${UPCOMING_DAYS} days.</p>`;
    else body = `<ul class="flux-lms-list">${list.map((e) => eventRowHtml(provider, e)).join('')}</ul>`;
    return `
      <div class="flux-lms-card">
        <div class="flux-lms-head">
          <div>
            <h3 class="flux-lms-title">${p.name} <span class="flux-lms-pill">Connected</span></h3>
            <p class="g-hub-muted">${c ? `Updated ${new Date(c.fetchedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}` : ''}</p>
          </div>
          <div class="flux-lms-actions">
            ${missing ? `<button type="button" class="flux-lms-btn flux-lms-btn--primary" data-lms-addall>Add all ${missing}</button>` : ''}
            <button type="button" class="flux-lms-btn" data-lms-refresh ${busy[provider] ? 'disabled' : ''}>${busy[provider] ? 'Refreshing…' : 'Refresh'}</button>
            <button type="button" class="flux-lms-btn flux-lms-btn--quiet" data-lms-disconnect>Disconnect</button>
          </div>
        </div>
        ${errors[provider] ? `<p class="flux-lms-error" role="alert">${esc(errors[provider])}</p>` : ''}
        ${body}
      </div>`;
  }

  function bind(el, provider) {
    const form = el.querySelector('[data-lms-connect]');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const url = String(form.querySelector('input').value || '').trim();
        if (!url) return;
        busy[provider] = true;
        errors[provider] = '';
        render(el, provider);
        try {
          const events = await fetchEvents(provider, url);
          const store = readStore();
          store[provider] = { url, connectedAt: Date.now() };
          writeStore(store);
          cache[provider] = { events, fetchedAt: Date.now() };
          toast(`${PROVIDERS[provider].name} connected ✓`, 'success');
        } catch (err) {
          errors[provider] = (err && err.message) || 'Could not connect.';
        } finally {
          busy[provider] = false;
          render(el, provider);
        }
      });
    }
    el.querySelectorAll('[data-lms-add]').forEach((b) => {
      b.addEventListener('click', () => {
        const ev = upcoming(provider).find((x) => x.uid === b.getAttribute('data-lms-add'));
        if (ev && addEvent(provider, ev)) toast(`Added "${String(ev.title).slice(0, 40)}" to planner ✓`, 'success');
        render(el, provider);
      });
    });
    el.querySelector('[data-lms-addall]')?.addEventListener('click', () => {
      let n = 0;
      upcoming(provider).forEach((ev) => { if (addEvent(provider, ev, { skipSave: true })) n++; });
      if (n) saveAndRender(taskList());
      toast(n ? `Added ${n} to your planner ✓` : 'Nothing new to add', n ? 'success' : 'info');
      render(el, provider);
    });
    el.querySelector('[data-lms-refresh]')?.addEventListener('click', () => refresh(provider, el));
    el.querySelector('[data-lms-disconnect]')?.addEventListener('click', () => {
      if (!window.confirm(`Disconnect ${PROVIDERS[provider].name}? Tasks already in your planner stay.`)) return;
      const store = readStore();
      delete store[provider];
      writeStore(store);
      cache[provider] = null;
      errors[provider] = '';
      render(el, provider);
    });
  }

  function render(el, provider) {
    if (!el || !PROVIDERS[provider]) return;
    el.innerHTML = `<div class="flux-lms">${isConnected(provider) ? connectedHtml(provider) : connectFormHtml(provider)}</div>`;
    bind(el, provider);
    // First open after connecting (or after a reload): pull the feed.
    if (isConnected(provider) && !cache[provider] && !busy[provider] && !errors[provider]) refresh(provider, el);
  }

  window.FluxLmsFeeds = { render, isConnected, parseIcs };
})();
