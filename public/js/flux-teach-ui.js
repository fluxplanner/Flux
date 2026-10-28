/* ============================================================================
   FLUX TEACH · UI  ·  flux-teach-ui.js
   The Learn screens inside Flux Tutor (teacher.html):

     #learn                     every subject with lessons, and how far you are
     #learn/<subject>           that subject's units and skills
     #learn/<subject>/<skill>   one skill: how to do it → watch a worked
                                example a step at a time → your turn, with the
                                working as hints → every kind, until mastered

   flux-teacher-app.js routes here and hands over its root element; this file
   draws and handles clicks inside it. Problems and marking come from
   flux-teach-core.js; units from flux-ib-syllabus.js.
   ========================================================================== */
(function () {
  'use strict';
  if (window.FluxTeachUI) return;
  var T = window.FluxTeach, IB = window.FluxIbSyllabus;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  /** Content markup: x^{2} x_{1} *bold* — escaped first, so content can never inject HTML. */
  function fmt(s) {
    return esc(s)
      .replace(/\^\{([^{}]*)\}/g, '<sup>$1</sup>')
      .replace(/_\{([^{}]*)\}/g, '<sub>$1</sub>')
      .replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }
  function pctBar(m, label) {
    var pct = Math.round(m.pct * 100);
    return '<div class="ft-meter' + (m.mastered ? ' is-done' : '') + '" role="progressbar" aria-label="' + esc(label) + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"><span style="width:' + pct + '%"></span></div>';
  }

  var host = null;
  var st = null;   // the skill screen's state

  /* ── Subjects ─────────────────────────────────────────────────────── */
  function subjectsWithLessons() {
    return IB.subjects().map(function (s) { return { s: s, skills: T.forSubject(s.id) }; }).filter(function (x) { return x.skills.length; });
  }
  function subjectStats(skills) {
    var done = 0, sum = 0;
    skills.forEach(function (k) { var m = T.mastery(k.id); sum += m.pct; if (m.mastered) done++; });
    return { done: done, pct: skills.length ? sum / skills.length : 0, mastered: false };
  }
  function homeHtml() {
    var list = subjectsWithLessons();
    var total = list.reduce(function (n, x) { return n + x.skills.length; }, 0);
    var variants = list.reduce(function (n, x) { return n + x.skills.reduce(function (m, k) { return m + k.variants.length; }, 0); }, 0);
    return '<section class="ft-learn" aria-labelledby="ftScreenTitle">'
      + '<p class="ft-crumbs"><a href="#">All study sets</a></p>'
      + '<h1 class="ft-h1" id="ftScreenTitle" tabindex="-1">Learn</h1>'
      + '<p class="ft-lead">Step-by-step lessons for each unit: how to do it, a worked example one step at a time, then your own problems with the working as hints. '
      + total + ' skills and ' + variants + ' kinds of question, with new numbers every time. Every answer and every step is worked out by Flux from the numbers in front of you, never guessed.</p>'
      + '<ul class="ft-learn-subjects">' + list.map(function (x) {
        var stt = subjectStats(x.skills);
        return '<li><a class="ft-learn-subject" href="#learn/' + esc(x.s.id) + '"><span class="ft-learn-sname">' + esc(x.s.name) + '</span>'
          + '<span class="ft-help">' + x.skills.length + ' skills · ' + stt.done + ' mastered</span>' + pctBar(stt, x.s.name + ' progress') + '</a></li>';
      }).join('') + '</ul></section>';
  }

  function subjectHtml(sid) {
    var subj = IB.subjects().filter(function (s) { return s.id === sid; })[0];
    if (!subj) return homeHtml();
    var skills = T.forSubject(sid);
    var stt = subjectStats(skills);
    var html = '<section class="ft-learn" aria-labelledby="ftScreenTitle">'
      + '<p class="ft-crumbs"><a href="#">All study sets</a> › <a href="#learn">Learn</a></p>'
      + '<h1 class="ft-h1" id="ftScreenTitle" tabindex="-1">' + esc(subj.name) + '</h1>'
      + '<p class="ft-lead">' + skills.length + ' skills, ' + stt.done + ' mastered. A skill is mastered when you have got every kind of its question right, and the last three in a row, without seeing the full working first.</p>'
      + pctBar(stt, subj.name + ' progress');
    var last = '';
    subj.units.forEach(function (u) {
      var ks = T.forUnit(u.id);
      if (!ks.length) return;
      if (u.section !== last) { html += '<h2 class="ft-h3 ft-syl-sec">' + esc(u.section) + '</h2>'; last = u.section; }
      html += '<div class="ft-learn-unit"><h3 class="ft-learn-uname">' + esc(IB.label(u)) + (u.hl ? ' <span class="ft-chip ft-chip--hl">HL</span>' : '') + '</h3><ul class="ft-learn-skills">'
        + ks.map(function (k) {
          var m = T.mastery(k.id);
          return '<li><a class="ft-learn-skill' + (m.mastered ? ' is-done' : '') + '" href="#learn/' + esc(sid) + '/' + esc(k.id) + '">'
            + '<span class="ft-learn-sname">' + fmt(k.title) + '</span><span class="ft-help">' + (m.mastered ? '✓ Mastered' : m.met + ' of ' + m.of + ' kinds') + '</span>'
            + pctBar(m, k.title) + '</a></li>';
        }).join('') + '</ul></div>';
    });
    return html + '</section>';
  }

  /* ── One skill ────────────────────────────────────────────────────── */
  function startSkill(skill, variantId) {
    var v = variantId || T.nextVariant(skill.id).id;
    st = { skill: skill, exV: v, ex: T.make(skill, v), exShown: 1, pr: null, hints: 0, given: '', result: null, choice: -1, feedback: '' };
    newProblem(v);
  }
  function newProblem(variantId) {
    var v = variantId || T.nextVariant(st.skill.id, st.pr && st.pr.variant).id;
    var p = T.make(st.skill, v);
    // Never the example's own numbers.
    if (st.ex && p.q === st.ex.q) p = T.make(st.skill, v);
    st.pr = p;
    st.hints = 0; st.given = ''; st.result = null; st.choice = -1; st.feedback = ''; st.closeOnce = false;
  }
  function stepsHtml(steps, shown) {
    return '<ol class="ft-learn-steps">' + steps.slice(0, shown).map(function (s) { return '<li>' + fmt(s) + '</li>'; }).join('') + '</ol>';
  }
  var answerText = function (p) { return T.answerText(p); };
  function answerLine(p) {
    return '<p class="ft-learn-answer"><span class="ft-label">Answer</span> ' + fmt(answerText(p)) + (p.unit && p.type === 'num' ? ' ' + fmt(p.unit) : '') + '</p>';
  }
  function problemInput(p, locked) {
    if (p.type === 'choice') {
      return '<div class="ft-learn-opts" role="group" aria-label="Choose one">' + p.options.map(function (o, i) {
        var cls = locked ? (o === p.answer ? ' is-right' : i === st.choice ? ' is-wrong' : '') : '';
        return '<button type="button" class="ft-learn-opt' + cls + '" data-tact="pick" data-i="' + i + '"' + (locked ? ' disabled' : '') + '>' + fmt(o) + '</button>';
      }).join('') + '</div>';
    }
    var unit = p.unit ? String(p.unit).replace(/[\^{}_*]/g, '') : '';
    return '<form class="ft-learn-form" data-tform="answer" novalidate><label class="ft-visually-hidden" for="ftLearnIn">Your answer</label>'
      + '<input class="ft-input ft-learn-in" id="ftLearnIn" autocomplete="off" autocapitalize="off" spellcheck="false" value="' + esc(st.given) + '"'
      + (locked ? ' readonly' : '') + ' placeholder="' + esc(p.type === 'num' ? 'Your answer' + (unit ? ' in ' + unit : '') : (p.placeholder || 'Your answer')) + '">'
      + (locked ? '' : '<button type="submit" class="ft-btn">Check</button>') + '</form>'
      + (p.type === 'num' && !locked ? '<p class="ft-help">' + (p.sf ? 'Give ' + p.sf + ' significant figures. ' : '') + 'Fractions (3/4) and powers of ten (2.5×10^3 or 2.5e3) are fine.</p>' : '');
  }
  function nameOf(vid) {
    var v = st.skill.variants.filter(function (x) { return x.id === vid; })[0];
    return v ? v.name : '';
  }
  function skillHtml() {
    var k = st.skill, m = T.mastery(k.id), pg = T.progress(k.id);
    var subj = k.units[0].split(':')[0];
    var subjObj = IB.subjects().filter(function (s) { return s.id === subj; })[0];
    var units = k.units.map(function (id) { return IB.label(IB.unit(id)); }).filter(Boolean).join(' · ');
    var ex = st.ex, pr = st.pr, res = st.result;
    var all = ex.steps.length;
    var html = '<section class="ft-learn ft-learn--skill" aria-labelledby="ftScreenTitle">'
      + '<p class="ft-crumbs"><a href="#">All study sets</a> › <a href="#learn">Learn</a> › <a href="#learn/' + esc(subj) + '">' + esc(subjObj ? subjObj.name : subj) + '</a></p>'
      + '<h1 class="ft-h1" id="ftScreenTitle" tabindex="-1">' + fmt(k.title) + '</h1>'
      + (units ? '<p class="ft-help">' + esc(units) + '</p>' : '')
      + '<div class="ft-learn-mastery">' + pctBar(m, 'Mastery of ' + k.title)
      + '<p class="ft-help">' + (m.mastered ? '✓ Mastered. Keep practising to keep it.' : m.met + ' of ' + m.of + ' kinds of question done · streak ' + m.streak + ' of 3') + ' · ' + pg.right + ' right, ' + pg.wrong + ' wrong</p></div>'
      + '<p class="ft-label">Kinds of question</p><div class="ft-learn-kinds">' + k.variants.map(function (v) {
        var met = pg.met[v.id];
        return '<button type="button" class="ft-learn-kind' + (met ? ' is-met' : '') + (pr && pr.variant === v.id ? ' is-on' : '') + '" data-tact="variant" data-v="' + esc(v.id) + '" aria-pressed="' + (pr && pr.variant === v.id) + '">' + (met ? '✓ ' : '') + fmt(v.name) + '</button>';
      }).join('') + '</div>';

    // 1 · How to do it
    html += '<section class="ft-learn-card" aria-labelledby="ftLearnHow"><h2 class="ft-h2" id="ftLearnHow"><span class="ft-learn-n" aria-hidden="true">1</span> How to do it</h2>'
      + '<ol class="ft-learn-method">' + k.method.map(function (s) { return '<li>' + fmt(s) + '</li>'; }).join('') + '</ol>'
      + (k.notes ? '<p class="ft-learn-tip">' + fmt(k.notes) + '</p>' : '') + '</section>';

    // 2 · Worked example
    html += '<section class="ft-learn-card" aria-labelledby="ftLearnEx"><h2 class="ft-h2" id="ftLearnEx"><span class="ft-learn-n" aria-hidden="true">2</span> Worked example <span class="ft-help">· ' + fmt(nameOf(ex.variant)) + '</span></h2>'
      + '<p class="ft-learn-q">' + fmt(ex.q) + '</p>'
      + (ex.type === 'choice' ? '<ul class="ft-learn-optlist">' + ex.options.map(function (o) { return '<li>' + fmt(o) + '</li>'; }).join('') + '</ul>' : '')
      + stepsHtml(ex.steps, st.exShown)
      + (st.exShown >= all ? answerLine(ex) + (ex.note ? '<p class="ft-learn-tip">' + fmt(ex.note) + '</p>' : '') : '')
      + '<div class="ft-row">'
      + (st.exShown < all ? '<button type="button" class="ft-btn" data-tact="ex-next">Next step (' + st.exShown + ' of ' + all + ')</button><button type="button" class="ft-btn ft-btn--quiet" data-tact="ex-all">Show every step</button>' : '')
      + '<button type="button" class="ft-btn ft-btn--quiet" data-tact="ex-new">Another example</button></div></section>';

    // 3 · Your turn
    var locked = !!res;
    html += '<section class="ft-learn-card" aria-labelledby="ftLearnTry"><h2 class="ft-h2" id="ftLearnTry"><span class="ft-learn-n" aria-hidden="true">3</span> Your turn <span class="ft-help">· ' + fmt(nameOf(pr.variant)) + '</span></h2>'
      + '<p class="ft-learn-q">' + fmt(pr.q) + '</p>'
      + problemInput(pr, locked)
      + (res ? '<p class="ft-learn-fb ' + (res.ok ? 'is-ok' : 'is-no') + '" role="status">' + (res.ok ? '✓ Right' + (st.hints ? ' (with ' + st.hints + ' hint' + (st.hints > 1 ? 's' : '') + ')' : '') : '✗ Not this time') + (res.note ? ' · ' + fmt(res.note) : '') + '</p>'
        : st.feedback ? '<p class="ft-learn-fb is-close" role="status">' + fmt(st.feedback) + ' Try again.</p>' : '')
      + (st.hints && !res ? '<div class="ft-learn-hints"><p class="ft-label">Hints</p>' + stepsHtml(pr.steps, st.hints) + '</div>' : '')
      + (res ? '<div class="ft-learn-hints"><p class="ft-label">The working</p>' + stepsHtml(pr.steps, pr.steps.length) + answerLine(pr) + (pr.note ? '<p class="ft-learn-tip">' + fmt(pr.note) + '</p>' : '') + '</div>' : '')
      + '<div class="ft-row">'
      + (res ? '<button type="button" class="ft-btn" data-tact="next">Next problem</button>'
        : (st.hints < pr.steps.length - 1 ? '<button type="button" class="ft-btn ft-btn--quiet" data-tact="hint">' + (st.hints ? 'Next hint' : 'Hint: show the first step') + '</button>' : '')
          + '<button type="button" class="ft-btn ft-btn--quiet" data-tact="giveup">Show me how</button>')
      + '</div></section>';

    return html + '<p class="ft-help ft-learn-foot">Hints are free. A problem counts towards mastery when you answer it yourself; “Show me how” shows the working and counts it as one to come back to. <button type="button" class="ft-link-btn" data-tact="reset">Start this skill again</button></p></section>';
  }

  /* ── Drawing and events ───────────────────────────────────────────── */
  function render(el, route) {
    host = el;
    bind();
    if (!T || !IB) { el.innerHTML = '<p class="ft-alert">Lessons did not load. Reload the page.</p>'; return; }
    if (route.skill) {
      var k = T.skill(route.skill);
      if (k) {
        if (!st || st.skill !== k) startSkill(k);
        el.innerHTML = skillHtml();
        return;
      }
    }
    st = null;
    el.innerHTML = route.subject ? subjectHtml(route.subject) : homeHtml();
  }
  function paint(focusSel) {
    if (!host || !st) return;
    var y = window.scrollY;
    host.innerHTML = skillHtml();
    window.scrollTo(0, y);
    if (focusSel) { var f = host.querySelector(focusSel); if (f) { try { f.focus({ preventScroll: true }); } catch (e) { f.focus(); } } }
  }
  function submit(given) {
    var pr = st.pr;
    var r = T.check(pr, given);
    if (r.empty) return;
    // A near miss (rounding, sign) gets one more go before it counts.
    if (!r.ok && r.close && !st.closeOnce) { st.closeOnce = true; st.feedback = r.note; paint('#ftLearnIn'); return; }
    st.feedback = '';
    st.result = r;
    T.record(st.skill.id, pr.variant, r.ok);
    paint('[data-tact="next"]');
  }

  var bound = false;
  function bind() {
    if (bound) return;
    bound = true;
    document.addEventListener('click', function (e) {
      if (!host || !st || !host.contains(e.target)) return;
      var b = e.target.closest('[data-tact]');
      if (!b || b.disabled) return;
      var a = b.getAttribute('data-tact');
      if (a === 'ex-next') { st.exShown++; paint(st.exShown < st.ex.steps.length ? '[data-tact="ex-next"]' : '[data-tact="ex-new"]'); }
      else if (a === 'ex-all') { st.exShown = st.ex.steps.length; paint('[data-tact="ex-new"]'); }
      else if (a === 'ex-new') { st.ex = T.make(st.skill, st.exV); st.exShown = 1; paint('[data-tact="ex-next"]'); }
      else if (a === 'variant') {
        var v = b.getAttribute('data-v');
        st.exV = v; st.ex = T.make(st.skill, v); st.exShown = 1; newProblem(v); paint();
        var exEl = host.querySelector('#ftLearnEx');
        if (exEl && exEl.scrollIntoView) exEl.scrollIntoView({ block: 'start' });
      }
      else if (a === 'hint') { st.hints++; paint('[data-tact="hint"]'); }
      else if (a === 'giveup') { st.hints = st.pr.steps.length; st.result = { ok: false, note: 'Here is how. The next one is yours.' }; T.record(st.skill.id, st.pr.variant, false); paint('[data-tact="next"]'); }
      else if (a === 'next') { newProblem(); paint(st.pr.type === 'choice' ? '.ft-learn-opt' : '#ftLearnIn'); }
      else if (a === 'pick') { st.choice = parseInt(b.getAttribute('data-i'), 10); submit(st.choice); }
      else if (a === 'reset') { T.reset(st.skill.id); startSkill(st.skill); paint(); }
    });
    document.addEventListener('submit', function (e) {
      if (!host || !st || !host.contains(e.target) || e.target.getAttribute('data-tform') !== 'answer') return;
      e.preventDefault();
      var inp = host.querySelector('#ftLearnIn');
      st.given = inp ? inp.value : '';
      submit(st.given);
    });
  }

  window.FluxTeachUI = { render: render, fmt: fmt, _state: function () { return st; } };
})();
