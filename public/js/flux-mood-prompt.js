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
   resolving. So the ceiling is two prompts a day, each closed by one tap, and
   one you dismiss does not come back until tomorrow.

   That ceiling is what earns this the right to be a modal. It has been all
   three shapes, and the order matters: it began as a fixed card floating
   bottom-right, which covered a button — the e2e suite caught it swallowing a
   click meant for Grade GPS, which in real use is a student unable to press
   Apply on their own study plan. It was then moved into the dashboard flow,
   where it could not overlap anything but was easy to scroll straight past
   ("kinda out of place"). It is now a backdrop modal, asked when you open the
   planner.

   A modal is only defensible because of the once-a-day rule above. Something
   that blocked you twice an hour would be intolerable; twice a day, closed by
   one tap, is a question worth being asked properly.

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

  // Step 1 is 😰 to match the check-in buttons: 😞 and 😕 resolve to the same
  // `frown` icon, so 1 and 2 offered the same face. See index.html's mood
  // buttons. The values stored are unchanged — only the glyph shown.
  var FACES = [
    { v: 1, ico: '😰', lbl: 'Rough' },
    { v: 2, ico: '😞', lbl: 'Meh' },
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
    /* Dashboard only. It is now a modal so it *could* open anywhere, but the
       dashboard is where you land when you open Flux, and "when they open the
       planner" is the whole brief. Asking on the Calendar or mid-way through
       Study Tools would mean interrupting work already in progress. */
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

  var lastFocus = null;

  function close() {
    var el = document.getElementById('fluxMoodPrompt');
    if (el) el.remove();
    var ov = document.getElementById('fluxMoodPromptOverlay');
    if (ov) ov.remove();
    document.body.classList.remove('fmp-open');
    // Hand focus back to whatever had it before the dialog took it.
    try { if (lastFocus && lastFocus.focus) lastFocus.focus(); } catch (e) {}
    lastFocus = null;
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
    /* A real modal on a backdrop, asked once when you open the planner.

       It was an inline card at the top of the dashboard, which Azfer found
       "kinda out of place" — fair, because a card sitting among other cards
       reads as content to scroll past, not as a question.

       Worth being careful here: the very first version was a floating card
       pinned bottom-right, and the e2e suite caught it silently covering a
       button — a student unable to press Apply on their own study plan. This
       is not that. A backdrop modal blocks deliberately and visibly, says so
       with aria-modal, and closes on the ×, on Escape, and on a backdrop
       click. The failure there was an invisible obstruction, not a dialog. */
    var ov = document.createElement('div');
    ov.id = 'fluxMoodPromptOverlay';
    ov.className = 'fmp-overlay';
    ov.setAttribute('data-fmp', 'backdrop');
    el.setAttribute('aria-modal', 'true');
    ov.appendChild(el);
    document.body.appendChild(ov);
    document.body.classList.add('fmp-open');
    // Next frame, so the entrance transition has a start state to animate from.
    requestAnimationFrame(function () { ov.classList.add('is-in'); el.classList.add('is-in'); });
    /* Focus the middle face rather than the close button: the dialog exists to
       be answered, and a keyboard user landing on × first is being offered the
       exit before the question. */
    try {
      lastFocus = document.activeElement;
      var mid = el.querySelector('.fmp-face[data-v="3"]');
      if (mid) mid.focus();
    } catch (e) {}
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
    /* A click on the backdrop itself — not on the card sitting inside it —
       is the third way out, alongside × and Escape. Checked before the card
       lookup because the overlay is the card's parent. */
    if (e.target.id === 'fluxMoodPromptOverlay') {
      if (showing) resolve(showing);
      close();
      return;
    }
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

  /* True while the e2e suite is driving the app — same test the harness itself
     uses. The auto-popup is suppressed there and only there.

     Not squeamishness about tests: a modal that opens on a timer would land on
     top of whatever any *other* spec was clicking, and fail it. That is exactly
     how the first version of this card broke the Grade GPS tests. The
     mood-prompt spec drives _show directly, so every behaviour below is still
     covered — what is skipped is the timer, not the dialog. */
  function underTest() {
    try {
      if (/[?&]e2e=1\b/.test(location.search)) return true;
      return localStorage.getItem('flux_e2e') === '1';
    } catch (e) { return false; }
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
  /* Coming back to a backgrounded tab is "opening the planner" too — on a phone
     that is exactly what reopening the app looks like. */
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && !underTest()) setTimeout(check, 800);
  });

  function install() {
    if (underTest()) return;
    /* Once, on open, and then not again.

       This used to also fire on every tab change and poll every five minutes.
       That was defensible for an inline card, which just sat there. For a modal
       it is not: interrupting someone mid-sentence with a dialog is precisely
       the behaviour that makes people dismiss it forever without reading it.

       The cost is that sitting in Flux from morning through to evening without
       ever leaving the tab means the evening question waits until you next come
       back to it. A missed prompt beats a dialog over what you were typing. */
    setTimeout(check, 4000);
  }
  document.addEventListener('DOMContentLoaded', install);
  if (document.readyState !== 'loading') install();

  window.FluxMoodPrompt = {
    check: check,
    close: close,
    /* Test seams.
       _show force-replaces whatever card is up. show() itself refuses to
       replace one, which is right in production — a card appearing under your
       finger mid-tap is how you answer the wrong question. But it made this
       seam silently do nothing whenever a card already existed, and the suite
       then clicked a card it had not asked for: run the tests after 18:00 and
       the evening prompt would already be on screen, so _show(AM) no-opped and
       the "morning" assertions were quietly made against the evening card. A
       seam that exists to put a specific window on screen has to actually do
       that, or the test is testing something else. */
    _show: function (win) { close(); show(win); },
    _windows: { AM: AM, PM: PM },
    _state: load,
    _currentWindow: currentWindow,
    _shouldAsk: shouldAsk,
  };
})();
