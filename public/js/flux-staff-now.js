/* ============================================================================
   FLUX STAFF NOW  ·  flux-staff-now.js
   The bar at the top of the staff dashboard: the period you are teaching right
   now, how long is left, what is next — and a nudge to take the register.

   WHY THIS DOES NOT WORK OUT THE TIME ITSELF
   ------------------------------------------
   FluxNow already owns "where are we in the school day?" for every surface —
   states, minutes left, the next class, cycle days, rest days and district
   closures. A second implementation would drift from it the first time the
   school moved a bell. This module is a view: it asks FluxNow and renders the
   answer. The only thing it decides for itself is whether to nudge.

   WHY THE NUDGE READS THE LESSON HUB'S OWN STORE
   ----------------------------------------------
   Attendance is taken in the Lesson Hub, which records it in
   flux_lesson_state_v1. The reminder reads that same key rather than keeping
   its own idea of "done", so marking a class present anywhere makes the nudge
   disappear everywhere. The only thing stored here is which periods the
   teacher waved away today — a dismissal is not a register, and conflating the
   two would either nag someone who has already taken it or, far worse, imply
   attendance was taken because a prompt was dismissed.
   ========================================================================== */
(function () {
  'use strict';
  if (window.FluxStaffNow) return;

  var SNOOZE_KEY = 'flux_staff_now_v1';
  var LESSON_KEY = 'flux_lesson_state_v1';
  var TICK_MS = 20000;

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function ymd(d) {
    var x = d || new Date();
    try { if (typeof fluxLocalYMD === 'function') return fluxLocalYMD(x); } catch (e) {}
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return x.getFullYear() + '-' + p(x.getMonth() + 1) + '-' + p(x.getDate());
  }
  function read(key, fb) {
    try {
      if (typeof window.load === 'function') return window.load(key, fb);
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fb;
    } catch (e) { return fb; }
  }
  function write(key, val) {
    try {
      if (typeof window.save === 'function') window.save(key, val);
      else localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {}
  }

  /* ── snooze state ─────────────────────────────────────────────────────────
     Held for today only. A stale list would silently suppress tomorrow's
     reminders, which is the one failure a reminder must not have. */
  function snoozeState() {
    var s = read(SNOOZE_KEY, null);
    var today = ymd();
    if (!s || typeof s !== 'object' || s.date !== today) return { date: today, snoozed: [] };
    return { date: today, snoozed: Array.isArray(s.snoozed) ? s.snoozed : [] };
  }
  function isSnoozed(period) {
    return snoozeState().snoozed.indexOf(Number(period)) !== -1;
  }
  function snooze(period) {
    var s = snoozeState();
    if (s.snoozed.indexOf(Number(period)) === -1) s.snoozed.push(Number(period));
    write(SNOOZE_KEY, s);
  }

  /** Has attendance been recorded for this period today, per the Lesson Hub? */
  function attendanceTaken(period) {
    var state = read(LESSON_KEY, {});
    var entry = state && state[ymd() + '__P' + period];
    return !!(entry && entry.attendance);
  }

  function resolve(now) {
    try {
      return window.FluxNow && window.FluxNow.resolveLive ? window.FluxNow.resolveLive(now) : null;
    } catch (e) { return null; }
  }

  /* ── view ─────────────────────────────────────────────────────────────── */

  function minsLabel(m) {
    if (m == null) return '';
    if (m >= 90) return Math.round(m / 60 * 10) / 10 + ' h';
    return m + ' min';
  }

  function nudgeHtml(r) {
    if (!r || r.state !== 'period' || !r.cls) return '';
    var period = r.cls.period;
    if (period == null) return '';
    if (attendanceTaken(period)) {
      return '<div class="fsn-nudge is-done"><span class="fsn-nudge-tick">✓</span>'
        + '<span>Attendance taken for ' + esc(r.cls.name) + '.</span></div>';
    }
    if (isSnoozed(period)) return '';
    return '<div class="fsn-nudge">'
      + '<span class="fsn-nudge-text">Take attendance for <strong>' + esc(r.cls.name) + '</strong></span>'
      + '<span class="fsn-nudge-acts">'
      + '<button type="button" class="fsn-btn fsn-btn--go" data-fsn="attend">Take it</button>'
      + '<button type="button" class="fsn-btn" data-fsn="snooze" data-period="' + esc(String(period))
      + '">Not now</button>'
      + '</span></div>';
  }

  function bodyHtml(r) {
    if (!r) return '';
    if (r.state === 'period' && r.cls) {
      var c = r.cls;
      var badge = c.periodLabel || (c.period != null ? 'P' + c.period : '');
      return '<div class="fsn-main">'
        + (badge ? '<span class="fsn-badge" style="--sub:' + esc(c.color || '#5865F2') + '">'
            + esc(badge) + '</span>' : '')
        + '<span class="fsn-now-name">' + esc(c.name) + '</span>'
        + (c.room ? '<span class="fsn-room">Rm ' + esc(c.room) + '</span>' : '')
        + '<span class="fsn-left">' + esc(minsLabel(r.minutesLeft)) + ' left</span>'
        + '</div>'
        + (r.next ? '<div class="fsn-next">Next · ' + esc(r.next.name)
            + (r.next.room ? ' · Rm ' + esc(r.next.room) : '') + '</div>' : '');
    }
    if ((r.state === 'passing' || r.state === 'before') && r.next) {
      return '<div class="fsn-main">'
        + '<span class="fsn-eyebrow">' + (r.state === 'before' ? 'First up' : 'Next') + '</span>'
        + '<span class="fsn-now-name">' + esc(r.next.name) + '</span>'
        + (r.next.room ? '<span class="fsn-room">Rm ' + esc(r.next.room) + '</span>' : '')
        + '<span class="fsn-left">in ' + esc(minsLabel(r.minutesUntil)) + '</span>'
        + '</div>';
    }
    /* after / weekend / holiday / untimed — FluxNow already writes one calm
       sentence for each of these, so don't second-guess its wording. */
    if (r.sentence) return '<div class="fsn-main"><span class="fsn-quiet">' + esc(r.sentence) + '</span></div>';
    return '';
  }

  /**
   * The empty state carries real weight here: a teacher who has not filled in
   * a timetable should be told where to do it, not shown a blank strip.
   * Naming the exact card is the difference between a dead bar and a first run.
   */
  function emptyHtml() {
    return '<div class="fsn-main"><span class="fsn-quiet">'
      + 'Add the periods you teach in <a href="javascript:nav(\'school\')">School Info</a>'
      + ' and today\'s classes appear here.</span></div>';
  }

  function hasTimetable() {
    try {
      var m = window.FluxTeacherClasses && window.FluxTeacherClasses.mine
        ? window.FluxTeacherClasses.mine() : null;
      return !!(m && m.length);
    } catch (e) { return false; }
  }

  function render() {
    var el = $('fluxStaffNow');
    if (!el) return;
    if (!hasTimetable()) { el.innerHTML = emptyHtml(); el.dataset.state = 'empty'; return; }
    var r = resolve();
    if (!r) { el.innerHTML = ''; return; }
    el.dataset.state = r.state;
    el.innerHTML = bodyHtml(r) + nudgeHtml(r);
  }

  /* ── mounting ─────────────────────────────────────────────────────────────
     renderTeacherDashboard replaces the whole body — a loading state first,
     then the content — so the bar has to be put back after each pass. A
     childList observer on that one host is cheaper and far more reliable than
     re-rendering on a timer and hoping the timing lines up. */
  function mount() {
    var host = $('teacherDashboardBody');
    if (!host) return false;
    var el = $('fluxStaffNow');
    if (el && el.parentNode === host && host.firstChild === el) { render(); return true; }
    if (el && el.parentNode) el.parentNode.removeChild(el);
    el = document.createElement('div');
    el.id = 'fluxStaffNow';
    el.className = 'fsn';
    el.setAttribute('aria-live', 'polite');
    host.insertBefore(el, host.firstChild);
    render();
    return true;
  }

  var _observer = null;
  function observe() {
    var host = $('teacherDashboardBody');
    if (!host || _observer) return;
    _observer = new MutationObserver(function () {
      // Only act once our own node has gone, or the insert below would
      // retrigger the observer and loop.
      if (!$('fluxStaffNow')) mount();
    });
    _observer.observe(host, { childList: true });
  }

  function onClick(e) {
    var btn = e.target && e.target.closest ? e.target.closest('[data-fsn]') : null;
    if (!btn) return;
    var act = btn.getAttribute('data-fsn');
    if (act === 'snooze') { snooze(btn.getAttribute('data-period')); render(); }
    else if (act === 'attend') { try { nav('lessonHub'); } catch (_) {} }
  }

  var _timer = null;
  function start() {
    if (_timer) return;
    _timer = setInterval(function () {
      // Every value is derived from the clock at render time, so a throttled
      // or skipped tick costs smoothness, never accuracy.
      if (document.hidden) return;
      if ($('fluxStaffNow')) render();
    }, TICK_MS);
  }

  function boot() {
    document.addEventListener('click', onClick);
    document.addEventListener('flux-nav', function () {
      setTimeout(function () { mount(); observe(); }, 60);
    });
    setTimeout(function () { mount(); observe(); start(); }, 1200);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.FluxStaffNow = {
    render: render,
    mount: mount,
    // Test seams.
    _resolve: resolve,
    _attendanceTaken: attendanceTaken,
    _isSnoozed: isSnoozed,
    _snooze: snooze,
    _snoozeState: snoozeState,
  };
})();
