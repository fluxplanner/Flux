/* Flux Data (data.html): statistics first. The grapher fits curves to lab
   data; this page answers "what are the numbers" — summary statistics,
   least-squares regression with residuals, and chi-squared with its p-value. */
(function () {
  'use strict';
  var T = window.FluxTool, $ = T.$;
  T.tabs($('[role="tablist"]'), 'flux_data_tab');
  var data = { head: [], cols: [] };
  var saved = T.load('flux_data_v1', null);
  if (saved) $('#dtIn').value = saved;

  function parse(text) {
    var lines = text.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    if (!lines.length) return { head: [], cols: [] };
    var sep = lines[0].indexOf('\t') >= 0 ? '\t' : lines[0].indexOf(',') >= 0 ? ',' : lines[0].indexOf(';') >= 0 ? ';' : /\s+/;
    var rows = lines.map(function (l) { return l.split(sep).map(function (c) { return c.trim(); }); });
    var isNum = function (c) { return c !== '' && isFinite(Number(c)); };
    var head = rows[0].some(function (c) { return !isNum(c); }) ? rows.shift() : rows[0].map(function (_, i) { return 'Column ' + (i + 1); });
    var n = head.length;
    var cols = head.map(function (_, i) { return rows.map(function (r) { return isNum(r[i]) ? Number(r[i]) : NaN; }); });
    return { head: head.slice(0, n), cols: cols };
  }
  var clean = function (a) { return a.filter(function (v) { return isFinite(v); }); };
  function stats(a) {
    a = clean(a); var n = a.length; if (!n) return null;
    var s = a.slice().sort(function (x, y) { return x - y; }), mean = a.reduce(function (p, v) { return p + v; }, 0) / n;
    var ss = a.reduce(function (p, v) { return p + (v - mean) * (v - mean); }, 0);
    var q = function (p) { var i = (n - 1) * p, lo = Math.floor(i); return s[lo] + (s[Math.min(n - 1, lo + 1)] - s[lo]) * (i - lo); };
    return { n: n, mean: mean, median: q(0.5), sd: n > 1 ? Math.sqrt(ss / (n - 1)) : NaN, psd: Math.sqrt(ss / n), min: s[0], max: s[n - 1], q1: q(0.25), q3: q(0.75), sum: mean * n };
  }
  function regress(x, y) {
    var px = [], py = [];
    x.forEach(function (v, i) { if (isFinite(v) && isFinite(y[i])) { px.push(v); py.push(y[i]); } });
    var n = px.length; if (n < 2) return null;
    var mx = px.reduce(function (a, v) { return a + v; }, 0) / n, my = py.reduce(function (a, v) { return a + v; }, 0) / n;
    var sxx = 0, sxy = 0, syy = 0;
    px.forEach(function (v, i) { sxx += (v - mx) * (v - mx); sxy += (v - mx) * (py[i] - my); syy += (py[i] - my) * (py[i] - my); });
    if (!sxx) return { err: 'Every x is the same, so there is no line to fit.' };
    var m = sxy / sxx, c = my - m * mx, r = syy ? sxy / Math.sqrt(sxx * syy) : 1;
    var res = px.map(function (v, i) { return { x: v, y: py[i], fit: m * v + c, r: py[i] - (m * v + c) }; });
    var sse = res.reduce(function (a, p) { return a + p.r * p.r; }, 0);
    var se = n > 2 ? Math.sqrt(sse / (n - 2)) : NaN;
    return { n: n, m: m, c: c, r: r, r2: r * r, res: res, seM: n > 2 ? se / Math.sqrt(sxx) : NaN, seC: n > 2 ? se * Math.sqrt(1 / n + mx * mx / sxx) : NaN };
  }
  /* Upper tail of chi-squared: Q(df/2, x/2), the regularized incomplete gamma. */
  function lgamma(z) {
    var g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z);
    z -= 1; var x = c[0]; for (var i = 1; i < g + 2; i++) x += c[i] / (z + i);
    var t = z + g + 0.5; return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
  }
  function gammaQ(a, x) {
    if (x <= 0) return 1;
    if (x < a + 1) { var sum = 1 / a, del = sum, ap = a; for (var n = 0; n < 500; n++) { ap++; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-14) break; } return 1 - sum * Math.exp(-x + a * Math.log(x) - lgamma(a)); }
    var b = x + 1 - a, cc = 1e300, d = 1 / b, h = d;
    for (var i = 1; i < 500; i++) { var an = -i * (i - a); b += 2; d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300; cc = b + an / cc; if (Math.abs(cc) < 1e-300) cc = 1e-300; d = 1 / d; var del2 = d * cc; h *= del2; if (Math.abs(del2 - 1) < 1e-14) break; }
    return Math.exp(-x + a * Math.log(x) - lgamma(a)) * h;
  }
  var f = function (v, d) { return isFinite(v) ? T.fmt(+v.toPrecision(d || 5)) : '—'; };

  function opts(sel, def) {
    var keep = sel.value;
    sel.innerHTML = data.head.map(function (h, i) { return '<option value="' + i + '">' + T.esc(h) + '</option>'; }).join('');
    sel.value = keep !== '' && +keep < data.head.length ? keep : String(Math.min(def, data.head.length - 1));
  }
  function summary() {
    var rows = data.head.map(function (h, i) { return { h: h, s: stats(data.cols[i]) }; }).filter(function (r) { return r.s; });
    var K = [['n', 'n'], ['mean', 'Mean'], ['median', 'Median'], ['sd', 'SD (sample)'], ['psd', 'SD (population)'], ['min', 'Min'], ['q1', 'Q1'], ['q3', 'Q3'], ['max', 'Max'], ['sum', 'Sum']];
    $('#dtSum').innerHTML = rows.length ? '<table class="ft-table"><thead><tr><th scope="col">Column</th>' + K.map(function (k) { return '<th scope="col">' + k[1] + '</th>'; }).join('') + '</tr></thead><tbody>'
      + rows.map(function (r) { return '<tr><th scope="row">' + T.esc(r.h) + '</th>' + K.map(function (k) { return '<td>' + f(r.s[k[0]]) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>'
      : '<p class="ft-muted">No numbers found yet.</p>';
    return { K: K, rows: rows };
  }
  var lastReg = null;
  function regression() {
    var xi = +$('#dtX').value, yi = +$('#dtY').value, r = lastReg = data.cols.length ? regress(data.cols[xi] || [], data.cols[yi] || []) : null;
    var out = $('#dtReg');
    if (!r) { out.innerHTML = '<span class="ft-muted">Two columns with at least two rows of numbers are needed.</span>'; $('#dtRes').innerHTML = ''; chart(null); return; }
    if (r.err) { out.innerHTML = '<span class="ft-err">' + T.esc(r.err) + '</span>'; chart(null); return; }
    out.innerHTML = '<div class="ft-big" id="dtEq">y = ' + f(r.m) + 'x ' + (r.c < 0 ? '− ' + f(-r.c) : '+ ' + f(r.c)) + '</div>'
      + '<div>r = ' + f(r.r, 4) + ', R² = <strong id="dtR2">' + f(r.r2, 4) + '</strong>, n = ' + r.n + '</div>'
      + (isFinite(r.seM) ? '<div class="ft-muted">Standard error of the gradient ' + f(r.seM, 3) + ', of the intercept ' + f(r.seC, 3) + '.</div>' : '')
      + '<p class="ft-muted">' + (Math.abs(r.r) > 0.9 ? 'A strong' : Math.abs(r.r) > 0.6 ? 'A moderate' : Math.abs(r.r) > 0.3 ? 'A weak' : 'Little or no') + ' ' + (r.r >= 0 ? 'positive' : 'negative') + ' linear relationship. Residuals with a pattern mean a straight line is the wrong model.</p>';
    $('#dtRes').innerHTML = '<table class="ft-table"><thead><tr><th scope="col">x</th><th scope="col">y</th><th scope="col">Fitted</th><th scope="col">Residual</th></tr></thead><tbody>'
      + r.res.map(function (p) { return '<tr><td>' + f(p.x) + '</td><td>' + f(p.y) + '</td><td>' + f(p.fit) + '</td><td>' + f(p.r) + '</td></tr>'; }).join('') + '</tbody></table>';
    chart(r, data.head[xi], data.head[yi]);
  }
  function chart(r, xl, yl) {
    var cv = $('#dtChart'), g = cv.getContext('2d'), W = cv.width, H = cv.height, P = 54;
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    if (!r || r.err) return;
    var xs = r.res.map(function (p) { return p.x; }), ys = r.res.map(function (p) { return p.y; }).concat(r.res.map(function (p) { return p.fit; }));
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    var px = function (x) { return P + (x - x0) / ((x1 - x0) || 1) * (W - 2 * P); }, py = function (y) { return H - P - (y - y0) / ((y1 - y0) || 1) * (H - 2 * P); };
    g.strokeStyle = '#334'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(P, P / 2); g.lineTo(P, H - P); g.lineTo(W - P / 2, H - P); g.stroke();
    g.fillStyle = '#334'; g.font = '14px system-ui, sans-serif'; g.textAlign = 'center';
    g.fillText(String(xl || 'x'), W / 2, H - 14); g.save(); g.translate(16, H / 2); g.rotate(-Math.PI / 2); g.fillText(String(yl || 'y'), 0, 0); g.restore();
    g.font = '12px system-ui, sans-serif'; g.fillText(f(x0, 3), P, H - P + 18); g.fillText(f(x1, 3), W - P, H - P + 18);
    g.textAlign = 'right'; g.fillText(f(y0, 3), P - 6, H - P); g.fillText(f(y1, 3), P - 6, P + 4);
    g.strokeStyle = '#0891b2'; g.lineWidth = 2; g.beginPath(); g.moveTo(px(x0), py(r.m * x0 + r.c)); g.lineTo(px(x1), py(r.m * x1 + r.c)); g.stroke();
    g.fillStyle = '#0f172a'; r.res.forEach(function (p) { g.beginPath(); g.arc(px(p.x), py(p.y), 4, 0, 7); g.fill(); });
  }
  function chi() {
    var oi = +$('#dtO').value, ei = +$('#dtE').value, out = $('#dtChi');
    var O = data.cols[oi] || [], E = data.cols[ei] || [], pairs = [];
    O.forEach(function (o, i) { if (isFinite(o) && isFinite(E[i])) pairs.push([o, E[i]]); });
    if (pairs.length < 2) { out.innerHTML = '<span class="ft-muted">Choose an observed and an expected column with at least two rows.</span>'; return; }
    if (pairs.some(function (p) { return p[1] <= 0; })) { out.innerHTML = '<span class="ft-err">Every expected value must be more than zero.</span>'; return; }
    var x2 = pairs.reduce(function (a, p) { return a + (p[0] - p[1]) * (p[0] - p[1]) / p[1]; }, 0), df = pairs.length - 1, p = gammaQ(df / 2, x2 / 2);
    out.innerHTML = '<div class="ft-big">χ² = <span id="dtX2">' + f(x2, 4) + '</span></div><div>Degrees of freedom ' + df + ', p = <strong id="dtP">' + (p < 0.0001 ? '< 0.0001' : f(p, 3)) + '</strong></div>'
      + '<p>' + (p < 0.05 ? 'p is below 0.05: the difference between observed and expected is significant at the 5% level, so reject the null hypothesis.' : 'p is 0.05 or more: the difference could be chance, so do not reject the null hypothesis.') + '</p>'
      + '<ol class="ft-work">' + pairs.map(function (q) { return '<li>(' + f(q[0]) + ' − ' + f(q[1]) + ')² ÷ ' + f(q[1]) + ' = ' + f((q[0] - q[1]) * (q[0] - q[1]) / q[1], 4) + '</li>'; }).join('') + '</ol>'
      + (pairs.some(function (q) { return q[1] < 5; }) ? '<p class="ft-muted">Some expected values are under 5, where the test is less reliable.</p>' : '');
  }
  function all() {
    T.save('flux_data_v1', $('#dtIn').value);
    data = parse($('#dtIn').value);
    $('#dtInfo').textContent = data.head.length ? data.head.length + ' column' + (data.head.length === 1 ? '' : 's') + ', ' + (data.cols[0] || []).length + ' row' + ((data.cols[0] || []).length === 1 ? '' : 's') + '.' : 'Paste a table to begin.';
    opts($('#dtX'), 0); opts($('#dtY'), 1); opts($('#dtO'), 0); opts($('#dtE'), 1);
    summary(); regression(); chi();
  }
  var csv = function (rows) { return rows.map(function (r) { return r.map(function (c) { c = String(c); return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(','); }).join('\n') + '\n'; };
  $('#dtIn').addEventListener('input', all);
  ['#dtX', '#dtY'].forEach(function (s) { $(s).addEventListener('change', regression); });
  ['#dtO', '#dtE'].forEach(function (s) { $(s).addEventListener('change', chi); });
  $('#dtSumCsv').addEventListener('click', function () { var s = summary(); T.download('flux-data-summary.csv', csv([['Column'].concat(s.K.map(function (k) { return k[1]; }))].concat(s.rows.map(function (r) { return [r.h].concat(s.K.map(function (k) { return r.s[k[0]]; })); }))), 'text/csv'); });
  $('#dtResCsv').addEventListener('click', function () { if (lastReg && lastReg.res) T.download('flux-data-residuals.csv', csv([['x', 'y', 'fitted', 'residual']].concat(lastReg.res.map(function (p) { return [p.x, p.y, p.fit, p.r]; }))), 'text/csv'); });
  $('#dtPng').addEventListener('click', function () { var cv = $('#dtChart'); if (window.FluxHub && window.FluxHub.markCanvas) window.FluxHub.markCanvas(cv); cv.toBlob(function (b) { T.download('flux-data-chart.png', b); regression(); }); });
  all();
  window.fluxData = { stats: stats, regress: regress, gammaQ: gammaQ };
})();
