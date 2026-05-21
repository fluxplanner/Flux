/**
 * P22.1 — ICS timetable import (weekly schedule + blackout dates).
 * Flag: enable_ics_timetable_import (default off).
 */
(function () {
  'use strict';

  const FLAG = 'enable_ics_timetable_import';
  const STORE_KEY = 'flux_ics_timetable_import_v1';
  const CARD_ID = 'fluxIcsTimetableImportCard';

  const BLACKOUT_RE =
    /\b(no\s*school|holiday|break|staff\s*day|in[- ]service|professional\s*development|pd\s*day|snow\s*day|teacher\s*workday|memorial|labor|thanksgiving|christmas|winter\s*break|spring\s*break|summer\s*break|closed|vacation)\b/i;

  const DAY_MAP = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

  function enabled() {
    try {
      return !!window.FluxFeatureFlags?.isEnabled(FLAG, false);
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

  function T(key, vars) {
    if (typeof window.fluxT === 'function') return window.fluxT(key, vars);
    return key;
  }

  function toast(msg, kind) {
    if (typeof window.showToast === 'function') window.showToast(msg, kind || 'info');
  }

  function getPrefs() {
    const s = load(STORE_KEY, {});
    return {
      lastImportAt: s.lastImportAt || 0,
      lastFileName: typeof s.lastFileName === 'string' ? s.lastFileName : '',
      importBlackouts: s.importBlackouts !== false,
      importWeekly: s.importWeekly !== false,
    };
  }

  function persistPrefs(patch) {
    const next = { ...getPrefs(), ...patch };
    save(STORE_KEY, next);
    try {
      if (typeof window.syncKey === 'function') window.syncKey('icsTimetableImport', getCloudSlice());
    } catch (_) {}
    return next;
  }

  function getCloudSlice() {
    const p = getPrefs();
    return {
      lastImportAt: p.lastImportAt,
      lastFileName: p.lastFileName,
      importBlackouts: p.importBlackouts,
      importWeekly: p.importWeekly,
    };
  }

  function applyFromCloud(data) {
    if (!data || typeof data !== 'object') return;
    persistPrefs(data);
    renderCard();
  }

  function unfoldIcs(text) {
    const raw = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = raw.split('\n');
    const out = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith(' ') || line.startsWith('\t')) {
        if (out.length) out[out.length - 1] += line.slice(1);
      } else {
        out.push(line);
      }
    }
    return out;
  }

  function parseIcsDate(val, params) {
    const p = params || '';
    const allDay = /VALUE=DATE/i.test(p) || /^\d{8}$/.test(val);
    if (!val) return { date: '', time: '', allDay: true };
    if (allDay && val.length >= 8) {
      const y = val.slice(0, 4);
      const m = val.slice(4, 6);
      const d = val.slice(6, 8);
      return { date: `${y}-${m}-${d}`, time: '', allDay: true };
    }
    if (val.length >= 15) {
      const y = val.slice(0, 4);
      const m = val.slice(4, 6);
      const d = val.slice(6, 8);
      const hh = val.slice(9, 11);
      const mm = val.slice(11, 13);
      return { date: `${y}-${m}-${d}`, time: `${hh}:${mm}`, allDay: false };
    }
    return { date: '', time: '', allDay: false };
  }

  function parseRrule(rrule) {
    const parts = String(rrule || '')
      .split(';')
      .reduce((acc, p) => {
        const [k, v] = p.split('=');
        if (k) acc[k.toUpperCase()] = v || '';
        return acc;
      }, {});
    const byday = (parts.BYDAY || '')
      .split(',')
      .map((x) => DAY_MAP[x.trim().toUpperCase()])
      .filter((n) => n != null);
    return { freq: (parts.FREQ || '').toUpperCase(), byday };
  }

  function parseIcs(text) {
    const lines = unfoldIcs(text);
    const events = [];
    let cur = null;

    lines.forEach((line) => {
      if (line === 'BEGIN:VEVENT') {
        cur = {};
        return;
      }
      if (line === 'END:VEVENT') {
        if (cur && cur.summary) events.push(cur);
        cur = null;
        return;
      }
      if (!cur) return;
      const idx = line.indexOf(':');
      if (idx < 0) return;
      const head = line.slice(0, idx);
      const val = line.slice(idx + 1);
      const key = head.split(';')[0].toUpperCase();
      const params = head;
      if (key === 'SUMMARY') cur.summary = val.trim();
      else if (key === 'UID') cur.uid = val.trim();
      else if (key === 'DESCRIPTION') cur.description = val.trim();
      else if (key === 'LOCATION') cur.location = val.trim();
      else if (key === 'RRULE') cur.rrule = val.trim();
      else if (key === 'DTSTART') {
        cur.dtstart = parseIcsDate(val.trim(), params);
      } else if (key === 'DTEND') {
        cur.dtend = parseIcsDate(val.trim(), params);
      }
    });

    return events;
  }

  function isBlackout(ev) {
    const text = `${ev.summary || ''} ${ev.description || ''}`.trim();
    if (!text) return false;
    if (BLACKOUT_RE.test(text)) return true;
    if (ev.dtstart?.allDay && ev.rrule) return false;
    return !!(ev.dtstart?.allDay && !ev.rrule);
  }

  function classifyEvents(rawEvents) {
    const items = [];
    rawEvents.forEach((ev, i) => {
      const summary = ev.summary || T('icsimp.untitled');
      const id = ev.uid || `ics-${i}-${summary}`;

      if (isBlackout(ev) && ev.dtstart?.date) {
        items.push({
          id,
          kind: 'blackout',
          title: summary,
          date: ev.dtstart.date,
          checked: true,
        });
        return;
      }

      const rrule = ev.rrule ? parseRrule(ev.rrule) : null;
      let weekdays = rrule?.byday?.length ? rrule.byday : null;

      if (!weekdays && ev.dtstart?.date) {
        const d = new Date(ev.dtstart.date + 'T12:00:00');
        if (!Number.isNaN(d.getTime())) weekdays = [d.getDay()];
      }

      if (weekdays?.length && (rrule?.freq === 'WEEKLY' || !rrule)) {
        items.push({
          id,
          kind: 'weekly',
          title: summary,
          time: ev.dtstart?.time || '',
          weekdays: [...new Set(weekdays)].sort((a, b) => a - b),
          scope: 'school',
          checked: true,
        });
        return;
      }

      if (ev.dtstart?.date) {
        items.push({
          id,
          kind: 'event',
          title: summary,
          date: ev.dtstart.date,
          time: ev.dtstart?.time || '',
          scope: 'school',
          checked: true,
        });
      }
    });

    return items;
  }

  let previewItems = [];

  function dayNames(wds) {
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return (wds || []).map((d) => names[d] || '').join(', ');
  }

  function kindLabel(kind) {
    if (kind === 'weekly') return T('icsimp.kind_weekly');
    if (kind === 'blackout') return T('icsimp.kind_blackout');
    return T('icsimp.kind_event');
  }

  function renderPreview() {
    if (!previewItems.length) return `<p class="flux-ics-import-lede">${esc(T('icsimp.no_events'))}</p>`;

    const rows = previewItems
      .map(
        (it) => `<div class="flux-ics-import-row">
  <input type="checkbox" data-ics-id="${esc(it.id)}"${it.checked ? ' checked' : ''} />
  <label for="">${esc(it.title)}<br><span style="color:var(--muted);font-size:.62rem;font-family:'JetBrains Mono',monospace">${
    it.kind === 'weekly'
      ? esc(dayNames(it.weekdays) + (it.time ? ' · ' + it.time : ''))
      : esc((it.date || '') + (it.time ? ' · ' + it.time : ''))
  }</span></label>
  <span class="flux-ics-kind">${esc(kindLabel(it.kind))}</span>
</div>`,
      )
      .join('');

    return `<div class="flux-ics-import-preview">${rows}</div>`;
  }

  function handleFileText(text, fileName) {
    try {
      const raw = parseIcs(text);
      previewItems = classifyEvents(raw);
      if (!previewItems.length) {
        toast(T('icsimp.no_events'), 'warning');
      } else {
        toast(T('icsimp.parsed', { n: previewItems.length }), 'success');
      }
      persistPrefs({ lastFileName: fileName || '' });
      renderCard();
    } catch (_) {
      toast(T('icsimp.parse_fail'), 'error');
    }
  }

  function readFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => handleFileText(reader.result, file.name);
    reader.onerror = () => toast(T('icsimp.read_fail'), 'error');
    reader.readAsText(file);
  }

  function applyImport() {
    const prefs = getPrefs();
    const card = document.getElementById(CARD_ID);
    const selected = new Set();
    card?.querySelectorAll('[data-ics-id]').forEach((cb) => {
      if (cb.checked) selected.add(cb.getAttribute('data-ics-id'));
    });

    const chosen = previewItems.filter((it) => selected.has(it.id));
    if (!chosen.length) {
      toast(T('icsimp.none_selected'), 'warning');
      return;
    }

    let weeklyN = 0;
    let eventN = 0;
    let blackoutN = 0;

    if (prefs.importWeekly) {
      const rules =
        typeof window.getWeeklyRules === 'function' ? window.getWeeklyRules() : load('flux_weekly_events', []);
      chosen
        .filter((it) => it.kind === 'weekly')
        .forEach((it) => {
          rules.push({
            id: String(Date.now()) + '-' + Math.random().toString(36).slice(2, 7),
            title: it.title,
            time: it.time || '',
            weekdays: it.weekdays,
            enabled: true,
            scope: it.scope || 'school',
            _icsImport: true,
          });
          weeklyN++;
        });
      if (weeklyN) {
        save('flux_weekly_events', rules);
        if (typeof window.syncKey === 'function') window.syncKey('weekly', rules);
      }

      const events = load('flux_events', []);
      chosen
        .filter((it) => it.kind === 'event')
        .forEach((it) => {
          events.push({
            id: String(Date.now()) + '-' + Math.random().toString(36).slice(2, 7),
            title: it.title,
            date: it.date,
            time: it.time || '',
            notes: T('icsimp.import_note'),
            scope: it.scope || 'school',
            _icsImport: true,
          });
          eventN++;
        });
      if (eventN) {
        save('flux_events', events);
        if (typeof window.syncKey === 'function') window.syncKey('events', 1);
      }
    }

    if (prefs.importBlackouts) {
      const rest =
        typeof window.loadRestDaysList === 'function'
          ? window.loadRestDaysList()
          : load('flux_rest_days_v1', []);
      const existing = new Set(rest.map((r) => r.date));
      chosen
        .filter((it) => it.kind === 'blackout')
        .forEach((it) => {
          if (!existing.has(it.date)) {
            rest.push({ date: it.date, kind: 'lazy', _icsImport: true });
            existing.add(it.date);
            blackoutN++;
          }
        });
      if (blackoutN) {
        if (typeof window.saveRestDaysList === 'function') window.saveRestDaysList(rest);
        else save('flux_rest_days_v1', rest);
      }
    }

    persistPrefs({ lastImportAt: Date.now() });
    previewItems = [];

    if (typeof window.renderWeeklyRulesList === 'function') window.renderWeeklyRulesList();
    if (typeof window.renderCalendar === 'function') window.renderCalendar();
    if (typeof window.flushTasksOffRestDays === 'function') window.flushTasksOffRestDays();

    toast(
      T('icsimp.imported', { weekly: weeklyN, events: eventN, blackouts: blackoutN }),
      'success',
    );
    renderCard();
  }

  function bindCard(card) {
    const drop = card.querySelector('#fluxIcsDrop');
    const input = card.querySelector('#fluxIcsFile');
    drop?.addEventListener('click', () => input?.click());
    input?.addEventListener('change', (e) => readFile(e.target.files?.[0]));

    drop?.addEventListener('dragover', (e) => {
      e.preventDefault();
      drop.classList.add('dragover');
    });
    drop?.addEventListener('dragleave', () => drop.classList.remove('dragover'));
    drop?.addEventListener('drop', (e) => {
      e.preventDefault();
      drop.classList.remove('dragover');
      readFile(e.dataTransfer?.files?.[0]);
    });

    card.querySelector('#fluxIcsImportWeekly')?.addEventListener('change', (e) => {
      persistPrefs({ importWeekly: !!e.target.checked });
    });
    card.querySelector('#fluxIcsImportBlackouts')?.addEventListener('change', (e) => {
      persistPrefs({ importBlackouts: !!e.target.checked });
    });
    card.querySelector('#fluxIcsApply')?.addEventListener('click', applyImport);
    card.querySelector('#fluxIcsClear')?.addEventListener('click', () => {
      previewItems = [];
      renderCard();
    });

    card.querySelectorAll('[data-ics-id]').forEach((cb) => {
      cb.addEventListener('change', () => {
        const id = cb.getAttribute('data-ics-id');
        const it = previewItems.find((x) => x.id === id);
        if (it) it.checked = cb.checked;
      });
    });
  }

  function renderCard() {
    if (!enabled()) return;
    const card = document.getElementById(CARD_ID);
    if (!card) return;

    const prefs = getPrefs();
    const status = prefs.lastImportAt
      ? T('icsimp.last_import', {
          when: new Date(prefs.lastImportAt).toLocaleString(),
          file: prefs.lastFileName || '—',
        })
      : T('icsimp.not_imported');

    card.innerHTML = `<div class="flux-ics-import-title">${esc(T('icsimp.title'))}</div>
<p class="flux-ics-import-lede">${esc(T('icsimp.lede'))}</p>
<label class="flux-ics-import-toggle" style="display:flex;align-items:center;gap:8px;font-size:.72rem;margin:8px 0;cursor:pointer">
  <input type="checkbox" id="fluxIcsImportWeekly"${prefs.importWeekly ? ' checked' : ''} />
  ${esc(T('icsimp.opt_weekly'))}
</label>
<label class="flux-ics-import-toggle" style="display:flex;align-items:center;gap:8px;font-size:.72rem;margin:8px 0;cursor:pointer">
  <input type="checkbox" id="fluxIcsImportBlackouts"${prefs.importBlackouts ? ' checked' : ''} />
  ${esc(T('icsimp.opt_blackouts'))}
</label>
<div class="flux-ics-import-drop" id="fluxIcsDrop">
  <input type="file" id="fluxIcsFile" accept=".ics,text/calendar" />
  ${esc(T('icsimp.drop'))}
</div>
${renderPreview()}
<div class="flux-ics-import-actions">
  <button type="button" class="btn-sec" id="fluxIcsApply">${esc(T('icsimp.apply'))}</button>
  <button type="button" class="btn-sec" id="fluxIcsClear">${esc(T('icsimp.clear'))}</button>
</div>
<p class="flux-ics-import-stats">${esc(status)}</p>`;

    bindCard(card);
  }

  function ensureCard() {
    if (!enabled()) {
      document.getElementById(CARD_ID)?.remove();
      return;
    }
    const anchor =
      document.getElementById('fluxIcalSubscribeCard') ||
      document.querySelector('.cal-gcal-inline');
    if (!anchor) return;
    let card = document.getElementById(CARD_ID);
    if (!card) {
      card = document.createElement('div');
      card.id = CARD_ID;
      card.className = 'flux-ics-import-card';
      card.setAttribute('role', 'region');
      card.setAttribute('aria-label', T('icsimp.aria'));
      anchor.insertAdjacentElement('afterend', card);
    }
    renderCard();
  }

  function getPaletteCommands(q) {
    if (!enabled()) return [];
    const needle = (q || '').toLowerCase();
    const label = T('icsimp.palette');
    const keys = 'ics import timetable schedule blackout calendar';
    if (
      needle &&
      !label.toLowerCase().includes(needle) &&
      !keys.split(' ').some((k) => needle.includes(k))
    ) {
      return [];
    }
    return [
      {
        icon: '📥',
        label,
        cat: 'Navigation',
        action: () => {
          if (typeof window.closeCommandPalette === 'function') window.closeCommandPalette();
          if (typeof window.nav === 'function') {
            const tab = document.querySelector('[data-tab="calendar"]');
            window.nav('calendar', tab);
          }
          setTimeout(() => ensureCard(), 200);
        },
      },
    ];
  }

  function install() {
    if (!enabled()) {
      document.getElementById(CARD_ID)?.remove();
      return false;
    }
    ensureCard();
    const origNav = window.nav;
    if (typeof origNav === 'function' && !origNav._fluxIcsImportWrapped) {
      window.nav = function (id) {
        const r = origNav.apply(this, arguments);
        if (id === 'calendar') setTimeout(() => ensureCard(), 80);
        return r;
      };
      window.nav._fluxIcsImportWrapped = true;
    }
    const origCal = window.renderCalendar;
    if (typeof origCal === 'function' && !origCal._fluxIcsImportWrapped) {
      window.renderCalendar = function () {
        const r = origCal.apply(this, arguments);
        try {
          if (enabled()) ensureCard();
        } catch (_) {}
        return r;
      };
      window.renderCalendar._fluxIcsImportWrapped = true;
    }
    return true;
  }

  window.FluxIcsTimetableImport = {
    FLAG,
    enabled,
    parseIcs,
    classifyEvents,
    getCloudSlice,
    applyFromCloud,
    getPaletteCommands,
    install,
  };
})();
