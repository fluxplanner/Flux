/* Flux Formulae (formulae.html): the planner's formula sheets
   (flux-formula-data.js), typeset by flux-formula-typeset.js, and a working
   pad that solves an equation for its one blank (FluxTool.compile/solve). */
(function () {
  'use strict';
  var T = window.FluxTool, $ = T.$, D = window.FLUX_FORMULA_DATA || {}, TS = window.FluxFormulaTypeset;
  var subjects = Object.keys(D);
  $('#fmSub').innerHTML += subjects.map(function (s) { return '<option>' + T.esc(s) + '</option>'; }).join('');
  var all = [];
  subjects.forEach(function (s) { D[s].forEach(function (c) { c.items.forEach(function (it) { all.push({ s: s, c: c.title, f: it.f, vars: (it.vars || []).join(' · ') }); }); }); });

  function typeset(f) { try { return TS ? TS.toHtml(f) : T.esc(f); } catch (e) { return T.esc(f); } }
  function list() {
    var q = $('#fmQ').value.trim().toLowerCase(), sub = $('#fmSub').value, last = '';
    var hits = all.filter(function (x) { return (!sub || x.s === sub) && (!q || (x.f + ' ' + x.vars + ' ' + x.c + ' ' + x.s).toLowerCase().indexOf(q) >= 0); });
    $('#fmList').innerHTML = hits.length ? hits.map(function (x) {
      var head = x.s + ' · ' + x.c, h = head !== last ? '<h3>' + T.esc(head) + '</h3>' : '';
      last = head;
      return h + '<div class="ft-row" style="align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">'
        + '<div style="min-width:0;flex:1"><div class="fm-f">' + typeset(x.f) + '</div><div class="ft-muted">' + T.esc(x.vars) + '</div></div>'
        + '<button type="button" class="ft-btn small" data-use="' + T.esc(x.f) + '" aria-label="Use ' + T.esc(x.f) + ' in the working pad">Use</button></div>';
    }).join('') : '<p class="ft-muted">No formula matches “' + T.esc(q) + '”.</p>';
    if (TS && TS.fit) TS.fit($('#fmList'));
  }
  $('#fmQ').addEventListener('input', list);
  $('#fmSub').addEventListener('change', list);

  /* The sheet's text, e.g. "s = ut + ½at²", as something the pad can read. */
  function toPad(f) {
    var eq = String(f).split(/\s{3,}|\n/)[0];
    var parts = eq.split('=');
    if (parts.length > 2) eq = parts.slice(-2).join('=');
    return eq.replace(/½/g, '(1/2)').replace(/¼/g, '(1/4)').replace(/×|·/g, '*').replace(/÷/g, '/').replace(/−/g, '-')
      .replace(/[₀-₉]/g, function (d) { return '_' + (d.charCodeAt(0) - 8320); }).replace(/_(\d)_(\d)/g, '_$1$2')
      .replace(/√\(/g, 'sqrt(').replace(/√(\w+)/g, 'sqrt($1)').replace(/Δ/g, 'd')
      // Sheets write products as letters side by side (ma, ut, mgh): one
      // variable per letter, except function names.
      .replace(/\b[a-zA-Z]{2,3}\b/g, function (w) { return /^(sin|cos|tan|ln|log|exp|abs|pi)$/.test(w) ? w : w.split('').join('*'); })
      .trim();
  }
  $('#fmList').addEventListener('click', function (e) {
    var b = e.target.closest('[data-use]'); if (!b) return;
    $('#fmEq').value = toPad(b.getAttribute('data-use'));
    pad(); $('#fmEq').focus();
  });

  var values = T.load('flux_formulae_vals', {});
  function pad() {
    var out = $('#fmOut'), host = $('#fmVars'), src = $('#fmEq').value;
    var sides = src.split('=');
    if (sides.length !== 2) { host.innerHTML = ''; out.innerHTML = '<span class="ft-err">Write one equation with a single “=”.</span>'; return; }
    var L, R;
    try { L = T.compile(sides[0]); R = T.compile(sides[1]); } catch (x) { host.innerHTML = ''; out.innerHTML = '<span class="ft-err">' + T.esc(x.message) + '</span>'; return; }
    var names = L.vars.concat(R.vars.filter(function (v) { return L.vars.indexOf(v) < 0; }));
    var have = [].slice.call(host.querySelectorAll('input')).map(function (i) { return i.getAttribute('data-v'); });
    if (have.join() !== names.join()) {
      host.innerHTML = names.map(function (n) { return '<label class="ft-field" style="flex:1 1 100px">' + T.esc(n) + '<input type="text" inputmode="decimal" data-v="' + T.esc(n) + '" value="' + T.esc(values[n] == null ? '' : values[n]) + '"></label>'; }).join('');
    }
    var scope = {}, blank = [];
    [].slice.call(host.querySelectorAll('input')).forEach(function (i) {
      var n = i.getAttribute('data-v'), v = i.value.trim(); values[n] = v;
      if (v === '') blank.push(n); else scope[n] = Number(v);
    });
    T.save('flux_formulae_vals', values);
    var bad = Object.keys(scope).filter(function (k) { return !isFinite(scope[k]); });
    if (bad.length) { out.innerHTML = '<span class="ft-err">' + T.esc(bad.join(', ')) + ' is not a number.</span>'; return; }
    if (blank.length !== 1) { out.innerHTML = '<span class="ft-muted">' + (blank.length ? 'Leave just one box empty — the one to find.' : 'Empty the box of the value you want to find.') + '</span>'; return; }
    var x = blank[0];
    var f = function (t) { var s = Object.assign({}, scope); s[x] = t; return L.fn(s) - R.fn(s); };
    var guess = 1;
    var ans = T.solve(f, guess);
    if (!isFinite(ans)) { out.innerHTML = '<span class="ft-err">No value of ' + T.esc(x) + ' makes both sides equal with these numbers.</span>'; return; }
    var sub = src.replace(/[A-Za-zα-ωΑ-Ω_][A-Za-z0-9α-ωΑ-Ω_]*/g, function (n) { return n in scope ? '(' + scope[n] + ')' : n; });
    var s2 = Object.assign({}, scope); s2[x] = ans;
    out.innerHTML = '<div class="ft-big">' + T.esc(x) + ' = ' + T.esc(T.fmt(ans)) + '</div><ol class="ft-work">'
      + '<li>Put in the numbers: ' + T.esc(sub) + '</li>'
      + '<li>Find ' + T.esc(x) + ' that makes the two sides equal: ' + T.esc(x) + ' = ' + T.esc(T.fmt(ans)) + '</li>'
      + '<li>Check: left side = ' + T.esc(T.fmt(L.fn(s2))) + ', right side = ' + T.esc(T.fmt(R.fn(s2))) + '</li></ol>';
  }
  $('#fmEq').addEventListener('input', pad);
  $('#fmVars').addEventListener('input', pad);
  list(); pad();
  window.fluxFormulae = { toPad: toPad };
})();
