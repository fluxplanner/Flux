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

  // ── state ─────────────────────────────────────────────────────────────────
  var state = {
    view: 'focus',
    stopwatch: { startedAt: 0, accumMs: 0, laps: [] },
    countdown: { endsAt: 0, totalMs: 0, label: '', running: false },
    alarms: [],
    worldClocks: [],
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
  })();

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
  function fsEl() { return $('fttFocusFs'); }

  function buildFsShell() {
    if (fsEl()) return fsEl();
    var el = document.createElement('div');
    el.id = 'fttFocusFs';
    el.className = 'ftt-fs';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Full screen focus timer');
    el.hidden = true;
    el.innerHTML =
      '<div class="ftt-fs-inner">'
      + '<div class="ftt-fs-lbl" id="fttFsLbl">Focus Time</div>'
      + '<div class="ftt-fs-ringwrap">'
      + '<svg class="ftt-fs-ring" viewBox="0 0 200 200" aria-hidden="true">'
      + '<circle class="ftt-fs-ring-bg" cx="100" cy="100" r="88"/>'
      + '<circle class="ftt-fs-ring-fill" id="fttFsRing" cx="100" cy="100" r="88"'
      + ' stroke-dasharray="553" stroke-dashoffset="0"/></svg>'
      + '<div class="ftt-fs-time" id="fttFsTime">25:00</div>'
      + '</div>'
      + '<div class="ftt-fs-sub" id="fttFsSub"></div>'
      + '<div class="ftt-fs-actions">'
      + '<button type="button" class="btn-sec" data-ftt="fs-reset">Reset</button>'
      + '<button type="button" data-ftt="fs-toggle" id="fttFsToggle">Start</button>'
      + '<button type="button" class="btn-sec" data-ftt="fs-exit">Exit</button>'
      + '</div>'
      + '<div class="ftt-fs-hint">Press Esc to leave full screen</div>'
      + '</div>';
    document.body.appendChild(el);
    return el;
  }

  /* Copy whatever the real timer currently shows. Reading the DOM rather than
     app.js internals keeps this working however tSecs happens to be stored. */
  function mirrorFs() {
    if (!fsOpen) return;
    var t = $('tDisplay'), l = $('tLbl'), s = $('tSessionLbl'), ring = $('timerRing');
    var ft = $('fttFsTime'), fl = $('fttFsLbl'), fsub = $('fttFsSub'), fr = $('fttFsRing');
    if (t && ft && ft.textContent !== t.textContent) ft.textContent = t.textContent;
    if (l && fl && fl.textContent !== l.textContent) fl.textContent = l.textContent;
    if (s && fsub && fsub.textContent !== s.textContent) fsub.textContent = s.textContent;
    if (ring && fr) {
      fr.style.strokeDasharray = ring.style.strokeDasharray || '553';
      fr.style.strokeDashoffset = ring.style.strokeDashoffset || '0';
    }
    // #timerBtn's label is an SVG plus the word Start or Pause; take the words.
    var btn = $('timerBtn'), fb = $('fttFsToggle');
    if (btn && fb) {
      var word = (btn.textContent || '').trim() || 'Start';
      if (fb.textContent !== word) fb.textContent = word;
    }
  }

  function openFocusFullscreen() {
    var el = buildFsShell();
    el.hidden = false;
    fsOpen = true;
    document.body.classList.add('ftt-fs-on');
    unlockAudio();
    mirrorFs();
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
    try {
      if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {});
      else if (document.webkitFullscreenElement && document.webkitExitFullscreen) document.webkitExitFullscreen();
    } catch (e) {}
  }
  /* Leaving fullscreen by any route the browser owns — Esc, F11, the system
     control — must also drop our overlay, or it stays pinned over the app with
     no visible way out. */
  function onFsChange() {
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

  function clockHtml() {
    var now = new Date();
    var time = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' });
    var date = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    var zones = '';
    if (state.worldClocks.length) {
      zones = '<div class="ftt-zones">' + state.worldClocks.map(function (tz) {
        var t = '—';
        try { t = now.toLocaleTimeString(undefined, { timeZone: tz, hour: 'numeric', minute: '2-digit' }); } catch (e) {}
        return '<div class="ftt-zone"><div class="ftt-zone-city">' + esc(zoneCity(tz)) + '</div>'
          + '<div class="ftt-zone-time">' + esc(t) + '</div>'
          + '<button type="button" class="ftt-x" data-ftt-zone-del="' + esc(tz) + '"'
          + ' aria-label="Remove ' + esc(zoneCity(tz)) + '">&times;</button></div>';
      }).join('') + '</div>';
    }
    return '<div class="card ftt-card">'
      + '<div class="ftt-clock" id="fttClockTime">' + esc(time) + '</div>'
      + '<div class="ftt-sub" id="fttClockDate">' + esc(date) + '</div>'
      + zones
      + '<div class="ftt-row ftt-row--center">'
      + '<select id="fttZonePick" class="ftt-input" aria-label="Add a world clock">'
      + '<option value="">Add a world clock…</option>'
      + ZONES.map(function (tz) {
        return '<option value="' + esc(tz) + '">' + esc(zoneCity(tz)) + '</option>';
      }).join('')
      + '</select></div></div>';
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

  // ── render ────────────────────────────────────────────────────────────────
  var mounted = false;
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
    /* The full-screen entry point belongs to the Pomodoro timer, so it only
       appears on Focus. Rendered here rather than in index.html so the button
       cannot exist when the module that drives it has not loaded. */
    else if (state.view === 'focus') {
      body = '<div class="ftt-row ftt-row--center ftt-fs-launch">'
        + '<button type="button" class="btn-sec" data-ftt="fs-open">Full screen</button>'
        + '</div>';
    }

    host.innerHTML = '<div class="ftt-nav">' + nav + '</div>' + body;
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
      if (t) t.textContent = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' });
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
  /* 250ms so the stopwatch's centiseconds move convincingly. The browser will
     throttle this hard in a background tab and that is fine — see the header:
     every value is derived from Date.now(), so a slow tick is a slow repaint,
     never a wrong number. Alarms are checked on every tick whichever view is
     open, and again on focus and visibilitychange, which is what makes an alarm
     that came due while you were away still ring. */
  var driver = null;
  function startDriver() {
    if (driver) return;
    driver = setInterval(function () {
      fireDueAlarms();
      tickDisplays();
      mirrorFs();
    }, 250);
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
    /* The full-screen overlay lives on <body>, outside #fluxTimeTools, so its
       buttons have to be handled before the containment check below. */
    var fsBtn = e.target.closest('[data-ftt="fs-toggle"],[data-ftt="fs-reset"],[data-ftt="fs-exit"]');
    if (fsBtn) {
      var fsAct = fsBtn.getAttribute('data-ftt');
      if (fsAct === 'fs-exit') closeFocusFullscreen();
      // Proxy straight through to the one real timer, then re-read it.
      else if (fsAct === 'fs-toggle') { try { window.toggleTimer(); } catch (er) {} }
      else if (fsAct === 'fs-reset') { try { window.resetTimer(); } catch (er) {} }
      mirrorFs();
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
      persist(); render(); return;
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
  }
  function onChange(e) {
    if (e.target && e.target.id === 'fttZonePick') {
      var tz = e.target.value;
      if (!tz) return;
      if (state.worldClocks.indexOf(tz) < 0 && state.worldClocks.length < 6) state.worldClocks.push(tz);
      persist(); render();
    }
  }

  function install() {
    if (!$('fluxTimeTools')) return;
    render();
    startDriver();
  }

  document.addEventListener('click', onClick);
  document.addEventListener('change', onChange);
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
    /* Cloud-sync contract, same shape as the other synced modules. Only alarms
       and world clocks travel: a running stopwatch or countdown belongs to the
       device it was started on, and copying endsAt to a second device would
       show a countdown nobody there started. */
    getCloudSlice: function () {
      return { alarms: state.alarms, worldClocks: state.worldClocks };
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
      persist();
      if (mounted) render();
    },
    // Test seams.
    _state: function () { return state; },
    _fireDue: fireDueAlarms,
  };
})();
