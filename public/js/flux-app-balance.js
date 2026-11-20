/* Flux Balance (balance.html): the periodic table's own chemistry engine
   (flux-chem.js, fed the element masses from flux-periodic.js) on a page of
   its own. This file only lays out the answers and the working. */
(function () {
  'use strict';
  var T = window.FluxTool, $ = T.$, C = window.FluxChem;
  if (window.fluxPeriodic && window.fluxPeriodic.ELEMENTS) C.useElements(window.fluxPeriodic.ELEMENTS);
  T.tabs($('[role="tablist"]'), 'flux_balance_tab');
  var f2 = function (n) { return (Math.round(n * 100) / 100).toFixed(2); };
  var err = function (out, e) { out.innerHTML = '<span class="ft-err">' + T.esc(e && e.message ? e.message : String(e)) + '</span>'; };
  var tidy = function (s) { try { return C.pretty(s); } catch (e) { return s; } };

  $('#eqForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var out = $('#eqOut');
    try {
      var r = C.balance($('#eqIn').value);
      out.innerHTML = '<div class="ft-big">' + T.esc(r.text) + '</div>'
        + (r.type ? '<p class="ft-muted">' + T.esc(r.type) + '</p>' : '')
        + (r.givenCorrect === false ? '<p class="ft-err">The numbers you typed did not balance; these do.</p>' : r.givenCorrect ? '<p class="ft-good">Your numbers were already right.</p>' : '')
        + '<h3>The check</h3><div class="ft-table-wrap"><table class="ft-table"><thead><tr><th scope="col">Atom</th><th scope="col">Left</th><th scope="col">Right</th></tr></thead><tbody>'
        + r.check.map(function (c) { return '<tr><td>' + T.esc(c.e) + '</td><td>' + c.left + '</td><td>' + c.right + '</td></tr>'; }).join('')
        + '</tbody></table></div>';
    } catch (x) { err(out, x); }
  });

  $('#mmForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var out = $('#mmOut');
    try {
      var r = C.molarMass($('#mmIn').value);
      out.innerHTML = '<div class="ft-big">M(' + T.esc(tidy($('#mmIn').value)) + ') = ' + f2(r.total) + ' g/mol</div>'
        + '<div class="ft-table-wrap"><table class="ft-table"><thead><tr><th scope="col">Element</th><th scope="col">Atoms</th><th scope="col">Aᵣ</th><th scope="col">Mass</th><th scope="col">% by mass</th></tr></thead><tbody>'
        + r.parts.map(function (p) { return '<tr><td>' + T.esc(p.s) + '</td><td>' + p.n + '</td><td>' + p.ar + '</td><td>' + p.n + ' × ' + p.ar + ' = ' + f2(p.mass) + '</td><td>' + p.pct.toFixed(1) + '%</td></tr>'; }).join('')
        + '</tbody></table></div><p class="ft-muted">Add the masses: ' + r.parts.map(function (p) { return f2(p.mass); }).join(' + ') + ' = ' + f2(r.total) + ' g/mol.</p>';
    } catch (x) { err(out, x); }
  });

  $('#empForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var out = $('#empOut');
    try {
      var rows = $('#empIn').value.split(/\n+/).map(function (l) { var m = l.trim().match(/^([A-Z][a-z]?)\s*[:=]?\s*([\d.]+)\s*%?$/); return m ? { s: m[1], v: +m[2] } : null; }).filter(Boolean);
      if (!rows.length) throw new Error('Write one element per line, like “C 40.0”.');
      var M = parseFloat($('#empM').value);
      var r = C.empirical(rows, M > 0 ? { M: M } : null);
      out.innerHTML = '<div class="ft-big">Empirical formula: ' + T.esc(r.pretty) + '</div>'
        + (r.molecular ? '<div class="ft-big">Molecular formula: ' + T.esc(r.molecular.pretty) + '</div><p class="ft-muted">' + f2(M) + ' ÷ ' + f2(r.M) + ' = ' + r.molecular.n + ' empirical units.</p>' : '')
        + '<div class="ft-table-wrap"><table class="ft-table"><thead><tr><th scope="col">Element</th><th scope="col">Mass</th><th scope="col">÷ Aᵣ = mol</th><th scope="col">÷ smallest</th><th scope="col">Whole</th></tr></thead><tbody>'
        + r.steps.map(function (s) { return '<tr><td>' + T.esc(s.s) + '</td><td>' + s.v + '</td><td>' + s.v + ' ÷ ' + s.ar + ' = ' + s.mol.toFixed(3) + '</td><td>' + s.ratio.toFixed(2) + (r.multiplier > 1 ? ' × ' + r.multiplier : '') + '</td><td>' + s.whole + '</td></tr>'; }).join('')
        + '</tbody></table></div>';
    } catch (x) { err(out, x); }
  });

  var limEq = null;
  function loadLim() {
    var out = $('#limOut');
    try {
      limEq = C.balance($('#limIn').value);
      $('#limMasses').innerHTML = limEq.left.map(function (s, i) {
        return '<label class="ft-field">Mass of ' + T.esc(tidy(s.text)) + ' (g)<input type="text" inputmode="decimal" data-i="' + i + '"></label>';
      }).join('');
      out.innerHTML = '<div>Balanced: <strong>' + T.esc(limEq.text) + '</strong></div>';
    } catch (x) { limEq = null; $('#limMasses').innerHTML = ''; err(out, x); }
  }
  $('#limLoad').addEventListener('click', loadLim);
  $('#limForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var out = $('#limOut');
    if (!limEq) loadLim();
    if (!limEq) return;
    try {
      var rows = limEq.left.map(function (s, i) {
        var m = parseFloat(($('#limMasses [data-i="' + i + '"]') || {}).value);
        if (!(m > 0)) throw new Error('Give a mass for ' + tidy(s.text) + '.');
        var M = C.molarMass(s.text).total, n = m / M;
        return { s: s, m: m, M: M, n: n, per: n / s.coef };
      });
      var lim = rows.reduce(function (a, b) { return b.per < a.per ? b : a; });
      var html = '<div class="ft-big">Limiting reagent: ' + T.esc(tidy(lim.s.text)) + '</div><ol class="ft-work">'
        + rows.map(function (r) { return '<li>' + T.esc(tidy(r.s.text)) + ': ' + r.m + ' g ÷ ' + f2(r.M) + ' g/mol = ' + r.n.toFixed(4) + ' mol; ÷ ' + r.s.coef + ' (its number in the equation) = ' + r.per.toFixed(4) + '</li>'; }).join('')
        + '<li>The smallest is ' + T.esc(tidy(lim.s.text)) + ', so it runs out first.</li></ol><h3>Theoretical yield</h3><ul class="ft-work">'
        + limEq.right.map(function (p) {
          var Mp = C.molarMass(p.text).total, n = lim.per * p.coef;
          return '<li>' + T.esc(tidy(p.text)) + ': ' + lim.per.toFixed(4) + ' × ' + p.coef + ' = ' + n.toFixed(4) + ' mol × ' + f2(Mp) + ' g/mol = <strong>' + f2(n * Mp) + ' g</strong></li>';
        }).join('') + '</ul>';
      rows.filter(function (r) { return r !== lim; }).forEach(function (r) {
        var used = lim.per * r.s.coef * r.M;
        html += '<p class="ft-muted">' + T.esc(tidy(r.s.text)) + ' left over: ' + r.m + ' − ' + f2(used) + ' = ' + f2(r.m - used) + ' g</p>';
      });
      out.innerHTML = html;
    } catch (x) { err(out, x); }
  });
  loadLim();
  $('#eqForm').dispatchEvent(new Event('submit', { cancelable: true }));
})();
