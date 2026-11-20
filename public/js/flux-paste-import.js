/**
 * flux-paste-import.js — "Paste a list": the screen for flux-paste-import-core.js.
 *
 * Paste an assignment sheet, a syllabus or a to-do list; every line becomes a
 * task draft you can untick or correct before anything is saved. Works offline
 * and uses no AI. Exposed as window.FluxPasteImport.open(); reached from the
 * Import hub and the command palette.
 *
 * Every button here carries a class: the planner turns a class-less button into
 * a primary pill.
 */
(function () {
  'use strict';

  var MODAL_ID = 'fluxPasteImportModal';
  var drafts = [];
  var timer = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function toast(msg, kind) { try { if (typeof window.showToast === 'function') window.showToast(msg, kind || 'info'); } catch (e) {} }
  function el(id) { return document.getElementById(id); }

  function close() {
    clearTimeout(timer);
    var m = el(MODAL_ID);
    if (m) m.remove();
    drafts = [];
    document.removeEventListener('keydown', onKey, true);
  }
  function onKey(e) {
    if (e.key !== 'Escape' || !el(MODAL_ID)) return;
    e.stopPropagation();
    close();
  }

  function subjects() {
    try { return (typeof getSubjects === 'function' ? getSubjects() : {}) || {}; } catch (e) { return {}; }
  }
  function existingTasks() {
    try { return Array.isArray(window.tasks) ? window.tasks.filter(function (t) { return t && !t.done; }) : []; } catch (e) { return []; }
  }

  var TYPE_LABEL = { test: 'Test', quiz: 'Quiz', project: 'Project', essay: 'Essay', lab: 'Lab' };

  function parse() {
    var ta = el('fpiText');
    var core = window.FluxPasteImportCore;
    if (!ta || !core || typeof window.parseNLTask !== 'function') return;
    var now = new Date();
    var built = core.build(ta.value, function (line) { return window.parseNLTask(line, now); });
    drafts = core.markDuplicates(built, existingTasks()).map(function (d) {
      d.on = !d.duplicate;
      return d;
    });
    render();
  }

  function render() {
    var list = el('fpiList');
    if (!list) return;
    var subs = subjects();
    var keys = Object.keys(subs);
    if (!drafts.length) {
      var typed = (el('fpiText').value || '').trim();
      list.innerHTML = typed
        ? '<p class="fpi-empty">Nothing here looks like a task yet. Put one task on each line.</p>'
        : '';
    } else {
      list.innerHTML = drafts.map(function (d, i) {
        var opts = '<option value="">No class</option>' + keys.map(function (k) {
          return '<option value="' + esc(k) + '"' + (k === d.subject ? ' selected' : '') + '>' + esc(subs[k].name) + '</option>';
        }).join('');
        return '<div class="fpi-row' + (d.on ? '' : ' fpi-row--off') + '" data-i="' + i + '">' +
          '<input type="checkbox" class="fpi-check" aria-label="Add this task"' + (d.on ? ' checked' : '') + '>' +
          '<div class="fpi-main">' +
            '<input type="text" class="fpi-name" aria-label="Task name" maxlength="200" value="' + esc(d.name) + '">' +
            '<div class="fpi-meta">' +
              '<input type="date" class="fpi-date" aria-label="Due date" value="' + esc(d.date) + '">' +
              (keys.length ? '<select class="fpi-subject" aria-label="Class">' + opts + '</select>' : '') +
              (TYPE_LABEL[d.type] ? '<span class="fpi-chip">' + TYPE_LABEL[d.type] + '</span>' : '') +
              (d.duplicate ? '<span class="fpi-chip fpi-chip--dup">Already in your list</span>' : '') +
            '</div>' +
          '</div>' +
        '</div>';
      }).join('');
    }
    updateFooter();
  }

  function updateFooter() {
    var n = drafts.filter(function (d) { return d.on && d.name.trim(); }).length;
    var btn = el('fpiAdd');
    if (btn) {
      btn.disabled = !n;
      btn.textContent = n ? 'Add ' + n + (n === 1 ? ' task' : ' tasks') : 'Add tasks';
    }
    var count = el('fpiCount');
    if (count) {
      var noDate = drafts.filter(function (d) { return d.on && !d.date; }).length;
      count.textContent = !drafts.length ? ''
        : drafts.length + (drafts.length === 1 ? ' line read' : ' lines read') + (noDate ? ' · ' + noDate + ' with no due date' : '');
    }
  }

  function addAll() {
    var chosen = drafts.filter(function (d) { return d.on && d.name.trim(); });
    if (!chosen.length) return;
    var now = Date.now();
    var made = chosen.map(function (d, i) {
      var t = {
        id: now + i + Math.random(),
        name: d.name.trim().slice(0, 200),
        priority: d.priority, date: d.date, type: d.type,
        estTime: d.estTime, subject: d.subject,
        done: false, rescheduled: 0, createdAt: now, urgencyScore: 0, difficulty: 3,
      };
      if (d.time) t.time = d.time;
      try { t.urgencyScore = calcUrgency(t); } catch (e) {}
      return t;
    });
    try {
      // Kept in the order they were pasted, above what was already there.
      tasks.unshift.apply(tasks, made);
      save('tasks', tasks);
      if (typeof syncKey === 'function') syncKey('tasks', tasks);
    } catch (e) {
      toast('Could not add those tasks. Nothing was changed.', 'error');
      return;
    }
    /* Bare names, as flux-canvas-panel.js does: these are the planner's own
       functions and not all of them are also hung on window. */
    try { if (typeof renderStats === 'function') renderStats(); } catch (e) {}
    try { if (typeof renderTasks === 'function') renderTasks(); } catch (e) {}
    try { if (typeof renderCalendar === 'function') renderCalendar(); } catch (e) {}
    try { if (typeof renderCountdown === 'function') renderCountdown(); } catch (e) {}
    try { if (typeof checkAllPanic === 'function') checkAllPanic(); } catch (e) {}
    close();
    toast('✓ ' + made.length + (made.length === 1 ? ' task added' : ' tasks added'), 'success');
  }

  function open(prefill) {
    close();
    var ov = document.createElement('div');
    ov.id = MODAL_ID;
    ov.className = 'modal-overlay';
    ov.style.display = 'flex';
    ov.innerHTML =
      '<div class="modal fpi-modal" role="dialog" aria-modal="true" aria-labelledby="fpiTitle">' +
        '<div class="fpi-head"><h3 class="fpi-title" id="fpiTitle">Paste a list</h3>' +
        '<button type="button" class="fpi-x" id="fpiClose" aria-label="Close">✕</button></div>' +
        '<p class="fpi-note">Paste an assignment sheet, a syllabus or your own list. One task per line; dates like <b>11/20</b>, <b>Nov 20</b> or <b>Friday</b> are picked up. Nothing is saved until you press Add.</p>' +
        '<textarea id="fpiText" class="fpi-text" rows="6" spellcheck="false" aria-label="Your list" placeholder="Read chapter 4 due Friday&#10;Bio lab report 11/20&#10;Vocab quiz Nov 22"></textarea>' +
        '<div class="fpi-count" id="fpiCount" aria-live="polite"></div>' +
        '<div class="fpi-list" id="fpiList"></div>' +
        '<div class="fpi-foot">' +
          '<button type="button" class="fpi-btn fpi-btn--ghost" id="fpiCancel">Cancel</button>' +
          '<button type="button" class="fpi-btn fpi-btn--primary" id="fpiAdd" disabled>Add tasks</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);

    var ta = el('fpiText');
    ta.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(parse, 180); });
    ta.addEventListener('paste', function () { clearTimeout(timer); timer = setTimeout(parse, 0); });

    ov.addEventListener('click', function (e) {
      if (e.target === ov || e.target.closest('#fpiClose') || e.target.closest('#fpiCancel')) { close(); return; }
      if (e.target.closest('#fpiAdd')) addAll();
    });
    /* Edits to a row change the draft in place; the list is not redrawn, so the
       field being typed in keeps its focus. */
    el('fpiList').addEventListener('input', onRowEdit);
    el('fpiList').addEventListener('change', onRowEdit);
    document.addEventListener('keydown', onKey, true);

    if (typeof prefill === 'string' && prefill.trim()) { ta.value = prefill; parse(); }
    try { ta.focus(); } catch (e) {}
  }

  function onRowEdit(e) {
    var row = e.target.closest('.fpi-row');
    if (!row) return;
    var d = drafts[+row.getAttribute('data-i')];
    if (!d) return;
    var t = e.target;
    if (t.classList.contains('fpi-check')) { d.on = t.checked; row.classList.toggle('fpi-row--off', !d.on); }
    else if (t.classList.contains('fpi-name')) d.name = t.value;
    else if (t.classList.contains('fpi-date')) d.date = /^\d{4}-\d{2}-\d{2}$/.test(t.value) ? t.value : '';
    else if (t.classList.contains('fpi-subject')) d.subject = t.value;
    updateFooter();
  }

  window.FluxPasteImport = { open: open, close: close };
})();
