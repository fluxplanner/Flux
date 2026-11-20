/* Flux Timer (timer.html). Times come from Date.now(), never from counting
   ticks, so a throttled background tab still shows the right time when it
   comes back. Sounds are made with Web Audio — nothing to download. */
(function () {
  'use strict';
  var T = window.FluxTool, $ = T.$, $$ = T.$$;
  T.tabs($('[role="tablist"]'), 'flux_timer_tab');
  var ctx = null;
  function beep(freq, len, vol) {
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      var o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
      o.frequency.value = freq || 880; g.gain.setValueAtTime(vol || 0.25, t); g.gain.exponentialRampToValueAtTime(0.0001, t + (len || 0.15));
      o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + (len || 0.15) + 0.02);
    } catch (e) { /* no audio here */ }
  }
  var mmss = function (ms) { var s = Math.max(0, Math.ceil(ms / 1000)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };

  /* Countdown */
  var cd = { total: 300000, left: 300000, end: 0, run: false };
  function cdSet(ms) { cd.total = cd.left = ms; cd.run = false; cdDraw(); }
  function cdDraw() {
    var left = cd.run ? cd.end - Date.now() : cd.left;
    $('#cdFace').textContent = mmss(left);
    $('#cdFace').classList.toggle('done', left <= 0 && cd.total > 0);
    $('#cdGo').textContent = cd.run ? 'Pause' : (cd.left < cd.total && cd.left > 0 ? 'Resume' : 'Start');
    if (cd.run && left <= 0) {
      cd.run = false; cd.left = 0;
      $('#cdSay').textContent = 'Time is up.';
      if ($('#cdSound').checked) { beep(880, .3); setTimeout(function () { beep(880, .3); }, 400); setTimeout(function () { beep(1175, .6); }, 800); }
      cdDraw();
    }
  }
  $$('[data-min]').forEach(function (b) { b.addEventListener('click', function () { var m = +b.getAttribute('data-min'); $('#cdMin').value = m; $('#cdSec').value = 0; cdSet(m * 60000); }); });
  ['#cdMin', '#cdSec'].forEach(function (s) { $(s).addEventListener('input', function () { cdSet(((+$('#cdMin').value || 0) * 60 + Math.min(59, +$('#cdSec').value || 0)) * 1000); }); });
  $('#cdGo').addEventListener('click', function () {
    if (cd.run) { cd.left = cd.end - Date.now(); cd.run = false; }
    else { if (cd.left <= 0) cd.left = cd.total; cd.end = Date.now() + cd.left; cd.run = cd.left > 0; $('#cdSay').textContent = ''; beep(660, .05, .05); }
    cdDraw();
  });
  $('#cdReset').addEventListener('click', function () { cdSet(cd.total); });
  $('#cdFull').addEventListener('click', function () { var p = $('#pane-count'); if (document.fullscreenElement) document.exitFullscreen(); else if (p.requestFullscreen) p.requestFullscreen(); });

  /* Intervals: work and rest alternate for the rounds asked. */
  var iv = { run: false, phase: 'ready', round: 0, end: 0 };
  function ivLen(ph) { return (ph === 'work' ? +$('#inWork').value : +$('#inRest').value) * 1000; }
  /* ready → work 1 → rest → work 2 → … → work N → done (no rest after the last). */
  function ivNext() {
    var rounds = Math.max(1, +$('#inRounds').value || 1), rest = +$('#inRest').value > 0;
    if (iv.phase === 'ready') { iv.phase = 'work'; iv.round = 1; }
    else if (iv.phase === 'work') {
      if (iv.round >= rounds) { iv.phase = 'done'; iv.run = false; beep(1175, .6); return; }
      if (rest) iv.phase = 'rest'; else iv.round++;
    } else if (iv.phase === 'rest') { iv.phase = 'work'; iv.round++; }
    iv.end = Date.now() + ivLen(iv.phase);
    beep(iv.phase === 'work' ? 990 : 520, .25);
  }
  function ivDraw() {
    if (iv.run && Date.now() >= iv.end) ivNext();
    var rounds = Math.max(1, +$('#inRounds').value || 1);
    $('#inPhase').textContent = iv.phase === 'ready' ? 'Ready' : iv.phase === 'done' ? 'Done — ' + rounds + ' rounds' : (iv.phase === 'work' ? 'Work' : 'Rest') + ' · round ' + iv.round + ' of ' + rounds;
    $('#inFace').textContent = mmss(iv.run ? iv.end - Date.now() : iv.phase === 'ready' ? ivLen('work') : 0);
    $('#inGo').textContent = iv.run ? 'Stop' : 'Start';
  }
  $('#inGo').addEventListener('click', function () {
    if (iv.run) { iv.run = false; iv.phase = 'ready'; iv.round = 0; } else { iv = { run: true, phase: 'ready', round: 0, end: 0 }; ivNext(); }
    ivDraw();
  });
  $('#inReset').addEventListener('click', function () { iv = { run: false, phase: 'ready', round: 0, end: 0 }; ivDraw(); });

  /* Metronome: beats scheduled ahead on the audio clock, so they stay even. */
  var mt = { run: false, next: 0, beat: 0, timer: 0 }, taps = [];
  function mtDraw() {
    $('#mtFace').textContent = $('#mtBpm').value + ' bpm';
    var n = +$('#mtBar').value;
    if ($('#mtBeats').children.length !== n) $('#mtBeats').innerHTML = new Array(n + 1).join('<span></span>');
    $('#mtGo').textContent = mt.run ? 'Stop' : 'Start';
  }
  function mtTick() {
    if (!mt.run || !ctx) return;
    var spb = 60 / +$('#mtBpm').value, n = +$('#mtBar').value;
    while (mt.next < ctx.currentTime + 0.12) {
      var b = mt.beat % n, at = mt.next;
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = b === 0 ? 1500 : 1000; g.gain.setValueAtTime(0.3, at); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
      o.connect(g); g.connect(ctx.destination); o.start(at); o.stop(at + 0.06);
      (function (b, delay) { setTimeout(function () { $$('#mtBeats span').forEach(function (s, i) { s.className = i === b ? 'on' + (b === 0 ? ' first' : '') : ''; }); }, Math.max(0, delay)); })(b, (at - ctx.currentTime) * 1000);
      mt.next += spb; mt.beat++;
    }
  }
  $('#mtGo').addEventListener('click', function () {
    if (mt.run) { mt.run = false; clearInterval(mt.timer); }
    else {
      try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { T.toast('This browser cannot play sound.'); return; }
      mt.run = true; mt.beat = 0; mt.next = ctx.currentTime + 0.05; mt.timer = setInterval(mtTick, 25); mtTick();
    }
    mtDraw();
  });
  $('#mtTap').addEventListener('click', function () {
    var now = Date.now();
    taps = taps.filter(function (t) { return now - t < 2500; }); taps.push(now);
    if (taps.length >= 2) {
      var gaps = taps.slice(1).map(function (t, i) { return t - taps[i]; });
      var bpm = Math.round(60000 / (gaps.reduce(function (a, b) { return a + b; }, 0) / gaps.length));
      $('#mtBpm').value = Math.max(30, Math.min(240, bpm)); mtDraw();
    }
  });
  $('#mtBpm').addEventListener('input', mtDraw); $('#mtBar').addEventListener('change', mtDraw);

  /* Stopwatch */
  var sw = { run: false, start: 0, acc: 0, laps: [] };
  var swNow = function () { return sw.acc + (sw.run ? Date.now() - sw.start : 0); };
  var swFmt = function (ms) { var t = Math.floor(ms / 100); return String(Math.floor(t / 600)).padStart(2, '0') + ':' + String(Math.floor(t / 10) % 60).padStart(2, '0') + '.' + (t % 10); };
  function swDraw() {
    $('#swFace').textContent = swFmt(swNow());
    $('#swGo').textContent = sw.run ? 'Stop' : (sw.acc ? 'Resume' : 'Start');
  }
  $('#swGo').addEventListener('click', function () { if (sw.run) { sw.acc += Date.now() - sw.start; sw.run = false; } else { sw.start = Date.now(); sw.run = true; } swDraw(); });
  $('#swLap').addEventListener('click', function () {
    if (!sw.run) return;
    var t = swNow(), prev = sw.laps.length ? sw.laps[sw.laps.length - 1] : 0; sw.laps.push(t);
    $('#swLaps').insertAdjacentHTML('afterbegin', '<li>Lap ' + sw.laps.length + ': ' + swFmt(t - prev) + ' <span class="ft-muted">(' + swFmt(t) + ')</span></li>');
  });
  $('#swReset').addEventListener('click', function () { sw = { run: false, start: 0, acc: 0, laps: [] }; $('#swLaps').innerHTML = ''; swDraw(); });

  setInterval(function () { cdDraw(); ivDraw(); swDraw(); }, 100);
  cdDraw(); ivDraw(); mtDraw(); swDraw();
})();
