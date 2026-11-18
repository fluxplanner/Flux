/* ============================================================================
   FLUX SUITE  ·  flux-suite-timer.js
   The planner's focus timer, followed into the other suite apps.

   The planner (Time tab) owns the timer. While it runs or is paused it keeps
   one record in localStorage under KEY:
     { mode, label, total, endAt, remaining, running }
   `endAt` is a wall-clock end time (epoch ms), so any page can work out the
   time left without a ticking counter — switching apps loses nothing.

   On every other suite page this file draws a small floating pill showing the
   time left, with pause/resume and stop. Those buttons only rewrite the
   record; the planner (if open in another tab) follows through the `storage`
   event, and otherwise reads the record when it next loads.

   When time runs out here the pill says so and leaves the record in place: the
   planner logs the finished session (stats, streak) the next time it loads.

   Self-contained: no bundles, no app CSS. Skips the planner itself, which has
   its own pill (#fluxPomoPill).
   ========================================================================== */
(function () {
  'use strict';
  var KEY = 'flux_suite_timer';

  function read() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY) || 'null');
      return s && typeof s === 'object' && isFinite(s.total) ? s : null;
    } catch (_) { return null; }
  }
  function write(s) {
    try {
      if (s) localStorage.setItem(KEY, JSON.stringify(s));
      else localStorage.removeItem(KEY);
    } catch (_) { /* private mode */ }
  }
  /** Whole seconds left, never negative. */
  function secsLeft(s) {
    if (!s) return 0;
    if (s.running) return Math.max(0, Math.ceil((s.endAt - Date.now()) / 1000));
    return Math.max(0, Math.round(s.remaining || 0));
  }
  function fmt(secs) {
    var m = Math.floor(secs / 60), r = secs % 60;
    return (m < 10 ? '0' : '') + m + ':' + (r < 10 ? '0' : '') + r;
  }

  if (typeof document === 'undefined') return;

  var el = null, tick = 0, dismissedEnd = 0;

  function css() {
    if (document.getElementById('fluxSuiteTimerCss')) return;
    var st = document.createElement('style');
    st.id = 'fluxSuiteTimerCss';
    st.textContent =
      '.fst-pill{position:fixed;left:16px;bottom:16px;z-index:2147483000;display:flex;align-items:center;gap:8px;' +
      'padding:6px 8px 6px 12px;border-radius:999px;background:rgba(20,22,30,.92);color:#fff;' +
      'font:600 14px/1.2 system-ui,-apple-system,Segoe UI,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.28);' +
      'border:1px solid rgba(255,255,255,.12);backdrop-filter:blur(8px)}' +
      '.fst-pill[hidden],.fst-pill button[hidden]{display:none}' +
      '.fst-pill .fst-link{color:inherit;text-decoration:none;display:flex;align-items:center;gap:8px}' +
      '.fst-time{font-variant-numeric:tabular-nums;font-size:16px}' +
      '.fst-lbl{opacity:.75;font-weight:500;font-size:12px}' +
      '.fst-pill button{all:unset;cursor:pointer;width:30px;height:30px;border-radius:50%;display:grid;place-items:center;' +
      'background:rgba(255,255,255,.12)}' +
      '.fst-pill button:hover{background:rgba(255,255,255,.22)}' +
      '.fst-pill button:focus-visible{outline:2px solid #8ab4ff;outline-offset:2px}' +
      '.fst-pill.is-done{background:rgba(16,140,100,.95)}' +
      '@media print{.fst-pill{display:none!important}}';
    document.head.appendChild(st);
  }

  var ICON = {
    pause: '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>',
    play: '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><polygon points="7 4 20 12 7 20"/></svg>',
    stop: '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
  };

  /* The planner needs an account, so for a guest the pill is not a link: from
     the Suite it would only drop them on the sign-in screen. */
  function signedIn() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        if (/^sb-.*-auth-token$/.test(localStorage.key(i) || '')) return true;
      }
    } catch (e) { /* storage blocked */ }
    return false;
  }

  function mount() {
    if (el) return;
    css();
    el = document.createElement('div');
    el.className = 'fst-pill';
    el.id = 'fluxSuiteTimer';
    el.hidden = true;
    el.setAttribute('role', 'timer');
    el.innerHTML =
      (signedIn() ? '<a class="fst-link" href="index.html" title="Open Flux Planner">' : '<span class="fst-link">') +
      '<span class="fst-time">00:00</span><span class="fst-lbl"></span>' + (signedIn() ? '</a>' : '</span>') +
      '<button type="button" data-fst="toggle"></button>' +
      '<button type="button" data-fst="stop" aria-label="Stop timer" title="Stop">' + ICON.stop + '</button>';
    el.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-fst]');
      if (!b) return;
      var s = read();
      if (s) {
        var left = secsLeft(s);
        if (b.getAttribute('data-fst') === 'stop') {
          if (s.running && left === 0) dismissedEnd = s.endAt; // finished: hide; the planner logs it
          else write(null);
        } else if (s.running && left > 0) {
          write({ mode: s.mode, label: s.label, total: s.total, running: false, remaining: left, endAt: 0 });
        } else if (!s.running) {
          write({ mode: s.mode, label: s.label, total: s.total, running: true, remaining: left, endAt: Date.now() + left * 1000 });
        }
      }
      render();
    });
    document.body.appendChild(el);
  }

  function render() {
    var s = read();
    if (!s || (s.running && s.endAt === dismissedEnd)) {
      if (el) el.hidden = true;
      if (tick) { clearInterval(tick); tick = 0; }
      return;
    }
    mount();
    var left = secsLeft(s), done = s.running && left === 0, label = s.label || 'Timer';
    el.hidden = false;
    el.classList.toggle('is-done', done);
    el.querySelector('.fst-time').textContent = done ? 'Done' : fmt(left);
    el.querySelector('.fst-lbl').textContent = done ? label + ' finished' : label + (s.running ? '' : ' · paused');
    var t = el.querySelector('[data-fst="toggle"]');
    t.hidden = done;
    t.innerHTML = s.running ? ICON.pause : ICON.play;
    t.setAttribute('aria-label', s.running ? 'Pause timer' : 'Resume timer');
    t.title = s.running ? 'Pause' : 'Resume';
    var stop = el.querySelector('[data-fst="stop"]');
    stop.setAttribute('aria-label', done ? 'Dismiss' : 'Stop timer');
    stop.title = done ? 'Dismiss' : 'Stop';
    if (s.running && !done) { if (!tick) tick = setInterval(render, 500); }
    else if (tick) { clearInterval(tick); tick = 0; }
  }

  function start() {
    if (document.getElementById('fluxPomoPill')) return; // the planner draws its own
    render();
    window.addEventListener('storage', function (e) { if (e.key === KEY || e.key === null) render(); });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) render(); });
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
