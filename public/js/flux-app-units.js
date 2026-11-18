/* Flux Units (units.html): the planner's converter tables (flux-reftool-units.js,
   window.FluxUnitConverter) with the working written out, significant figures,
   and a quiz. */
(function () {
  'use strict';
  var T = window.FluxTool, $ = T.$, U = window.FluxUnitConverter;
  var SHOW = ['length', 'mass', 'volume', 'time', 'speed', 'area', 'energy', 'pressure', 'temperature'];
  var cats = SHOW.filter(function (k) { return U.CATEGORIES[k]; });
  T.tabs($('[role="tablist"]'), 'flux_units_tab');

  var cat = $('#unCat'), from = $('#unFrom'), to = $('#unTo');
  cat.innerHTML = cats.map(function (k) { return '<option value="' + k + '">' + T.esc(U.CATEGORIES[k].label) + '</option>'; }).join('');
  function fillUnits() {
    var u = U.CATEGORIES[cat.value].units, keys = Object.keys(u);
    var opts = keys.map(function (k) { return '<option value="' + T.esc(k) + '">' + T.esc(u[k].label) + '</option>'; }).join('');
    from.innerHTML = opts; to.innerHTML = opts;
    to.value = keys[Math.min(1, keys.length - 1)];
  }
  function sym(k) { return cat.value === 'temperature' && k !== 'K' ? '°' + k : k; }
  function convert() {
    var raw = $('#unVal').value.trim(), v = Number(raw), c = U.CATEGORIES[cat.value], out = $('#unOut');
    if (!raw || !isFinite(v)) { out.innerHTML = '<span class="ft-err">Type a number to convert.</span>'; return; }
    var r = U.convert(cat.value, v, from.value, to.value);
    var sf = T.sigFigsOf(raw);
    var shown = $('#unKeepSf').checked && sf ? T.toSig(r, sf) : U.fmt(r);
    var html = '<div class="ft-big">' + T.esc(raw) + ' ' + T.esc(sym(from.value)) + ' = ' + T.esc(shown) + ' ' + T.esc(sym(to.value)) + '</div>';
    if ($('#unKeepSf').checked && sf) html += '<div class="ft-muted">' + sf + ' significant figure' + (sf === 1 ? '' : 's') + ', as in what you typed.</div>';
    if ($('#unWork').checked) {
      var steps = [];
      if (c.convert) {
        var f = from.value, t = to.value;
        var toC = { C: 'it is already in °C', F: '°C = (°F − 32) × 5 ÷ 9', K: '°C = K − 273.15', R: '°C = (°R − 491.67) × 5 ÷ 9' };
        var fromC = { C: 'the answer is in °C', F: '°F = °C × 9 ÷ 5 + 32', K: 'K = °C + 273.15', R: '°R = (°C + 273.15) × 9 ÷ 5' };
        steps.push('To Celsius: ' + toC[f] + ' → ' + U.fmt(U.convert(cat.value, v, f, 'C')) + ' °C');
        steps.push('From Celsius: ' + fromC[t] + ' → ' + U.fmt(r) + ' ' + t);
      } else {
        var fu = c.units[from.value], tu = c.units[to.value];
        steps.push('1 ' + from.value + ' = ' + U.fmt(fu.f) + ' ' + c.base + ', and 1 ' + to.value + ' = ' + U.fmt(tu.f) + ' ' + c.base + '.');
        steps.push(raw + ' ' + from.value + ' × (' + U.fmt(fu.f) + ' ' + c.base + ' / 1 ' + from.value + ') = ' + U.fmt(v * fu.f) + ' ' + c.base);
        steps.push(U.fmt(v * fu.f) + ' ' + c.base + ' × (1 ' + to.value + ' / ' + U.fmt(tu.f) + ' ' + c.base + ') = ' + U.fmt(r) + ' ' + to.value);
        steps.push('The units cancel: ' + from.value + ' over ' + from.value + ', ' + c.base + ' over ' + c.base + ', leaving ' + to.value + '.');
      }
      html += '<ol class="ft-work">' + steps.map(function (s) { return '<li>' + T.esc(s) + '</li>'; }).join('') + '</ol>';
    }
    out.innerHTML = html;
  }
  cat.addEventListener('change', function () { fillUnits(); convert(); });
  [from, to, $('#unVal'), $('#unKeepSf'), $('#unWork')].forEach(function (el) { el.addEventListener('input', convert); el.addEventListener('change', convert); });
  $('#unSwap').addEventListener('click', function () { var a = from.value; from.value = to.value; to.value = a; convert(); });
  fillUnits(); convert();

  function sigfig() {
    var raw = $('#sfNum').value.trim(), n = Number(raw), to2 = Math.max(1, Math.min(15, +$('#sfTo').value || 1)), out = $('#sfOut');
    if (!raw || !isFinite(n)) { out.innerHTML = '<span class="ft-err">Type a number.</span>'; return; }
    var sf = T.sigFigsOf(raw);
    var why = /\./.test(raw) ? 'Leading zeros never count; with a decimal point, every digit after the first non-zero one counts, trailing zeros too.'
      : 'Without a decimal point, trailing zeros are ambiguous and are not counted. Write it in standard form to show them.';
    out.innerHTML = '<div class="ft-big">' + T.esc(raw) + ' has ' + sf + ' significant figure' + (sf === 1 ? '' : 's') + '</div>'
      + '<div>Rounded to ' + to2 + ' s.f.: <strong>' + T.esc(T.toSig(n, to2)) + '</strong> (standard form ' + T.esc(n.toExponential(to2 - 1)) + ')</div>'
      + '<p class="ft-muted">' + T.esc(why) + '</p>';
  }
  $('#sfNum').addEventListener('input', sigfig); $('#sfTo').addEventListener('input', sigfig); sigfig();

  var score = T.load('flux_units_quiz', { right: 0, asked: 0 }), q = null;
  function ask() {
    var c = cats.filter(function (k) { return k !== 'temperature'; })[Math.floor(Math.random() * (cats.length - 1))];
    var keys = Object.keys(U.CATEGORIES[c].units);
    var a = keys[Math.floor(Math.random() * keys.length)], b;
    do { b = keys[Math.floor(Math.random() * keys.length)]; } while (b === a);
    var v = [1, 2, 2.5, 5, 10, 12, 25, 50, 100, 250][Math.floor(Math.random() * 10)];
    q = { c: c, a: a, b: b, v: v, ans: U.convert(c, v, a, b) };
    $('#qzQ').textContent = 'Convert ' + v + ' ' + a + ' to ' + b + '.';
    $('#qzA').value = ''; $('#qzOut').innerHTML = '';
  }
  function showScore() { $('#qzScore').textContent = score.asked ? score.right + ' right out of ' + score.asked + ' on this device.' : ''; }
  $('#qzForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var given = Number($('#qzA').value.replace(/,/g, ''));
    if (!isFinite(given) || $('#qzA').value.trim() === '') { $('#qzOut').innerHTML = '<span class="ft-err">Type a number first.</span>'; return; }
    var ok = Math.abs(given - q.ans) <= Math.abs(q.ans) * 0.01;
    score.asked++; if (ok) score.right++; T.save('flux_units_quiz', score); showScore();
    $('#qzOut').innerHTML = ok ? '<span class="ft-good">Right.</span> ' + T.esc(U.fmt(q.ans) + ' ' + q.b)
      : '<span class="ft-err">Not quite.</span> ' + T.esc(q.v + ' ' + q.a + ' = ' + U.fmt(q.ans) + ' ' + q.b) + '. Multiply by how many base units are in one ' + T.esc(q.a) + ', then divide by how many are in one ' + T.esc(q.b) + '.';
  });
  $('#qzNext').addEventListener('click', ask);
  ask(); showScore();
})();
