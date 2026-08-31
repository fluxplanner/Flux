/* ============================================================================
   FLUX MOOD PROMPT  ·  flux-mood-prompt.js
   Asks how you are once in the morning and once in the evening.

   Mood was barely used, and nothing in the app ever asked for it — you had to
   remember the tab existed, open it, move two sliders and press Save. This
   removes all of that for the common case: one tap on a face, from whatever
   tab you are already looking at.

   THE RULE THAT KEEPS THIS FROM BECOMING A NAG
   --------------------------------------------
   Each window resolves at most once per day, and dismissing counts as
   resolving. So the ceiling is two cards a day, each closed by one tap, and a
   card you dismiss does not come back until tomorrow. That ceiling is the
   whole reason this is a card and not a modal: something that appears twice a
   day must never block what you were doing.

   Storage is one date per window (see LS_KEY), compared against today. Dates
   rather than timestamps, because "have I already asked today" is exactly the
   question being answered, and a date survives clock changes and timezone
   travel in a way an elapsed-milliseconds check does not.
   ========================================================================== */
(function () {
  'use strict';
  if (window.FluxMoodPrompt) return;

  var LS_KEY = 'flux_mood_prompt_v1';
  /* Morning runs to noon. Evening starts at 18:00 and stops at midnight rather
     than running into the small hours: a card asking how your day went at 2am
     is asking about the wrong day, and would stamp itself against it too. */
  var AM = { from: 5, to: 12, key: 'am', title: 'Morning check-in', ask: 'How are you starting today?' };
  var PM = { from: 18, to: 24, key: 'pm', title: 'Evening check-in', ask: 'How did today go?' };

  var FACES = [
    { v: 1, ico: '😞', lbl: 'Rough' },
    { v: 2, ico: '😕', lbl: 'Meh' },
    { v: 3, ico: '😐', lbl: 'OK' },
    { v: 4, ico: '🙂', lbl: 'Good' },
    { v: 5, ico: '😄', lbl: 'Great' },
  ];

  function load() {
    try {
      if (typeof window.load === 'function') return window.load(LS_KEY, {}) || {};
      var raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }
  function persist(s) {
    try {
      if (typeof window.save === 'function') { window.save(LS_KEY, s); return; }
      localStorage.setItem(LS_KEY, JSON.stringify(s));
    } catch (e) {}
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function currentWindow() {
    var h = new Date().getHours();
    if (h >= AM.from && h < AM.to) return AM;
    if (h >= PM.from && h < PM.to) return PM;
    return null;
  }

  /* Deliberately conservative — every check here is a reason NOT to interrupt.
     A prompt that appears over a dialog, or while you are already filling in
     the very form it is asking you to fill in, is worse than no prompt. */
  function shouldAsk(win) {
    if (!win) return false;
    var s = load();
    if (s[win.key] === today()) return false;
    // Just answered the other window — don't pounce with the next question.
    if (s.at && Date.now() - s.at < QUIET_AFTER_ANSWER_MS) return false;
    /* Dashboard only, because the card renders INTO the dashboard rather than
       floating over the app. The first version was position:fixed at the
       bottom-right corner, and it did exactly what a floating card over a
       dense page does: it covered a button. The e2e suite caught it clicking
       through to Grade GPS — "subtree intercepts pointer events" — which would
       have been a student unable to press Apply on their own study plan.
       In the page flow it cannot overlap anything, and the dashboard is where
       people land, so it is still seen. */
    var dash = document.getElementById('dashboard');
    if (!dash || !dash.classList.contains('active')) return false;
    // Signed out, or still sitting on the login screen.
    var auth = document.getElementById('authScreen');
    if (auth && !auth.hidden) return false;
    var app = document.getElementById('app');
    if (app && !app.classList.contains('visible')) return false;
    // Don't compete with an open dialog, sheet, or the full-screen focus timer.
    if (document.querySelector('.modal.open, .more-sheet.open, #fttFocusFs:not([hidden])')) return false;
    if (document.body.classList.contains('ftt-fs-on')) return false;
    return true;
  }

  /* How long to stay quiet after ANY answer, in ms. The two windows are
     independent by design, which meant that answering the morning card at
     18:05 — the moment the evening window opens — was met with "How did today
     go?" a fraction of a second later. Independent windows, yes; two questions
     in the same breath, no.

     The e2e suite found this the hard way: three tests answer the morning card
     explicitly, and started failing only when the suite happened to run after
     18:00, because the evening card legitimately replaced the one that had
     just been dismissed. A time-of-day flake, but it was reporting a real
     defect rather than a bad test. */
  var QUIET_AFTER_ANSWER_MS = 60 * 1000;

  function resolve(win) {
    var s = load();
    s[win.key] = today();
    s.at = Date.now();
    persist(s);
  }

  function close() {
    var el = document.getElementById('fluxMoodPrompt');
    if (el) el.remove();
  }

  var showing = null;
  function show(win) {
    if (document.getElementById('fluxMoodPrompt')) return;
    showing = win;
    var el = document.createElement('div');
    el.id = 'fluxMoodPrompt';
    el.className = 'fmp';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', win.title);
    el.innerHTML =
      '<div class="fmp-head">'
      + '<div><div class="fmp-title">' + esc(win.title) + '</div>'
      + '<div class="fmp-ask">' + esc(win.ask) + '</div></div>'
      + '<button type="button" class="fmp-x" data-fmp="later" aria-label="Not now">&times;</button>'
      + '</div>'
      + '<div class="fmp-faces">'
      + FACES.map(function (f) {
        return '<button type="button" class="fmp-face" data-fmp="pick" data-v="' + f.v + '"'
          + ' aria-label="' + esc(f.lbl) + '"><span class="fmp-face-ico">' + f.ico + '</span>'
          + '<span class="fmp-face-lbl">' + esc(f.lbl) + '</span></button>';
      }).join('')
      + '</div>'
      + '<button type="button" class="fmp-more" data-fmp="full">Add sleep &amp; stress →</button>';
    /* Into the top of the dashboard, in the flow, next to the existing
       recovery banner — NOT onto <body> as an overlay. See shouldAsk for why
       that mattered. Falls back to <body> only if the dashboard is somehow
       absent, which shouldAsk already prevents in practice. */
    var dash = document.getElementById('dashboard');
    if (dash) dash.insertBefore(el, dash.firstChild);
    else document.body.appendChild(el);
    // Next frame, so the entrance transition has a start state to animate from.
    requestAnimationFrame(function () { el.classList.add('is-in'); });
  }

  function pick(v) {
    var win = showing;
    if (!win) return;
    var patch = { mood: v };
    /* Also recorded against the window it came from. The day's record keeps one
       headline `mood` for everything that already reads it, and these two extra
       fields mean a morning and an evening answer no longer overwrite each
       other invisibly — the difference between them is the interesting part. */
    patch[win.key === 'am' ? 'moodAm' : 'moodPm'] = v;
    try {
      if (typeof window.fluxPersistMood === 'function') window.fluxPersistMood(patch);
      // Keep the Mood tab's own control in step for when they next open it.
      if (typeof window.save === 'function') window.save('flux_mood_today', v);
    } catch (e) {}
    resolve(win);
    close();
    var f = FACES.filter(function (x) { return x.v === v; })[0];
    try {
      if (typeof window.showToast === 'function') {
        window.showToast('Logged ' + (f ? f.lbl.toLowerCase() : 'check-in') + ' — thanks', 'success');
      }
    } catch (e) {}
  }

  function onClick(e) {
    if (!e.target || !e.target.closest) return;
    var btn = e.target.closest('#fluxMoodPrompt [data-fmp]');
    if (!btn) return;
    var act = btn.getAttribute('data-fmp');
    if (act === 'pick') pick(parseInt(btn.getAttribute('data-v'), 10) || 3);
    else if (act === 'later') { if (showing) resolve(showing); close(); }
    else if (act === 'full') {
      /* Counts as resolved: they are on their way to the full form, and being
         asked again the moment they arrive would be absurd. */
      if (showing) resolve(showing);
      close();
      try { if (typeof window.nav === 'function') window.nav('mood'); } catch (er) {}
    }
  }

  function check() {
    var win = currentWindow();
    if (!win) { if (document.getElementById('fluxMoodPrompt')) close(); return; }
    if (!shouldAsk(win)) return;
    show(win);
  }

  document.addEventListener('click', onClick);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && document.getElementById('fluxMoodPrompt')) {
      if (showing) resolve(showing);
      close();
    }
  });
  /* Moving between tabs is a natural moment to ask, and it is also when the
     "are you already on Mood" guard needs re-evaluating. */
  document.addEventListener('flux-nav', function () { setTimeout(check, 600); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) check(); });

  function install() {
    /* Not immediately on load. Being asked a question before the first paint
       has settled is jarring, and the signed-in state is not always known yet. */
    setTimeout(check, 4000);
    /* A window can open while you are sitting in the app. Five minutes catches
       it without being a busy timer. */
    setInterval(check, 5 * 60 * 1000);
  }
  document.addEventListener('DOMContentLoaded', install);
  if (document.readyState !== 'loading') install();

  window.FluxMoodPrompt = {
    check: check,
    close: close,
    // Test seams.
    _show: show,
    _windows: { AM: AM, PM: PM },
    _state: load,
    _currentWindow: currentWindow,
    _shouldAsk: shouldAsk,
  };
})();
