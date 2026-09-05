/* ============================================================================
   FLUX TIME TOOLS  ·  flux-time-tools.js
   Clock, world clocks, stopwatch, countdown and alarms, alongside the existing
   Pomodoro focus timer on the Timer tab.

   WHY NOTHING HERE COUNTS DOWN A COUNTER
   --------------------------------------
   The focus timer in app.js keeps `tSecs` and does tSecs-- on a 1s interval.
   That is fine for a timer you sit and watch, but it is wrong for everything
   here, because browsers do not promise to run your interval:

     - a background tab is throttled to roughly one tick per second, and after
       a few minutes to once per minute;
     - a phone with the screen off may not run it at all;
     - a laptop that sleeps stops it dead.

   Each of those makes a decrementing counter silently lose time, so a
   25-minute countdown started before lunch still reads 25 minutes when you get
   back. An alarm built that way simply never goes off, which is worse than not
   shipping an alarm at all.

   So nothing here counts. Everything stores an absolute epoch timestamp and
   derives the number on screen from Date.now() at paint time. Throttling then
   costs smoothness — the display may update once a second instead of four
   times — and never accuracy. Return to the tab and it is instantly right,
   because it recomputes rather than catches up.

   Alarms go one step further and ask "did this come due while I wasn't
   looking", so a laptop closed over a due alarm rings when it opens. See
   fireDueAlarms().
   ========================================================================== */
(function () {
  'use strict';
  if (window.FluxTimeTools) return;

  var LS_KEY = 'flux_time_tools_v1';
  var VIEWS = ['focus', 'clock', 'stopwatch', 'countdown', 'alarms'];

  /* Go through the app's storage helpers, not localStorage. They route through
     fluxNamespacedKey(), which prefixes the key while an owner is viewing
     another account — writing raw would leak one person's alarms into another
     person's view. Falls back if app.js has not defined them yet. */
  function load(def) {
    try {
      if (typeof window.load === 'function') return window.load(LS_KEY, def);
      var raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : def;
    } catch (e) { return def; }
  }
  function persist() {
    try {
      if (typeof window.save === 'function') { window.save(LS_KEY, state); return; }
      localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch (e) {}
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function $(id) { return document.getElementById(id); }
  function toast(msg, kind) {
    try { if (typeof window.showToast === 'function') window.showToast(msg, kind || 'success'); } catch (e) {}
  }

  /* ── clock appearance ──────────────────────────────────────────────────────
     "allow users to customize the font, color, background, etc. literally
     EVERYTHING to make it their own."

     Every option is stored as data and turned into CSS custom properties by
     applyClockStyle(), rather than each control writing its own style. That is
     what lets one description drive three surfaces that cannot share a DOM:
     the card on the Timer tab, the full-screen overlay, and clock.html in its
     own window. Add an option here and all three get it. */
  var CLOCK_FONTS = [
    // Self-hosted (see the @font-face pair in styles.css) — always available.
    ['mono', 'Mono', "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace"],
    ['sans', 'Sans', "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"],
    /* The rest are stacks of faces the operating system already has. No web
       font is fetched for them: a clock that shows nothing until a download
       finishes is worse than a clock in the wrong typeface, and this page is
       meant to survive a school network. Each stack ends in a generic family,
       so the worst case is "close enough" rather than blank. */
    ['rounded', 'Rounded', "ui-rounded, 'SF Pro Rounded', 'Segoe UI Variable Display', 'Nunito', 'Trebuchet MS', system-ui, sans-serif"],
    ['serif', 'Serif', "ui-serif, Georgia, 'Times New Roman', serif"],
    ['slab', 'Slab', "'Rockwell', 'Roboto Slab', 'Bookman Old Style', Georgia, serif"],
    ['display', 'Display', "'Haettenschweiler', 'Arial Narrow', Impact, 'Franklin Gothic Bold', sans-serif"],
    ['hand', 'Hand', "'Bradley Hand', 'Segoe Script', 'Comic Sans MS', cursive"],
  ];
  var CLOCK_WEIGHTS = [[300, 'Light'], [500, 'Regular'], [700, 'Bold'], [900, 'Black']];
  // '' means "whatever the theme uses", so a themed clock still follows a
  // later switch between dark and light instead of freezing one of them in.
  var CLOCK_INKS = [['', 'Theme'], ['#ffffff', 'White'], ['#34d0ff', 'Cyan'], ['#7c8cff', 'Indigo'],
    ['#37c98a', 'Green'], ['#f0b429', 'Amber'], ['#ff6b6b', 'Red'], ['#ff9ff3', 'Pink']];
  var CLOCK_BGS = [['', 'Theme'], ['#000000', 'Black'], ['#0b1020', 'Midnight'],
    ['linear-gradient(160deg,#0f2027,#203a43,#2c5364)', 'Ocean'],
    ['linear-gradient(160deg,#42275a,#734b6d)', 'Twilight'],
    ['linear-gradient(160deg,#232526,#414345)', 'Graphite'],
    ['linear-gradient(160deg,#ff512f,#dd2476)', 'Sunset'],
    ['linear-gradient(160deg,#134e5e,#71b280)', 'Forest']];

  var CLOCK_DEFAULTS = {
    font: 'mono', weight: 700, size: 100, track: -2,
    color: '', bg: '', glow: false,
    seconds: true, hour24: false, showDate: true, showZones: false, label: '',
    /* Off by default, and that is deliberate: the full-screen view already
       fades everything but the time after three seconds, which is what was
       asked for and shipped last week. This is the opposite choice offered as
       an option — "allow the user to keep the date and other info on screen" —
       so it has to be opt-in or it would silently undo the other. */
    keepInfo: false,
    drift: false,
  };

  // ── state ─────────────────────────────────────────────────────────────────
  var state = {
    view: 'focus',
    stopwatch: { startedAt: 0, accumMs: 0, laps: [] },
    countdown: { endsAt: 0, totalMs: 0, label: '', running: false },
    alarms: [],
    worldClocks: [],
    clock: Object.assign({}, CLOCK_DEFAULTS),
  };
  (function restore() {
    var s = load(null);
    if (!s || typeof s !== 'object') return;
    if (VIEWS.indexOf(s.view) >= 0) state.view = s.view;
    if (s.stopwatch && typeof s.stopwatch === 'object') {
      state.stopwatch = {
        startedAt: +s.stopwatch.startedAt || 0,
        accumMs: +s.stopwatch.accumMs || 0,
        laps: Array.isArray(s.stopwatch.laps)
          ? s.stopwatch.laps.filter(function (n) { return typeof n === 'number'; })
          : [],
      };
    }
    if (s.countdown && typeof s.countdown === 'object') {
      state.countdown = {
        endsAt: +s.countdown.endsAt || 0,
        totalMs: +s.countdown.totalMs || 0,
        label: typeof s.countdown.label === 'string' ? s.countdown.label : '',
        running: !!s.countdown.running,
      };
    }
    /* Alarms are the one thing here where a dropped record has a cost you
       notice — a missed bus. Keep every entry carrying the two fields that
       matter and repair the rest rather than discarding the lot. */
    if (Array.isArray(s.alarms)) {
      state.alarms = s.alarms.filter(function (a) {
        return a && typeof a.time === 'string' && /^\d{1,2}:\d{2}$/.test(a.time);
      }).map(function (a) {
        return {
          id: String(a.id || ('al' + Math.random().toString(36).slice(2, 9))),
          time: a.time,
          days: Array.isArray(a.days) ? a.days.filter(function (d) { return d >= 0 && d <= 6; }) : [],
          enabled: a.enabled !== false,
          label: typeof a.label === 'string' ? a.label : '',
          lastFired: typeof a.lastFired === 'string' ? a.lastFired : '',
        };
      });
    }
    if (Array.isArray(s.worldClocks)) {
      state.worldClocks = s.worldClocks.filter(function (z) { return typeof z === 'string'; }).slice(0, 6);
    }
    if (s.clock && typeof s.clock === 'object') state.clock = sanitiseClock(s.clock);
  })();

  /* Field by field, against what each one is allowed to be. This is not
     defensiveness for its own sake: the object also arrives from the cloud
     slice and from a URL fragment in clock.html, and `bg` and `color` are
     written straight into a style attribute. An unchecked value there is a
     stylesheet injection, so anything that is not a colour or one of our own
     gradients is dropped rather than sanitised into something plausible. */
  function sanitiseClock(raw) {
    var c = Object.assign({}, CLOCK_DEFAULTS);
    if (!raw || typeof raw !== 'object') return c;
    var num = function (v, lo, hi, dflt) {
      var n = +v;
      return isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
    };
    if (CLOCK_FONTS.some(function (f) { return f[0] === raw.font; })) c.font = raw.font;
    if (CLOCK_WEIGHTS.some(function (w) { return w[0] === +raw.weight; })) c.weight = +raw.weight;
    c.size = num(raw.size, 40, 220, CLOCK_DEFAULTS.size);
    c.track = num(raw.track, -12, 24, CLOCK_DEFAULTS.track);
    if (isColour(raw.color)) c.color = raw.color;
    // A preset by exact match, or a plain colour. Nothing else gets through.
    if (isColour(raw.bg) || CLOCK_BGS.some(function (b) { return b[0] && b[0] === raw.bg; })) c.bg = raw.bg;
    ['glow', 'seconds', 'hour24', 'showDate', 'showZones', 'keepInfo', 'drift'].forEach(function (k) {
      if (typeof raw[k] === 'boolean') c[k] = raw[k];
    });
    if (typeof raw.label === 'string') c.label = raw.label.slice(0, 60);
    return c;
  }
  function isColour(v) { return typeof v === 'string' && /^#[0-9a-f]{3,8}$/i.test(v); }

  // ── formatting ────────────────────────────────────────────────────────────
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  /** ms -> H:MM:SS or M:SS. `withCs` appends centiseconds, for the stopwatch. */
  function fmtDur(ms, withCs) {
    if (ms < 0) ms = 0;
    var t = Math.floor(ms / 1000);
    var h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    var out = h > 0 ? h + ':' + pad(m) + ':' + pad(s) : m + ':' + pad(s);
    if (withCs) out += '.' + pad(Math.floor((ms % 1000) / 10));
    return out;
  }
  function localYMD(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  // ── clock appearance: data → CSS ──────────────────────────────────────────
  function fontStack(key) {
    for (var i = 0; i < CLOCK_FONTS.length; i++) if (CLOCK_FONTS[i][0] === key) return CLOCK_FONTS[i][2];
    return CLOCK_FONTS[0][2];
  }

  /* One description, applied to any host element. The full-screen overlay and
     the card on the Timer tab size their digits very differently, so the size
     control is a *multiplier* on whatever that surface already chose rather
     than a pixel value — otherwise 100px would fill a phone and be lost on a
     monitor. */
  function applyClockStyle(host, c) {
    if (!host) return;
    c = c || state.clock;
    var s = host.style;
    s.setProperty('--fttc-font', fontStack(c.font));
    s.setProperty('--fttc-weight', String(c.weight));
    s.setProperty('--fttc-scale', String(c.size / 100));
    s.setProperty('--fttc-track', c.track + 'px');
    /* Left *unset* rather than set to a default when the student picked
       "Theme". The two surfaces want different fallbacks — the overlay must
       fall back to the page background and the card must fall back to
       transparent so the card behind it still shows — and a var() that is
       simply absent lets each stylesheet name its own. Writing one value here
       would force the same wrong answer on both. */
    if (c.color) s.setProperty('--fttc-ink', c.color); else s.removeProperty('--fttc-ink');
    if (c.bg) s.setProperty('--fttc-bg', c.bg); else s.removeProperty('--fttc-bg');
    // Glow is a flag, not a shadow: its colour has to resolve against whatever
    // the ink ends up being, which only the stylesheet knows.
    host.setAttribute('data-clock-glow', c.glow ? '1' : '0');
    host.setAttribute('data-clock-drift', c.drift ? '1' : '0');
    host.classList.toggle('ftt-keepinfo', !!c.keepInfo);
  }

  function clockTimeStr(c, now) {
    var o = { hour: 'numeric', minute: '2-digit' };
    if (c.seconds) o.second = '2-digit';
    if (c.hour24) { o.hour12 = false; o.hour = '2-digit'; }
    var out = now.toLocaleTimeString(undefined, o);
    /* Some engines render midnight as 24:00 under hour12:false rather than
       00:00. Cheaper and more certain to correct the one known output than to
       feature-detect hourCycle support across browsers. */
    if (c.hour24 && out.indexOf('24:') === 0) out = '00:' + out.slice(3);
    return out;
  }
  function clockDateStr(now) {
    return now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  }
  function zoneRow(tz, now) {
    var t = '—';
    try { t = now.toLocaleTimeString(undefined, { timeZone: tz, hour: 'numeric', minute: '2-digit' }); } catch (e) {}
    return { city: zoneCity(tz), time: t };
  }

  /* ── the second window ─────────────────────────────────────────────────────
     "give an option to make it a seperate tab so it can run on an extended
     background while you work."

     A real page rather than a document written into about:blank: a written
     document has no URL, so it dies on reload, cannot be bookmarked, and is
     blocked outright by some browsers. clock.html carries the whole style in
     its fragment, which means the window survives a reload and can be dragged
     to a second monitor and left there.

     Changes made in the planner afterwards reach it over a BroadcastChannel —
     same origin, no storage, and it works in both directions without either
     side polling. Where BroadcastChannel is missing the window simply keeps
     the style it opened with. */
  var clockChannel = null;
  function clockBus() {
    if (clockChannel !== null) return clockChannel;
    try { clockChannel = window.BroadcastChannel ? new BroadcastChannel('flux-clock') : false; }
    catch (e) { clockChannel = false; }
    return clockChannel;
  }
  // World clocks travel with the style: the second window is not signed in to
  // anything and has no way to look them up for itself.
  function clockPayload() { return { style: state.clock, zones: state.worldClocks }; }
  function clockBroadcast() {
    var bus = clockBus();
    if (bus) { try { bus.postMessage(Object.assign({ type: 'style' }, clockPayload())); } catch (e) {} }
  }
  function openClockWindow() {
    var url = 'clock.html#' + encodeURIComponent(JSON.stringify(clockPayload()));
    var w = null;
    try { w = window.open(url, 'fluxClock', 'width=1000,height=640'); } catch (e) {}
    /* A blocked pop-up returns null silently, which would look like a dead
       button. Say what happened and what to do about it. */
    if (!w) toast('Your browser blocked the pop-up. Allow pop-ups for Flux, then try again.', 'error');
    else { try { w.focus(); } catch (e) {} }
  }

  /** Change one appearance field. `quiet` skips the re-render, for controls
      that are being dragged — a full render mid-drag drops the input focus and
      the drag stops dead after one pixel. */
  function setClock(key, value, quiet) {
    if (!(key in CLOCK_DEFAULTS)) return;
    var next = {};
    next[key] = value;
    state.clock = sanitiseClock(Object.assign({}, state.clock, next));
    persist();
    clockBroadcast();
    if (quiet) applyClockStyle($('fttClockFace'), state.clock);
    else render();
    if (fsOpen && fsMode === 'clock') { applyClockStyle(fsEl(), state.clock); mirrorFs(); }
  }
  function resetClock() {
    state.clock = Object.assign({}, CLOCK_DEFAULTS);
    persist(); clockBroadcast(); render();
    toast('Clock style reset', 'success');
  }

  // ── sound ─────────────────────────────────────────────────────────────────
  /* One AudioContext, created on the first user gesture. Browsers refuse to
     start audio without one, and creating it eagerly leaves a permanently
     suspended context that never plays a thing. */
  var actx = null;
  function unlockAudio() {
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
    } catch (e) {}
  }
  function chime(times) {
    unlockAudio();
    if (!actx) return;
    var now = actx.currentTime;
    var notes = [880, 1108.73, 1318.51];
    for (var rep = 0; rep < (times || 1); rep++) {
      for (var i = 0; i < notes.length; i++) {
        var at = now + rep * 0.75 + i * 0.11;
        try {
          var osc = actx.createOscillator(), gain = actx.createGain();
          osc.type = 'sine';
          osc.frequency.value = notes[i];
          gain.gain.setValueAtTime(0.0001, at);
          gain.gain.exponentialRampToValueAtTime(0.14, at + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.5);
          osc.connect(gain); gain.connect(actx.destination);
          osc.start(at); osc.stop(at + 0.55);
        } catch (e) {}
      }
    }
  }
  function notify(title, body) {
    try {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      new Notification(title, { body: body, tag: 'flux-time-tools' });
    } catch (e) {}
  }

  // ── stopwatch ─────────────────────────────────────────────────────────────
  function swElapsed() {
    var sw = state.stopwatch;
    return sw.accumMs + (sw.startedAt ? Date.now() - sw.startedAt : 0);
  }
  function swToggle() {
    var sw = state.stopwatch;
    unlockAudio();
    if (sw.startedAt) { sw.accumMs += Date.now() - sw.startedAt; sw.startedAt = 0; }
    else sw.startedAt = Date.now();
    persist(); render();
  }
  function swReset() {
    state.stopwatch = { startedAt: 0, accumMs: 0, laps: [] };
    persist(); render();
  }
  function swLap() {
    if (!state.stopwatch.startedAt) return;
    state.stopwatch.laps.unshift(swElapsed());
    if (state.stopwatch.laps.length > 50) state.stopwatch.laps.length = 50;
    persist(); render();
  }

  // ── countdown ─────────────────────────────────────────────────────────────
  function cdRemaining() {
    var cd = state.countdown;
    return cd.running ? Math.max(0, cd.endsAt - Date.now()) : cd.totalMs;
  }
  function cdStart(ms, label) {
    if (!(ms > 0)) return;
    unlockAudio();
    state.countdown = { endsAt: Date.now() + ms, totalMs: ms, label: label || '', running: true };
    persist(); render();
  }
  function cdStartFromInputs() {
    var h = parseInt(($('fttCdH') || {}).value, 10) || 0;
    var m = parseInt(($('fttCdM') || {}).value, 10) || 0;
    var s = parseInt(($('fttCdS') || {}).value, 10) || 0;
    var label = (($('fttCdLabel') || {}).value || '').slice(0, 60);
    var ms = ((h * 3600) + (m * 60) + s) * 1000;
    if (!(ms > 0)) { toast('Set a time first', 'error'); return; }
    cdStart(ms, label);
  }
  function cdStop() {
    state.countdown = { endsAt: 0, totalMs: 0, label: '', running: false };
    persist(); render();
  }
  function cdDone() {
    var label = state.countdown.label;
    state.countdown.running = false;
    state.countdown.totalMs = 0;
    persist();
    chime(2);
    toast(label ? 'Countdown finished: ' + label : 'Countdown finished', 'success');
    notify('Countdown finished', label || 'Your countdown has finished.');
    render();
  }

  // ── alarms ────────────────────────────────────────────────────────────────
  function findAlarm(id) {
    for (var i = 0; i < state.alarms.length; i++) if (state.alarms[i].id === id) return state.alarms[i];
    return null;
  }
  function alarmAdd() {
    var time = (($('fttAlTime') || {}).value || '').trim();
    if (!/^\d{1,2}:\d{2}$/.test(time)) { toast('Pick a time first', 'error'); return; }
    var label = (($('fttAlLabel') || {}).value || '').slice(0, 60);
    var days = [];
    for (var d = 0; d < 7; d++) {
      var cb = $('fttAlDay' + d);
      if (cb && cb.checked) days.push(d);
    }
    state.alarms.push({
      id: 'al' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      time: time, days: days, enabled: true, label: label,
      /* Stamped as already-fired for today. Adding a 07:00 alarm at 09:00 must
         not ring the moment you save it — that time is in the past, and
         fireDueAlarms would otherwise consider it due right now. */
      lastFired: localYMD(new Date()),
    });
    persist();
    if ($('fttAlLabel')) $('fttAlLabel').value = '';
    toast('Alarm set for ' + time, 'success');
    render();
  }
  function alarmToggle(id) {
    var a = findAlarm(id); if (!a) return;
    a.enabled = !a.enabled;
    // Re-arming mid-day must not instantly ring for a time already gone.
    if (a.enabled) a.lastFired = localYMD(new Date());
    persist(); render();
  }
  function alarmDelete(id) {
    state.alarms = state.alarms.filter(function (a) { return a.id !== id; });
    persist(); render();
  }
  function alarmSnooze(id, mins) {
    var a = findAlarm(id); if (!a) return;
    cdStart((mins || 9) * 60000, (a.label || 'Alarm') + ' (snoozed)');
    toast('Snoozed ' + (mins || 9) + ' minutes', 'success');
  }

  /* Ring anything that has come due, including while the tab was hidden or
     shut. An alarm is due when its time has passed today, today is one of its
     days, and it has not already fired today — so a laptop opened at 09:00 over
     a 07:30 alarm rings once, not repeatedly, and not at all if it already
     rang. */
  function fireDueAlarms() {
    var now = new Date();
    var today = localYMD(now);
    var nowMins = now.getHours() * 60 + now.getMinutes();
    var dow = now.getDay();
    var fired = false;
    for (var i = 0; i < state.alarms.length; i++) {
      var a = state.alarms[i];
      if (!a.enabled || a.lastFired === today) continue;
      if (a.days.length && a.days.indexOf(dow) < 0) continue;
      var parts = a.time.split(':');
      var due = (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
      if (nowMins < due) continue;
      a.lastFired = today;
      // A one-off alarm (no repeat days) switches itself off once it has rung.
      if (!a.days.length) a.enabled = false;
      fired = true;
      chime(3);
      toast(a.label ? 'Alarm: ' + a.label : 'Alarm · ' + a.time, 'success');
      notify(a.label || 'Alarm', 'It is ' + a.time + (a.label ? ' — ' + a.label : ''));
    }
    if (fired) { persist(); render(); }
  }

  // ── full-screen focus ─────────────────────────────────────────────────────
  /* A *view* of the Pomodoro timer, not a second timer. It mirrors #tDisplay
     and proxies the existing toggleTimer()/resetTimer() globals, so the app
     keeps exactly one piece of timer state and the two can never disagree.
     Deliberately not a re-implementation: a duplicated tSecs would drift the
     moment either copy was paused.

     Tries the real Fullscreen API first and falls back to a fixed overlay,
     because iOS Safari does not support requestFullscreen on ordinary elements
     and any browser may refuse the request. The overlay alone is already the
     useful part — it hides everything else — so a refusal is not an error. */
  var fsOpen = false;
  /* Which tool the overlay is showing. It began as Focus-only; Azfer asked for
     "every timer thingy", so the shell is now rebuilt per mode on open. Alarms
     is deliberately not included — a list of switches has nothing to show at
     arm's length, which is the entire point of this view. */
  var fsMode = 'focus';
  var FS_TITLES = { focus: 'Focus timer', clock: 'Clock', stopwatch: 'Stopwatch', countdown: 'Countdown' };
  function fsEl() { return $('fttFocusFs'); }

  /* The id stays fttFocusFs even now that it shows four different tools. It is
     load-bearing: flux-mood-prompt.js checks for it before deciding whether to
     interrupt, and the CSS and tests key off it. Renaming it to something
     tidier would be a rename in five files to no one's benefit. */
  function buildFsShell() {
    var el = fsEl();
    if (!el) {
      el = document.createElement('div');
      el.id = 'fttFocusFs';
      el.className = 'ftt-fs';
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-modal', 'true');
      el.hidden = true;
      document.body.appendChild(el);
    }
    el.setAttribute('aria-label', 'Full screen ' + (FS_TITLES[fsMode] || 'timer').toLowerCase());
    el.setAttribute('data-mode', fsMode);
    el.innerHTML = '<div class="ftt-fs-inner">' + fsBodyHtml() + '</div>';
    return el;
  }

  /* A ring only makes sense where there is a known total to count against.
     The stopwatch has no end and the clock is not a duration, so neither gets
     one — a ring that never moves is just a circle. */
  function fsBodyHtml() {
    var ring = '<div class="ftt-fs-ringwrap">'
      + '<svg class="ftt-fs-ring" viewBox="0 0 200 200" aria-hidden="true">'
      + '<circle class="ftt-fs-ring-bg" cx="100" cy="100" r="88"/>'
      + '<circle class="ftt-fs-ring-fill" id="fttFsRing" cx="100" cy="100" r="88"'
      + ' stroke-dasharray="553" stroke-dashoffset="0"/></svg>'
      + '<div class="ftt-fs-time" id="fttFsTime">25:00</div>'
      + '</div>';
    var plain = '<div class="ftt-fs-plainwrap">'
      + '<div class="ftt-fs-time" id="fttFsTime">0:00</div></div>';
    var exit = '<button type="button" class="btn-sec" data-ftt="fs-exit">Exit</button>';
    var hint = '<div class="ftt-fs-hint">Press Esc to leave full screen</div>';

    if (fsMode === 'clock') {
      var c = state.clock;
      /* The clock is the one mode whose chrome is the point rather than a
         control panel, so what it shows is whatever the student asked for:
         their own line in place of the "CLOCK" label, the date, and their
         world clocks. Each is omitted entirely when switched off — an empty
         element still occupies a row and would shift the time off centre. */
      return (c.label ? '<div class="ftt-fs-lbl" id="fttFsLbl">' + esc(c.label) + '</div>' : '')
        + '<div class="ftt-fs-plainwrap"><div class="ftt-fs-time" id="fttFsTime">0:00</div></div>'
        + (c.showDate ? '<div class="ftt-fs-sub" id="fttFsSub"></div>' : '')
        + (c.showZones && state.worldClocks.length ? '<div class="ftt-fs-zones" id="fttFsZones"></div>' : '')
        + '<div class="ftt-fs-actions">' + exit + '</div>' + hint;
    }
    if (fsMode === 'stopwatch') {
      return '<div class="ftt-fs-lbl" id="fttFsLbl">Stopwatch</div>'
        + plain
        + '<div class="ftt-fs-sub" id="fttFsSub"></div>'
        + '<div class="ftt-fs-actions">'
        + '<button type="button" class="btn-sec" data-ftt="sw-lap">Lap</button>'
        + '<button type="button" data-ftt="sw-toggle" id="fttFsToggle">Start</button>'
        + '<button type="button" class="btn-sec" data-ftt="sw-reset">Reset</button>'
        + exit + '</div>' + hint;
    }
    if (fsMode === 'countdown') {
      return '<div class="ftt-fs-lbl" id="fttFsLbl">Countdown</div>'
        + ring
        + '<div class="ftt-fs-sub" id="fttFsSub"></div>'
        + '<div class="ftt-fs-actions">'
        + '<button type="button" class="btn-sec" data-ftt="cd-stop">Stop</button>'
        + exit + '</div>' + hint;
    }
    // focus — unchanged, including every id and action the tests rely on.
    return '<div class="ftt-fs-lbl" id="fttFsLbl">Focus Time</div>'
      + ring
      + '<div class="ftt-fs-sub" id="fttFsSub"></div>'
      + '<div class="ftt-fs-actions">'
      + '<button type="button" class="btn-sec" data-ftt="fs-reset">Reset</button>'
      + '<button type="button" data-ftt="fs-toggle" id="fttFsToggle">Start</button>'
      + exit + '</div>' + hint;
  }

  function setFsText(id, text) {
    var el = $(id);
    if (el && el.textContent !== text) el.textContent = text;
  }

  /** Push the current numbers into whichever shell is open. */
  function mirrorFs() {
    if (!fsOpen) return;

    if (fsMode === 'clock') {
      var now = new Date();
      var c = state.clock;
      setFsText('fttFsTime', clockTimeStr(c, now));
      if (c.showDate) setFsText('fttFsSub', clockDateStr(now));
      var zEl = $('fttFsZones');
      if (zEl) {
        /* Rewritten as text, not innerHTML: this runs on every tick, and
           rebuilding markup four times a second to change two digits is both
           wasteful and a place for a city name to end up unescaped. The rows
           are built once, the times are set. */
        if (zEl.children.length !== state.worldClocks.length) {
          zEl.textContent = '';
          state.worldClocks.forEach(function () {
            var row = document.createElement('div');
            row.className = 'ftt-fs-zone';
            row.appendChild(document.createElement('span'));
            row.appendChild(document.createElement('b'));
            zEl.appendChild(row);
          });
        }
        state.worldClocks.forEach(function (tz, i) {
          var row = zEl.children[i];
          if (!row) return;
          var z = zoneRow(tz, now);
          if (row.children[0].textContent !== z.city) row.children[0].textContent = z.city;
          if (row.children[1].textContent !== z.time) row.children[1].textContent = z.time;
        });
      }
      return;
    }

    if (fsMode === 'stopwatch') {
      setFsText('fttFsTime', fmtDur(swElapsed(), true));
      var laps = state.stopwatch.laps || [];
      setFsText('fttFsSub', laps.length ? 'Lap ' + laps.length + ' · ' + fmtDur(laps[laps.length - 1], true) : '');
      setFsText('fttFsToggle', state.stopwatch.startedAt ? 'Pause' : (state.stopwatch.accumMs ? 'Resume' : 'Start'));
      return;
    }

    if (fsMode === 'countdown') {
      var rem = cdRemaining();
      setFsText('fttFsTime', fmtDur(rem));
      setFsText('fttFsSub', state.countdown.label || '');
      var cr = $('fttFsRing');
      if (cr && state.countdown.totalMs) {
        // 553 is the circumference of an r=88 circle, matching the markup.
        cr.style.strokeDasharray = '553';
        cr.style.strokeDashoffset = (553 * (1 - rem / state.countdown.totalMs)).toFixed(1);
      }
      return;
    }

    /* Focus: copy whatever the real Pomodoro shows. Reading the DOM rather
       than app.js internals keeps this working however tSecs is stored. */
    var t = $('tDisplay'), l = $('tLbl'), s = $('tSessionLbl'), ring = $('timerRing');
    if (t) setFsText('fttFsTime', t.textContent);
    if (l) setFsText('fttFsLbl', l.textContent);
    if (s) setFsText('fttFsSub', s.textContent);
    var fr = $('fttFsRing');
    if (ring && fr) {
      fr.style.strokeDasharray = ring.style.strokeDasharray || '553';
      fr.style.strokeDashoffset = ring.style.strokeDashoffset || '0';
    }
    // #timerBtn's label is an SVG plus the word Start or Pause; take the words.
    var btn = $('timerBtn');
    if (btn) setFsText('fttFsToggle', (btn.textContent || '').trim() || 'Start');
  }

  /* ── keeping the screen awake ──────────────────────────────────────────────
     A clock you cannot read because the machine went to sleep is not a clock.
     The Wake Lock API is the only way for a web page to ask for this, and it
     is not everywhere — Firefox shipped it late and iOS Safari later still —
     so every call is guarded and a refusal is silent. Failing to hold the lock
     costs you a screensaver, not the feature.

     The browser drops the lock whenever the tab is hidden, so it has to be
     taken again when you come back rather than requested once. */
  var wakeLock = null;
  function requestWakeLock() {
    try {
      if (!navigator.wakeLock || !navigator.wakeLock.request) return;
      navigator.wakeLock.request('screen').then(function (lock) {
        // The overlay may have been closed while the request was in flight.
        if (!fsOpen) { try { lock.release(); } catch (e) {} return; }
        wakeLock = lock;
        lock.addEventListener('release', function () { wakeLock = null; });
      }).catch(function () {});
    } catch (e) {}
  }
  function releaseWakeLock() {
    var lock = wakeLock;
    wakeLock = null;
    if (lock) { try { lock.release(); } catch (e) {} }
  }
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && fsOpen && !wakeLock) requestWakeLock();
  });

  /* ── idle chrome ───────────────────────────────────────────────────────────
     Stop moving the mouse and everything but the time fades away, the way a
     video player hides its controls. Any movement, key or tap brings it back.

     Guarded rather than debounced: pointermove fires continuously, and
     clearing and re-arming a timeout on every one of those is wasted work.
     While the chrome is already visible, re-arming more than five times a
     second changes nothing anyone can see. */
  var IDLE_MS = 3000;
  var idleTimer = null;
  var lastActivity = 0;
  function fsIdleActivity() {
    if (!fsOpen) return;
    var el = fsEl();
    if (!el) return;
    var now = Date.now();
    var wasIdle = el.classList.contains('is-idle');
    if (!wasIdle && now - lastActivity < 200) return;
    lastActivity = now;
    el.classList.remove('is-idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function () {
      var later = fsEl();
      if (fsOpen && later) later.classList.add('is-idle');
    }, IDLE_MS);
  }
  var IDLE_EVENTS = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'];
  function startIdleWatch() {
    IDLE_EVENTS.forEach(function (n) {
      document.addEventListener(n, fsIdleActivity, { passive: true });
    });
    fsIdleActivity();
  }
  function stopIdleWatch() {
    IDLE_EVENTS.forEach(function (n) { document.removeEventListener(n, fsIdleActivity); });
    clearTimeout(idleTimer);
    idleTimer = null;
    var el = fsEl();
    if (el) el.classList.remove('is-idle');
  }

  /** @param {string} [mode] Defaults to whichever view is open. */
  function openFocusFullscreen(mode) {
    var m = mode || state.view;
    if (!FS_TITLES[m]) m = 'focus';
    fsMode = m;
    var el = buildFsShell();
    el.hidden = false;
    fsOpen = true;
    // Stamped before anything asynchronous starts; see onFsChange.
    fsOpenedAt = Date.now();
    document.body.classList.add('ftt-fs-on');
    // Only the clock is customisable; the other three keep the app's styling,
    // so the properties are cleared rather than left on from a previous open.
    if (fsMode === 'clock') applyClockStyle(el, state.clock);
    else { el.removeAttribute('style'); el.removeAttribute('data-clock-drift'); el.classList.remove('ftt-keepinfo'); }
    unlockAudio();
    mirrorFs();
    kickPaint();
    requestWakeLock();
    startIdleWatch();
    try {
      if (el.requestFullscreen) el.requestFullscreen().catch(function () {});
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    } catch (e) {}
  }
  function closeFocusFullscreen() {
    var el = fsEl();
    if (el) el.hidden = true;
    fsOpen = false;
    document.body.classList.remove('ftt-fs-on');
    releaseWakeLock();
    stopIdleWatch();
    try {
      if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {});
      else if (document.webkitFullscreenElement && document.webkitExitFullscreen) document.webkitExitFullscreen();
    } catch (e) {}
  }
  /* Leaving fullscreen by any route the browser owns — F11, the system
     control, the browser's own toolbar — must also drop our overlay, or it
     stays pinned over the app with no visible way out.

     The guard is a time, not a flag. Entering and leaving fullscreen are both
     asynchronous and both fire this event, so closing and immediately
     reopening produces a burst of changes whose order is not fixed — and a
     "was that exit mine?" boolean gets consumed by the wrong one about one
     time in fifty under load, after which the leftover event closes an overlay
     nobody asked it to close. That is what made the staff Classroom timer
     vanish when a second preset was clicked.

     A change arriving within a moment of a deliberate open is always our own
     plumbing: nobody reaches for F11 that fast. Ignoring those costs nothing,
     because Escape does not come through here at all — it has its own keydown
     handler that calls closeFocusFullscreen directly. */
  var fsOpenedAt = 0;
  function onFsChange() {
    if (Date.now() - fsOpenedAt < 600) return;
    var native = document.fullscreenElement || document.webkitFullscreenElement;
    if (!native && fsOpen) closeFocusFullscreen();
  }

  // ── views ─────────────────────────────────────────────────────────────────
  function setView(v) {
    if (VIEWS.indexOf(v) < 0) return;
    state.view = v;
    persist();
    render();
  }

  var DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  var DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var ZONES = ['America/Los_Angeles', 'America/New_York', 'America/Chicago', 'Europe/London',
    'Europe/Paris', 'Africa/Cairo', 'Asia/Dubai', 'Asia/Karachi', 'Asia/Kolkata',
    'Asia/Shanghai', 'Asia/Tokyo', 'Australia/Sydney'];

  function zoneCity(tz) { return tz.split('/').pop().replace(/_/g, ' '); }

  /* One swatch/segment row builder for every appearance control, so the
     controls cannot drift apart in look or in behaviour. `kind` is the state
     key; the click handler reads it back off the button. */
  function styleRow(kind, options, current, render) {
    return '<div class="ftt-swatches" role="group">' + options.map(function (o) {
      var val = o[0], label = o[1];
      var on = String(val) === String(current);
      return '<button type="button" class="ftt-sw' + (on ? ' active' : '') + '"'
        + ' data-ftt-clock="' + kind + '" data-val="' + esc(String(val)) + '"'
        + ' aria-pressed="' + (on ? 'true' : 'false') + '"'
        + ' title="' + esc(label) + '">' + (render ? render(o, on) : esc(label)) + '</button>';
    }).join('') + '</div>';
  }
  function toggleRow(items) {
    return '<div class="ftt-toggles">' + items.map(function (it) {
      var key = it[0], label = it[1], on = !!state.clock[key];
      return '<button type="button" class="ftt-toggle' + (on ? ' active' : '') + '"'
        + ' data-ftt-clock="' + key + '" data-val="toggle" aria-pressed="' + (on ? 'true' : 'false') + '">'
        + '<span class="ftt-toggle-dot" aria-hidden="true"></span>' + esc(label) + '</button>';
    }).join('') + '</div>';
  }

  function clockHtml() {
    var c = state.clock;
    var now = new Date();
    var zones = '';
    if (state.worldClocks.length) {
      zones = '<div class="ftt-zones">' + state.worldClocks.map(function (tz) {
        var z = zoneRow(tz, now);
        return '<div class="ftt-zone"><div class="ftt-zone-city">' + esc(z.city) + '</div>'
          + '<div class="ftt-zone-time">' + esc(z.time) + '</div>'
          + '<button type="button" class="ftt-x" data-ftt-zone-del="' + esc(tz) + '"'
          + ' aria-label="Remove ' + esc(z.city) + '">&times;</button></div>';
      }).join('') + '</div>';
    }

    /* The face is its own element with its own custom properties rather than
       styling .ftt-card, so what you see while you drag a slider is exactly
       what the full-screen view and the second window will show. A preview
       that is only approximately the real thing is worse than none. */
    var face = '<div class="ftt-face" id="fttClockFace">'
      + '<div class="ftt-clock" id="fttClockTime">' + esc(clockTimeStr(c, now)) + '</div>'
      + (c.showDate ? '<div class="ftt-sub ftt-face-date" id="fttClockDate">' + esc(clockDateStr(now)) + '</div>' : '')
      + (c.label ? '<div class="ftt-face-label">' + esc(c.label) + '</div>' : '')
      + '</div>';

    var custom = '<details class="ftt-custom" id="fttCustom"' + (customOpen ? ' open' : '') + '>'
      + '<summary class="ftt-custom-sum">Customise the clock</summary>'
      + '<div class="ftt-custom-body">'

      + '<div class="ftt-field"><span class="ftt-field-lbl">Font</span>'
      + styleRow('font', CLOCK_FONTS.map(function (f) { return [f[0], f[1]]; }), c.font, function (o) {
        return '<span style="font-family:' + fontStack(o[0]) + '">' + esc(o[1]) + '</span>';
      }) + '</div>'

      + '<div class="ftt-field"><span class="ftt-field-lbl">Weight</span>'
      + styleRow('weight', CLOCK_WEIGHTS, c.weight) + '</div>'

      + '<div class="ftt-field"><span class="ftt-field-lbl">Colour</span>'
      + styleRow('color', CLOCK_INKS, c.color, function (o) {
        return o[0] ? '<i class="ftt-chip" style="background:' + o[0] + '"></i>' : esc(o[1]);
      })
      + '<label class="ftt-pick"><input type="color" data-ftt-clock-color="color" value="'
      + esc(isColour(c.color) ? c.color : '#ffffff') + '" aria-label="Pick a text colour"><span>Custom</span></label>'
      + '</div>'

      + '<div class="ftt-field"><span class="ftt-field-lbl">Background</span>'
      + styleRow('bg', CLOCK_BGS, c.bg, function (o) {
        return o[0] ? '<i class="ftt-chip" style="background:' + o[0] + '"></i>' : esc(o[1]);
      })
      + '<label class="ftt-pick"><input type="color" data-ftt-clock-color="bg" value="'
      + esc(isColour(c.bg) ? c.bg : '#000000') + '" aria-label="Pick a background colour"><span>Custom</span></label>'
      + '</div>'

      + '<div class="ftt-field ftt-field--range">'
      + '<label class="ftt-field-lbl" for="fttClockSize">Size <b>' + Math.round(c.size) + '%</b></label>'
      + '<input type="range" id="fttClockSize" min="40" max="220" step="5" value="' + c.size + '" data-ftt-clock-range="size">'
      + '</div>'
      + '<div class="ftt-field ftt-field--range">'
      + '<label class="ftt-field-lbl" for="fttClockTrack">Letter spacing <b>' + c.track + 'px</b></label>'
      + '<input type="range" id="fttClockTrack" min="-12" max="24" step="1" value="' + c.track + '" data-ftt-clock-range="track">'
      + '</div>'

      + '<div class="ftt-field"><span class="ftt-field-lbl">Show</span>'
      + toggleRow([['seconds', 'Seconds'], ['hour24', '24-hour'], ['showDate', 'Date'],
        ['showZones', 'World clocks'], ['glow', 'Glow']]) + '</div>'

      + '<div class="ftt-field"><span class="ftt-field-lbl">Full screen</span>'
      + toggleRow([['keepInfo', 'Keep the date on screen'], ['drift', 'Gentle drift']])
      + '<p class="ftt-hint ftt-hint--tight">With <b>Keep the date on screen</b> off, everything but the time '
      + 'fades away when you stop moving the mouse. Turn it on for a screensaver that keeps the date, your '
      + 'message and your world clocks. <b>Gentle drift</b> moves the clock around very slowly, so a screen '
      + 'left on all night never burns the same pixels.</p></div>'

      + '<div class="ftt-field"><label class="ftt-field-lbl" for="fttClockLabel">Your own line</label>'
      + '<input type="text" id="fttClockLabel" class="ftt-input ftt-input--wide" maxlength="60"'
      + ' placeholder="Anything you like — shown under the clock" value="' + esc(c.label) + '"'
      + ' data-ftt-clock-text="label"></div>'

      + '<div class="ftt-row ftt-row--center">'
      + '<button type="button" class="btn-sec" data-ftt="clock-reset">Reset to default</button>'
      + '</div>'
      + '</div></details>';

    return '<div class="card ftt-card">'
      + face
      + zones
      + '<div class="ftt-row ftt-row--center">'
      + '<select id="fttZonePick" class="ftt-input" aria-label="Add a world clock">'
      + '<option value="">Add a world clock…</option>'
      + ZONES.map(function (tz) {
        return '<option value="' + esc(tz) + '">' + esc(zoneCity(tz)) + '</option>';
      }).join('')
      + '</select>'
      + '<button type="button" class="btn-sec" data-ftt="clock-window">Open in its own window</button>'
      + '</div>'
      + custom
      + '</div>';
  }

  function stopwatchHtml() {
    var running = !!state.stopwatch.startedAt;
    var laps = state.stopwatch.laps;
    var lapHtml = '';
    if (laps.length) {
      lapHtml = '<div class="ftt-laps">' + laps.map(function (total, i) {
        var n = laps.length - i;
        var prev = laps[i + 1] || 0;
        return '<div class="ftt-lap"><span class="ftt-lap-n">Lap ' + n + '</span>'
          + '<span class="ftt-lap-split">+' + esc(fmtDur(total - prev, true)) + '</span>'
          + '<span class="ftt-lap-total">' + esc(fmtDur(total, true)) + '</span></div>';
      }).join('') + '</div>';
    }
    return '<div class="card ftt-card">'
      + '<div class="ftt-big" id="fttSwDisplay">' + esc(fmtDur(swElapsed(), true)) + '</div>'
      + '<div class="ftt-row ftt-row--center">'
      + '<button type="button" class="btn-sec" data-ftt="sw-lap"' + (running ? '' : ' disabled') + '>Lap</button>'
      + '<button type="button" data-ftt="sw-toggle">' + (running ? 'Pause' : (swElapsed() ? 'Resume' : 'Start')) + '</button>'
      + '<button type="button" class="btn-sec" data-ftt="sw-reset">Reset</button>'
      + '</div>' + lapHtml + '</div>';
  }

  function countdownHtml() {
    var cd = state.countdown;
    if (cd.running) {
      var rem = cdRemaining();
      var pct = cd.totalMs ? (1 - rem / cd.totalMs) * 100 : 0;
      return '<div class="card ftt-card">'
        + (cd.label ? '<div class="ftt-sub">' + esc(cd.label) + '</div>' : '')
        + '<div class="ftt-big" id="fttCdDisplay">' + esc(fmtDur(rem)) + '</div>'
        + '<div class="ftt-bar"><div class="ftt-bar-fill" id="fttCdBar" style="width:' + pct.toFixed(1) + '%"></div></div>'
        + '<div class="ftt-row ftt-row--center">'
        + '<button type="button" class="btn-sec" data-ftt="cd-stop">Cancel</button>'
        + '</div></div>';
    }
    return '<div class="card ftt-card">'
      + '<div class="ftt-big ftt-big--idle">' + esc(fmtDur(0)) + '</div>'
      + '<div class="ftt-row ftt-row--center ftt-presets">'
      + [1, 5, 10, 15, 30, 60].map(function (m) {
        return '<button type="button" class="btn-sec" data-ftt="cd-preset" data-mins="' + m + '">' + m + 'm</button>';
      }).join('') + '</div>'
      + '<div class="ftt-row ftt-row--center">'
      + '<label class="ftt-lbl">Hrs<input type="number" id="fttCdH" class="ftt-num" min="0" max="23" value="0"></label>'
      + '<label class="ftt-lbl">Min<input type="number" id="fttCdM" class="ftt-num" min="0" max="59" value="5"></label>'
      + '<label class="ftt-lbl">Sec<input type="number" id="fttCdS" class="ftt-num" min="0" max="59" value="0"></label>'
      + '</div>'
      + '<div class="ftt-row ftt-row--center">'
      + '<input type="text" id="fttCdLabel" class="ftt-input" maxlength="60" placeholder="What for? (optional)">'
      + '</div>'
      + '<div class="ftt-row ftt-row--center">'
      + '<button type="button" data-ftt="cd-start">Start countdown</button>'
      + '</div></div>';
  }

  function alarmsHtml() {
    var list = state.alarms.length
      ? '<div class="ftt-alarms">' + state.alarms.slice().sort(function (a, b) {
        return a.time.localeCompare(b.time);
      }).map(function (a) {
        var days = a.days.length
          ? a.days.slice().sort().map(function (d) { return DAY_FULL[d].slice(0, 3); }).join(' ')
          : 'Once';
        return '<div class="ftt-alarm' + (a.enabled ? '' : ' is-off') + '">'
          + '<div class="ftt-alarm-main">'
          + '<div class="ftt-alarm-time">' + esc(a.time) + '</div>'
          + '<div class="ftt-alarm-meta">' + esc(days) + (a.label ? ' · ' + esc(a.label) : '') + '</div>'
          + '</div>'
          + '<button type="button" class="btn-sec ftt-mini" data-ftt="al-snooze" data-id="' + esc(a.id) + '">Snooze 9m</button>'
          + '<button type="button" class="btn-sec ftt-mini" data-ftt="al-toggle" data-id="' + esc(a.id) + '"'
          + ' aria-pressed="' + (a.enabled ? 'true' : 'false') + '">' + (a.enabled ? 'On' : 'Off') + '</button>'
          + '<button type="button" class="ftt-x" data-ftt="al-del" data-id="' + esc(a.id) + '"'
          + ' aria-label="Delete alarm">&times;</button>'
          + '</div>';
      }).join('') + '</div>'
      : '<div class="ftt-empty">No alarms yet.</div>';

    var dayBoxes = DAY_LABELS.map(function (d, i) {
      return '<label class="ftt-day" title="' + esc(DAY_FULL[i]) + '">'
        + '<input type="checkbox" id="fttAlDay' + i + '"><span>' + esc(d) + '</span></label>';
    }).join('');

    return '<div class="card ftt-card">'
      + '<div class="ftt-row ftt-row--center">'
      + '<label class="ftt-lbl">Time<input type="time" id="fttAlTime" class="ftt-input ftt-input--time"></label>'
      + '<input type="text" id="fttAlLabel" class="ftt-input" maxlength="60" placeholder="Label (optional)">'
      + '</div>'
      + '<div class="ftt-row ftt-row--center ftt-days">' + dayBoxes + '</div>'
      + '<div class="ftt-hint">Leave every day unticked for a one-off alarm.</div>'
      + '<div class="ftt-row ftt-row--center">'
      + '<button type="button" data-ftt="al-add">Add alarm</button>'
      + '</div>' + list + '</div>';
  }

  /** Is the student part way through something a redraw would destroy? */
  function isBusy() {
    var host = $('fluxTimeTools');
    if (!host) return false;
    var a = document.activeElement;
    // Focus inside the panel means a field is being filled or a day picker is
    // open. document.activeElement is <body> when nothing is focused, so this
    // is false the moment they click away.
    if (a && a !== document.body && host.contains(a)) return true;
    // The customiser being open is a weaker signal than focus, but rebuilding
    // it snaps the whole section shut mid-adjustment.
    var det = $('fttCustom');
    return !!(det && det.open);
  }

  // ── render ────────────────────────────────────────────────────────────────
  var mounted = false;
  /* render() rebuilds the whole Clock view from a string, so a <details> that
     remembered nothing would snap shut every time you picked a colour —
     one change per open, which is not a customiser. */
  var customOpen = false;
  function render() {
    var host = $('fluxTimeTools');
    if (!host) return;
    var focus = $('timerFocusSection');
    if (focus) focus.style.display = state.view === 'focus' ? '' : 'none';

    var nav = VIEWS.map(function (v) {
      var label = v === 'focus' ? 'Focus' : v.charAt(0).toUpperCase() + v.slice(1);
      return '<button type="button" class="tmode-btn' + (state.view === v ? ' active' : '') + '"'
        + ' data-ftt-view="' + v + '" aria-pressed="' + (state.view === v ? 'true' : 'false') + '">'
        + label + '</button>';
    }).join('');

    var body = '';
    if (state.view === 'clock') body = clockHtml();
    else if (state.view === 'stopwatch') body = stopwatchHtml();
    else if (state.view === 'countdown') body = countdownHtml();
    else if (state.view === 'alarms') body = alarmsHtml();
    else if (state.view === 'focus') body = '';

    /* Every view that shows a number gets a full-screen button, not just Focus
       — "I like the focus timer popout but make that for every timer thingy".
       Alarms is the exception: a list of switches has nothing to show across a
       room, which is what this view is for.

       Rendered here rather than in index.html so the button cannot exist when
       the module that drives it has not loaded. */
    if (state.view !== 'alarms') {
      body += '<div class="ftt-row ftt-row--center ftt-fs-launch">'
        + '<button type="button" class="btn-sec" data-ftt="fs-open">Full screen</button>'
        + '</div>';
    }

    host.innerHTML = '<div class="ftt-nav">' + nav + '</div>' + body;
    if (state.view === 'clock') applyClockStyle($('fttClockFace'), state.clock);
    mounted = true;
  }

  /* Repaint only the digits that change. A full render four times a second
     would wipe out whatever you were typing in a countdown field or the day
     boxes you were ticking. Anything structural goes through render(); this is
     the hot path. */
  function tickDisplays() {
    if (!mounted) return;
    if (state.view === 'clock') {
      var now = new Date();
      var t = $('fttClockTime');
      if (t) t.textContent = clockTimeStr(state.clock, now);
      var zs = document.querySelectorAll('#fluxTimeTools .ftt-zone');
      for (var i = 0; i < zs.length; i++) {
        var tz = state.worldClocks[i];
        var el = zs[i].querySelector('.ftt-zone-time');
        if (!tz || !el) continue;
        try { el.textContent = now.toLocaleTimeString(undefined, { timeZone: tz, hour: 'numeric', minute: '2-digit' }); } catch (e) {}
      }
    } else if (state.view === 'stopwatch') {
      var sw = $('fttSwDisplay');
      if (sw) sw.textContent = fmtDur(swElapsed(), true);
    } else if (state.view === 'countdown' && state.countdown.running) {
      var rem = cdRemaining();
      var d = $('fttCdDisplay');
      if (d) d.textContent = fmtDur(rem);
      var bar = $('fttCdBar');
      if (bar && state.countdown.totalMs) {
        bar.style.width = ((1 - rem / state.countdown.totalMs) * 100).toFixed(1) + '%';
      }
      if (rem <= 0) cdDone();
    }
  }

  // ── driver ────────────────────────────────────────────────────────────────
  /* Two clocks, deliberately.

     A single 250ms interval used to repaint everything, including the
     stopwatch's centiseconds — so the hundredths digit advanced about 25 at a
     time. Azfer: "it's skipping numbers and jumping". It was: four repaints a
     second cannot show a number that changes a hundred times a second.

     Anything fast-moving now repaints from requestAnimationFrame, in step with
     the screen, and the interval is left to the slow work — checking alarms —
     where 250ms is plenty.

     Honest about the limit: a 60Hz screen redraws 60 times a second and
     centiseconds change 100 times a second, so the last digit still cannot
     show every single value. No screen can. What it can do is move smoothly
     rather than lurch, which is what a stopwatch is meant to look like.

     Neither clock is a source of truth. Every value is derived from Date.now()
     (see the header), so throttling either in a background tab costs
     smoothness and never accuracy. Alarms are checked on every interval tick
     whichever view is open, and again on focus and visibilitychange, which is
     what makes an alarm that came due while you were away still ring. */
  var driver = null;
  var rafId = null;

  /** Is there something on screen changing faster than the eye forgives? */
  function needsFastPaint() {
    // The clock ticks once a second either way — the interval covers it, and a
    // frame loop redrawing the same string 60 times a second is just heat.
    if (fsOpen) return fsMode !== 'clock';
    if (!mounted) return false;
    if (state.view === 'stopwatch') return !!state.stopwatch.startedAt;
    if (state.view === 'countdown') return !!state.countdown.running;
    return false;
  }

  function paintFrame() {
    rafId = null;
    tickDisplays();
    mirrorFs();
    if (needsFastPaint()) rafId = requestAnimationFrame(paintFrame);
  }

  /** Start the frame loop if something needs it and it isn't already running. */
  function kickPaint() {
    if (rafId == null && needsFastPaint()) rafId = requestAnimationFrame(paintFrame);
  }

  function startDriver() {
    if (driver) return;
    driver = setInterval(function () {
      fireDueAlarms();
      /* Still repaints here as well as in the frame loop: a paused stopwatch,
         the clock, and a backgrounded tab all need updating without one, and
         rAF does not run in a hidden document at all. */
      tickDisplays();
      mirrorFs();
      kickPaint();
    }, 250);
    kickPaint();
  }
  function onWake() {
    fireDueAlarms();
    // A countdown that expired while hidden must resolve on return, not sit at 0.
    if (state.countdown.running && cdRemaining() <= 0) cdDone();
    else tickDisplays();
  }

  // ── events ────────────────────────────────────────────────────────────────
  function onClick(e) {
    if (!e.target || !e.target.closest) return;
    /* The full-screen overlay lives on <body>, outside #fluxTimeTools, so
       anything clicked inside it has to be handled before the containment
       check below — otherwise the stopwatch and countdown buttons the overlay
       now carries are silently dropped. */
    var overlay = e.target.closest('#fttFocusFs');
    if (overlay) {
      var fsBtn = e.target.closest('[data-ftt]');
      if (!fsBtn) return;
      var fsAct = fsBtn.getAttribute('data-ftt');
      if (fsAct === 'fs-exit') { closeFocusFullscreen(); return; }
      // Focus proxies straight through to the one real timer, then re-reads it.
      else if (fsAct === 'fs-toggle') { try { window.toggleTimer(); } catch (er) {} }
      else if (fsAct === 'fs-reset') { try { window.resetTimer(); } catch (er) {} }
      /* The rest drive this module's own state. They call the same functions
         the in-page buttons do, so there is one implementation per action and
         the two surfaces cannot drift. */
      else if (fsAct === 'sw-toggle') swToggle();
      else if (fsAct === 'sw-reset') swReset();
      else if (fsAct === 'sw-lap') swLap();
      else if (fsAct === 'cd-stop') cdStop();
      mirrorFs();
      kickPaint();
      return;
    }
    var host = $('fluxTimeTools');
    if (!host || !host.contains(e.target)) return;
    var viewBtn = e.target.closest('[data-ftt-view]');
    if (viewBtn) { unlockAudio(); setView(viewBtn.getAttribute('data-ftt-view')); return; }
    var zoneDel = e.target.closest('[data-ftt-zone-del]');
    if (zoneDel) {
      var tz = zoneDel.getAttribute('data-ftt-zone-del');
      state.worldClocks = state.worldClocks.filter(function (z) { return z !== tz; });
      persist(); clockBroadcast(); render(); return;
    }
    /* Appearance controls. Segments and swatches carry the value; toggles say
       "toggle" and flip whatever is there, so one handler covers both and a
       new option needs no new branch. */
    var styleBtn = e.target.closest('[data-ftt-clock]');
    if (styleBtn) {
      var key = styleBtn.getAttribute('data-ftt-clock');
      var raw = styleBtn.getAttribute('data-val');
      if (raw === 'toggle') setClock(key, !state.clock[key]);
      else setClock(key, key === 'weight' ? +raw : raw);
      return;
    }
    var btn = e.target.closest('[data-ftt]');
    if (!btn) return;
    var act = btn.getAttribute('data-ftt');
    var id = btn.getAttribute('data-id');
    if (act === 'sw-toggle') swToggle();
    else if (act === 'sw-reset') swReset();
    else if (act === 'sw-lap') swLap();
    else if (act === 'cd-start') cdStartFromInputs();
    else if (act === 'cd-stop') cdStop();
    else if (act === 'cd-preset') cdStart((parseInt(btn.getAttribute('data-mins'), 10) || 0) * 60000, '');
    else if (act === 'al-add') alarmAdd();
    else if (act === 'al-toggle') alarmToggle(id);
    else if (act === 'al-del') alarmDelete(id);
    else if (act === 'al-snooze') alarmSnooze(id, 9);
    else if (act === 'fs-open') openFocusFullscreen();
    else if (act === 'clock-window') openClockWindow();
    else if (act === 'clock-reset') resetClock();
  }
  function onChange(e) {
    if (e.target && e.target.id === 'fttZonePick') {
      var tz = e.target.value;
      if (!tz) return;
      if (state.worldClocks.indexOf(tz) < 0 && state.worldClocks.length < 6) state.worldClocks.push(tz);
      persist(); clockBroadcast(); render();
      return;
    }
    /* The colour pickers commit on `change`, not on `input`. A native colour
       dialog fires `input` continuously while you drag around the wheel, and
       re-rendering on each one closes the dialog under your cursor. */
    var col = e.target && e.target.closest && e.target.closest('[data-ftt-clock-color]');
    if (col) setClock(col.getAttribute('data-ftt-clock-color'), col.value);
  }

  /* Sliders and the free-text line, on the other hand, must respond as you
     move them or the preview is useless — so these update live and are given
     `quiet`, which restyles the face without rebuilding the panel. Rebuilding
     would take the slider out from under the pointer mid-drag. */
  function onInput(e) {
    var t = e.target;
    if (!t || !t.getAttribute) return;
    var rangeKey = t.getAttribute('data-ftt-clock-range');
    if (rangeKey) {
      setClock(rangeKey, +t.value, true);
      var lbl = t.parentNode && t.parentNode.querySelector('.ftt-field-lbl b');
      if (lbl) lbl.textContent = rangeKey === 'size' ? Math.round(+t.value) + '%' : (+t.value) + 'px';
      return;
    }
    if (t.getAttribute('data-ftt-clock-text') === 'label') {
      setClock('label', t.value, true);
      var face = $('fttClockFace');
      if (!face) return;
      var line = face.querySelector('.ftt-face-label');
      if (!line && t.value) {
        line = document.createElement('div');
        line.className = 'ftt-face-label';
        face.appendChild(line);
      }
      if (line) line.textContent = t.value;
    }
  }

  function install() {
    if (!$('fluxTimeTools')) return;
    render();
    startDriver();
  }

  document.addEventListener('click', onClick);
  document.addEventListener('change', onChange);
  document.addEventListener('input', onInput);
  /* `toggle` does not bubble, so it cannot be delegated from document the way
     everything else here is — capture is the only way to catch it without
     re-binding after each render. */
  document.addEventListener('toggle', function (e) {
    if (e.target && e.target.id === 'fttCustom') customOpen = !!e.target.open;
  }, true);
  /* Capture phase, and stopPropagation, because the app has other Escape
     handlers (FluxOverlays, the command palette) that would otherwise also act
     on this keypress and close something underneath the overlay. */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || !fsOpen) return;
    e.stopPropagation();
    closeFocusFullscreen();
  }, true);
  document.addEventListener('fullscreenchange', onFsChange);
  document.addEventListener('webkitfullscreenchange', onFsChange);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) onWake(); });
  window.addEventListener('focus', onWake);
  document.addEventListener('DOMContentLoaded', install);
  if (document.readyState !== 'loading') install();

  window.FluxTimeTools = {
    install: install,
    setView: setView,
    openFocusFullscreen: openFocusFullscreen,
    closeFocusFullscreen: closeFocusFullscreen,
    /* Exported so the staff dashboard's Classroom timer can start the real
       countdown rather than keep its own. render() no-ops when the Timer panel
       isn't on screen, so this is safe to call from anywhere. */
    startCountdown: cdStart,
    /* Cloud-sync contract, same shape as the other synced modules. Only alarms
       and world clocks travel: a running stopwatch or countdown belongs to the
       device it was started on, and copying endsAt to a second device would
       show a countdown nobody there started. */
    getCloudSlice: function () {
      // `clock` travels with the alarms: an appearance you spent time choosing
      // should be waiting for you on the school laptop, same as your alarms.
      return { alarms: state.alarms, worldClocks: state.worldClocks, clock: state.clock };
    },
    applyFromCloud: function (data) {
      if (!data || typeof data !== 'object') return;
      if (Array.isArray(data.alarms)) {
        state.alarms = data.alarms.filter(function (a) {
          return a && typeof a.time === 'string' && /^\d{1,2}:\d{2}$/.test(a.time);
        });
      }
      if (Array.isArray(data.worldClocks)) {
        state.worldClocks = data.worldClocks.filter(function (z) { return typeof z === 'string'; }).slice(0, 6);
      }
      // Same validation as a local load — a cloud row is no more trusted than
      // a URL fragment, and both end up in a style attribute.
      if (data.clock && typeof data.clock === 'object') state.clock = sanitiseClock(data.clock);
      persist();
      /* Never redraw the panel out from under someone using it. A sync from
         another device arriving while you are half way through setting an
         alarm used to wipe the time you had entered and shut the day picker;
         the state above is already updated, so the next render — switching
         view, or any action of your own — shows it. Nothing is lost except
         the interruption. */
      if (mounted && !isBusy()) render();
    },
    openClockWindow: openClockWindow,
    // Test seams.
    _state: function () { return state; },
    _fireDue: fireDueAlarms,
    _setClock: setClock,
    _clockFonts: function () { return CLOCK_FONTS.map(function (f) { return f[0]; }); },
  };
})();
