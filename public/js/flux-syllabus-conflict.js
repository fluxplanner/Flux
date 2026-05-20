/**
 * P11-SYLLABUS-CONFLICT — schedule conflict detection for dashboard banner.
 * Flag: enable_syllabus_conflict_check (default off). Falls back to renderExamConflictBanner.
 */
(function () {
  'use strict';

  const FLAG = 'enable_syllabus_conflict_check';
  const ASSESS_TYPES = new Set(['test', 'quiz']);
  const WORK_TYPES = new Set(['hw', 'essay', 'project', 'lab', 'reading']);

  function enabled() {
    try {
      return !!window.FluxFeatureFlags?.isEnabled(FLAG, false);
    } catch (_) {
      return false;
    }
  }

  function T(key, vars) {
    if (typeof window.fluxT === 'function') return window.fluxT(key, vars);
    return key;
  }

  function esc(s) {
    if (typeof window.esc === 'function') return window.esc(s);
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function fmtDay(iso) {
    if (typeof window.fmtFluxDate === 'function') return window.fmtFluxDate(iso, 'short');
    return iso || '';
  }

  function taskList() {
    if (typeof window.tasks !== 'undefined' && Array.isArray(window.tasks)) return window.tasks;
    try {
      if (typeof window.load === 'function') return window.load('tasks', []);
    } catch (_) {}
    return [];
  }

  function normName(t) {
    return String(t?.name || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function subjectKey(t) {
    return String(t?.subject || t?.classId || 'general').toLowerCase().trim();
  }

  function openTasks() {
    return taskList().filter((t) => t && !t.done && t.date);
  }

  function groupByDate(list) {
    const by = {};
    list.forEach((t) => {
      const d = String(t.date).slice(0, 10);
      if (!by[d]) by[d] = [];
      by[d].push(t);
    });
    return by;
  }

  function detectConflicts() {
    const list = openTasks();
    const byDate = groupByDate(list);
    const issues = [];

    Object.entries(byDate).forEach(([date, items]) => {
      const assess = items.filter((t) => ASSESS_TYPES.has(t.type));
      if (assess.length >= 2) {
        issues.push({
          kind: 'exam_stack',
          date,
          message: T('syllabus.exam_stack', { date: fmtDay(date + 'T12:00'), n: assess.length }),
        });
      }

      if (items.length >= 4) {
        issues.push({
          kind: 'heavy_day',
          date,
          message: T('syllabus.heavy_day', { date: fmtDay(date + 'T12:00'), n: items.length }),
        });
      }

      const bySubject = {};
      items.forEach((t) => {
        const sk = subjectKey(t);
        if (!bySubject[sk]) bySubject[sk] = { assess: 0, work: 0, name: t.subject || sk };
        if (ASSESS_TYPES.has(t.type)) bySubject[sk].assess += 1;
        else if (WORK_TYPES.has(t.type)) bySubject[sk].work += 1;
      });
      Object.values(bySubject).forEach((row) => {
        if (row.assess && row.work) {
          issues.push({
            kind: 'subject_clash',
            date,
            message: T('syllabus.subject_clash', {
              date: fmtDay(date + 'T12:00'),
              subject: row.name,
            }),
          });
        }
      });

      const names = new Map();
      items.forEach((t) => {
        const n = normName(t);
        if (!n || n.length < 4) return;
        const k = n + '|' + subjectKey(t);
        if (!names.has(k)) names.set(k, []);
        names.get(k).push(t);
      });
      names.forEach((dupes, key) => {
        if (dupes.length < 2) return;
        issues.push({
          kind: 'duplicate_due',
          date,
          message: T('syllabus.duplicate_due', {
            date: fmtDay(date + 'T12:00'),
            name: dupes[0].name || key.split('|')[0],
          }),
        });
      });
    });

    const seen = new Set();
    return issues.filter((i) => {
      const id = i.kind + '|' + i.date + '|' + i.message;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  function renderLegacy() {
    if (typeof window.renderExamConflictBanner === 'function') window.renderExamConflictBanner();
  }

  function render() {
    const el = document.getElementById('examConflictBanner');
    if (!el) return;

    if (!enabled()) {
      el.classList.remove('syllabus-conflict-banner--v2');
      renderLegacy();
      return;
    }

    const issues = detectConflicts();
    if (!issues.length) {
      el.style.display = 'none';
      el.innerHTML = '';
      el.classList.remove('syllabus-conflict-banner--v2');
      return;
    }

    const items = issues
      .slice(0, 5)
      .map((i) => `<li>${esc(i.message)}</li>`)
      .join('');
    const more =
      issues.length > 5
        ? `<li>${esc(T('syllabus.more', { n: issues.length - 5 }))}</li>`
        : '';

    el.style.display = 'block';
    el.classList.add('syllabus-conflict-banner--v2');
    el.innerHTML = `<strong>${esc(T('syllabus.title'))}</strong>
      <ul class="syllabus-conflict-list">${items}${more}</ul>`;
  }

  window.FluxSyllabusConflict = {
    FLAG,
    enabled,
    detectConflicts,
    render,
  };
})();
