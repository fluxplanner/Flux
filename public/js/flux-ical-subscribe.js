/**
 * P21.1 — iCal subscribe export (live webcal feed).
 * Flag: enable_ical_subscribe (default off).
 */
(function () {
  'use strict';

  const FLAG = 'enable_ical_subscribe';
  const STORE_KEY = 'flux_ical_subscribe_v1';
  const CARD_ID = 'fluxIcalSubscribeCard';
  const SB_URL = 'https://lfigdijuqmbensebnevo.supabase.co';

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
      includeFocus: s.includeFocus !== false,
      token: typeof s.token === 'string' ? s.token : '',
      lastPublishedAt: s.lastPublishedAt || 0,
    };
  }

  function persistPrefs(patch) {
    const next = { ...getPrefs(), ...patch };
    save(STORE_KEY, next);
    try {
      if (typeof window.syncKey === 'function') window.syncKey('icalSubscribe', getCloudSlice());
    } catch (_) {}
    return next;
  }

  function getCloudSlice() {
    const p = getPrefs();
    return { includeFocus: p.includeFocus, token: p.token, lastPublishedAt: p.lastPublishedAt };
  }

  function applyFromCloud(data) {
    if (!data || typeof data !== 'object') return;
    persistPrefs(data);
    renderCard();
  }

  function taskList() {
    return typeof window.tasks !== 'undefined' && Array.isArray(window.tasks) ? window.tasks : [];
  }

  function sessionLog() {
    return typeof window.sessionLog !== 'undefined' && Array.isArray(window.sessionLog)
      ? window.sessionLog
      : load('flux_session_log', []);
  }

  function icalEsc(s) {
    return String(s || '')
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');
  }

  function newToken() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 8);
    }
    return String(Date.now()) + Math.random().toString(36).slice(2, 14);
  }

  function buildIcsBody(includeFocus) {
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Flux Planner//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Flux Planner',
    ];

    taskList()
      .filter((t) => t && t.date && !t.done)
      .forEach((t) => {
        const d = String(t.date).replace(/-/g, '');
        lines.push(
          'BEGIN:VEVENT',
          `UID:flux-task-${t.id}@fluxplanner`,
          `DTSTART;VALUE=DATE:${d}`,
          `SUMMARY:${icalEsc(t.name)}`,
          'BEGIN:VALARM',
          'ACTION:DISPLAY',
          'DESCRIPTION:Flux reminder',
          'TRIGGER:-P1D',
          'END:VALARM',
          'END:VEVENT',
        );
      });

    if (includeFocus) {
      sessionLog()
        .filter((s) => s && s.date && (parseInt(s.mins, 10) || 0) > 0)
        .forEach((s, i) => {
          const d = String(s.date).replace(/-/g, '');
          const subj = s.subject ? ` (${s.subject})` : '';
          lines.push(
            'BEGIN:VEVENT',
            `UID:flux-focus-${d}-${i}@fluxplanner`,
            `DTSTART;VALUE=DATE:${d}`,
            `SUMMARY:${icalEsc(`Focus: ${s.mins} min${subj}`)}`,
            'END:VEVENT',
          );
        });
    }

    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }

  function feedUrl(token) {
    return `${SB_URL}/functions/v1/ical-feed?t=${encodeURIComponent(token)}`;
  }

  function webcalUrl(token) {
    return feedUrl(token).replace(/^https:/i, 'webcal:');
  }

  function getSbUser() {
    const sb = typeof window.getSB === 'function' ? window.getSB() : null;
    const user = typeof window.currentUser !== 'undefined' ? window.currentUser : null;
    if (!sb || !user?.id) return null;
    return { sb, userId: user.id };
  }

  async function fetchRemoteToken() {
    const ctx = getSbUser();
    if (!ctx) return '';
    try {
      const { data } = await ctx.sb
        .from('flux_ical_feeds')
        .select('token, updated_at')
        .eq('user_id', ctx.userId)
        .maybeSingle();
      if (data?.token) {
        persistPrefs({ token: data.token, lastPublishedAt: data.updated_at ? Date.parse(data.updated_at) : 0 });
        return data.token;
      }
    } catch (_) {}
    return getPrefs().token || '';
  }

  async function publishFeed(opts) {
    const ctx = getSbUser();
    if (!ctx) {
      toast(T('ical.sign_in'), 'warning');
      return false;
    }

    const prefs = getPrefs();
    const includeFocus = opts?.includeFocus != null ? !!opts.includeFocus : prefs.includeFocus;
    let token = opts?.regenerate ? newToken() : prefs.token || (await fetchRemoteToken()) || newToken();
    const icsBody = buildIcsBody(includeFocus);

    try {
      const { error } = await ctx.sb.from('flux_ical_feeds').upsert(
        {
          user_id: ctx.userId,
          token,
          ics_body: icsBody,
          include_focus: includeFocus,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );
      if (error) throw error;
      persistPrefs({ token, includeFocus, lastPublishedAt: Date.now() });
      toast(T('ical.published'), 'success');
      renderCard();
      return true;
    } catch (e) {
      toast(T('ical.publish_fail'), 'error');
      return false;
    }
  }

  function copyText(text) {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(
        () => toast(T('ical.copied'), 'success'),
        () => toast(text, 'info'),
      );
      return;
    }
    toast(text, 'info');
  }

  function downloadIcs() {
    const body = buildIcsBody(getPrefs().includeFocus);
    const blob = new Blob([body], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'flux-subscribe.ics';
    a.click();
    URL.revokeObjectURL(url);
    toast(T('ical.downloaded'), 'success');
  }

  function bindCard(card) {
    card.querySelector('#fluxIcalIncludeFocus')?.addEventListener('change', (e) => {
      persistPrefs({ includeFocus: !!e.target.checked });
    });
    card.querySelector('#fluxIcalPublish')?.addEventListener('click', () => publishFeed({}));
    card.querySelector('#fluxIcalRegen')?.addEventListener('click', () => publishFeed({ regenerate: true }));
    card.querySelector('#fluxIcalCopyHttps')?.addEventListener('click', () => {
      const token = getPrefs().token;
      if (!token) {
        toast(T('ical.publish_first'), 'warning');
        return;
      }
      copyText(feedUrl(token));
    });
    card.querySelector('#fluxIcalCopyWebcal')?.addEventListener('click', () => {
      const token = getPrefs().token;
      if (!token) {
        toast(T('ical.publish_first'), 'warning');
        return;
      }
      copyText(webcalUrl(token));
    });
    card.querySelector('#fluxIcalDownload')?.addEventListener('click', downloadIcs);
  }

  async function renderCard() {
    if (!enabled()) return;
    const card = document.getElementById(CARD_ID);
    if (!card) return;

    let prefs = getPrefs();
    if (!prefs.token && getSbUser()) await fetchRemoteToken();
    prefs = getPrefs();

    const token = prefs.token;
    const status = prefs.lastPublishedAt
      ? T('ical.last_published', { when: new Date(prefs.lastPublishedAt).toLocaleString() })
      : T('ical.not_published');

    card.innerHTML = `<div class="flux-ical-title">${esc(T('ical.title'))}</div>
<p class="flux-ical-lede">${esc(T('ical.lede'))}</p>
<label class="flux-ical-toggle">
  <input type="checkbox" id="fluxIcalIncludeFocus"${prefs.includeFocus ? ' checked' : ''} />
  ${esc(T('ical.include_focus'))}
</label>
<div class="flux-ical-actions">
  <button type="button" class="btn-sec" id="fluxIcalPublish">${esc(T('ical.publish'))}</button>
  <button type="button" class="btn-sec" id="fluxIcalDownload">${esc(T('ical.download'))}</button>
  <button type="button" class="btn-sec" id="fluxIcalRegen">${esc(T('ical.regen'))}</button>
</div>
${
  token
    ? `<div class="flux-ical-url" style="margin-top:12px">
  <code>${esc(webcalUrl(token))}</code>
</div>
<div class="flux-ical-actions">
  <button type="button" class="btn-sec" id="fluxIcalCopyWebcal">${esc(T('ical.copy_webcal'))}</button>
  <button type="button" class="btn-sec" id="fluxIcalCopyHttps">${esc(T('ical.copy_https'))}</button>
</div>`
    : `<p class="flux-ical-lede">${esc(T('ical.publish_first'))}</p>`
}
<p class="flux-ical-status">${esc(status)}</p>`;

    bindCard(card);
  }

  function ensureCard() {
    if (!enabled()) {
      document.getElementById(CARD_ID)?.remove();
      return;
    }
    const anchor = document.querySelector('.cal-gcal-inline');
    if (!anchor) return;
    let card = document.getElementById(CARD_ID);
    if (!card) {
      card = document.createElement('div');
      card.id = CARD_ID;
      card.className = 'flux-ical-card';
      card.setAttribute('role', 'region');
      card.setAttribute('aria-label', T('ical.aria'));
      anchor.insertAdjacentElement('afterend', card);
    }
    renderCard();
  }

  function getPaletteCommands(q) {
    if (!enabled()) return [];
    const needle = (q || '').toLowerCase();
    const label = T('ical.palette');
    const keys = 'ical subscribe calendar export webcal apple';
    if (
      needle &&
      !label.toLowerCase().includes(needle) &&
      !keys.split(' ').some((k) => needle.includes(k))
    ) {
      return [];
    }
    return [
      {
        icon: '📆',
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
    if (typeof origNav === 'function' && !origNav._fluxIcalWrapped) {
      window.nav = function (id) {
        const r = origNav.apply(this, arguments);
        if (id === 'calendar') setTimeout(() => ensureCard(), 80);
        return r;
      };
      window.nav._fluxIcalWrapped = true;
    }
    const origCal = window.renderCalendar;
    if (typeof origCal === 'function' && !origCal._fluxIcalWrapped) {
      window.renderCalendar = function () {
        const r = origCal.apply(this, arguments);
        try {
          if (enabled()) ensureCard();
        } catch (_) {}
        return r;
      };
      window.renderCalendar._fluxIcalWrapped = true;
    }
    return true;
  }

  window.FluxIcalSubscribe = {
    FLAG,
    enabled,
    buildIcsBody,
    publishFeed,
    feedUrl,
    webcalUrl,
    renderCard,
    ensureCard,
    getCloudSlice,
    applyFromCloud,
    getPaletteCommands,
    install,
  };
})();
