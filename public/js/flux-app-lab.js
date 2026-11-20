/* Flux Lab (lab.html). Uncertainty: any formula of the student's measurements,
   propagated two ways with the working — the textbook rule (fractional
   uncertainties add, the same as summing |∂f/∂x|·Δx) and the quadrature
   estimate. Report: a skeleton for the IB DP internal assessment or MYP
   Sciences B and C, with each criterion's checklist. Saved on this device. */
(function () {
  'use strict';
  var T = window.FluxTool, $ = T.$;
  var st = T.load('flux_lab_v1', { vals: {}, rep: {}, kind: 'dp', title: '' });
  var save = function () { T.save('flux_lab_v1', st); };
  T.tabs($('[role="tablist"]'), 'flux_lab_tab');
  var f = function (v) { return isFinite(v) ? String(+v.toPrecision(4)) : '—'; };
  var lastWork = '';

  function unc() {
    var out = $('#lbOut'), c;
    st.expr = $('#lbExpr').value; save();
    try { c = T.compile(st.expr); } catch (e) { $('#lbVars').innerHTML = ''; out.innerHTML = '<span class="ft-err">' + T.esc(e.message) + '</span>'; return; }
    var have = [].slice.call($('#lbVars').querySelectorAll('tr')).map(function (r) { return r.getAttribute('data-v'); });
    if (have.join() !== c.vars.join()) {
      $('#lbVars').innerHTML = c.vars.map(function (v) {
        var s = st.vals[v] || {};
        return '<tr data-v="' + T.esc(v) + '"><th scope="row">' + T.esc(v) + '</th><td><input aria-label="Value of ' + T.esc(v) + '" data-k="x" inputmode="decimal" value="' + T.esc(s.x == null ? '' : s.x) + '"></td>'
          + '<td><input aria-label="Uncertainty in ' + T.esc(v) + '" data-k="d" inputmode="decimal" value="' + T.esc(s.d == null ? '' : s.d) + '"></td><td class="lb-pct"></td></tr>';
      }).join('');
    }
    var scope = {}, d = {}, missing = [];
    [].slice.call($('#lbVars').querySelectorAll('tr')).forEach(function (r) {
      var v = r.getAttribute('data-v'), x = r.querySelector('[data-k="x"]').value.trim(), dx = r.querySelector('[data-k="d"]').value.trim();
      st.vals[v] = { x: x, d: dx };
      if (x === '' || !isFinite(+x)) missing.push(v); else scope[v] = +x;
      d[v] = Math.abs(+dx) || 0;
      r.querySelector('.lb-pct').textContent = isFinite(+x) && +x ? f(d[v] / Math.abs(+x) * 100) + '%' : '—';
    });
    save();
    if (missing.length) { out.innerHTML = '<span class="ft-muted">Give a value for ' + T.esc(missing.join(', ')) + '.</span>'; return; }
    var y;
    try { y = c.fn(scope); } catch (e) { out.innerHTML = '<span class="ft-err">' + T.esc(e.message) + '</span>'; return; }
    if (!isFinite(y)) { out.innerHTML = '<span class="ft-err">The formula gives no number with these values.</span>'; return; }
    var parts = c.vars.map(function (v) {
      var h = Math.abs(scope[v]) * 1e-6 || 1e-6, a = Object.assign({}, scope), b = Object.assign({}, scope);
      a[v] += h; b[v] -= h;
      var dfdx = (c.fn(a) - c.fn(b)) / (2 * h);
      return { v: v, dfdx: dfdx, contrib: Math.abs(dfdx) * d[v], pct: scope[v] ? d[v] / Math.abs(scope[v]) * 100 : 0 };
    });
    var lin = parts.reduce(function (s, p) { return s + p.contrib; }, 0), quad = Math.sqrt(parts.reduce(function (s, p) { return s + p.contrib * p.contrib; }, 0));
    var pctLin = y ? lin / Math.abs(y) * 100 : NaN;
    // Report to one significant figure of uncertainty, the value to the same place.
    // Half up, with a whisker for floating point: 0.15 is 0.1499999… in binary.
    var place = lin > 0 ? Math.floor(Math.log10(lin)) : 0;
    var r1 = lin > 0 ? Math.round(lin / Math.pow(10, place) * (1 + 1e-7)) * Math.pow(10, place) : 0;
    if (r1 > 0 && Math.floor(Math.log10(r1) + 1e-9) > place) place++;
    var yRound = lin > 0 ? Math.round(y / Math.pow(10, place)) * Math.pow(10, place) : y;
    var yStr = lin > 0 ? yRound.toFixed(Math.max(0, -place)) : f(y), uStr = lin > 0 ? r1.toFixed(Math.max(0, -place)) : '0';
    var steps = parts.map(function (p) {
      return p.v + ': ' + f(scope[p.v]) + ' ± ' + f(d[p.v]) + ' (' + f(p.pct) + '%); it moves the answer by |∂/∂' + p.v + '| × Δ' + p.v + ' = ' + f(Math.abs(p.dfdx)) + ' × ' + f(d[p.v]) + ' = ' + f(p.contrib);
    });
    steps.push('Add them (the textbook rule; for × and ÷ it is the same as adding percentages): Δ = ' + parts.map(function (p) { return f(p.contrib); }).join(' + ') + ' = ' + f(lin) + ' (' + f(pctLin) + '%)');
    steps.push('Round the uncertainty to one significant figure (' + uStr + ') and the value to the same decimal place.');
    lastWork = 'Result = ' + st.expr + ' = ' + yStr + ' ± ' + uStr + '\n' + steps.join('\n');
    out.innerHTML = '<div class="ft-big" id="lbResult">' + T.esc(yStr) + ' ± ' + T.esc(uStr) + '</div><div class="ft-muted">' + f(y) + ' ± ' + f(lin) + ' (' + f(pctLin) + '%). Quadrature, if your course uses it: ± ' + f(quad) + '.</div>'
      + '<ol class="ft-work">' + steps.map(function (s) { return '<li>' + T.esc(s) + '</li>'; }).join('') + '</ol>';
  }
  $('#lbExpr').addEventListener('input', unc);
  $('#lbVars').addEventListener('input', unc);
  $('#lbCopy').addEventListener('click', function () { T.copy(lastWork || 'Nothing worked out yet.'); });
  if (st.expr) $('#lbExpr').value = st.expr;

  /* The report skeleton. Criteria wording is a paraphrase for students, not
     the official descriptors; the teacher's copy is the authority. */
  var KINDS = {
    dp: [
      ['Research design', ['A focused research question with the independent and dependent variables and their units', 'Background science that explains the expected relationship', 'Controlled variables, why each matters and how it is kept constant', 'A method someone else could repeat, with enough data (range and repeats)', 'Safety, ethical and environmental points']],
      ['Data analysis', ['Raw data in a table with units and uncertainties', 'Processing shown with a worked example', 'Uncertainties carried through the processing', 'A suitable graph: labelled axes, error bars, line of best fit']],
      ['Conclusion', ['Answers the research question using the processed data', 'Compares with accepted science or values (percentage error where it applies)', 'Says how far the uncertainties limit the conclusion']],
      ['Evaluation', ['Strengths and weaknesses of the method, random and systematic errors', 'How each weakness affected the results', 'Realistic, specific improvements and extensions']],
    ],
    myp: [
      ['Criterion B: Inquiring and designing', ['A problem or question to test', 'A testable hypothesis explained with science', 'How you will change, measure and control the variables', 'A safe, logical method with enough data']],
      ['Criterion C: Processing and evaluating', ['Data collected, organised and shown in tables and graphs', 'Data interpreted, with a conclusion based on science', 'How valid the hypothesis was, based on the results', 'How valid the method was', 'Improvements or extensions to the method']],
    ],
    plain: [
      ['Aim', ['What the experiment finds out']], ['Hypothesis', ['What you expect and why']], ['Method', ['Equipment', 'Steps', 'Variables']],
      ['Results', ['Table with units', 'Graph']], ['Analysis', ['Calculations with uncertainties']], ['Conclusion', ['Answer to the aim']], ['Evaluation', ['Errors and improvements']],
    ],
  };
  function report() {
    st.kind = $('#rpKind').value; st.title = $('#rpTitle').value; save();
    // The select's value is DOM text: only a known kind is used.
    if (!KINDS[st.kind]) st.kind = 'dp';
    var secs = KINDS[st.kind];
    $('#rpBody').innerHTML = secs.map(function (s, i) {
      var id = st.kind + i, r = st.rep[id] || { text: '', done: [] };
      var done = Array.isArray(r.done) ? r.done : [];
      return '<section class="ft-card" style="background:transparent"><h2>' + T.esc(s[0]) + '</h2><ul class="ft-list ft-noprint">'
        + s[1].map(function (c, j) { return '<li><label class="ft-check"><input type="checkbox" data-sec="' + T.esc(id) + '" data-c="' + j + '"' + (done.indexOf(j) >= 0 ? ' checked' : '') + '> ' + T.esc(c) + '</label></li>'; }).join('')
        + '</ul><label class="ft-field">Your ' + T.esc(s[0].replace(/^Criterion \w: /, '').toLowerCase()) + '<textarea class="ft-in" data-text="' + T.esc(id) + '" rows="5" style="font-family:inherit">' + T.esc(r.text) + '</textarea></label></section>';
    }).join('');
  }
  $('#rpBody').addEventListener('input', function (e) {
    var t = e.target, id = t.getAttribute('data-text') || t.getAttribute('data-sec'); if (!id) return;
    var r = st.rep[id] = st.rep[id] || { text: '', done: [] };
    if (t.hasAttribute('data-text')) r.text = t.value;
    else { var j = +t.getAttribute('data-c'); r.done = r.done.filter(function (x) { return x !== j; }); if (t.checked) r.done.push(j); }
    save();
  });
  $('#rpKind').addEventListener('change', report); $('#rpTitle').addEventListener('input', function () { st.title = this.value; save(); });
  function asText() {
    return (st.title ? st.title + '\n' + st.title.replace(/./g, '=') + '\n\n' : '') + KINDS[st.kind].map(function (s, i) {
      var r = st.rep[st.kind + i] || { text: '' };
      return s[0] + '\n' + s[0].replace(/./g, '-') + '\n' + (r.text || '') + '\n';
    }).join('\n');
  }
  $('#rpTxt').addEventListener('click', function () { T.download((st.title || 'lab-report').replace(/[^\w -]/g, '').trim().replace(/\s+/g, '-').toLowerCase() + '.txt', asText()); });
  $('#rpPrint').addEventListener('click', function () { window.print(); });
  $('#rpTable').addEventListener('click', function () {
    var rows = [];
    [].slice.call($('#lbVars').querySelectorAll('tr')).forEach(function (r) { rows.push([r.getAttribute('data-v'), r.querySelector('[data-k="x"]').value, r.querySelector('[data-k="d"]').value].join('\t')); });
    T.copy(['Quantity\tValue\tUncertainty'].concat(rows).join('\n'), 'Table copied — paste it into the grapher');
  });
  $('#rpKind').value = st.kind; $('#rpTitle').value = st.title || '';
  report(); unc();
})();
