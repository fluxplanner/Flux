/* Flux Timetable (timetable.html): a bell schedule as an .ics file — the
   reverse of the planner's .ics timetable import (flux-ics-timetable-import.js).
   Presets come from flux-school-presets.js. Every weekday: one repeating event
   per period. A/B days: school days are counted out (weekends and the dates
   off skipped) and each day gets its own events, so the rotation survives
   holidays exactly as schools run it. Times are floating local times. */
(function () {
  'use strict';
  var T = window.FluxTool, $ = T.$, SP = window.FluxSchoolPresets;
  var st = T.load('flux_timetable_v1', { rows: [], pattern: 'every', first: 'A', off: '' });
  var save = function () { T.save('flux_timetable_v1', st); };
  if (SP) $('#ttPreset').innerHTML += SP.list().map(function (p) { return '<option value="' + T.esc(p.id) + '">' + T.esc(p.name + (p.note ? ' — ' + p.note : '')) + '</option>'; }).join('');
  var pad = function (n) { return n < 10 ? '0' + n : String(n); };
  var ymd = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  var parse = function (s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3], 12) : null; };
  if (!st.rows.length) st.rows = [{ day: 'every', label: '1', name: '', room: '', start: '08:00', end: '08:50' }];

  function draw() {
    var ab = $('#ttPattern').value === 'ab';
    [].slice.call(document.querySelectorAll('[data-ab]')).forEach(function (e) { e.hidden = !ab; });
    $('#ttRows').innerHTML = st.rows.map(function (r, i) {
      var day = ab ? '<select aria-label="Day" data-i="' + i + '" data-k="day" class="ft-in" style="min-height:36px;padding:4px 8px"><option value="A"' + (r.day === 'A' ? ' selected' : '') + '>A</option><option value="B"' + (r.day === 'B' ? ' selected' : '') + '>B</option><option value="every"' + (r.day === 'every' ? ' selected' : '') + '>Both</option></select>' : 'Every day';
      var inp = function (k, lab, type) { return '<input aria-label="' + lab + '" data-i="' + i + '" data-k="' + k + '" type="' + (type || 'text') + '" value="' + T.esc(r[k] || '') + '">'; };
      return '<tr><td>' + day + '</td><td>' + inp('label', 'Period') + '</td><td>' + inp('name', 'Class') + '</td><td>' + inp('room', 'Room') + '</td><td>' + inp('start', 'Starts', 'time') + '</td><td>' + inp('end', 'Ends', 'time') + '</td>'
        + '<td><button type="button" class="ft-btn small" data-del="' + i + '" aria-label="Remove period">✕</button></td></tr>';
    }).join('');
  }
  $('#ttRows').addEventListener('change', function (e) { var t = e.target, k = t.getAttribute('data-k'); if (!k) return; st.rows[+t.getAttribute('data-i')][k] = t.value; save(); });
  $('#ttRows').addEventListener('click', function (e) { var b = e.target.closest('[data-del]'); if (b) { st.rows.splice(+b.getAttribute('data-del'), 1); save(); draw(); } });
  $('#ttAdd').addEventListener('click', function () { var last = st.rows[st.rows.length - 1]; st.rows.push({ day: last ? last.day : 'every', label: String(st.rows.length + 1), name: '', room: '', start: last ? last.end : '08:00', end: '' }); save(); draw(); });
  $('#ttLoad').addEventListener('click', function () {
    var id = $('#ttPreset').value; if (!id || !SP) { T.toast('Choose a school first.'); return; }
    var rows = SP.rowsFor(id);
    if (!rows.length) { T.toast('That preset has no periods.'); return; }
    var ab = rows.some(function (r) { return /^[AB] Day$/.test(r.days || ''); });
    st.rows = rows.map(function (r) { return { day: ab ? (r.days || '').charAt(0) : 'every', label: ab ? String(r.period) : (r.periodLabel || String(r.period)), name: '', room: '', start: r.timeStart, end: r.timeEnd }; });
    $('#ttPattern').value = ab ? 'ab' : 'every'; st.pattern = $('#ttPattern').value;
    save(); draw(); T.toast('Periods filled in — add your class names.');
  });
  ['#ttPattern', '#ttStart', '#ttEnd', '#ttFirst', '#ttOff'].forEach(function (s) {
    $(s).addEventListener('change', function () { st.pattern = $('#ttPattern').value; st.start = $('#ttStart').value; st.end = $('#ttEnd').value; st.first = $('#ttFirst').value; st.off = $('#ttOff').value; save(); draw(); });
  });

  function offDays(text) {
    var set = {};
    text.split(/\n+/).forEach(function (l) {
      var m = l.trim().match(/^(\d{4}-\d{2}-\d{2})(?:\s*(?:to|–|-{1,2})\s*(\d{4}-\d{2}-\d{2}))?$/);
      if (!m) return;
      for (var d = parse(m[1]), e = parse(m[2] || m[1]); d && e && d <= e; d.setDate(d.getDate() + 1)) set[ymd(d)] = true;
    });
    return set;
  }
  function icsEsc(s) { return String(s).replace(/[\\;,]/g, '\\$&').replace(/\n/g, '\\n'); }
  function stamp(date, hm) { return date.replace(/-/g, '') + 'T' + hm.replace(':', '') + '00'; }
  $('#ttIcs').addEventListener('click', function () {
    var out = $('#ttOut'), start = $('#ttStart').value, end = $('#ttEnd').value;
    if (!parse(start) || !parse(end) || end < start) { out.innerHTML = '<span class="ft-err">Give the first and last day of term.</span>'; return; }
    var rows = st.rows.filter(function (r) { return /^\d\d:\d\d$/.test(r.start) && /^\d\d:\d\d$/.test(r.end) && r.end > r.start; });
    if (!rows.length) { out.innerHTML = '<span class="ft-err">Give each period a start and an end time.</span>'; return; }
    var off = offDays($('#ttOff').value), ab = $('#ttPattern').value === 'ab';
    var now = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
    var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Flux//Timetable//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:School timetable'];
    var n = 0, schoolDays = 0, letter = $('#ttFirst').value;
    var title = function (r) { return (r.name || 'Period ' + r.label) + (ab && r.day !== 'every' ? ' (' + r.day + r.label + ')' : ''); };
    var ev = function (r, date, extra) {
      n++;
      L.push('BEGIN:VEVENT', 'UID:flux-tt-' + n + '-' + stamp(date, r.start) + '@fluxplanner', 'DTSTAMP:' + now,
        'DTSTART:' + stamp(date, r.start), 'DTEND:' + stamp(date, r.end), 'SUMMARY:' + icsEsc(title(r)));
      if (r.room) L.push('LOCATION:' + icsEsc(r.room));
      (extra || []).forEach(function (x) { L.push(x); });
      L.push('END:VEVENT');
    };
    for (var d = parse(start); ymd(d) <= end; d.setDate(d.getDate() + 1)) {
      var g = d.getDay(), day = ymd(d);
      if (g === 0 || g === 6 || off[day]) continue;
      schoolDays++;
      if (!ab) continue;
      rows.forEach(function (r) { if (r.day === 'every' || r.day === letter) ev(r, day); });
      letter = letter === 'A' ? 'B' : 'A';
    }
    if (!ab) {
      // One weekly event per period from the first school day, with the days off as exceptions.
      var first = parse(start); while (first.getDay() === 0 || first.getDay() === 6 || off[ymd(first)]) first.setDate(first.getDate() + 1);
      rows.forEach(function (r) {
        var ex = Object.keys(off).filter(function (x) { return x >= start && x <= end; }).map(function (x) { return 'EXDATE:' + stamp(x, r.start); });
        ev(r, ymd(first), ['RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;UNTIL=' + end.replace(/-/g, '') + 'T235959'].concat(ex));
      });
    }
    L.push('END:VCALENDAR');
    T.download('school-timetable.ics', L.join('\r\n') + '\r\n', 'text/calendar');
    out.innerHTML = '<span class="ft-good">Downloaded.</span> ' + schoolDays + ' school days, ' + (ab ? n + ' class events' : rows.length + ' repeating periods') + '. Open the file to add it to your calendar.';
  });
  $('#ttPattern').value = st.pattern || 'every'; $('#ttFirst').value = st.first || 'A'; $('#ttOff').value = st.off || '';
  if (st.start) $('#ttStart').value = st.start; if (st.end) $('#ttEnd').value = st.end;
  draw();
})();
