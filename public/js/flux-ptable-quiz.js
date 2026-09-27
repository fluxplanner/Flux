/* ════════════════════════════════════════════════════════════════════════
   FLUX · Periodic Table quiz — flux-ptable-quiz.js
   ------------------------------------------------------------------------
   Learning the table on the table itself:
     Find it   — a name is given; click where it lives.
     Name it   — a square pulses; type its name or symbol.
   Choose the first 20, the first 36, the main groups, the transition
   metals or all 118, and whether the squares keep their symbols (easier)
   or go blank so only the position helps (harder). The best streak is
   remembered in this browser.
   ════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.FluxPTableQuiz) return;

  const core = () => window.FluxPTable.core;
  const esc = (s) => core().esc(s);
  const BEST = 'flux_ptable_quiz_best';
  const SETS = [['20', 'First 20'], ['36', 'First 36'], ['main', 'Main groups'], ['transition', 'Transition metals'], ['all', 'All 118']];
  // Spellings a course might use, both accepted.
  const ALIAS = { aluminium: 'aluminum', sulphur: 'sulfur', caesium: 'cesium' };

  const Q = { mode: 'find', set: '20', blank: false, target: null, tried: false, right: 0, total: 0, streak: 0, busy: false, fb: '' };

  function best() { try { return +(JSON.parse(localStorage.getItem(BEST) || '{}')[Q.mode + ':' + Q.set] || 0); } catch (e) { return 0; } }
  function saveBest(v) {
    try {
      const all = JSON.parse(localStorage.getItem(BEST) || '{}');
      all[Q.mode + ':' + Q.set] = v;
      localStorage.setItem(BEST, JSON.stringify(all));
    } catch (e) { /* private window */ }
  }
  function pool(app) {
    const K = core();
    return app.els().filter((e) => {
      switch (Q.set) {
        case '20': return e.n <= 20;
        case '36': return e.n <= 36;
        case 'main': { const b = K.block(e); return (b === 's' || b === 'p') && e.n <= 86; }
        case 'transition': return K.block(e) === 'd' && e.p >= 4 && e.p <= 6;
        default: return true;
      }
    }).map((e) => e.n);
  }
  function next(app) {
    const p = pool(app);
    let n;
    do { n = p[Math.floor(Math.random() * p.length)]; } while (p.length > 1 && n === Q.target);
    Q.target = n;
    Q.tried = false;
    Q.busy = false;
  }
  function clearMarks(app) {
    Object.keys(app.cells).forEach((k) => app.cells[k].classList.remove('is-target', 'is-right', 'is-wrong', 'is-reveal'));
  }
  function mark(app) {
    clearMarks(app);
    app.grid.classList.toggle('is-blank', Q.blank);
    if (Q.mode === 'name' && Q.target) app.cells[Q.target].classList.add('is-target');
  }
  function score(ok) {
    if (!Q.tried) { Q.total++; if (ok) Q.right++; }
    Q.tried = true;
    if (ok) {
      Q.streak++;
      if (Q.streak > best()) saveBest(Q.streak);
    } else Q.streak = 0;
  }
  function matchName(e, typed) {
    const t = typed.trim().toLowerCase();
    if (!t) return false;
    return t === e.s.toLowerCase() || t === e.name.toLowerCase() || ALIAS[t] === e.name.toLowerCase();
  }
  const scoreHTML = () => '<div><b>' + Q.right + '/' + Q.total + '</b>right</div><div><b>' + Q.streak + '</b>streak</div><div><b>' + best() + '</b>best streak</div>';

  function render(app, host) {
    if (!Q.target || pool(app).indexOf(Q.target) < 0) next(app);
    app.highlight(pool(app), 'the quiz');
    const e = app.byN(Q.target);
    const prompt = Q.mode === 'find'
      ? '<small>Click it on the table</small><b>' + esc(e.name) + '</b>'
      : '<small>Which element is flashing?</small><div class="fpt-qin"><input class="fpt-in fpt-qname" placeholder="Name or symbol" autocomplete="off" spellcheck="false" aria-label="Your answer"><button type="button" class="fpt-tbtn is-on" data-act="qcheck">Check</button></div>';
    host.innerHTML = '<div class="fpt-quiz"><h2>Quiz</h2>'
      + '<div class="fpt-seg">' + [['find', 'Find it'], ['name', 'Name it']].map((m) => '<button type="button" class="fpt-chip' + (Q.mode === m[0] ? ' is-on' : '') + '" data-act="qmode" data-v="' + m[0] + '">' + m[1] + '</button>').join('') + '</div>'
      + '<div class="fpt-rowf"><label class="fpt-field">Elements<select class="fpt-in fpt-qset">' + SETS.map((s) => '<option value="' + s[0] + '"' + (Q.set === s[0] ? ' selected' : '') + '>' + s[1] + '</option>').join('') + '</select></label>'
      + '<label class="fpt-check"><input type="checkbox" class="fpt-qblank"' + (Q.blank ? ' checked' : '') + '> Blank squares (harder)</label></div>'
      + '<div class="fpt-qprompt">' + prompt + '</div>'
      + '<div class="fpt-qfb" aria-live="polite">' + Q.fb + '</div>'
      + '<div class="fpt-qscore">' + scoreHTML() + '</div>'
      + '<p class="fpt-note fpt-center"><button type="button" class="fpt-link" data-act="qskip">Skip</button> · <button type="button" class="fpt-link" data-act="qreset">Start again</button></p></div>';
    mark(app);
    host.querySelector('.fpt-qset').addEventListener('change', (ev) => { Q.set = ev.target.value; Q.target = null; Q.fb = ''; Q.streak = 0; render(app, host); });
    host.querySelector('.fpt-qblank').addEventListener('change', (ev) => { Q.blank = ev.target.checked; mark(app); });
    const inp = host.querySelector('.fpt-qname');
    if (inp) {
      inp.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); check(app, host, inp.value); } });
      setTimeout(() => { if (inp.isConnected && app.root.clientWidth >= 700) inp.focus({ preventScroll: true }); }, 0);
    }
    app.cellClick = Q.mode === 'find' ? (n) => found(app, host, n) : () => {};
  }

  function advance(app, host, ms) {
    Q.busy = true;
    setTimeout(() => {
      if (!app.root.isConnected || app.st.view !== 'quiz') { Q.busy = false; return; }
      next(app);
      Q.fb = '';
      render(app, host);
    }, ms);
  }
  function found(app, host, n) {
    if (Q.busy) return;
    const want = app.byN(Q.target), got = app.byN(n);
    const cell = app.cells[n];
    if (n === Q.target) {
      score(true);
      cell.classList.add('is-right', 'is-reveal');
      Q.fb = '<span class="fpt-ok">✓ ' + esc(want.name) + ' — group ' + (want.g || '—') + ', period ' + want.p + '</span>';
      host.querySelector('.fpt-qfb').innerHTML = Q.fb;
      host.querySelector('.fpt-qscore').innerHTML = scoreHTML();
      advance(app, host, 900);
    } else {
      score(false);
      cell.classList.remove('is-wrong');
      void cell.offsetWidth;
      cell.classList.add('is-wrong', 'is-reveal');
      setTimeout(() => cell.classList.remove('is-wrong', 'is-reveal'), 700);
      Q.fb = '<span class="fpt-bad">That is ' + esc(got.name) + '. Try again.</span>';
      host.querySelector('.fpt-qfb').innerHTML = Q.fb;
      host.querySelector('.fpt-qscore').innerHTML = scoreHTML();
    }
  }
  function check(app, host, typed) {
    if (Q.busy || !typed.trim()) return;
    const e = app.byN(Q.target);
    const ok = matchName(e, typed);
    score(ok);
    const cell = app.cells[Q.target];
    cell.classList.remove('is-target');
    cell.classList.add('is-reveal', ok ? 'is-right' : 'is-wrong');
    Q.fb = ok ? '<span class="fpt-ok">✓ ' + esc(e.name) + ' (' + esc(e.s) + ')</span>' : '<span class="fpt-bad">It is ' + esc(e.name) + ' (' + esc(e.s) + ').</span>';
    host.querySelector('.fpt-qfb').innerHTML = Q.fb;
    host.querySelector('.fpt-qscore').innerHTML = scoreHTML();
    advance(app, host, ok ? 900 : 1800);
  }

  function action(app, act, el) {
    const host = app.side;
    if (act === 'qmode') { Q.mode = el.dataset.v; Q.target = null; Q.fb = ''; Q.streak = 0; render(app, host); }
    else if (act === 'qskip') { if (Q.busy) return; score(false); Q.fb = 'That was ' + esc(app.byN(Q.target).name) + '.'; next(app); render(app, host); }
    else if (act === 'qreset') { Q.right = 0; Q.total = 0; Q.streak = 0; Q.fb = ''; next(app); render(app, host); }
    else if (act === 'qcheck') { const inp = host.querySelector('.fpt-qname'); if (inp) check(app, host, inp.value); }
  }
  function leave(app) {
    clearMarks(app);
    app.grid.classList.remove('is-blank');
    app.cellClick = null;
    Q.busy = false;
  }

  window.FluxPTableQuiz = { render: render, action: action, leave: leave, _q: Q };
})();
