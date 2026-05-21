/**
 * P16.1 — Exam countdown + suggested daily prep minutes per subject.
 * Flag: enable_exam_prep_plan (default off).
 */
(function () {
  'use strict';

  const FLAG = 'enable_exam_prep_plan';
  const STORE_KEY = 'flux_exam_prep_plan_v1';
  const BLOCK_ID = 'examPrepPlanBlock';
  const EXAM_TYPES = ['test', 'quiz'];
  const DEFAULT_REVIEW_MIN = 90;

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

  function getPrefs() {
    const s = load(STORE_KEY, {});
    return {
      defaultReviewMin: Math.max(30, parseInt(s.defaultReviewMin, 10) || DEFAULT_REVIEW_MIN),
      overrides: s.overrides && typeof s.overrides === 'object' ? s.overrides : {},
    };
  }

  function persistPrefs(data) {
    save(STORE_KEY, data);
    try {
      if (typeof window.syncKey === 'function') window.syncKey('examPrepPlan', data);
    } catch (_) {}
  }

  function getCloudSlice() {
    return getPrefs();
  }

  function applyFromCloud(data) {
    if (!data || typeof data !== 'object') return;
    persistPrefs({ ...getPrefs(), ...data });
    renderBlock();
  }

  function taskList() {
    return typeof window.tasks !== 'undefined' && Array.isArray(window.tasks) ? window.tasks : [];
  }

  function daysUntil(dateStr) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const due = new Date(dateStr + 'T00:00:00');
    return Math.max(0, Math.floor((due - now) / 86400000));
  }

  function upcomingExams(limit) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return taskList()
      .filter(
        (t) =>
          t &&
          !t.done &&
          EXAM_TYPES.includes(t.type || '') &&
          t.date &&
          new Date(t.date + 'T00:00:00') >= now,
      )
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, limit || 4);
  }

  function prepMinutesForExam(exam) {
    const prefs = getPrefs();
    const override = prefs.overrides[String(exam.id)];
    if (Number.isFinite(parseInt(override, 10)) && parseInt(override, 10) > 0) {
      return parseInt(override, 10);
    }
    const examDate = exam.date;
    const subject = exam.subject || '';
    let total = parseInt(exam.estTime, 10) || 0;
    if (total < 30) total = prefs.defaultReviewMin;
    taskList().forEach((t) => {
      if (!t || t.done || t.id === exam.id || !t.date) return;
      if (subject && t.subject !== subject) return;
      if (t.date > examDate) return;
      total += parseInt(t.estTime, 10) || 30;
    });
    return total;
  }

  function dailyMinutes(exam) {
    const days = Math.max(1, daysUntil(exam.date));
    const total = prepMinutesForExam(exam);
    return Math.max(15, Math.ceil(total / days));
  }

  function subjectColor(key) {
    const subjs = typeof window.getSubjects === 'function' ? window.getSubjects() : {};
    const s = subjs[key];
    return s?.color || 'var(--accent)';
  }

  function subjectShort(key) {
    const subjs = typeof window.getSubjects === 'function' ? window.getSubjects() : {};
    const s = subjs[key];
    return s ? s.short || s.name || key : key || '—';
  }

  function renderBlock() {
    if (!enabled()) return;
    const card = document.getElementById('countdownCard');
    if (!card || card.style.display === 'none') {
      document.getElementById(BLOCK_ID)?.remove();
      return;
    }
    const exams = upcomingExams(4);
    if (!exams.length) {
      document.getElementById(BLOCK_ID)?.remove();
      return;
    }

    let block = document.getElementById(BLOCK_ID);
    if (!block) {
      block = document.createElement('div');
      block.id = BLOCK_ID;
      block.className = 'flux-exam-prep-block';
      const grid = document.getElementById('countdownGrid');
      const inner = card.querySelector('.dash-v2-countdown-card') || card;
      if (grid && grid.parentNode === inner) inner.appendChild(block);
      else inner.appendChild(block);
    }

    const rows = exams
      .map((exam) => {
        const days = daysUntil(exam.date);
        const daily = dailyMinutes(exam);
        const col = subjectColor(exam.subject);
        const fmtDue =
          typeof window.fmtFluxDue === 'function' ? window.fmtFluxDue(exam.date) : exam.date;
        return `<div class="flux-exam-prep-row">
  <div class="flux-exam-prep-stripe" style="background:${esc(col)}"></div>
  <div class="flux-exam-prep-main">
    <div class="flux-exam-prep-name">${esc(exam.name)}</div>
    <div class="flux-exam-prep-meta">${esc(subjectShort(exam.subject))} · ${esc(fmtDue)} · ${esc(T('exam.days', { n: days }))}</div>
  </div>
  <div class="flux-exam-prep-mins">${daily}<span>${esc(T('exam.min_day'))}</span></div>
</div>`;
      })
      .join('');

    block.innerHTML = `<div class="flux-exam-prep-title">${esc(T('exam.prep_title'))}</div>
${rows}
<p style="font-size:.68rem;color:var(--muted);margin:8px 0 0;line-height:1.45">${esc(T('exam.prep_hint'))}</p>`;
  }

  function wrapRenderCountdown() {
    const orig = window.renderCountdown;
    if (typeof orig !== 'function' || orig._fluxExamPrepWrapped) return;
    window.renderCountdown = function () {
      const r = orig.apply(this, arguments);
      try {
        if (enabled()) renderBlock();
        else document.getElementById(BLOCK_ID)?.remove();
      } catch (_) {}
      return r;
    };
    window.renderCountdown._fluxExamPrepWrapped = true;
  }

  function getPaletteCommands(q) {
    if (!enabled()) return [];
    const needle = (q || '').toLowerCase();
    const label = T('exam.palette');
    const keys = 'exam prep countdown study minutes daily';
    if (
      needle &&
      !label.toLowerCase().includes(needle) &&
      !keys.split(' ').some((k) => needle.includes(k))
    ) {
      return [];
    }
    return [
      {
        icon: '📝',
        label,
        cat: 'Navigation',
        action: () => {
          if (typeof window.closeCommandPalette === 'function') window.closeCommandPalette();
          if (typeof window.nav === 'function') window.nav('dashboard');
          setTimeout(() => {
            if (typeof window.renderCountdown === 'function') window.renderCountdown();
          }, 150);
        },
      },
    ];
  }

  function install() {
    if (!enabled()) {
      document.getElementById(BLOCK_ID)?.remove();
      return false;
    }
    wrapRenderCountdown();
    if (typeof window.renderCountdown === 'function') window.renderCountdown();
    return true;
  }

  window.FluxExamPrepPlan = {
    FLAG,
    enabled,
    upcomingExams,
    dailyMinutes,
    prepMinutesForExam,
    renderBlock,
    getCloudSlice,
    applyFromCloud,
    getPaletteCommands,
    install,
  };
})();
