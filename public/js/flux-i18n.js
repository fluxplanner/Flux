/**
 * FluxI18n — locale + Intl date/time formatting foundation.
 * Flag: enable_locale_foundation (default off).
 */
(function () {
  'use strict';

  const FLAG = 'enable_locale_foundation';
  const LOCALE_KEY = 'flux_locale_v1';

  const LOCALES = [
    { id: 'en-US', label: 'English (US)' },
    { id: 'es-US', label: 'Español (US)' },
    { id: 'fr-FR', label: 'Français' },
    { id: 'ar-SA', label: 'العربية' },
  ];

  const STRINGS = {
    'en-US': {
      'settings.locale_title': 'Language & region',
      'settings.locale_hint': 'Dates and times use your locale. More UI translation coming later.',
      'date.today': 'Today',
      'date.tomorrow': 'Tomorrow',
    },
    'es-US': {
      'settings.locale_title': 'Idioma y región',
      'settings.locale_hint': 'Fechas y horas usan tu configuración regional.',
      'date.today': 'Hoy',
      'date.tomorrow': 'Mañana',
    },
    'fr-FR': {
      'settings.locale_title': 'Langue et région',
      'settings.locale_hint': 'Dates et heures selon votre locale.',
      'date.today': "Aujourd'hui",
      'date.tomorrow': 'Demain',
    },
    'ar-SA': {
      'settings.locale_title': 'اللغة والمنطقة',
      'settings.locale_hint': 'التواريخ والأوقات حسب إعداداتك المحلية.',
      'date.today': 'اليوم',
      'date.tomorrow': 'غداً',
    },
  };

  let _locale = 'en-US';

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
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function normalizeLocale(id) {
    const hit = LOCALES.find((l) => l.id === id);
    return hit ? hit.id : 'en-US';
  }

  function getLocale() {
    return _locale;
  }

  function setLocale(id) {
    _locale = normalizeLocale(id);
    save(LOCALE_KEY, _locale);
    applyDocumentLocale();
    updateDatePill();
    try {
      document.dispatchEvent(new CustomEvent('flux-locale-change', { detail: { locale: _locale } }));
    } catch (_) {}
    if (typeof window.renderNoHWList === 'function') window.renderNoHWList();
    if (typeof window.renderStats === 'function') window.renderStats();
  }

  function applyDocumentLocale() {
    if (!enabled()) return;
    document.documentElement.lang = _locale.split('-')[0];
    document.documentElement.dir = _locale === 'ar-SA' ? 'rtl' : 'ltr';
  }

  function t(key) {
    const table = STRINGS[_locale] || STRINGS['en-US'];
    return table[key] || STRINGS['en-US'][key] || key;
  }

  function toDate(input) {
    if (!input) return null;
    if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input;
    const s = String(input);
    const d = s.length === 10 ? new Date(`${s}T12:00:00`) : new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function formatDate(input, style) {
    const d = toDate(input);
    if (!d) return '';
    const loc = enabled() ? _locale : 'en-US';
    const opts =
      style === 'long'
        ? { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }
        : style === 'weekday'
          ? { weekday: 'long', month: 'short', day: 'numeric' }
          : style === 'monthDay'
            ? { month: 'short', day: 'numeric' }
            : style === 'monthDayYear'
              ? { month: 'short', day: 'numeric', year: 'numeric' }
              : style === 'weekdayShort'
                ? { weekday: 'short' }
                : { weekday: 'short', month: 'short', day: 'numeric' };
    try {
      return new Intl.DateTimeFormat(loc, opts).format(d);
    } catch (_) {
      return d.toLocaleDateString('en-US', opts);
    }
  }

  function formatTime(input, opts) {
    const d = toDate(input) || new Date();
    const loc = enabled() ? _locale : 'en-US';
    const use24 = !!(opts && opts.hour24);
    try {
      return new Intl.DateTimeFormat(loc, {
        hour: use24 ? '2-digit' : 'numeric',
        minute: '2-digit',
        hour12: !use24,
      }).format(d);
    } catch (_) {
      return d.toLocaleTimeString(loc, { hour: 'numeric', minute: '2-digit', hour12: !use24 });
    }
  }

  function formatDateTime(input) {
    return `${formatDate(input, 'short')} · ${formatTime(input)}`;
  }

  function relativeDayLabel(iso) {
    if (!iso) return null;
    const today = typeof todayStr === 'function' ? todayStr() : new Date().toISOString().slice(0, 10);
    if (iso === today) return enabled() ? t('date.today') : 'Today';
    const tmr = new Date(`${today}T12:00:00`);
    tmr.setDate(tmr.getDate() + 1);
    const tmrStr = tmr.toISOString().slice(0, 10);
    if (iso === tmrStr) return enabled() ? t('date.tomorrow') : 'Tomorrow';
    return null;
  }

  /** Calendar week strip: Today / Tomorrow / short weekday */
  function calendarStripLabel(iso, index) {
    const rel = relativeDayLabel(iso);
    if (rel) return rel;
    if (index === 1) return enabled() ? t('date.tomorrow') : 'Tmrw';
    return formatDate(iso, 'weekdayShort');
  }

  function updateDatePill() {
    const pill = document.getElementById('datePill');
    if (!pill) return;
    const now = typeof TODAY !== 'undefined' && TODAY instanceof Date ? TODAY : new Date();
    let text = formatDate(now, 'short');
    if (window.FluxSiteEnhancements && typeof window.fluxEnhFormatTime === 'function') {
      try {
        const raw = window.load?.('flux_enh_prefs_v1', {}) || {};
        if (raw.time_24h) text += ' · ' + window.fluxEnhFormatTime(new Date());
      } catch (_) {}
    }
    pill.textContent = text;
  }

  function renderSettingsCard() {
    if (!enabled()) return;
    const pane = document.getElementById('spane-appearance');
    if (!pane || document.getElementById('fluxI18nSettingsCard')) return;
    const card = document.createElement('div');
    card.className = 'card';
    card.id = 'fluxI18nSettingsCard';
    card.innerHTML = `
      <h3>${esc(t('settings.locale_title'))}</h3>
      <p style="font-size:.72rem;color:var(--muted2);margin:0 0 10px;line-height:1.45">${esc(t('settings.locale_hint'))}</p>
      <label style="font-size:.78rem;display:block;margin-bottom:6px">Locale</label>
      <select id="fluxLocaleSelect" style="width:100%;font-size:.82rem;padding:8px;border-radius:10px">
        ${LOCALES.map((l) => `<option value="${esc(l.id)}">${esc(l.label)}</option>`).join('')}
      </select>
      <p id="fluxLocalePreview" style="font-size:.72rem;color:var(--muted);margin-top:10px;font-family:'JetBrains Mono',monospace"></p>`;
    pane.insertBefore(card, pane.firstChild);
    const sel = card.querySelector('#fluxLocaleSelect');
    const preview = card.querySelector('#fluxLocalePreview');
    if (sel) {
      sel.value = _locale;
      sel.addEventListener('change', () => {
        setLocale(sel.value);
        if (preview) {
          preview.textContent = `${formatDate(new Date(), 'long')} · ${formatTime(new Date())}`;
        }
        if (typeof showToast === 'function') showToast('Locale updated', 'success', 1600);
      });
    }
    if (preview) preview.textContent = `${formatDate(new Date(), 'long')} · ${formatTime(new Date())}`;
  }

  function bindGlobals() {
    window.fluxFmtDate = formatDate;
    window.fluxFormatDate = formatDate;
    window.fluxFormatTime = formatTime;
    window.fluxFormatDateTime = formatDateTime;
    window.fluxRelativeDayLabel = relativeDayLabel;
    window.fluxCalendarStripLabel = calendarStripLabel;
  }

  function install() {
    _locale = normalizeLocale(load(LOCALE_KEY, 'en-US'));
    bindGlobals();
    if (!enabled()) {
      updateDatePill();
      return false;
    }
    applyDocumentLocale();
    updateDatePill();
    renderSettingsCard();
    document.addEventListener('flux-nav', (ev) => {
      if (ev.detail?.panel === 'settings') renderSettingsCard();
      if (ev.detail?.panel === 'dashboard') updateDatePill();
    });
    document.addEventListener('flux-locale-change', () => {
      updateDatePill();
      try {
        if (typeof renderTasks === 'function') renderTasks();
        if (typeof renderCalendar === 'function') renderCalendar();
        if (typeof renderCountdown === 'function') renderCountdown();
        if (typeof renderDashWeekStrip === 'function') renderDashWeekStrip();
      } catch (_) {}
    });
    return true;
  }

  _locale = normalizeLocale(load(LOCALE_KEY, 'en-US'));
  bindGlobals();

  window.FluxI18n = {
    FLAG,
    LOCALES,
    enabled,
    getLocale,
    setLocale,
    t,
    formatDate,
    formatTime,
    formatDateTime,
    relativeDayLabel,
    calendarStripLabel,
    bindGlobals,
    updateDatePill,
    renderSettingsCard,
    install,
  };
})();
