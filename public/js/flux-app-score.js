/* Flux Score (score.html): weighted grade, what-ifs, target and GPA. Written
   fresh rather than wrapping flux-grade-gps.js, which reads the planner's own
   classes and grades; this page keeps its numbers in localStorage only. */
(function () {
  'use strict';
  var T = window.FluxTool, $ = T.$;
  var KEY = 'flux_score_v1';
  var st = T.load(KEY, null) || {
    cats: [{ name: 'Tests', w: 50 }, { name: 'Homework', w: 30 }, { name: 'Labs', w: 20 }],
    rows: [], gpa: [{ name: '', g: '', lvl: 'reg', cr: 1 }],
  };
  var save = function () { T.save(KEY, st); };
  T.tabs($('[role="tablist"]'), 'flux_score_tab');
  var num = function (v) { var n = parseFloat(v); return isFinite(n) ? n : NaN; };

  /** Weighted grade from rows; categories with no marks are left out and the
      rest re-weighted, as most gradebooks do. */
  function grade(rows) {
    var tot = 0, wsum = 0, avg = {};
    st.cats.forEach(function (c, i) {
      var s = 0, m = 0;
      rows.forEach(function (r) { if (+r.cat === i && isFinite(num(r.s)) && num(r.m) > 0) { s += num(r.s); m += num(r.m); } });
      if (m > 0 && num(c.w) > 0) { avg[i] = s / m * 100; tot += avg[i] * num(c.w); wsum += num(c.w); }
    });
    return { g: wsum ? tot / wsum : NaN, avg: avg, wsum: wsum };
  }
  var opt = function (sel) { return st.cats.map(function (c, i) { return '<option value="' + i + '"' + (+sel === i ? ' selected' : '') + '>' + T.esc(c.name || 'Category ' + (i + 1)) + '</option>'; }).join(''); };
  function drawCats() {
    var g = grade(st.rows.filter(function (r) { return !r.wi; }));
    $('#scCats').innerHTML = st.cats.map(function (c, i) {
      return '<tr><td><input aria-label="Category name" data-c="' + i + '" data-k="name" value="' + T.esc(c.name) + '"></td>'
        + '<td><input aria-label="Weight of ' + T.esc(c.name) + '" data-c="' + i + '" data-k="w" inputmode="decimal" value="' + T.esc(c.w) + '"></td>'
        + '<td>' + (g.avg[i] != null ? g.avg[i].toFixed(1) + '%' : '—') + '</td>'
        + '<td><button type="button" class="ft-btn small" data-delc="' + i + '" aria-label="Remove ' + T.esc(c.name) + '">✕</button></td></tr>';
    }).join('');
    $('#tgCat').innerHTML = opt($('#tgCat').value || 0);
  }
  function drawRows() {
    $('#scRows').innerHTML = st.rows.map(function (r, i) {
      return '<tr><td><input aria-label="Assessment name" data-r="' + i + '" data-k="name" value="' + T.esc(r.name) + '"></td>'
        + '<td><select aria-label="Category" data-r="' + i + '" data-k="cat" class="ft-in" style="min-height:36px;padding:4px 8px">' + opt(r.cat) + '</select></td>'
        + '<td><input aria-label="Score" data-r="' + i + '" data-k="s" inputmode="decimal" value="' + T.esc(r.s) + '"></td>'
        + '<td><input aria-label="Out of" data-r="' + i + '" data-k="m" inputmode="decimal" value="' + T.esc(r.m) + '"></td>'
        + '<td><input type="checkbox" aria-label="What-if mark" data-r="' + i + '" data-k="wi"' + (r.wi ? ' checked' : '') + ' style="width:20px;min-width:0;min-height:20px"></td>'
        + '<td><button type="button" class="ft-btn small" data-delr="' + i + '" aria-label="Remove mark">✕</button></td></tr>';
    }).join('');
  }
  function totals() {
    var real = grade(st.rows.filter(function (r) { return !r.wi; })), wi = grade(st.rows);
    var hasWi = st.rows.some(function (r) { return r.wi; });
    var wsum = st.cats.reduce(function (a, c) { return a + (num(c.w) || 0); }, 0);
    $('#scOut').innerHTML = isFinite(real.g) || isFinite(wi.g)
      ? '<div class="ft-big" id="scGrade">' + (isFinite(real.g) ? real.g.toFixed(2) + '%' : '—') + '</div>'
        + (hasWi ? '<div>With your what-if marks: <strong id="scWhatIf">' + (isFinite(wi.g) ? wi.g.toFixed(2) + '%' : '—') + '</strong></div>' : '')
        + (Math.abs(wsum - 100) > 0.01 ? '<p class="ft-muted">The weights add up to ' + T.fmt(wsum) + '%, not 100%. Each category counts in proportion to its weight.</p>' : '')
      : '<span class="ft-muted">Add a mark to see the grade.</span>';
    // Target: the score on one more assessment that brings the grade to the goal.
    var goal = num($('#tgGoal').value), cat = +$('#tgCat').value, max = num($('#tgMax').value), out = $('#tgOut');
    if (!(goal > 0) || !(max > 0) || !st.cats[cat]) { out.innerHTML = ''; return; }
    var withS = function (s) { return grade(st.rows.concat([{ cat: cat, s: s, m: max }])).g; };
    var lo = 0, hi = max * 3;
    if (withS(hi) < goal) { out.innerHTML = '<span class="ft-err">Even ' + T.fmt(hi) + ' out of ' + T.fmt(max) + ' would not reach ' + T.fmt(goal) + '%.</span>'; return; }
    if (withS(0) >= goal) { out.innerHTML = '<span class="ft-good">You stay at or above ' + T.fmt(goal) + '% even with a zero.</span>'; return; }
    for (var k = 0; k < 60; k++) { var mid = (lo + hi) / 2; if (withS(mid) >= goal) hi = mid; else lo = mid; }
    out.innerHTML = '<div class="ft-big">You need ' + (Math.ceil(hi * 10) / 10) + ' out of ' + T.fmt(max) + '</div><div class="ft-muted">That is ' + (hi / max * 100).toFixed(1) + '% on the next ' + T.esc(st.cats[cat].name) + ' assessment.' + (hi > max ? ' More than full marks: it would take extra credit.' : '') + '</div>';
  }
  function drawClass() { drawCats(); drawRows(); totals(); }

  /* GPA */
  var LETTERS = [['A+', 97, 4.0], ['A', 93, 4.0], ['A-', 90, 3.7], ['B+', 87, 3.3], ['B', 83, 3.0], ['B-', 80, 2.7], ['C+', 77, 2.3], ['C', 73, 2.0], ['C-', 70, 1.7], ['D+', 67, 1.3], ['D', 65, 1.0], ['F', 0, 0]];
  function points(g, lvl, scale) {
    if (scale === 'ib') { var n = Math.round(num(g)); return n >= 1 && n <= 7 ? n : NaN; }
    var s = String(g).trim().toUpperCase(), base = NaN;
    var L = LETTERS.filter(function (x) { return x[0] === s; })[0];
    if (L) base = L[2];
    else if (isFinite(num(s))) base = LETTERS.filter(function (x) { return num(s) >= x[1]; })[0][2];
    if (!isFinite(base)) return NaN;
    if (scale === 'w5' && base > 0) base += lvl === 'hon' ? 0.5 : lvl === 'ap' ? 1 : 0;
    return base;
  }
  function drawGpa() {
    var scale = $('#gpScale').value;
    st.gpaScale = scale;
    $('#gpGradeH').textContent = scale === 'ib' ? 'IB grade (1–7)' : 'Grade % or letter';
    var tot = 0, cr = 0;
    $('#gpRows').innerHTML = st.gpa.map(function (c, i) {
      var p = points(c.g, c.lvl, scale);
      if (isFinite(p) && num(c.cr) > 0) { tot += p * num(c.cr); cr += num(c.cr); }
      return '<tr><td><input aria-label="Course name" data-g="' + i + '" data-k="name" value="' + T.esc(c.name) + '"></td>'
        + '<td><input aria-label="Grade" data-g="' + i + '" data-k="g" value="' + T.esc(c.g) + '"></td>'
        + '<td><select aria-label="Level" data-g="' + i + '" data-k="lvl" class="ft-in" style="min-height:36px;padding:4px 8px">'
        + [['reg', 'Regular'], ['hon', 'Honors'], ['ap', 'AP / IB']].map(function (o) { return '<option value="' + o[0] + '"' + (c.lvl === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></td>'
        + '<td><input aria-label="Credits" data-g="' + i + '" data-k="cr" inputmode="decimal" value="' + T.esc(c.cr) + '" style="min-width:56px"></td>'
        + '<td>' + (isFinite(p) ? p.toFixed(1) : '—') + '</td>'
        + '<td><button type="button" class="ft-btn small" data-delg="' + i + '" aria-label="Remove course">✕</button></td></tr>';
    }).join('');
    $('#gpOut').innerHTML = cr ? '<div class="ft-big" id="gpValue">GPA ' + (tot / cr).toFixed(2) + (scale === 'ib' ? ' / 7' : scale === 'w5' ? ' / 5.0' : ' / 4.0') + '</div><div class="ft-muted">' + T.fmt(tot) + ' points ÷ ' + T.fmt(cr) + ' credits.</div>' : '<span class="ft-muted">Add a grade to see the GPA.</span>';
  }

  document.addEventListener('change', function (e) {
    var t = e.target, k = t.getAttribute('data-k'); if (!k) return;
    var v = t.type === 'checkbox' ? t.checked : t.value;
    if (t.hasAttribute('data-c')) st.cats[+t.getAttribute('data-c')][k] = v;
    else if (t.hasAttribute('data-r')) st.rows[+t.getAttribute('data-r')][k] = v;
    else if (t.hasAttribute('data-g')) st.gpa[+t.getAttribute('data-g')][k] = v;
    save();
    if (t.hasAttribute('data-g')) drawGpa(); else { if (t.hasAttribute('data-c')) drawCats(); totals(); }
  });
  document.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-delc')) { var i = +b.getAttribute('data-delc'); st.cats.splice(i, 1); st.rows = st.rows.filter(function (r) { return +r.cat !== i; }).map(function (r) { if (+r.cat > i) r.cat = +r.cat - 1; return r; }); }
    else if (b.hasAttribute('data-delr')) st.rows.splice(+b.getAttribute('data-delr'), 1);
    else if (b.hasAttribute('data-delg')) st.gpa.splice(+b.getAttribute('data-delg'), 1);
    else if (b.id === 'scAddCat') st.cats.push({ name: 'New category', w: 10 });
    else if (b.id === 'scAddRow') st.rows.push({ name: '', cat: 0, s: '', m: 100, wi: false });
    else if (b.id === 'gpAdd') st.gpa.push({ name: '', g: '', lvl: 'reg', cr: 1 });
    else return;
    save(); drawClass(); drawGpa();
  });
  ['#tgGoal', '#tgCat', '#tgMax'].forEach(function (s) { $(s).addEventListener('input', totals); $(s).addEventListener('change', totals); });
  $('#gpScale').addEventListener('change', function () { save(); drawGpa(); });
  if (st.gpaScale) $('#gpScale').value = st.gpaScale;
  if (!st.rows.length) st.rows.push({ name: '', cat: 0, s: '', m: 100, wi: false });
  drawClass(); drawGpa();
})();
