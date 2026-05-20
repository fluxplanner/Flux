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

  const UI_STRINGS = {
    'settings.locale_title': 'Language & region',
    'settings.locale_hint': 'Dates and times use your locale. More UI translation coming later.',
    'date.today': 'Today',
    'date.tomorrow': 'Tomorrow',
    'sync.title': 'Sync conflicts',
    'sync.lede_legacy': 'Same item changed on two devices. Pick a version.',
    'sync.lede_v2': 'The same item was edited here and in the cloud. Compare previews, then pick which copy to keep.',
    'sync.keep_mine': 'Keep mine',
    'sync.keep_cloud': 'Keep cloud',
    'sync.keep_all_mine': 'Keep all mine ({n})',
    'sync.keep_all_cloud': 'Keep all cloud ({n})',
    'sync.no_conflicts': 'No sync conflicts',
    'sync.close': 'Close',
    'sync.this_device': 'This device',
    'sync.cloud': 'Cloud',
    'sync.compare': 'Compare versions',
    'sync.resolve': 'Resolve',
    'sync.conflicts_pill': '{n} conflict(s)',
    'sync.pending_pill': '{n} pending',
    'sync.pill_title': 'Sync conflicts',
    'sync.pill_title_v2': 'Sync conflicts — tap to compare versions',
    'sync.outbox_title': 'Pending offline changes',
    'sync.banner': '{n} sync conflict(s) —',
    'sync.settings_title': 'Sync & conflicts',
    'sync.settings_body': 'Offline-aware merge is on for tasks, notes, and calendar events.',
    'sync.settings_body_v2': ' When versions differ, you get side-by-side previews before choosing.',
    'sync.stat_conflicts': '{n} conflict(s)',
    'sync.stat_pending': '{n} pending change(s)',
    'sync.review': 'Review conflicts',
    'sync.flush': 'Sync pending now',
    'sync.syncing': 'Syncing…',
    'sync.toast_new': '{n} sync conflict(s) — open Settings → Data or tap the pill',
    'task.untitled': '(untitled task)',
    'task.due': 'Due {date}',
    'task.done': 'Done',
    'task.not_done': 'Not done',
    'task.priority': 'Priority: {p}',
    'note.untitled': '(untitled note)',
    'note.no_body': '(no body)',
    'event.untitled': '(untitled event)',
    'storage.title': 'Storage repair',
    'storage.body': 'Fixes corrupt JSON for tasks, notes, and other planner data on this device. Does not change cloud sync.',
    'storage.last': 'Last scan: {detail}',
    'storage.not_scanned': 'Not scanned yet',
    'storage.scan': 'Scan & repair',
    'storage.toast_ok': 'Storage looks healthy — no repairs needed',
    'storage.toast_fixed': 'Repaired {n} storage key(s) — review tasks if anything looks missing',
    'dash.heading': 'Dashboard',
    'dash.hint': 'Show or hide sections, then reorder.',
    'dash.section.pulse': 'Next 7 days (workload)',
    'dash.section.gapfill': 'Smart gap-fill suggestions',
    'dash.section.countdown': 'Exam countdown',
    'dash.section.schedule': 'Today schedule & focus',
    'dash.section.tasks': 'Tasks',
    'cal.heading': 'Calendar',
    'cal.section.hero': 'Month, day detail & Google sync',
    'cal.section.schedule': 'Cycle & weekly schedule',
    'syllabus.title': 'Schedule conflicts',
    'syllabus.exam_stack': '{date}: {n} tests/quizzes due',
    'syllabus.heavy_day': '{date}: {n} assignments due',
    'syllabus.subject_clash': '{date}: {subject} has a test and homework due',
    'syllabus.duplicate_due': '{date}: duplicate "{name}" — check syllabus import',
    'syllabus.more': '+{n} more conflicts',
    'syllabus.cal_marker': 'Schedule conflict on this day',
  };

  const STRINGS = {
    'en-US': { ...UI_STRINGS },
    'es-US': {
      ...UI_STRINGS,
      'settings.locale_title': 'Idioma y región',
      'settings.locale_hint': 'Fechas y horas usan tu configuración regional.',
      'date.today': 'Hoy',
      'date.tomorrow': 'Mañana',
      'sync.title': 'Conflictos de sincronización',
      'sync.lede_legacy': 'El mismo elemento cambió en dos dispositivos. Elige una versión.',
      'sync.lede_v2': 'El mismo elemento se editó aquí y en la nube. Compara y elige qué copia conservar.',
      'sync.keep_mine': 'Mantener la mía',
      'sync.keep_cloud': 'Mantener la nube',
      'sync.keep_all_mine': 'Mantener todas las mías ({n})',
      'sync.keep_all_cloud': 'Mantener todas de la nube ({n})',
      'sync.no_conflicts': 'Sin conflictos de sincronización',
      'sync.close': 'Cerrar',
      'sync.this_device': 'Este dispositivo',
      'sync.cloud': 'Nube',
      'sync.compare': 'Comparar versiones',
      'sync.resolve': 'Resolver',
      'sync.conflicts_pill': '{n} conflicto(s)',
      'sync.pending_pill': '{n} pendiente(s)',
      'sync.pill_title': 'Conflictos de sincronización',
      'sync.pill_title_v2': 'Conflictos — toca para comparar versiones',
      'sync.outbox_title': 'Cambios sin conexión pendientes',
      'sync.banner': '{n} conflicto(s) de sync —',
      'sync.settings_title': 'Sincronización y conflictos',
      'sync.settings_body': 'La fusión sin conexión está activa para tareas, notas y calendario.',
      'sync.settings_body_v2': ' Si las versiones difieren, verás vistas previas lado a lado.',
      'sync.stat_conflicts': '{n} conflicto(s)',
      'sync.stat_pending': '{n} cambio(s) pendiente(s)',
      'sync.review': 'Revisar conflictos',
      'sync.flush': 'Sincronizar pendientes',
      'sync.syncing': 'Sincronizando…',
      'sync.toast_new': '{n} conflicto(s) — Ajustes → Datos o toca el indicador',
      'task.due': 'Entrega {date}',
      'task.done': 'Hecho',
      'task.not_done': 'Pendiente',
      'task.priority': 'Prioridad: {p}',
      'storage.title': 'Reparar almacenamiento',
      'storage.body': 'Corrige JSON dañado de tareas, notas y otros datos locales. No cambia la nube.',
      'storage.last': 'Último escaneo: {detail}',
      'storage.not_scanned': 'Aún no escaneado',
      'storage.scan': 'Escanear y reparar',
      'storage.toast_ok': 'Almacenamiento en buen estado',
      'storage.toast_fixed': 'Se repararon {n} clave(s) — revisa tus tareas',
      'dash.heading': 'Panel',
      'dash.hint': 'Mostrar u ocultar secciones y reordenar.',
      'dash.section.pulse': 'Próximos 7 días (carga)',
      'dash.section.gapfill': 'Sugerencias inteligentes',
      'dash.section.countdown': 'Cuenta regresiva de exámenes',
      'dash.section.schedule': 'Horario y enfoque de hoy',
      'dash.section.tasks': 'Tareas',
      'cal.heading': 'Calendario',
      'cal.section.hero': 'Mes, día y sync de Google',
      'cal.section.schedule': 'Ciclo y horario semanal',
      'syllabus.title': 'Conflictos de horario',
      'syllabus.exam_stack': '{date}: {n} exámenes/pruebas',
      'syllabus.heavy_day': '{date}: {n} tareas con entrega',
      'syllabus.subject_clash': '{date}: {subject} tiene examen y tarea',
      'syllabus.duplicate_due': '{date}: duplicado "{name}" — revisa el sílabo',
      'syllabus.more': '+{n} conflictos más',
      'syllabus.cal_marker': 'Conflicto de horario este día',
    },
    'fr-FR': {
      ...UI_STRINGS,
      'settings.locale_title': 'Langue et région',
      'settings.locale_hint': 'Dates et heures selon votre locale.',
      'date.today': "Aujourd'hui",
      'date.tomorrow': 'Demain',
      'sync.title': 'Conflits de synchronisation',
      'sync.lede_legacy': 'Le même élément a changé sur deux appareils. Choisissez une version.',
      'sync.lede_v2': 'Le même élément a été modifié ici et dans le cloud. Comparez puis choisissez.',
      'sync.keep_mine': 'Garder la mienne',
      'sync.keep_cloud': 'Garder le cloud',
      'sync.keep_all_mine': 'Tout garder (moi) ({n})',
      'sync.keep_all_cloud': 'Tout garder (cloud) ({n})',
      'sync.no_conflicts': 'Aucun conflit de sync',
      'sync.close': 'Fermer',
      'sync.this_device': 'Cet appareil',
      'sync.cloud': 'Cloud',
      'sync.compare': 'Comparer',
      'sync.resolve': 'Résoudre',
      'sync.conflicts_pill': '{n} conflit(s)',
      'sync.pending_pill': '{n} en attente',
      'sync.settings_title': 'Sync et conflits',
      'sync.settings_body': 'Fusion hors ligne active pour tâches, notes et calendrier.',
      'sync.settings_body_v2': ' Prévisualisations côte à côte si les versions diffèrent.',
      'sync.review': 'Voir les conflits',
      'sync.flush': 'Synchroniser maintenant',
      'sync.syncing': 'Synchronisation…',
      'storage.title': 'Réparation du stockage',
      'storage.body': 'Corrige le JSON local corrompu. Ne modifie pas le cloud.',
      'storage.scan': 'Analyser et réparer',
      'dash.heading': 'Tableau de bord',
      'dash.hint': 'Afficher, masquer et réordonner les sections.',
      'dash.section.countdown': 'Compte à rebours examens',
      'dash.section.tasks': 'Tâches',
      'cal.heading': 'Calendrier',
      'syllabus.title': 'Conflits d\'emploi du temps',
      'syllabus.exam_stack': '{date} : {n} tests',
      'syllabus.heavy_day': '{date} : {n} devoirs',
      'syllabus.subject_clash': '{date} : {subject} — test et devoir',
      'syllabus.duplicate_due': '{date} : doublon « {name} »',
      'syllabus.more': '+{n} autres',
      'syllabus.cal_marker': 'Conflit d\'horaire ce jour',
    },
    'ar-SA': {
      ...UI_STRINGS,
      'settings.locale_title': 'اللغة والمنطقة',
      'settings.locale_hint': 'التواريخ والأوقات حسب إعداداتك المحلية.',
      'date.today': 'اليوم',
      'date.tomorrow': 'غداً',
      'sync.title': 'تعارضات المزامنة',
      'sync.lede_legacy': 'عُدّل نفس العنصر على جهازين. اختر نسخة.',
      'sync.lede_v2': 'عُدّل العنصر هنا وفي السحابة. قارن ثم اختر النسخة.',
      'sync.keep_mine': 'الاحتفاظ بنسختي',
      'sync.keep_cloud': 'الاحتفاظ بالسحابة',
      'sync.keep_all_mine': 'الكل محلياً ({n})',
      'sync.keep_all_cloud': 'الكل من السحابة ({n})',
      'sync.no_conflicts': 'لا تعارضات',
      'sync.close': 'إغلاق',
      'sync.this_device': 'هذا الجهاز',
      'sync.cloud': 'السحابة',
      'sync.compare': 'مقارنة',
      'sync.resolve': 'حل',
      'sync.settings_title': 'المزامنة والتعارضات',
      'sync.review': 'مراجعة التعارضات',
      'sync.flush': 'مزامنة المعلّق',
      'storage.title': 'إصلاح التخزين',
      'storage.scan': 'فحص وإصلاح',
      'dash.heading': 'لوحة التحكم',
      'dash.section.tasks': 'المهام',
      'cal.heading': 'التقويم',
      'syllabus.title': 'تعارضات الجدول',
      'syllabus.exam_stack': '{date}: {n} اختبارات',
      'syllabus.heavy_day': '{date}: {n} واجبات',
      'syllabus.subject_clash': '{date}: {subject} — اختبار وواجب',
      'syllabus.duplicate_due': '{date}: تكرار «{name}»',
      'syllabus.more': '+{n} أخرى',
      'syllabus.cal_marker': 'تعارض في الجدول هذا اليوم',
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

  function t(key, vars) {
    const table = STRINGS[_locale] || STRINGS['en-US'];
    let s = table[key] || STRINGS['en-US'][key] || key;
    if (vars && typeof vars === 'object') {
      Object.keys(vars).forEach((k) => {
        s = s.split('{' + k + '}').join(String(vars[k]));
      });
    }
    return s;
  }

  function fluxT(key, vars) {
    if (!enabled()) {
      let s = STRINGS['en-US'][key] || key;
      if (vars && typeof vars === 'object') {
        Object.keys(vars).forEach((k) => {
          s = s.split('{' + k + '}').join(String(vars[k]));
        });
      }
      return s;
    }
    return t(key, vars);
  }

  function refreshLocaleSurfaces() {
    try {
      if (window.FluxPersonal?.renderPanelLayoutSettings) window.FluxPersonal.renderPanelLayoutSettings();
      if (window.FluxStorageRepair?.renderSettingsCard) window.FluxStorageRepair.renderSettingsCard();
      if (window.FluxOfflineSync?.refreshConflictUi) window.FluxOfflineSync.refreshConflictUi();
      if (window.FluxSyllabusConflict?.render) window.FluxSyllabusConflict.render();
      if (window.FluxSyllabusConflict?.decorateCalendar) window.FluxSyllabusConflict.decorateCalendar();
    } catch (_) {}
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

  /** Staff/educator panels — delegates to fmtFluxDate when app.js is loaded */
  function fmtStaffDate(input, style) {
    if (typeof window.fmtFluxDate === 'function') return window.fmtFluxDate(input, style || 'short');
    return formatDate(input, style || 'short');
  }

  function fmtStaffDateTime(input) {
    if (typeof window.fluxFormatDateTime === 'function') return window.fluxFormatDateTime(input);
    const d = toDate(input);
    if (!d) return '';
    return formatDateTime(d);
  }

  function fmtStaffTime(input, opts) {
    if (typeof window.fluxFormatTime === 'function') return window.fluxFormatTime(input, opts);
    return formatTime(input, opts);
  }

  function refreshStaffDateSurfaces() {
    const panels = ['lessonHub', 'counselorMeetings', 'adminOps', 'staffWorkboard'];
    panels.forEach((panel) => {
      if (document.getElementById(`fluxWidgetGrid_${panel}`) && window.FluxModuleLoader?.renderWidgetGrid) {
        try {
          window.FluxModuleLoader.renderWidgetGrid(panel);
        } catch (_) {}
      }
    });
    const adminBody = document.getElementById('adminDashboardBody');
    if (adminBody && adminBody.querySelector('.edu-dash-root') && typeof window.renderAdminDashboard === 'function') {
      void window.renderAdminDashboard();
    }
    try {
      if (typeof window.renderTeacherDashboard === 'function' && document.getElementById('teacherDashboardBody')?.querySelector('.edu-dash-root')) {
        void window.renderTeacherDashboard();
      }
      if (typeof window.renderCounselorDashboard === 'function' && document.getElementById('counselorDashboardBody')?.querySelector('.edu-dash-root')) {
        void window.renderCounselorDashboard();
      }
    } catch (_) {}
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
    window.fluxFmtStaffDate = fmtStaffDate;
    window.fluxFmtStaffDateTime = fmtStaffDateTime;
    window.fluxFmtStaffTime = fmtStaffTime;
    window.fluxT = fluxT;
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
        refreshStaffDateSurfaces();
        refreshLocaleSurfaces();
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
    fluxT,
    refreshLocaleSurfaces,
    formatDate,
    formatTime,
    formatDateTime,
    fmtStaffDate,
    fmtStaffDateTime,
    fmtStaffTime,
    refreshStaffDateSurfaces,
    relativeDayLabel,
    calendarStripLabel,
    bindGlobals,
    updateDatePill,
    renderSettingsCard,
    install,
  };
})();
