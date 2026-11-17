/* Flux Plan (plan.html): the planner's own pure scheduler (flux-task-plan.js,
   tested in test/unit) for several assignments at once. Assignments are
   planned in due-date order, each one seeing the minutes the earlier ones
   already took, so the daily limit holds across all of them; whatever cannot
   fit inside it is listed rather than quietly piled on. */
(function () {
  'use strict';
  var T = window.FluxTool, $ = T.$, P = window.FluxTaskPlan;
  var KEY = 'flux_plan_v1';
  var st = T.load(KEY, { tasks: [], max: 90, weekends: false });
  var pad = function (n) { return n < 10 ? '0' + n : String(n); };
  var ymd = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  var today = ymd(new Date());
  var nice = function (s) { var d = new Date(s + 'T12:00:00'); return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }); };
  $('#plMax').value = st.max; $('#plWeekends').checked = !!st.weekends; $('#plStart').value = today;
  $('#plDue').value = P.addDays(today, 7);
  var last = null;

  function compute() {
    var start = $('#plStart').value || today, max = Math.max(15, +$('#plMax').value || 90), noWeekends = $('#plWeekends').checked;
    var used = {}, sessions = [], miss = [];
    var tasks = st.tasks.slice().sort(function (a, b) { return a.due < b.due ? -1 : 1; });
    tasks.forEach(function (t) {
      if (t.due < start) { miss.push({ t: t, why: 'It was due before ' + nice(start) + '.' }); return; }
      var r = P.plan({
        totalMin: t.min, start: start, due: t.due, maxPerDay: max,
        skip: function (d) { var g = new Date(d + 'T12:00:00').getDay(); return noWeekends && (g === 0 || g === 6); },
        busy: function (d) { return used[d] || 0; },
        steps: P.stepsFor(t.type, t.steps),
      });
      if (!r.sessions.length) { miss.push({ t: t, why: 'There are no days to work on it before it is due.' }); return; }
      var over = r.sessions.filter(function (s) { return (used[s.date] || 0) + s.minutes > max; });
      if (r.tight || over.length) {
        var fit = r.sessions.reduce(function (a, s) { return a + Math.max(0, Math.min(s.minutes, max - (used[s.date] || 0))); }, 0);
        miss.push({ t: t, why: 'It needs ' + t.min + ' minutes, but only about ' + fit + ' fit under ' + max + ' a day before ' + nice(t.due) + '. Start earlier, raise the limit, or ask for more time.' });
      }
      r.sessions.forEach(function (s) { used[s.date] = (used[s.date] || 0) + s.minutes; sessions.push({ date: s.date, minutes: s.minutes, label: s.label, task: t.name, part: s.part, of: s.of }); });
    });
    sessions.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    return { sessions: sessions, miss: miss, used: used, max: max, noWeekends: noWeekends };
  }

  function draw() {
    st.max = +$('#plMax').value || 90; st.weekends = $('#plWeekends').checked; T.save(KEY, st);
    $('#plTasks').innerHTML = st.tasks.length ? st.tasks.map(function (t, i) {
      return '<li class="ft-row" style="justify-content:space-between;align-items:center"><span><strong>' + T.esc(t.name) + '</strong> <span class="ft-muted">due ' + T.esc(nice(t.due)) + ' · ' + T.fmt(t.min / 60) + ' h</span></span>'
        + '<button type="button" class="ft-btn small" data-del="' + i + '" aria-label="Remove ' + T.esc(t.name) + '">Remove</button></li>';
    }).join('') : '<li class="ft-muted">Nothing added yet.</li>';
    var r = last = compute(), days = {};
    r.sessions.forEach(function (s) { (days[s.date] = days[s.date] || []).push(s); });
    $('#plOut').innerHTML = Object.keys(days).map(function (d) {
      var tot = days[d].reduce(function (a, s) { return a + s.minutes; }, 0);
      return '<h3>' + T.esc(nice(d)) + ' <span class="ft-muted">· ' + tot + ' min</span></h3><ul class="ft-list">' + days[d].map(function (s) {
        return '<li><strong>' + T.esc(s.task) + '</strong>: ' + T.esc(s.label) + ' <span class="ft-muted">(' + s.minutes + ' min, part ' + s.part + ' of ' + s.of + ')</span></li>';
      }).join('') + '</ul>';
    }).join('') || '<p class="ft-muted">Add an assignment to see the plan.</p>';
    $('#plMiss').innerHTML = r.miss.length ? '<div class="ft-out" style="border-color:var(--warn)"><strong>Doesn’t fit</strong><ul class="ft-work">' + r.miss.map(function (m) { return '<li><strong>' + T.esc(m.t.name) + '</strong>: ' + T.esc(m.why) + '</li>'; }).join('') + '</ul></div>' : '';
    $('#plWhy').innerHTML = [
      'Work ends the day before each deadline, so the due day is spare for fixing last things (unless it is due today or tomorrow).',
      'Sessions are spread across the days rather than piled at the end, at least 20 minutes each.',
      'Earlier deadlines are planned first; later ones use what is left of each day under your limit of ' + r.max + ' minutes.',
      r.noWeekends ? 'Weekends are kept free, unless there is no other day.' : 'Weekends count as working days. Tick “Keep weekends free” to change that.',
      'Each session is named after the step of the work it covers.',
    ].map(function (x) { return '<li>' + T.esc(x) + '</li>'; }).join('');
  }

  $('#plForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var name = $('#plName').value.trim(), due = $('#plDue').value, h = parseFloat($('#plHours').value);
    if (!name) { T.toast('Give it a name.'); $('#plName').focus(); return; }
    if (!due) { T.toast('Pick the due date.'); return; }
    var min = h > 0 ? Math.round(h * 60) : P.defaultMinutes($('#plType').value);
    st.tasks.push({ name: name, type: $('#plType').value, due: due, min: min, steps: $('#plSteps').value.split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean) });
    $('#plName').value = ''; $('#plHours').value = ''; $('#plSteps').value = '';
    draw();
  });
  $('#plTasks').addEventListener('click', function (e) { var b = e.target.closest('[data-del]'); if (b) { st.tasks.splice(+b.getAttribute('data-del'), 1); draw(); } });
  ['#plMax', '#plWeekends', '#plStart'].forEach(function (s) { $(s).addEventListener('change', draw); });
  $('#plCopy').addEventListener('click', function () {
    T.copy(last.sessions.map(function (s) { return nice(s.date) + ' — ' + s.task + ': ' + s.label + ' (' + s.minutes + ' min)'; }).join('\n') || 'No plan yet.');
  });
  $('#plIcs').addEventListener('click', function () {
    var esc = function (s) { return String(s).replace(/[\;,]/g, '\\$&').replace(/\n/g, '\\n'); };
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Flux//Plan//EN'];
    last.sessions.forEach(function (s, i) {
      var d = s.date.replace(/-/g, '');
      lines.push('BEGIN:VEVENT', 'UID:flux-plan-' + d + '-' + i + '@fluxplanner', 'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z',
        'DTSTART;VALUE=DATE:' + d, 'SUMMARY:' + esc(s.task + ': ' + s.label + ' (' + s.minutes + ' min)'), 'END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    T.download('flux-plan.ics', lines.join('\r\n') + '\r\n', 'text/calendar');
  });
  draw();
})();
