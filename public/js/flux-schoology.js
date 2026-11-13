/**
 * flux-schoology.js — keeps Flux tasks in step with a student's Schoology or
 * Moodle calendar. One sync engine, two instances: window.FluxSchoology and
 * window.FluxMoodle. Both show as tabs in the Connect panel (flux-google-hub.js).
 *
 * Neither system lets most students create an API key, but each lets a student
 * copy a private calendar link. It carries assignment and event dates only,
 * with no grades. The schoology-feed edge function fetches the link because
 * browsers can't read it directly; it accepts any public calendar link, so
 * Moodle uses it too.
 *
 * Rules a sync must keep:
 *  - A task deleted in Flux stays deleted: every imported event is remembered in
 *    `seen`, which syncs with the account.
 *  - A task moved in Flux stays moved until the teacher changes the date.
 *  - Task ids come from the event, so two devices syncing at once add one task.
 */
(function () {
  'use strict';

  var AUTO_SYNC_MS = 30 * 60 * 1000;
  var LOOKBACK_DAYS = 7;
  var MAX_SEEN = 3000;
  /* The calendar also carries school-wide days, which are not things to do. */
  var NOT_WORK_RE = /\b(no school|holiday|vacation|winter break|spring break|fall break|summer break|teacher (work|in-?service)|staff development|school closed|early dismissal|picture day)\b/i;

  /* ── Reading the calendar ─────────────────────────────────────────── */

  function unescapeText(s) {
    return String(s).replace(/\\([nN,;\\])/g, function (_, c) {
      return c === 'n' || c === 'N' ? '\n' : c;
    }).trim();
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function isoLocal(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  /** A time ending in Z is UTC: 11:59pm in New York arrives dated the next day,
   *  so it must be converted to the student's own day. */
  function parseIcsDay(value) {
    var m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(String(value).trim());
    if (!m) return '';
    if (m[7]) return isoLocal(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])));
    return m[1] + '-' + m[2] + '-' + m[3];
  }

  function parseIcs(text) {
    var lines = String(text).replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n');
    var events = [];
    var cur = null;
    lines.forEach(function (line) {
      if (line === 'BEGIN:VEVENT') { cur = {}; return; }
      if (line === 'END:VEVENT') {
        if (cur && cur.uid && cur.summary && cur.date) events.push(cur);
        cur = null;
        return;
      }
      if (!cur) return;
      var at = line.indexOf(':');
      if (at < 0) return;
      var name = line.slice(0, at).split(';')[0].toUpperCase();
      var val = line.slice(at + 1);
      if (name === 'UID') cur.uid = val.trim();
      else if (name === 'SUMMARY') cur.summary = unescapeText(val);
      else if (name === 'DESCRIPTION') cur.description = unescapeText(val);
      else if (name === 'URL') cur.url = val.trim();
      /* Moodle puts the course short name here. */
      else if (name === 'CATEGORIES') cur.category = unescapeText(val.split(',')[0]);
      else if (name === 'DTSTART') cur.date = parseIcsDay(val);
    });
    return events;
  }

  /* ── Turning events into tasks ────────────────────────────────────── */

  function hashId(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return 2e12 + h; /* above any Date.now()-based id until the year 2033 */
  }

  function inferType(title) {
    if (/\bquiz\b/i.test(title)) return 'quiz';
    if (/\b(test|exam|midterm|final|assessment)\b/i.test(title)) return 'test';
    if (/\b(project|essay|paper|presentation)\b/i.test(title)) return 'project';
    return 'hw';
  }

  function squash(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ''); }

  function subjectFor(ev, classes) {
    var hay = squash(ev.summary + ' ' + (ev.category || '') + ' ' + (ev.description || ''));
    var match = (classes || []).find(function (c) {
      var name = squash(c && c.name);
      return name.length >= 3 && hay.indexOf(name) >= 0;
    });
    return match ? 'CLS' + match.id : '';
  }

  function toast(msg, kind) { try { if (typeof window.showToast === 'function') window.showToast(msg, kind); } catch (e) {} }

  function escHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function refreshPlanner() {
    ['renderStats', 'renderTasks', 'renderCalendar', 'renderCountdown'].forEach(function (fn) {
      try { if (typeof window[fn] === 'function') window[fn](); } catch (e) {}
    });
  }

  /**
   * One calendar-link connection. cfg:
   *   id        cloud slice name and Connect-panel tab id ('schoology' | 'moodle')
   *   name      shown to the student; also the element id prefix (fluxMoodleUrl…)
   *   field     task field prefix: <field>Uid / <field>Due / <field>Name
   *   idSalt    mixed into task ids so two systems never share one
   *   steps     how to copy the link, as <li> HTML
   *   howTo     FluxHowTo video id, or ''
   *   slotId    element the tab renders into
   */
  function createCalendarSync(cfg) {
    var KEY = 'flux_' + cfg.id + '_v1';
    var LAST_SYNC_KEY = 'flux_' + cfg.id + '_last_sync';
    var EL = 'flux' + cfg.name;
    var UID = cfg.field + 'Uid';
    var DUE = cfg.field + 'Due';
    var NAME = cfg.field + 'Name';
    var syncing = false;
    var lastError = '';

    /** Applies a fetched calendar to `tasks` in place. Returns what changed and
     *  the new `seen` list. */
    function mergeEvents(tasks, events, seen, opts) {
      var today = opts.today;
      var cutoff = isoLocal(new Date(today.getFullYear(), today.getMonth(), today.getDate() - LOOKBACK_DAYS));
      var seenSet = new Set(seen || []);
      var byUid = new Map();
      tasks.forEach(function (t) { if (t && t[UID]) byUid.set(t[UID], t); });
      var added = 0;
      var updated = 0;

      events.forEach(function (ev) {
        var t = byUid.get(ev.uid);
        if (t) {
          seenSet.add(ev.uid);
          if (t.done) return;
          var changed = false;
          if (ev.date !== t[DUE]) { t.date = ev.date; t[DUE] = ev.date; changed = true; }
          if (ev.summary !== t[NAME]) {
            if (t.name === t[NAME]) t.name = ev.summary.slice(0, 240);
            t[NAME] = ev.summary;
            changed = true;
          }
          if (changed) {
            updated++;
            if (opts.calcUrgency) t.urgencyScore = opts.calcUrgency(t);
          }
          return;
        }
        if (seenSet.has(ev.uid) || ev.date < cutoff || NOT_WORK_RE.test(ev.summary)) return;

        var type = inferType(ev.summary);
        var task = {
          id: hashId(cfg.idSalt + ev.uid),
          name: ev.summary.slice(0, 240),
          date: ev.date,
          subject: subjectFor(ev, opts.classes),
          priority: type === 'test' || type === 'quiz' ? 'high' : 'med',
          type: type,
          notes: ['From ' + cfg.name + (ev.category ? ': ' + ev.category : ''), (ev.description || '').slice(0, 500), ev.url || ''].filter(Boolean).join('\n'),
          done: false,
          rescheduled: 0,
          createdAt: Date.now(),
        };
        task[UID] = ev.uid;
        task[DUE] = ev.date;
        task[NAME] = ev.summary;
        if (opts.calcUrgency) task.urgencyScore = opts.calcUrgency(task);
        tasks.unshift(task);
        seenSet.add(ev.uid);
        added++;
      });

      return { added: added, updated: updated, seen: Array.from(seenSet).slice(-MAX_SEEN) };
    }

    /* ── Saved connection ── */

    /* Read on every use: the store is namespaced by account, so a copy taken at
       load time would predate sign-in. */
    function state() {
      var s = typeof window.load === 'function' ? window.load(KEY, null) : null;
      return {
        feedUrl: (s && typeof s.feedUrl === 'string') ? s.feedUrl : '',
        seen: (s && Array.isArray(s.seen)) ? s.seen : [],
      };
    }

    function saveState(next, opts) {
      window.save(KEY, next);
      if (!(opts && opts.fromCloud) && typeof window.syncKey === 'function') window.syncKey(cfg.id, next);
    }

    /** No clock in here: this is read on every push, and a changing value would
     *  rewrite the account's row nonstop. */
    function getCloudSlice() { return state(); }

    function applyFromCloud(slice) {
      if (!slice || typeof slice !== 'object') return;
      var cur = state();
      var feedUrl = typeof slice.feedUrl === 'string' ? slice.feedUrl : cur.feedUrl;
      var incoming = Array.isArray(slice.seen) ? slice.seen : [];
      var seen = Array.from(new Set(cur.seen.concat(incoming))).slice(-MAX_SEEN);
      if (feedUrl === cur.feedUrl && seen.length === cur.seen.length) return;
      var linkChanged = feedUrl !== cur.feedUrl;
      saveState({ feedUrl: feedUrl, seen: seen }, { fromCloud: true });
      if (linkChanged) renderIfVisible();
    }

    /* ── Sync ── */

    async function fetchIcs(url) {
      var endpoint = window.API && window.API.schoology;
      if (!endpoint || typeof window.fluxAuthHeaders !== 'function') throw new Error(cfg.name + ' sync is still loading. Try again in a moment.');
      var res = await fetch(endpoint, {
        method: 'POST',
        headers: await window.fluxAuthHeaders(),
        body: JSON.stringify({ url: url }),
      });
      var data = null;
      try { data = await res.json(); } catch (e) {}
      if (res.status === 401) throw new Error('Sign in to Flux to sync ' + cfg.name + '.');
      if (!res.ok || !data || typeof data.ics !== 'string') {
        throw new Error((data && data.error) || 'Couldn\'t reach ' + cfg.name + '. Try again in a moment.');
      }
      return data.ics;
    }

    async function syncFrom(url) {
      var ics = await fetchIcs(url);
      var tasks = window.tasks;
      if (!Array.isArray(tasks)) throw new Error('Flux is still loading. Try again in a moment.');
      var result = mergeEvents(tasks, parseIcs(ics), state().seen, {
        today: new Date(),
        classes: window.classes,
        calcUrgency: typeof window.calcUrgency === 'function' ? window.calcUrgency : null,
      });
      saveState({ feedUrl: url, seen: result.seen });
      window.save(LAST_SYNC_KEY, Date.now());
      if (result.added || result.updated) {
        window.save('tasks', tasks);
        if (typeof window.syncKey === 'function') window.syncKey('tasks', tasks);
        refreshPlanner();
      }
      return result;
    }

    function summary(r) {
      if (!r.added && !r.updated) return cfg.name + ' is up to date.';
      var bits = [];
      if (r.added) bits.push(r.added + ' new');
      if (r.updated) bits.push(r.updated + ' updated');
      return cfg.name + ': ' + bits.join(', ') + '.';
    }

    async function run(url, quiet) {
      if (syncing) return null;
      syncing = true;
      lastError = '';
      if (!quiet) renderIfVisible();
      try {
        var r = await syncFrom(url);
        if (!quiet) toast(summary(r), 'success');
        return r;
      } catch (e) {
        lastError = (e && e.message) || 'Couldn\'t sync ' + cfg.name + '.';
        if (!quiet) toast(lastError, 'warning');
        return null;
      } finally {
        syncing = false;
        renderIfVisible();
      }
    }

    function syncNow() {
      var url = state().feedUrl;
      return url ? run(url, false) : Promise.resolve(null);
    }

    function connect(url) {
      var clean = String(url || '').trim();
      if (!clean) {
        lastError = 'Paste your ' + cfg.name + ' calendar link first.';
        renderIfVisible();
        return Promise.resolve(null);
      }
      return run(clean, false); /* Saved only after the link returns a calendar. */
    }

    function disconnect() {
      /* `seen` stays, so reconnecting doesn't bring back tasks deleted from Flux. */
      saveState({ feedUrl: '', seen: state().seen });
      window.save(LAST_SYNC_KEY, 0);
      lastError = '';
      renderIfVisible();
      toast(cfg.name + ' disconnected. Imported tasks stay in your planner.', 'info');
    }

    function autoSync() {
      if (document.hidden) return;
      var url = state().feedUrl;
      if (!url) return;
      var last = Number(window.load(LAST_SYNC_KEY, 0)) || 0;
      if (Date.now() - last < AUTO_SYNC_MS) return;
      void run(url, true);
    }

    /* ── Screen ── */

    function lastSyncText() {
      var last = Number(window.load(LAST_SYNC_KEY, 0)) || 0;
      if (!last) return 'Not synced on this device yet.';
      return 'Last synced ' + new Date(last).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + '.';
    }

    function errorHtml() {
      return lastError ? '<p class="g-hub-muted" id="' + EL + 'Err" role="alert" style="color:var(--red,#ef4444);margin-top:8px">' + escHtml(lastError) + '</p>' : '';
    }

    function render(slot) {
      if (!slot) return;
      var st = state();
      if (st.feedUrl) {
        slot.innerHTML =
          '<div class="g-hub-import-card" id="' + EL + 'Card">' +
            '<strong>' + cfg.name + ' connected</strong>' +
            '<p class="g-hub-muted" id="' + EL + 'Status">' + (syncing ? 'Syncing…' : escHtml(lastSyncText())) + ' Flux checks for new work about every 30 minutes while it\'s open.</p>' +
            errorHtml() +
            '<div class="g-tasks-head" style="margin-top:12px">' +
              '<button type="button" class="flux-schoology-sync" id="' + EL + 'Sync"' + (syncing ? ' disabled' : '') + '>Sync now</button>' +
              '<button type="button" class="btn-sec" id="' + EL + 'Off">Disconnect</button>' +
            '</div>' +
          '</div>';
      } else {
        slot.innerHTML =
          '<div class="g-hub-import-card" id="' + EL + 'Card">' +
            '<strong>Connect ' + cfg.name + '</strong> ' +
            (cfg.howTo ? '<button type="button" class="btn-sec" onclick="FluxHowTo.open(\'' + cfg.howTo + '\')" style="margin-left:10px">Watch how</button>' : '') +
            '<ol class="g-hub-muted" style="margin:10px 0 0 18px;padding:0;line-height:1.6">' + cfg.steps + '</ol>' +
            '<div class="mrow" style="margin-top:12px">' +
              '<label for="' + EL + 'Url" style="font-size:.78rem;color:var(--muted)">' + cfg.name + ' calendar link</label>' +
              '<input type="url" id="' + EL + 'Url" autocomplete="off" spellcheck="false" placeholder="' + escHtml(cfg.placeholder) + '">' +
            '</div>' +
            '<p class="g-hub-muted" style="margin-top:6px">Keep this link private: anyone who has it can read your calendar. Flux imports dates only, not grades.</p>' +
            errorHtml() +
            '<div class="g-tasks-head" style="margin-top:12px">' +
              '<button type="button" class="flux-schoology-connect" id="' + EL + 'Connect"' + (syncing ? ' disabled' : '') + '>' + (syncing ? 'Connecting…' : 'Connect ' + cfg.name) + '</button>' +
            '</div>' +
          '</div>';
      }
      var on = function (id, fn) { var el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
      on(EL + 'Sync', function () { void syncNow(); });
      on(EL + 'Off', disconnect);
      on(EL + 'Connect', function () {
        var input = document.getElementById(EL + 'Url');
        void connect(input && input.value);
      });
    }

    function renderIfVisible() {
      var slot = document.getElementById(cfg.slotId);
      if (!slot) return;
      /* Don't wipe a half-typed link when a refresh finishes. */
      var input = document.getElementById(EL + 'Url');
      var typed = input ? input.value : '';
      render(slot);
      var after = document.getElementById(EL + 'Url');
      if (after && typed) after.value = typed;
    }

    /** Opens this system's tab in the Connect panel from elsewhere in the app. */
    function open() {
      if (typeof window.nav === 'function') window.nav('canvas');
      try { if (window.FluxGoogle && typeof window.FluxGoogle.setTab === 'function') window.FluxGoogle.setTab(cfg.id); } catch (e) {}
    }

    function boot() {
      setTimeout(autoSync, 20000); /* after sign-in and the first cloud pull */
      setInterval(autoSync, 5 * 60 * 1000);
      document.addEventListener('visibilitychange', autoSync);
    }

    if (typeof document !== 'undefined') {
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
      else boot();
    }

    return {
      connect: connect,
      disconnect: disconnect,
      syncNow: syncNow,
      render: render,
      open: open,
      isConnected: function () { return !!state().feedUrl; },
      getCloudSlice: getCloudSlice,
      applyFromCloud: applyFromCloud,
      _parseIcs: parseIcs,
      _mergeEvents: mergeEvents,
    };
  }

  window.FluxSchoology = createCalendarSync({
    id: 'schoology',
    name: 'Schoology',
    field: 'schoology',
    idSalt: '', /* ids already in students' planners came from the bare uid */
    howTo: 'schoology',
    slotId: 'fluxSchoologySlot',
    placeholder: 'webcal://…',
    steps:
      '<li>Open <strong>Calendar</strong> in Schoology.</li>' +
      '<li>Find the option to share or subscribe to your calendar. Turn it on if it asks.</li>' +
      '<li>Copy the iCal link and paste it here.</li>',
  });

  window.FluxMoodle = createCalendarSync({
    id: 'moodle',
    name: 'Moodle',
    field: 'moodle',
    idSalt: 'moodle:',
    howTo: '',
    slotId: 'fluxMoodleSlot',
    placeholder: 'https://moodle.yourschool.edu/calendar/export_execute.php?…',
    steps:
      '<li>Open <strong>Calendar</strong> in Moodle.</li>' +
      '<li>Click <strong>Import or export calendars</strong>, then <strong>Export calendar</strong>.</li>' +
      '<li>Choose <strong>All events</strong> and <strong>Recent and next 60 days</strong>, then click <strong>Get calendar URL</strong>.</li>' +
      '<li>Copy the link and paste it here.</li>',
  });
})();
