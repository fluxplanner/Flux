/* ============================================================================
   FLUX TEACHER CLASSES  ·  flux-teacher-classes.js
   The classes a member of staff TEACHES, on the same IA period system students
   already use — A1 · American Lit, A2 · World History — plus the assigned work
   and events attached to each one.

   Before this, the teacher School tab had a "My classes" card containing one
   sentence pointing at the teacher dashboard. There was no way for a teacher
   to record what they teach, when.

   WHY A SEPARATE KEY FROM THE STUDENT LIST
   ----------------------------------------
   Students keep flux_classes: the classes they ATTEND. That list feeds GPA,
   subject budgets, the subject picker on tasks, study-tool subjects and the AI
   planner context. A teacher's classes are the ones they TEACH — the same
   shape, an entirely different meaning. Sharing one key would collide for
   anyone who is both, and would quietly feed "American Lit, period A1" into a
   student's GPA maths. So: flux_teacher_classes, same field names so the
   period helpers can be reused verbatim, separate storage.

   The period parsing is NOT reimplemented. parseClassPeriodInput in app.js
   already turns "A1" into {period:1, days:'A Day'}, and is what the student
   form, the PDF schedule import and onboarding all use. A second parser would
   drift from it the first time the school changed its format.
   ========================================================================== */
(function () {
  'use strict';
  if (window.FluxTeacherClasses) return;

  var LS_KEY = 'flux_teacher_classes';
  var COLORS = ['#3b82f6', '#f43f5e', '#10d9a0', '#fbbf24', '#a78bfa', '#fb923c', '#e879f9', '#22d3ee'];

  function load() {
    try {
      if (typeof window.load === 'function') return window.load(LS_KEY, []) || [];
      var raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }
  function persist() {
    try {
      if (typeof window.save === 'function') window.save(LS_KEY, classes);
      else localStorage.setItem(LS_KEY, JSON.stringify(classes));
    } catch (e) {}
    // Teaching load should follow the account, not the laptop it was typed on.
    try { if (typeof window.syncKey === 'function') window.syncKey('teacherClasses', classes); } catch (e) {}
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function $(id) { return document.getElementById(id); }
  function toast(m, k) {
    try { if (typeof window.showToast === 'function') window.showToast(m, k || 'success'); } catch (e) {}
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  var classes = [];
  function byPeriod(a, b) {
    // A-day before B-day at the same number, so a fortnight reads in order.
    if (a.period !== b.period) return a.period - b.period;
    return String(a.days).localeCompare(String(b.days));
  }
  function normalise(list) {
    if (!Array.isArray(list)) return [];
    return list.filter(function (c) { return c && typeof c === 'object' && c.name; }).map(function (c, i) {
      return {
        id: c.id || (Date.now() + i),
        period: typeof c.period === 'number' ? c.period : 1,
        periodLabel: String(c.periodLabel || ''),
        days: typeof c.days === 'string' ? c.days : '',
        name: String(c.name || ''),
        room: String(c.room || ''),
        timeStart: String(c.timeStart || ''),
        timeEnd: String(c.timeEnd || ''),
        color: c.color || COLORS[i % COLORS.length],
        /* A class written before work existed has none, and a corrupted one
           could hold anything — a bad value here throws on every render. */
        work: Array.isArray(c.work) ? c.work.filter(function (w) { return w && w.title; }) : [],
      };
    }).sort(byPeriod);
  }
  classes = normalise(load());

  // ── period helpers, borrowed from app.js rather than rewritten ────────────
  function parsePeriod(raw, fallbackDays) {
    if (typeof window.parseClassPeriodInput === 'function') {
      return window.parseClassPeriodInput(raw, fallbackDays);
    }
    // Only reached if app.js has not evaluated yet; same contract, minimal.
    var s = String(raw || '').trim().replace(/\s+/g, '');
    var ab = s.match(/^([AB])(\d{1,2})$/i);
    if (ab) return { period: Math.min(24, parseInt(ab[2], 10)), days: ab[1].toUpperCase() === 'A' ? 'A Day' : 'B Day' };
    var n = parseInt(s, 10);
    return { period: !isNaN(n) && n >= 1 ? Math.min(24, n) : 1, days: fallbackDays || '' };
  }
  function badge(c) {
    if (typeof window.fluxClassPeriodBadge === 'function') return window.fluxClassPeriodBadge(c);
    return c.periodLabel || String(c.period || '');
  }
  function cleanName(n) {
    if (typeof window.cleanClassName === 'function') return window.cleanClassName(n);
    return String(n || '').trim().replace(/\s+/g, ' ');
  }

  // ── mutations ─────────────────────────────────────────────────────────────
  function find(id) {
    for (var i = 0; i < classes.length; i++) if (String(classes[i].id) === String(id)) return classes[i];
    return null;
  }

  function addClass() {
    var rawPeriod = ($('ftcPeriod') || {}).value || '';
    var name = (($('ftcName') || {}).value || '').trim();
    if (!name) { toast('Give the class a name first', 'error'); return; }
    var p = parsePeriod(rawPeriod, '');
    classes.push({
      id: Date.now(),
      period: p.period,
      periodLabel: String(rawPeriod).trim(),
      days: p.days,
      name: cleanName(name),
      room: (($('ftcRoom') || {}).value || '').trim(),
      timeStart: ($('ftcStart') || {}).value || '',
      timeEnd: ($('ftcEnd') || {}).value || '',
      color: COLORS[classes.length % COLORS.length],
      work: [],
    });
    classes.sort(byPeriod);
    persist();
    ['ftcPeriod', 'ftcName', 'ftcRoom', 'ftcStart', 'ftcEnd'].forEach(function (id) {
      var el = $(id); if (el) el.value = '';
    });
    render();
    toast('Added ' + name, 'success');
  }

  function removeClass(id) {
    var c = find(id);
    if (!c) return;
    /* Deleting a class takes its assigned work with it, so say so up front
       rather than letting it be discovered afterwards. */
    var msg = c.work.length
      ? 'Delete ' + c.name + ' and its ' + c.work.length + ' item' + (c.work.length === 1 ? '' : 's') + ' of work?'
      : 'Delete ' + c.name + '?';
    if (!window.confirm(msg)) return;
    classes = classes.filter(function (x) { return String(x.id) !== String(id); });
    persist(); render();
  }

  var openId = null;   // which class has its work drawer open

  function addWork(classId) {
    var c = find(classId); if (!c) return;
    var title = (($('ftcWorkTitle-' + classId) || {}).value || '').trim();
    if (!title) { toast('Give the work a title first', 'error'); return; }
    c.work.push({
      id: uid(),
      type: (($('ftcWorkType-' + classId) || {}).value) === 'event' ? 'event' : 'assignment',
      title: title,
      due: ($('ftcWorkDue-' + classId) || {}).value || '',
      notes: '',
      done: false,
    });
    c.work.sort(function (a, b) {
      /* Dated first and soonest first; undated sink to the bottom rather than
         sorting as though they were due in the year 0. */
      if (!a.due && !b.due) return 0;
      if (!a.due) return 1;
      if (!b.due) return -1;
      return a.due.localeCompare(b.due);
    });
    persist(); render();
    toast('Added to ' + c.name, 'success');
  }
  function removeWork(classId, workId) {
    var c = find(classId); if (!c) return;
    c.work = c.work.filter(function (w) { return w.id !== workId; });
    persist(); render();
  }
  function toggleWork(classId, workId) {
    var c = find(classId); if (!c) return;
    for (var i = 0; i < c.work.length; i++) {
      if (c.work[i].id === workId) { c.work[i].done = !c.work[i].done; break; }
    }
    persist(); render();
  }
  function toggleOpen(id) {
    openId = String(openId) === String(id) ? null : id;
    render();
  }

  // ── render ────────────────────────────────────────────────────────────────
  function fmtDue(d) {
    if (!d) return '';
    try {
      return new Date(d + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch (e) { return d; }
  }
  function isOverdue(w) {
    if (!w.due || w.done) return false;
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    var t = new Date();
    return w.due < (t.getFullYear() + '-' + p(t.getMonth() + 1) + '-' + p(t.getDate()));
  }

  function workHtml(c) {
    var rows = c.work.length
      ? c.work.map(function (w) {
        return '<div class="ftc-work' + (w.done ? ' is-done' : '') + (isOverdue(w) ? ' is-late' : '') + '">'
          + '<button type="button" class="ftc-check" data-ftc="work-toggle" data-id="' + esc(String(c.id)) + '"'
          + ' data-wid="' + esc(w.id) + '" role="checkbox" aria-checked="' + (w.done ? 'true' : 'false') + '"'
          + ' aria-label="Mark ' + esc(w.title) + ' done">' + (w.done ? '✓' : '') + '</button>'
          + '<span class="ftc-work-type" data-t="' + esc(w.type) + '">' + (w.type === 'event' ? 'Event' : 'Work') + '</span>'
          + '<span class="ftc-work-title">' + esc(w.title) + '</span>'
          + (w.due ? '<span class="ftc-work-due">' + esc(fmtDue(w.due)) + '</span>' : '')
          + '<button type="button" class="ftc-x" data-ftc="work-del" data-id="' + esc(String(c.id)) + '"'
          + ' data-wid="' + esc(w.id) + '" aria-label="Delete ' + esc(w.title) + '">&times;</button>'
          + '</div>';
      }).join('')
      : '<div class="ftc-empty-work">Nothing set for this class yet.</div>';

    return '<div class="ftc-drawer">'
      + rows
      + '<div class="ftc-work-add">'
      + '<select class="ftc-in ftc-in--type" id="ftcWorkType-' + esc(String(c.id)) + '" aria-label="Type">'
      + '<option value="assignment">Assigned work</option><option value="event">Event</option></select>'
      + '<input class="ftc-in ftc-in--grow" id="ftcWorkTitle-' + esc(String(c.id)) + '" type="text" maxlength="120"'
      + ' placeholder="e.g. Essay 2 draft, or Field trip">'
      + '<input class="ftc-in ftc-in--date" id="ftcWorkDue-' + esc(String(c.id)) + '" type="date" aria-label="Due date">'
      + '<button type="button" class="btn-sec ftc-mini" data-ftc="work-add" data-id="' + esc(String(c.id)) + '">Add</button>'
      + '</div></div>';
  }

  function classHtml(c) {
    var open = String(openId) === String(c.id);
    var meta = [c.room ? 'Room ' + c.room : '',
                c.timeStart ? c.timeStart + (c.timeEnd ? '–' + c.timeEnd : '') : '']
      .filter(Boolean).join(' · ');
    var pending = c.work.filter(function (w) { return !w.done; }).length;
    return '<div class="ftc-class" style="border-left:3px solid ' + esc(c.color) + '">'
      + '<div class="ftc-class-head">'
      + '<div class="ftc-badge" style="--sub:' + esc(c.color) + '">' + esc(badge(c)) + '</div>'
      + '<div class="ftc-class-main">'
      + '<div class="ftc-class-name">' + esc(c.name) + '</div>'
      + (meta ? '<div class="ftc-class-meta">' + esc(meta) + '</div>' : '')
      + '</div>'
      + '<button type="button" class="btn-sec ftc-mini" data-ftc="toggle" data-id="' + esc(String(c.id)) + '"'
      + ' aria-expanded="' + (open ? 'true' : 'false') + '">'
      + (pending ? pending + ' open' : 'Work') + (open ? ' ▴' : ' ▾') + '</button>'
      + '<button type="button" class="ftc-x" data-ftc="class-del" data-id="' + esc(String(c.id)) + '"'
      + ' aria-label="Delete ' + esc(c.name) + '">&times;</button>'
      + '</div>'
      + (open ? workHtml(c) : '')
      + '</div>';
  }

  function html() {
    var list = classes.length
      ? '<div class="ftc-list">' + classes.map(classHtml).join('') + '</div>'
      : '<div class="ftc-empty">No classes yet. Add your first one below — use the period you teach it, like <code>A1</code> or <code>B3</code>.</div>';

    return '<h3 style="margin-top:0">My classes</h3>'
      + '<p class="ftc-lede">The classes you teach, on the same A/B period system your students use. '
      + 'Open a class to add assigned work and events for it.</p>'
      + list
      + '<div class="ftc-add">'
      + '<input class="ftc-in ftc-in--period" id="ftcPeriod" type="text" maxlength="4" placeholder="A1" aria-label="Period">'
      + '<input class="ftc-in ftc-in--grow" id="ftcName" type="text" maxlength="80" placeholder="Class name — e.g. American Lit" aria-label="Class name">'
      + '<input class="ftc-in ftc-in--room" id="ftcRoom" type="text" maxlength="12" placeholder="Room" aria-label="Room">'
      + '<input class="ftc-in ftc-in--time" id="ftcStart" type="time" aria-label="Start time">'
      + '<input class="ftc-in ftc-in--time" id="ftcEnd" type="time" aria-label="End time">'
      + '<button type="button" data-ftc="class-add">Add class</button>'
      + '</div>';
  }

  /** Paint into whatever host the School tab gives us. */
  function render() {
    var host = $('fluxTeacherClasses');
    if (!host) return;
    host.innerHTML = html();
  }

  // ── events ────────────────────────────────────────────────────────────────
  function onClick(e) {
    if (!e.target || !e.target.closest) return;
    var host = $('fluxTeacherClasses');
    if (!host || !host.contains(e.target)) return;
    var btn = e.target.closest('[data-ftc]');
    if (!btn) return;
    var act = btn.getAttribute('data-ftc');
    var id = btn.getAttribute('data-id');
    var wid = btn.getAttribute('data-wid');
    if (act === 'class-add') addClass();
    else if (act === 'class-del') removeClass(id);
    else if (act === 'toggle') toggleOpen(id);
    else if (act === 'work-add') addWork(id);
    else if (act === 'work-del') removeWork(id, wid);
    else if (act === 'work-toggle') toggleWork(id, wid);
  }
  function onKey(e) {
    if (e.key !== 'Enter') return;
    var t = e.target;
    if (!t || !t.id) return;
    // Enter submits the row you are actually typing in.
    if (t.id === 'ftcPeriod' || t.id === 'ftcName' || t.id === 'ftcRoom') { e.preventDefault(); addClass(); }
    else if (t.id.indexOf('ftcWorkTitle-') === 0) { e.preventDefault(); addWork(t.id.slice('ftcWorkTitle-'.length)); }
  }

  document.addEventListener('click', onClick);
  document.addEventListener('keydown', onKey);

  window.FluxTeacherClasses = {
    render: render,
    /** Markup for renderSchoolTeacher to drop in place of its old stub card. */
    cardHtml: function () { return '<div class="card" id="fluxTeacherClasses"></div>'; },
    list: function () { return classes.slice(); },
    /**
     * The timetable belonging to whoever is signed in, or null meaning
     * "not yours — use the student list".
     *
     * Every staff surface needs this same answer, and before a teacher
     * timetable existed they all guessed the same wrong way: the Lesson Hub
     * (attendance, lesson notes, materials) and the FluxNow strip both read
     * window.classes — the list of classes you ATTEND. For a teacher that is
     * normally empty, so the Lesson Hub showed "No classes yet" directly under
     * an empty state telling you to add the periods you teach in School Info,
     * and the dashboard counted 0 of everything. That wall of zeros was never
     * a teacher with nothing on; it was the wrong list.
     *
     * In Personal mode an educator is using Flux as themselves, so null is
     * correct there and the student list rightly wins again.
     */
    mine: function () {
      try {
        if (!window.FluxRole?.isEducator?.()) return null;
        if (window.FluxRole.isWorkMode && !window.FluxRole.isWorkMode()) return null;
      } catch (e) { return null; }
      // An empty timetable still belongs to them: a teacher who has not filled
      // theirs in should get an honest empty state, not their own student rows.
      return classes.slice();
    },
    /* Cloud contract, same shape as every other synced module. */
    getCloudSlice: function () { return classes; },
    applyFromCloud: function (data) {
      if (!Array.isArray(data)) return;
      classes = normalise(data);
      try {
        if (typeof window.save === 'function') window.save(LS_KEY, classes);
        else localStorage.setItem(LS_KEY, JSON.stringify(classes));
      } catch (e) {}
      render();
    },
    // Test seams.
    _add: addClass,
    _addWork: addWork,
    _set: function (l) { classes = normalise(l); persist(); render(); },
  };
})();
