/* ============================================================================
   FLUX STUDY TOOLS · Verb drill  ·  flux-study-verbs.js
   Conjugation practice in the spirit of conjuguemos.com, inside Study tools ▸
   Spanish / French / German. Language teachers asked for it.

     Practice      pick tenses, a verb set or your own list, pronouns, and a
                   round by time (1–5 minutes) or by number of questions; type
                   each form, with accent buttons; marked at once; a score,
                   your mistakes, and "Practise my mistakes" at the end.
     My results    best scores per setting, recent rounds, assignments.
     For teachers  make an assignment link; check the score codes students
                   send back.

   The logic is flux-verb-drill-core.js (unit-tested); the answers are
   flux-lang-engine.js's. History and assignments are saved in the language
   practice record (FluxLangPractice.updateVerbs), which the planner already
   syncs to the account — no new storage key and no new sync slice.

   NO SERVER. An assignment link carries the whole assignment in the address
   (#verbs=…), and a score code carries the result with a check value. The
   page tells teachers plainly what that catches and what it cannot.

   Keyboard first: Enter checks, Enter again moves on after a wrong answer,
   and focus stays in the answer box the whole round. Feedback is text in a
   polite live region — nothing flashes, nothing moves.
   ========================================================================== */
(function () {
  'use strict';
  if (window.FluxVerbDrill) return;

  var C = function () { return window.FluxVerbCore; };
  var E = function () { return window.FluxLangEngine; };
  var SUBJECT = { es: 'spanish', fr: 'french', de: 'german' };
  var LANG_OF_SUBJECT = { spanish: 'es', french: 'fr', german: 'de' };
  var ROUTE_KEY = 'flux_verbs_route';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function $(sel, el) { return (el || document).querySelector(sel); }
  function $$(sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  /* ── Store (inside the langPractice record) ─────────────────────────── */

  var memStore = null;   // only if FluxLangPractice is missing (it never should be)
  function getStore() {
    var P = window.FluxLangPractice;
    if (P && P.verbStore) return P.verbStore();
    return memStore || (memStore = C().emptyStore());
  }
  function updateStore(fn) {
    var P = window.FluxLangPractice;
    if (P && P.updateVerbs) return P.updateVerbs(fn);
    memStore = fn(getStore()) || memStore;
    return memStore;
  }

  /* ── Session ────────────────────────────────────────────────────────── */

  /* One drill on screen at a time (Study tools shows one tool body). Leaving
     the tab replaces the body; the round's timer notices and stops. */
  var S = null;
  var pending = null;    // a route waiting for the tool to open: {view, assignment?, error?}

  function live(text) {
    var el = $('#fvdLive');
    if (!el) return;
    // Clear first, so the same sentence twice in a row is still announced.
    el.textContent = '';
    setTimeout(function () { if (el.isConnected) el.textContent = text; }, 30);
  }

  function copyText(text, input) {
    function fallback() {
      try {
        if (input) { input.focus(); input.select(); document.execCommand('copy'); return true; }
      } catch (e) { /* nothing more to try */ }
      return false;
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text).then(function () { return true; }, fallback);
      }
    } catch (e) { /* fall through */ }
    return Promise.resolve(fallback());
  }

  /* ── Settings form (shared by Practice and For teachers) ────────────── */

  var COUNTS = [5, 10, 15, 20, 25, 30, 40, 50];

  function formHtml(p, cfg) {
    var L = C().LANGS[cfg.lang];
    var tenses = E().tenses(cfg.lang);
    var sets = C().sets(cfg.lang);
    var setText = cfg.set === 'custom' ? '' : C().setVerbs(cfg.lang, cfg.set).join(', ');
    return '<fieldset class="fvd-field"><legend>Tenses</legend><div class="fvd-chips">'
      + tenses.map(function (t) {
        return '<label class="fvd-chip" title="' + esc(t.hint) + '"><input type="checkbox" name="' + p + 'tense" value="' + esc(t.id) + '"'
          + (cfg.tenses.indexOf(t.id) !== -1 ? ' checked' : '') + '><span>' + esc(t.name) + '</span></label>';
      }).join('') + '</div></fieldset>'
      + '<div class="fvd-field"><label class="fvd-lbl" for="' + p + 'set">Verbs</label>'
      + '<select id="' + p + 'set" class="fvd-select">'
      + sets.map(function (s) { return '<option value="' + esc(s.id) + '"' + (cfg.set === s.id ? ' selected' : '') + '>' + esc(s.name) + ' (' + s.count + ')</option>'; }).join('')
      + '<option value="custom"' + (cfg.set === 'custom' ? ' selected' : '') + '>My own list…</option></select>'
      + '<p class="fvd-hint" id="' + p + 'setText"' + (cfg.set === 'custom' ? ' hidden' : '') + '>' + esc(setText) + '</p>'
      + '<div id="' + p + 'customWrap"' + (cfg.set === 'custom' ? '' : ' hidden') + '>'
      + '<label class="fvd-lbl" for="' + p + 'custom">Type the verbs, separated by commas or new lines</label>'
      + '<textarea id="' + p + 'custom" class="fvd-text" rows="3" spellcheck="false" autocapitalize="off" autocomplete="off">' + esc(cfg.custom.join(', ')) + '</textarea>'
      + '<p class="fvd-hint" id="' + p + 'customNote" aria-live="polite"></p></div></div>'
      + '<fieldset class="fvd-field"><legend>Pronouns</legend><div class="fvd-chips">'
      + L.persons.map(function (name, i) {
        return '<label class="fvd-chip"><input type="checkbox" name="' + p + 'person" value="' + i + '"' + (cfg.persons.indexOf(i) !== -1 ? ' checked' : '')
          + '><span>' + esc(name) + '</span></label>';
      }).join('') + '</div></fieldset>'
      + '<fieldset class="fvd-field"><legend>Round</legend><div class="fvd-row">'
      + '<label class="fvd-chip"><input type="radio" name="' + p + 'mode" value="time"' + (cfg.mode === 'time' ? ' checked' : '') + '><span>Timed</span></label>'
      + '<label class="fvd-chip"><input type="radio" name="' + p + 'mode" value="count"' + (cfg.mode === 'count' ? ' checked' : '') + '><span>Number of questions</span></label>'
      + '<label class="fvd-inline" id="' + p + 'minWrap"' + (cfg.mode === 'time' ? '' : ' hidden') + '><span class="fvd-sr">Minutes</span><select id="' + p + 'minutes" class="fvd-select fvd-select--sm">'
      + [1, 2, 3, 4, 5].map(function (m) { return '<option value="' + m + '"' + (cfg.minutes === m ? ' selected' : '') + '>' + m + ' minute' + (m === 1 ? '' : 's') + '</option>'; }).join('')
      + '</select></label>'
      + '<label class="fvd-inline" id="' + p + 'cntWrap"' + (cfg.mode === 'count' ? '' : ' hidden') + '><span class="fvd-sr">Questions</span><select id="' + p + 'count" class="fvd-select fvd-select--sm">'
      + COUNTS.concat(COUNTS.indexOf(cfg.count) === -1 ? [cfg.count] : []).sort(function (a, b) { return a - b; })
        .map(function (n) { return '<option value="' + n + '"' + (cfg.count === n ? ' selected' : '') + '>' + n + ' questions</option>'; }).join('')
      + '</select></label></div></fieldset>'
      + '<label class="fvd-check"><input type="checkbox" id="' + p + 'exact"' + (cfg.exact ? ' checked' : '') + '><span>Accents must be exact</span></label>'
      + '<p class="fvd-hint">' + (cfg.exact ? 'A missing or wrong accent counts as a mistake.' : 'A missing accent still counts as right, and the correct spelling is shown.') + '</p>';
  }

  /** Read a settings form back into a config (plus what the custom list said). */
  function readForm(box, p, lang) {
    var checked = function (name) { return $$('input[name="' + p + name + '"]:checked', box).map(function (i) { return i.value; }); };
    var set = $('#' + p + 'set', box).value;
    var parsed = null;
    if (set === 'custom') parsed = C().parseCustom(E(), lang, $('#' + p + 'custom', box).value);
    var cfg = C().sanitizeConfig({
      lang: lang,
      tenses: checked('tense'),
      set: set,
      custom: parsed ? parsed.verbs : [],
      persons: checked('person').map(Number),
      mode: (checked('mode')[0] || 'time'),
      minutes: Number($('#' + p + 'minutes', box).value),
      count: Number($('#' + p + 'count', box).value),
      exact: $('#' + p + 'exact', box).checked,
    }, E());
    return { cfg: cfg, parsed: parsed, noTense: !checked('tense').length, noPerson: !checked('person').length };
  }

  function customNote(parsed) {
    if (!parsed) return '';
    var bits = [];
    bits.push(parsed.verbs.length ? parsed.verbs.length + ' verb' + (parsed.verbs.length === 1 ? '' : 's') + ' ready.' : 'No verbs yet.');
    if (parsed.refused.length) bits.push('Left out: ' + parsed.refused.map(function (r) { return r.verb; }).join(', ') + ' — Flux cannot conjugate ' + (parsed.refused.length === 1 ? 'it' : 'them') + '.');
    if (parsed.unlisted.length) bits.push('Not in Flux’s verb tables, so conjugated by the regular pattern: ' + parsed.unlisted.join(', ') + '. Check any irregular ones.');
    return bits.join(' ');
  }

  /** Wire the show/hide bits of a settings form; `onChange` gets the read-back. */
  function wireForm(box, p, lang, onChange) {
    function sync() {
      var r = readForm(box, p, lang);
      var custom = r.cfg.set === 'custom' || $('#' + p + 'set', box).value === 'custom';
      $('#' + p + 'customWrap', box).hidden = !custom;
      var st = $('#' + p + 'setText', box);
      st.hidden = custom;
      if (!custom) st.textContent = C().setVerbs(lang, r.cfg.set).join(', ');
      $('#' + p + 'customNote', box).textContent = custom ? customNote(r.parsed) : '';
      var timed = r.cfg.mode === 'time';
      $('#' + p + 'minWrap', box).hidden = !timed;
      $('#' + p + 'cntWrap', box).hidden = timed;
      if (onChange) onChange(r);
    }
    // On the form itself: the panel around it outlives every re-render.
    $('#' + p + 'set', box).closest('form').addEventListener('change', sync);
    var ta = $('#' + p + 'custom', box);
    var t = 0;
    ta.addEventListener('input', function () { clearTimeout(t); t = setTimeout(sync, 350); });
    sync();
  }

  /* ── Shell ──────────────────────────────────────────────────────────── */

  function render(lang, body) {
    if (!C() || !E()) {
      body.innerHTML = '<div class="fsh-card" style="padding:20px"><span class="fsh-err">The verb drill is still loading — reopen this tool in a moment.</span></div>';
      return;
    }
    stopTimer();
    /* The route stays until the student does something here: opening Study
       tools can draw this tool twice in a row (the panel, then the subject),
       and the second draw must still land on the assignment. */
    var route = pending && pending.lang === lang ? pending : null;
    S = { lang: lang, body: body, view: route ? route.view : 'setup', assignment: route ? route.assignment : null, routeError: route ? route.error : '' };
    body.innerHTML = '<section class="fsh-card fvd" id="fvdRoot" aria-labelledby="fvdTitle">'
      + '<div class="fvd-top"><div class="fvd-titles"><h3 class="fvd-h" id="fvdTitle">' + esc(C().LANGS[lang].name) + ' verb drill</h3>'
      + '<p class="fvd-sub">Type the right form of each verb. Timed or by number of questions, offline.</p></div>'
      + '<div class="fsh-seg fvd-tabs" role="tablist" aria-label="Verb drill sections" id="fvdTabs">'
      + [['setup', 'Practice'], ['mine', 'My results'], ['teach', 'For teachers']].map(function (t) {
        return '<button type="button" role="tab" data-view="' + t[0] + '" id="fvdTab-' + t[0] + '" aria-controls="fvdBody">' + t[1] + '</button>';
      }).join('') + '</div></div>'
      + '<div class="fvd-body" id="fvdBody" role="tabpanel" tabindex="-1"></div>'
      + '<p class="fvd-sr" id="fvdLive" role="status" aria-live="polite" aria-atomic="true"></p>'
      + '<p class="fvd-sr" id="fvdLiveTime" aria-live="polite"></p>'
      + '</section>';
    var root = $('#fvdRoot', body);
    root.addEventListener('click', onClick);
    root.addEventListener('submit', onSubmit);
    root.addEventListener('keydown', onKeydown);
    root.addEventListener('mousedown', function (e) {
      // Accent keys must not take focus away from the answer box.
      if (e.target.closest('[data-key]')) e.preventDefault();
    });
    show(S.view);
  }

  function show(view, opts) {
    if (!S) return;
    S.view = view;
    var tabView = view === 'play' || view === 'results' || view === 'asg' ? (S.assignment ? null : 'setup') : view;
    $$('#fvdTabs [data-view]').forEach(function (b) {
      var on = b.getAttribute('data-view') === tabView;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    // During a round the section tabs go away: a stray click must not end it.
    $('#fvdTabs').hidden = view === 'play';
    var box = $('#fvdBody');
    if (view === 'setup') renderSetup(box);
    else if (view === 'asg') renderAssignment(box);
    else if (view === 'play') renderPlay(box);
    else if (view === 'results') renderResults(box, opts);
    else if (view === 'mine') renderMine(box);
    else if (view === 'teach') renderTeach(box);
  }

  function onClick(e) {
    var t = e.target.closest('[data-view],[data-act],[data-key]');
    if (!t || !S) return;
    pending = null;
    if (t.hasAttribute('data-view') && t.closest('#fvdTabs')) {
      S.assignment = null;
      show(t.getAttribute('data-view'));
      return;
    }
    if (t.hasAttribute('data-key')) { insertKey(t.getAttribute('data-key')); return; }
    var act = t.getAttribute('data-act');
    var fn = ACTIONS[act];
    if (fn) fn(t, e);
  }
  function onSubmit(e) {
    var f = e.target;
    e.preventDefault();
    pending = null;
    if (f.id === 'fvdForm') answer();
    else if (f.id === 'fvdSetupForm') startFromSetup();
    else if (f.id === 'fvdTeachForm') makeLink();
    else if (f.id === 'fvdNameForm') makeScoreCode();
    else if (f.id === 'fvdCheckForm') checkCodes();
  }
  function onKeydown(e) {
    if (e.key === 'Escape' && S && S.view === 'play' && S.round && S.round.waiting) { e.preventDefault(); next(); }
  }

  var ACTIONS = {
    end: function () { finish(true); },
    reveal: function () { reveal(); },
    again: function () { start(S.round.cfg, null, S.round.assignment); },
    mistakes: function () { startMistakes(); },
    settings: function () { show(S.assignment ? 'asg' : 'setup'); },
    'start-asg': function () { start(C().assignmentConfig(S.assignment), null, S.assignment); },
    'leave-asg': function () { S.assignment = null; show('setup'); },
    'open-asg': function (t) { openLink(t.getAttribute('data-link')); },
    'copy-code': function (t) { copyFrom(t.getAttribute('data-for'), t); },
    'copy-link': function (t) { copyFrom(t.getAttribute('data-for'), t); },
    'copy-made': function (t) { copyText(t.getAttribute('data-link')).then(function (ok) { live(ok ? 'Link copied.' : 'Could not copy — select the link and copy it.'); }); },
    'check-made': function (t) {
      var sel = $('#fvdCheckAsg');
      if (sel) { sel.value = t.getAttribute('data-fp'); $('#fvdCodes').focus(); }
    },
    'copy-table': function () { copyTable(); },
    'try-link': function (t) { openLink($('#' + t.getAttribute('data-for')).value); },
  };

  function copyFrom(id, btn) {
    var el = document.getElementById(id);
    if (!el) return;
    var text = el.value != null ? el.value : el.textContent;
    copyText(text, el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' ? el : null).then(function (ok) {
      live(ok ? 'Copied.' : 'Could not copy — select the text and copy it.');
      if (ok && btn) { var old = btn.textContent; btn.textContent = 'Copied'; setTimeout(function () { btn.textContent = old; }, 1600); }
    });
  }

  /* ── Practice: setup ────────────────────────────────────────────────── */

  function currentConfig() {
    var st = getStore();
    return C().sanitizeConfig(st.settings[S.lang] || C().defaultConfig(S.lang, E()), E());
  }

  function bestLine(cfg) {
    var b = getStore().best[C().configKey(cfg)];
    if (!b) return 'No rounds with these settings yet.';
    return 'Your best with these settings: ' + b.correct + ' right' + (b.answered ? ' of ' + b.answered + ' (' + Math.round((b.correct / b.answered) * 100) + '%)' : '') + '.';
  }

  function renderSetup(box) {
    var cfg = currentConfig();
    box.innerHTML = (S.routeError ? '<p class="fvd-warn" role="alert">' + esc(S.routeError) + '</p>' : '')
      + '<form class="fvd-form" id="fvdSetupForm" novalidate>' + formHtml('fvdP', cfg)
      + '<div class="fvd-start"><button type="submit" class="fsh-btn" id="fvdStart">Start round</button>'
      + '<p class="fvd-hint" id="fvdBest">' + esc(bestLine(cfg)) + '</p>'
      + '<p class="fvd-warn" id="fvdSetupErr" role="alert" hidden></p></div></form>';
    S.routeError = '';
    var saveT = 0;
    wireForm(box, 'fvdP', S.lang, function (r) {
      $('#fvdBest', box).textContent = bestLine(r.cfg);
      clearTimeout(saveT);
      // Remember the choices for next time (a small write, so not on every
      // key). Read now: by the time the timer fires the form may be gone.
      var keep = Object.assign({}, r.cfg, { set: $('#fvdPset', box).value });
      var lang = S.lang;
      saveT = setTimeout(function () {
        updateStore(function (s) { s.settings[lang] = keep; return s; });
      }, 400);
    });
  }

  function setupProblem(r) {
    if (r.noTense) return 'Choose at least one tense.';
    if (r.noPerson) return 'Choose at least one pronoun.';
    if (r.cfg.set === 'custom' && !r.cfg.custom.length) return 'Type at least one verb for your own list.';
    if (!C().buildPool(E(), r.cfg).length) return 'Nothing to ask with these choices — try another tense or pronoun.';
    return '';
  }

  function startFromSetup() {
    var box = $('#fvdBody');
    var r = readForm(box, 'fvdP', S.lang);
    var err = setupProblem(r);
    var out = $('#fvdSetupErr', box);
    if (err) { out.textContent = err; out.hidden = false; return; }
    updateStore(function (s) { s.settings[S.lang] = r.cfg; return s; });
    start(r.cfg);
  }

  /* ── Rounds ─────────────────────────────────────────────────────────── */

  var timer = 0;
  function stopTimer() { if (timer) { clearInterval(timer); timer = 0; } }

  /**
   * Start a round. `items` (for "Practise my mistakes") fixes the questions;
   * otherwise they come from the config's pool.
   */
  function start(cfg, items, assignment) {
    stopTimer();
    var pool = items || C().buildPool(E(), cfg);
    if (!pool.length) return;
    var timed = cfg.mode === 'time' && !items;
    var n = items ? items.length : timed ? 400 : cfg.count;
    S.round = {
      cfg: cfg, items: items || null, assignment: assignment || null,
      queue: items ? C().shuffle(items) : C().makeQueue(pool, n, Math.random),
      pos: 0, results: [], timed: timed, total: timed ? 0 : n,
      started: Date.now(), ends: timed ? Date.now() + cfg.minutes * 60000 : 0,
      q: null, waiting: false, warned: {},
    };
    show('play');
  }
  function startMistakes() {
    var items = C().mistakeItems(S.round.results);
    if (!items.length) return;
    var cfg = Object.assign({}, S.round.cfg, { mode: 'count', count: items.length });
    var a = S.round.assignment;
    start(cfg, items, null);
    S.round.practisingFor = a;
  }

  function renderPlay(box) {
    var R = S.round;
    var keys = C().LANGS[S.lang].accents;
    box.innerHTML = '<div class="fvd-play">'
      + '<div class="fvd-bar">'
      + (R.timed ? '<span class="fvd-clock" id="fvdClock" role="timer" aria-label="Time left">' + C().fmtSecs((R.ends - Date.now()) / 1000) + '</span>'
        : '<span class="fvd-count" id="fvdCount">Question 1 of ' + R.total + '</span>')
      + '<span class="fvd-score" id="fvdScore">0 right</span>'
      + '<button type="button" class="fsh-btn ghost mini" data-act="end">End round</button></div>'
      + (R.items ? '<p class="fvd-hint">Practising your mistakes — this round is not saved as a score.</p>' : '')
      + (R.assignment ? '<p class="fvd-hint">Assignment: <b>' + esc(R.assignment.title) + '</b></p>' : '')
      + '<div class="fvd-q" id="fvdQ"></div>'
      + '<form class="fvd-answer" id="fvdForm" autocomplete="off" novalidate>'
      + '<label class="fvd-sr" for="fvdIn" id="fvdInLabel">Your answer</label>'
      + '<input id="fvdIn" class="fvd-in" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go">'
      + '<button type="submit" class="fsh-btn" id="fvdGo">Check</button></form>'
      + '<div class="fvd-keys" role="group" aria-label="Accented letters — each one types into your answer">'
      + keys.map(function (k) { return '<button type="button" class="fvd-key" data-key="' + esc(k) + '" aria-label="Type ' + esc(k) + '">' + esc(k) + '</button>'; }).join('')
      + '</div>'
      + '<div class="fvd-fb" id="fvdFb" aria-hidden="true"></div>'
      + '<div class="fvd-play-foot"><button type="button" class="fvd-link" data-act="reveal">I don’t know — show me</button>'
      + '<span class="fvd-hint">Enter checks your answer.</span></div>'
      + '</div>';
    ask(true);
    if (R.timed) {
      timer = setInterval(tick, 250);
    }
  }

  function tick() {
    var R = S && S.round;
    var clock = $('#fvdClock');
    // The tool body was replaced (another tab, another subject): stop quietly.
    if (!R || !clock || !clock.isConnected) { stopTimer(); return; }
    var left = (R.ends - Date.now()) / 1000;
    if (left <= 0) { finish(false); return; }
    var text = C().fmtSecs(Math.ceil(left));
    if (clock.textContent !== text) clock.textContent = text;
    [30, 10].forEach(function (s) {
      if (left <= s && !R.warned[s]) {
        R.warned[s] = 1;
        var t = $('#fvdLiveTime');
        if (t) t.textContent = s + ' seconds left.';
      }
    });
  }

  function ask(first) {
    var R = S.round;
    if (!R.timed && R.pos >= R.total) { finish(false); return; }
    if (R.pos >= R.queue.length) R.queue = R.queue.concat(C().makeQueue(R.items || C().buildPool(E(), R.cfg), 200, Math.random));
    var item = R.queue[R.pos];
    R.q = C().makeQuestion(E(), item, S.lang, Math.random);
    R.waiting = false;
    var q = R.q;
    var pron = q.pronoun + (q.hint ? ' (' + q.hint + ')' : '');
    $('#fvdQ').innerHTML = '<p class="fvd-tense">' + esc(q.tenseName) + '</p>'
      + '<p class="fvd-prompt"><span class="fvd-pron">' + esc(pron) + '</span> <span class="fvd-verb" lang="' + S.lang + '">' + esc(q.verb) + '</span></p>'
      + (q.gloss ? '<p class="fvd-gloss">' + esc(q.gloss) + '</p>' : '');
    var label = $('#fvdInLabel');
    if (label) label.textContent = q.tenseName + ' of ' + q.verb + ' for ' + pron;
    var inp = $('#fvdIn');
    inp.value = '';
    inp.removeAttribute('aria-invalid');
    inp.readOnly = false;
    inp.setAttribute('lang', S.lang);
    $('#fvdGo').textContent = 'Check';
    var count = $('#fvdCount');
    if (count) count.textContent = 'Question ' + (R.pos + 1) + ' of ' + R.total;
    if (first) {
      $('#fvdFb').textContent = '';
      live('Round started. ' + q.tenseName + ': ' + pron + ', ' + q.verb + '.');
    }
    try { inp.focus({ preventScroll: false }); } catch (e) { inp.focus(); }
  }

  function record(given, res) {
    var R = S.round;
    var q = R.q;
    R.results.push({ verb: q.verb, tense: q.tense, tenseName: q.tenseName, person: q.person, pronoun: q.pronoun,
      given: given, expected: res.expected || q.answers[0], ok: !!res.ok, accents: !!res.accents });
    R.pos++;
    var right = R.results.filter(function (r) { return r.ok; }).length;
    $('#fvdScore').textContent = right + ' right';
  }

  function answer() {
    var R = S && S.round;
    if (!R || !R.q) return;
    if (R.waiting) { next(); return; }
    var inp = $('#fvdIn');
    var given = inp.value;
    var res = C().check(given, R.q, { exact: R.cfg.exact, lang: S.lang });
    var fb = $('#fvdFb');
    if (res.empty) {
      fb.className = 'fvd-fb';
      fb.textContent = 'Type an answer, or press “I don’t know”.';
      live('Type an answer first.');
      return;
    }
    record(given, res);
    var shown = C().phrase(R.q, res.expected);
    if (res.ok) {
      var note = res.accents ? ' Watch the accents: ' + res.expected + '.' : '';
      fb.className = 'fvd-fb is-ok';
      fb.innerHTML = '<span class="fvd-mark" aria-hidden="true">✓</span> Right — <b lang="' + S.lang + '">' + esc(shown) + '</b>' + (note ? '<span class="fvd-note">' + esc(note) + '</span>' : '');
      if (!R.timed && R.pos >= R.total) { finish(false); return; }
      ask(false);
      live('Right.' + note + ' Next: ' + R.q.tenseName + ', ' + R.q.pronoun + ', ' + R.q.verb + '.');
      return;
    }
    wrong(given, res, shown);
  }

  function wrong(given, res, shown) {
    var R = S.round;
    var fb = $('#fvdFb');
    var inp = $('#fvdIn');
    var why = res.accents ? 'Accents count in this round. ' : '';
    fb.className = 'fvd-fb is-no';
    fb.innerHTML = '<span class="fvd-mark" aria-hidden="true">✗</span> ' + esc(why) + 'The answer is <b lang="' + S.lang + '">' + esc(shown) + '</b>'
      + '<span class="fvd-note">Press Enter to go on.</span>';
    R.waiting = true;
    inp.setAttribute('aria-invalid', 'true');
    inp.readOnly = true;
    $('#fvdGo').textContent = 'Next';
    live('Not quite. ' + why + 'The answer is ' + shown + '. Press Enter to go on.');
    if (!R.timed && R.pos >= R.total) R.lastWrong = true;
  }

  function reveal() {
    var R = S && S.round;
    if (!R || !R.q || R.waiting) return;
    record('', { ok: false, expected: R.q.answers[0] });
    wrong('', { accents: false }, C().phrase(R.q));
    $('#fvdIn').focus();
  }

  function next() {
    var R = S.round;
    if (!R.timed && R.pos >= R.total) { finish(false); return; }
    if (R.timed && Date.now() >= R.ends) { finish(false); return; }
    ask(false);
    live(R.q.tenseName + ': ' + R.q.pronoun + ', ' + R.q.verb + '.');
  }

  function insertKey(ch) {
    var inp = $('#fvdIn');
    if (!inp || inp.readOnly) return;
    var a = inp.selectionStart == null ? inp.value.length : inp.selectionStart;
    var b = inp.selectionEnd == null ? a : inp.selectionEnd;
    inp.setRangeText(ch, a, b, 'end');
    inp.focus();
  }

  function finish(early) {
    stopTimer();
    var R = S && S.round;
    if (!R || R.done) return;
    R.done = true;
    var secs = R.timed && !early ? R.cfg.minutes * 60 : (Date.now() - R.started) / 1000;
    var sum = C().summarize(R.results, secs);
    R.summary = sum;
    R.at = Date.now();
    var best = false;
    if (!R.items && sum.answered) {
      var fp = R.assignment ? C().fingerprint(R.assignment) : '';
      updateStore(function (s) {
        var out = C().recordRound(s, {
          id: uid(), at: R.at, lang: S.lang, key: C().configKey(R.cfg), label: R.assignment ? R.assignment.title : C().describe(R.cfg, E()),
          correct: sum.correct, answered: sum.answered, secs: sum.secs, fp: fp,
        });
        best = out.best;
        s = out.store;
        if (R.assignment) {
          s = C().recordAssignment(s, asgInfo(R.assignment), { correct: sum.correct, answered: sum.answered, secs: sum.secs, at: R.at, code: '' });
        }
        return s;
      });
    }
    show('results', { best: best });
  }

  /* ── Results ────────────────────────────────────────────────────────── */

  function renderResults(box, opts) {
    var R = S.round, sum = R.summary, a = R.assignment;
    var goal = a && a.goal ? (sum.correct >= a.goal ? 'Goal reached: ' + a.goal + ' right.' : 'Goal: ' + a.goal + ' right — ' + (a.goal - sum.correct) + ' to go.') : '';
    var name = getStore().name;
    var missed = sum.missed;
    box.innerHTML = '<div class="fvd-results">'
      + '<h4 class="fvd-res-h" id="fvdResH" tabindex="-1">' + (R.items ? 'Mistakes practised' : 'Round over') + '</h4>'
      + '<p class="fvd-big"><b>' + sum.correct + '</b> right</p>'
      + '<p class="fvd-res-line">' + sum.answered + ' answered · ' + sum.accuracy + '% accuracy · ' + C().fmtSecs(sum.secs) + '</p>'
      + (opts && opts.best ? '<p class="fvd-badge">Your best with these settings</p>' : '')
      + (goal ? '<p class="fvd-badge' + (sum.correct >= a.goal ? '' : ' fvd-badge--mute') + '">' + esc(goal) + '</p>' : '')
      + (a && sum.answered ? '<form class="fvd-namebox" id="fvdNameForm" novalidate>'
        + '<p class="fvd-hint">Send your teacher a score code: it holds your name, this assignment, your score and the date.</p>'
        + '<div class="fvd-row"><label class="fvd-lbl" for="fvdName">Your name</label>'
        + '<input id="fvdName" class="fvd-line" maxlength="40" autocomplete="name" value="' + esc(name) + '">'
        + '<button type="submit" class="fsh-btn">Get my score code</button></div>'
        + '<div id="fvdCodeOut"></div></form>' : '')
      + (missed.length ? '<h5 class="fvd-h5">To practise (' + missed.length + ')</h5><div class="fvd-scroll"><table class="fvd-table"><thead><tr><th scope="col">Asked</th><th scope="col">You typed</th><th scope="col">Answer</th></tr></thead><tbody>'
        + missed.map(function (m) {
          return '<tr><td>' + esc(m.tenseName) + ': <b>' + esc(m.pronoun) + '</b> ' + esc(m.verb) + '</td><td lang="' + S.lang + '">' + (m.given ? esc(m.given) : '<i>—</i>') + '</td><td lang="' + S.lang + '"><b>' + esc(m.expected) + '</b></td></tr>';
        }).join('') + '</tbody></table></div>'
        : sum.answered ? '<p class="fvd-hint">No mistakes this round.</p>' : '<p class="fvd-hint">No answers this round.</p>')
      + '<div class="fvd-actions">'
      + (missed.length ? '<button type="button" class="fsh-btn" data-act="mistakes">Practise my mistakes (' + C().mistakeItems(R.results).length + ')</button>' : '')
      + (R.items
        ? (R.practisingFor ? '<button type="button" class="fsh-btn ghost" data-act="back-asg">Back to the assignment</button>' : '<button type="button" class="fsh-btn ghost" data-act="settings">New round</button>')
        : '<button type="button" class="fsh-btn ghost" data-act="again">' + (a ? 'Try the assignment again' : 'Play again') + '</button>'
          + '<button type="button" class="fsh-btn ghost" data-act="settings">' + (a ? 'Assignment details' : 'Change settings') + '</button>')
      + '</div></div>';
    var h = $('#fvdResH', box);
    h.focus();
    live((R.items ? 'Mistakes practised. ' : 'Round over. ') + sum.correct + ' right out of ' + sum.answered + ', ' + sum.accuracy + ' percent.' + (goal ? ' ' + goal : ''));
  }
  ACTIONS['back-asg'] = function () {
    S.assignment = S.round.practisingFor;
    show('asg');
  };

  function makeScoreCode() {
    var R = S.round, a = R && R.assignment;
    if (!a) return;
    var nameEl = $('#fvdName');
    var name = nameEl.value.replace(/\s+/g, ' ').trim();
    var out = $('#fvdCodeOut');
    if (!name) { out.innerHTML = '<p class="fvd-warn" role="alert">Type your name first, so your teacher knows whose score it is.</p>'; nameEl.focus(); return; }
    var sum = R.summary;
    var code = C().makeCode({ name: name, fp: C().fingerprint(a), correct: sum.correct, answered: sum.answered, secs: sum.secs, date: C().ymd(R.at) });
    var text = name + ' · ' + a.title + ' · ' + sum.correct + ' right of ' + sum.answered + ' (' + sum.accuracy + '%) · ' + C().fmtDate(C().ymd(R.at)) + ' · ' + code;
    updateStore(function (s) {
      s.name = name;
      s = C().recordAssignment(s, asgInfo(a), { correct: sum.correct, answered: sum.answered, secs: sum.secs, at: R.at, code: text });
      // An equal attempt is not "better", so give this one its code directly.
      s.assignments.forEach(function (x) { if (x.fp === C().fingerprint(a) && x.best && x.best.at === R.at) x.best.code = text; });
      return s;
    });
    out.innerHTML = '<label class="fvd-lbl" for="fvdCode">Copy this and paste it where your teacher asked (a Google Classroom comment, for example):</label>'
      + '<textarea id="fvdCode" class="fvd-text fvd-code" rows="3" readonly>' + esc(text) + '</textarea>'
      + '<button type="button" class="fsh-btn ghost mini" data-act="copy-code" data-for="fvdCode">Copy</button>';
    live('Your score code is ready. Copy it and send it to your teacher.');
    $('#fvdCode').focus();
    $('#fvdCode').select();
  }

  /* ── Assignments (student side) ─────────────────────────────────────── */

  function asgInfo(a) {
    return { fp: C().fingerprint(a), title: a.title, lang: a.lang, link: C().assignmentUrl(baseUrl(), a), at: Date.now() };
  }
  function baseUrl() { return location.origin + location.pathname; }

  function renderAssignment(box) {
    var a = S.assignment;
    var d = C().describeAssignment(a, E());
    var mine = getStore().assignments.filter(function (x) { return x.fp === C().fingerprint(a); })[0];
    box.innerHTML = '<div class="fvd-asg">'
      + '<p class="fvd-kicker">Assignment from your teacher</p>'
      + '<h4 class="fvd-res-h" id="fvdAsgH" tabindex="-1">' + esc(a.title) + '</h4>'
      + '<dl class="fvd-dl">'
      + '<dt>Language</dt><dd>' + esc(d.language) + '</dd>'
      + '<dt>Tenses</dt><dd>' + esc(d.tenses) + '</dd>'
      + '<dt>Verbs</dt><dd lang="' + a.lang + '">' + esc(d.verbs) + '</dd>'
      + '<dt>Pronouns</dt><dd lang="' + a.lang + '">' + esc(d.pronouns) + '</dd>'
      + '<dt>Round</dt><dd>' + esc(d.length) + '</dd>'
      + (d.goal ? '<dt>Goal</dt><dd>' + esc(d.goal) + '</dd>' : '')
      + '<dt>Accents</dt><dd>' + esc(d.accents) + '</dd></dl>'
      + (mine && mine.best ? '<p class="fvd-hint">Your best so far: ' + mine.best.correct + ' right of ' + mine.best.answered + '.</p>' : '')
      + '<p class="fvd-hint">When you finish you get a score code to send your teacher. You can try as many times as you like.</p>'
      + '<div class="fvd-actions"><button type="button" class="fsh-btn" data-act="start-asg">Start the assignment</button>'
      + '<button type="button" class="fsh-btn ghost" data-act="leave-asg">Practise something else</button></div></div>';
    $('#fvdAsgH', box).focus();
  }

  /** Open an assignment link (from the address bar, a list, or "Try it"). */
  function openLink(link) {
    var m = /#verbs=([A-Za-z0-9_-]+)/.exec(String(link || ''));
    if (!m) { live('That is not a verb drill link.'); return; }
    route({ kind: 'asg', code: m[1] });
  }

  /* ── My results ─────────────────────────────────────────────────────── */

  function renderMine(box) {
    var st = getStore();
    var lang = S.lang;
    var hist = st.history.filter(function (h) { return h.lang === lang; });
    var labels = {};
    hist.forEach(function (h) { if (!labels[h.key]) labels[h.key] = h.label; });
    var bests = Object.keys(st.best).filter(function (k) { return k.indexOf(lang + '|') === 0; })
      .map(function (k) { return { key: k, b: st.best[k], label: labels[k] || 'Earlier settings' }; })
      .sort(function (x, y) { return (y.b.at || 0) - (x.b.at || 0); }).slice(0, 12);
    var asgs = st.assignments.filter(function (a) { return a.lang === lang; });
    var row = function (h) {
      return '<tr><td>' + esc(C().fmtDate(C().ymd(h.at))) + '</td><td>' + esc(h.label) + (h.fp ? ' <span class="fvd-tag">assignment</span>' : '') + '</td><td><b>' + h.correct + '</b> / ' + h.answered + '</td><td>' + (h.answered ? Math.round((h.correct / h.answered) * 100) : 0) + '%</td></tr>';
    };
    box.innerHTML = '<div class="fvd-mine">'
      + '<h4 class="fvd-h5">Best scores</h4>'
      + (bests.length ? '<div class="fvd-scroll"><table class="fvd-table"><thead><tr><th scope="col">Settings</th><th scope="col">Best</th><th scope="col">Accuracy</th></tr></thead><tbody>'
        + bests.map(function (x) { return '<tr><td>' + esc(x.label) + '</td><td><b>' + x.b.correct + '</b> / ' + x.b.answered + '</td><td>' + (x.b.answered ? Math.round((x.b.correct / x.b.answered) * 100) : 0) + '%</td></tr>'; }).join('')
        + '</tbody></table></div>' : '<p class="fvd-hint">Finish a round and your best score for those settings appears here.</p>')
      + '<h4 class="fvd-h5">Recent rounds</h4>'
      + (hist.length ? '<div class="fvd-scroll"><table class="fvd-table" id="fvdHistory"><thead><tr><th scope="col">Date</th><th scope="col">Round</th><th scope="col">Right</th><th scope="col">Accuracy</th></tr></thead><tbody>'
        + hist.slice(0, 15).map(row).join('') + '</tbody></table></div>' : '<p class="fvd-hint">No rounds yet.</p>')
      + '<h4 class="fvd-h5">Assignments</h4>'
      + (asgs.length ? '<ul class="fvd-list">' + asgs.map(function (a, i) {
        var b = a.best;
        return '<li><div><b>' + esc(a.title) + '</b><span class="fvd-hint"> · ' + (b ? 'best ' + b.correct + ' right of ' + b.answered : 'not finished yet') + '</span></div>'
          + (b && b.code ? '<textarea class="fvd-text fvd-code" id="fvdMineCode' + i + '" rows="2" readonly aria-label="Score code for ' + esc(a.title) + '">' + esc(b.code) + '</textarea>' : '')
          + '<div class="fvd-actions fvd-actions--sm">'
          + (b && b.code ? '<button type="button" class="fsh-btn ghost mini" data-act="copy-code" data-for="fvdMineCode' + i + '" aria-label="Copy the score code for ' + esc(a.title) + '">Copy score code</button>' : '')
          + '<button type="button" class="fsh-btn ghost mini" data-act="open-asg" data-link="' + esc(a.link) + '" aria-label="Open ' + esc(a.title) + '">Open</button></div></li>';
      }).join('') + '</ul>' : '<p class="fvd-hint">When a teacher sends you an assignment link, it is listed here.</p>')
      + '<p class="fvd-hint">Saved with your language practice' + (window.currentUser ? ', and synced to your account.' : ' on this device.') + '</p>'
      + '</div>';
  }

  /* ── For teachers ───────────────────────────────────────────────────── */

  function renderTeach(box) {
    var lang = (S.teach && S.teach.lang) || S.lang;
    var cfg = S.teach && S.teach.cfg && S.teach.cfg.lang === lang ? S.teach.cfg : C().sanitizeConfig(Object.assign({}, C().defaultConfig(lang, E()), { set: 'irregular', mode: 'count', count: 20 }), E());
    var made = getStore().made;
    box.innerHTML = '<div class="fvd-teach">'
      + '<div class="fvd-honest" role="note"><b>How this works without accounts.</b> You make a link; students open it in Flux, do the drill, and send back a short score code (in Google Classroom, by email, anywhere). '
      + 'Paste the codes below to see everyone’s scores. A code catches typos, edits and mix-ups between assignments. It is <b>not cheat-proof</b>: there is no server, so someone determined could make a fake code. Class lists and grade sync need school accounts, which are switched off for now.</div>'
      + '<h4 class="fvd-h5" id="fvdMakeH">Make an assignment link</h4>'
      + '<form class="fvd-form" id="fvdTeachForm" novalidate>'
      + '<div class="fvd-field"><label class="fvd-lbl" for="fvdTtitle">Title students will see</label><input id="fvdTtitle" class="fvd-line" maxlength="80" value="' + esc((S.teach && S.teach.title) || '') + '" placeholder="Week 5: preterite"></div>'
      + '<div class="fvd-field"><label class="fvd-lbl" for="fvdTlang">Language</label><select id="fvdTlang" class="fvd-select">'
      + ['es', 'fr', 'de'].map(function (l) { return '<option value="' + l + '"' + (l === lang ? ' selected' : '') + '>' + C().LANGS[l].name + '</option>'; }).join('') + '</select></div>'
      + formHtml('fvdT', cfg)
      + '<div class="fvd-field"><label class="fvd-lbl" for="fvdTgoal">Goal (number right, optional)</label><input id="fvdTgoal" class="fvd-line fvd-line--sm" type="number" min="0" max="500" inputmode="numeric" value="' + esc((S.teach && S.teach.goal) || '') + '"></div>'
      + '<button type="submit" class="fsh-btn">Make link</button>'
      + '<p class="fvd-warn" id="fvdTeachErr" role="alert" hidden></p></form>'
      + '<div id="fvdLinkOut"></div>'
      + (made.length ? '<h4 class="fvd-h5">Assignments you made</h4><ul class="fvd-list">' + made.map(function (a) {
        return '<li><div><b>' + esc(a.title) + '</b><span class="fvd-hint"> · ' + esc(C().LANGS[a.lang].name) + ' · ' + esc(C().fmtDate(C().ymd(a.at))) + '</span></div>'
          + '<div class="fvd-actions fvd-actions--sm"><button type="button" class="fsh-btn ghost mini" data-act="copy-made" data-link="' + esc(a.link) + '" aria-label="Copy the link for ' + esc(a.title) + '">Copy link</button>'
          + '<button type="button" class="fsh-btn ghost mini" data-act="check-made" data-fp="' + esc(a.fp) + '" aria-label="Check score codes for ' + esc(a.title) + '">Check its codes</button></div></li>';
      }).join('') + '</ul>' : '')
      + '<h4 class="fvd-h5" id="fvdCheckH">Check score codes</h4>'
      + '<form class="fvd-form" id="fvdCheckForm" novalidate>'
      + '<div class="fvd-field"><label class="fvd-lbl" for="fvdCheckAsg">Assignment</label><select id="fvdCheckAsg" class="fvd-select">'
      + '<option value="">Paste its link below instead</option>'
      + made.map(function (a) { return '<option value="' + esc(a.fp) + '">' + esc(a.title) + ' (' + esc(C().LANGS[a.lang].name) + ')</option>'; }).join('')
      + '</select></div>'
      + '<div class="fvd-field"><label class="fvd-lbl" for="fvdCheckLink">Assignment link (if it is not in the list)</label><input id="fvdCheckLink" class="fvd-line" type="url" spellcheck="false" autocomplete="off"></div>'
      + '<div class="fvd-field"><label class="fvd-lbl" for="fvdCodes">Score codes — paste one or many, with or without the rest of the message</label>'
      + '<textarea id="fvdCodes" class="fvd-text" rows="5" spellcheck="false" autocomplete="off"></textarea></div>'
      + '<button type="submit" class="fsh-btn">Check codes</button></form>'
      + '<div id="fvdCheckOut" aria-live="polite"></div>'
      + '</div>';
    wireForm(box, 'fvdT', lang, function (r) { S.teach = Object.assign({}, S.teach, { lang: lang, cfg: r.cfg }); });
    $('#fvdTlang', box).addEventListener('change', function (e) {
      S.teach = { lang: e.target.value, title: $('#fvdTtitle').value, goal: $('#fvdTgoal').value };
      renderTeach(box);
      $('#fvdTlang').focus();
    });
  }

  function makeLink() {
    var box = $('#fvdBody');
    var lang = $('#fvdTlang', box).value;
    var r = readForm(box, 'fvdT', lang);
    var err = setupProblem(r);
    var out = $('#fvdTeachErr', box);
    if (err) { out.textContent = err; out.hidden = false; return; }
    out.hidden = true;
    var title = $('#fvdTtitle', box).value;
    var a = C().newAssignment(r.cfg, { title: title, goal: $('#fvdTgoal', box).value }, E());
    var link = C().assignmentUrl(baseUrl(), a);
    updateStore(function (s) { return C().recordMade(s, { fp: C().fingerprint(a), title: a.title, lang: a.lang, link: link, at: Date.now() }); });
    S.teach = { lang: lang, cfg: r.cfg, title: title, goal: $('#fvdTgoal', box).value };
    renderTeach(box);
    $('#fvdLinkOut').innerHTML = '<div class="fvd-made"><label class="fvd-lbl" for="fvdLink">Link for “' + esc(a.title) + '” — send this to your students</label>'
      + '<input id="fvdLink" class="fvd-line" readonly value="' + esc(link) + '">'
      + '<div class="fvd-actions fvd-actions--sm"><button type="button" class="fsh-btn mini" data-act="copy-link" data-for="fvdLink">Copy link</button>'
      + '<button type="button" class="fsh-btn ghost mini" data-act="try-link" data-for="fvdLink">Try it as a student</button></div>'
      + '<p class="fvd-hint">Students open it in Flux (signed in or as a guest). It is saved under “Assignments you made” for checking codes later.</p></div>';
    $('#fvdLink').focus();
    $('#fvdLink').select();
    live('Link made. Copy it and send it to your students.');
  }

  var lastRows = [];
  function checkCodes() {
    var box = $('#fvdBody');
    var out = $('#fvdCheckOut', box);
    var fp = $('#fvdCheckAsg', box).value;
    var linkText = $('#fvdCheckLink', box).value.trim();
    var a = null, note = '';
    if (linkText) {
      var m = /#verbs=([A-Za-z0-9_-]+)/.exec(linkText);
      try { a = m ? C().decodeAssignment(m[1], E()) : null; } catch (e) { a = null; }
      if (!a) note = 'That link could not be read, so codes are checked for edits only.';
    } else if (fp) {
      var made = getStore().made.filter(function (x) { return x.fp === fp; })[0];
      var mm = made && /#verbs=([A-Za-z0-9_-]+)/.exec(made.link);
      try { a = mm ? C().decodeAssignment(mm[1], E()) : null; } catch (e) { a = null; }
    } else {
      note = 'No assignment chosen, so codes are checked for edits only — not whether they belong to your assignment.';
    }
    var rows = C().checkCodes($('#fvdCodes', box).value, a);
    lastRows = rows;
    if (!rows.length) { out.innerHTML = '<p class="fvd-warn">No score codes found. A code starts with FV1.</p>'; return; }
    var okN = rows.filter(function (r) { return r.status === 'ok'; }).length;
    out.innerHTML = (note ? '<p class="fvd-hint">' + esc(note) + '</p>' : '')
      + '<p class="fvd-res-line"><b>' + rows.length + '</b> code' + (rows.length === 1 ? '' : 's') + ' · <b>' + okN + '</b> fine'
      + (rows.length - okN ? ' · <b>' + (rows.length - okN) + '</b> flagged' : '') + (a ? ' · for “' + esc(a.title) + '”' : '') + '</p>'
      + '<div class="fvd-scroll"><table class="fvd-table" id="fvdCheckTable"><thead><tr><th scope="col">Name</th><th scope="col">Right</th><th scope="col">Answered</th><th scope="col">Accuracy</th><th scope="col">Date</th>'
      + (a && a.goal ? '<th scope="col">Goal</th>' : '') + '<th scope="col">Check</th></tr></thead><tbody>'
      + rows.map(function (r) {
        var flag = r.status !== 'ok';
        return '<tr class="' + (flag ? 'is-flag' : '') + '"><td>' + esc(r.name || '—') + '</td><td>' + (r.correct != null ? r.correct : '—') + '</td><td>' + (r.answered != null ? r.answered : '—') + '</td><td>'
          + (r.answered ? r.accuracy + '%' : '—') + '</td><td>' + esc(r.date ? C().fmtDate(r.date) : '—') + '</td>'
          + (a && a.goal ? '<td>' + (r.goalMet == null ? '—' : r.goalMet ? 'Met' : 'Not yet') + '</td>' : '')
          + '<td><span class="fvd-status">' + (flag ? '<span aria-hidden="true">⚠ </span>' : '<span aria-hidden="true">✓ </span>') + esc(C().STATUS_TEXT[r.status]) + '</span></td></tr>';
      }).join('') + '</tbody></table></div>'
      + '<button type="button" class="fsh-btn ghost mini" data-act="copy-table">Copy table (for a spreadsheet)</button>';
    live(rows.length + ' codes checked. ' + okN + ' fine' + (rows.length - okN ? ', ' + (rows.length - okN) + ' flagged.' : '.'));
  }
  function copyTable() {
    var lines = [['Name', 'Right', 'Answered', 'Accuracy %', 'Date', 'Check'].join('\t')].concat(lastRows.map(function (r) {
      return [r.name, r.correct, r.answered, r.accuracy, r.date ? C().fmtDate(r.date) : '', C().STATUS_TEXT[r.status]].join('\t');
    }));
    copyText(lines.join('\n')).then(function (ok) { live(ok ? 'Table copied. Paste it into a spreadsheet.' : 'Could not copy the table.'); });
  }

  /* ── Links into the planner: #verbs=<assignment> and #verbs-teacher ──── */

  /* A student may open the link before signing in, or before onboarding, so
     the route is parked in this tab's sessionStorage and the hash cleared at
     once (Supabase reads the hash on sign-in; nothing of ours should sit
     there). It is acted on when the planner is on screen. */
  function parkRoute() {
    var h = String(location.hash || '');
    var m = /^#verbs=([A-Za-z0-9_-]{8,6000})$/.exec(h);
    var r = m ? { kind: 'asg', code: m[1] } : h === '#verbs-teacher' ? { kind: 'teach' } : null;
    if (!r) return false;
    try { sessionStorage.setItem(ROUTE_KEY, JSON.stringify(r)); } catch (e) { parked = r; }
    try { history.replaceState(history.state, '', location.pathname + location.search); } catch (e) { /* leave the hash */ }
    return true;
  }
  var parked = null;
  function takeRoute() {
    var r = parked;
    parked = null;
    try {
      var raw = sessionStorage.getItem(ROUTE_KEY);
      if (raw) { r = JSON.parse(raw); sessionStorage.removeItem(ROUTE_KEY); }
    } catch (e) { /* use the in-memory one */ }
    return r;
  }
  function appVisible() {
    var app = document.getElementById('app');
    return !!(app && app.classList.contains('visible') && typeof window.nav === 'function');
  }
  /** Open the drill for a route: Study tools ▸ <language> ▸ Verb drill. */
  function route(r) {
    if (!r || !C() || !E()) return;
    var lang = (S && S.lang) || 'es', view = 'teach', a = null, error = '';
    if (r.kind === 'asg') {
      try { a = C().decodeAssignment(r.code, E()); lang = a.lang; view = 'asg'; } catch (e) { error = e.message; view = 'setup'; }
      if (a) updateStore(function (s) { return C().recordAssignment(s, asgInfo(a)); });
    } else {
      try {
        var cur = window.fluxStudyHub && window.fluxStudyHub.currentSubject && window.fluxStudyHub.currentSubject();
        if (LANG_OF_SUBJECT[cur]) lang = LANG_OF_SUBJECT[cur];
      } catch (e) { /* default Spanish */ }
    }
    pending = { lang: lang, view: view, assignment: a, error: error };
    try { window.nav('toolbox'); } catch (e) { /* still try the hub */ }
    var tries = 0;
    (function go() {
      var H = window.fluxStudyHub;
      if (H && H.openTool && document.getElementById('fshRoot')) { H.openTool(SUBJECT[lang], 'verbs'); return; }
      if (++tries < 40) setTimeout(go, 150);
    })();
  }
  function routeWhenReady() {
    if (!parkRoute() && !parked) {
      try { if (!sessionStorage.getItem(ROUTE_KEY)) return; } catch (e) { return; }
    }
    if (appVisible()) { route(takeRoute()); return; }
    var app = document.getElementById('app');
    if (!app || typeof MutationObserver === 'undefined') { setTimeout(routeWhenReady, 500); return; }
    var mo = new MutationObserver(function () {
      if (appVisible()) { mo.disconnect(); setTimeout(function () { route(takeRoute()); }, 300); }
    });
    mo.observe(app, { attributes: true, attributeFilter: ['class'] });
  }
  window.addEventListener('hashchange', function () { if (/^#verbs/.test(location.hash)) routeWhenReady(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', routeWhenReady);
  else routeWhenReady();

  window.FluxVerbDrill = {
    render: render,
    openLink: openLink,
    // Test seams: the question on screen, and the round so far.
    _current: function () { return S && S.round && S.round.q ? JSON.parse(JSON.stringify(S.round.q)) : null; },
    _round: function () { return S && S.round ? { pos: S.round.pos, total: S.round.total, timed: S.round.timed, results: S.round.results.slice(), waiting: S.round.waiting } : null; },
    _finish: function () { finish(false); },
    /** Bring a timed round's end to `ms` from now (tests cannot wait five minutes). */
    _endIn: function (ms) { if (S && S.round && S.round.timed) S.round.ends = Date.now() + ms; },
  };
})();
