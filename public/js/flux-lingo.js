/* ============================================================================
   FLUX LINGO  ·  flux-lingo.js
   The page translate.html became: Conjugate (every tense of any Spanish or
   French verb), Practice (type the form, against the clock) and Translate
   (flux-translator.js, unchanged).

   The forms come from flux-conj.js and nowhere else; this file only draws
   them, speaks them and asks for them.
   ========================================================================== */
(function () {
  'use strict';
  if (window.FluxLingo) return;
  var C = window.FluxConj;

  var KEY = 'flux_lingo.v1';
  var ACCENTS = { es: ['á', 'é', 'í', 'ó', 'ú', 'ñ', 'ü', '¿', '¡'], fr: ['é', 'è', 'ê', 'ë', 'à', 'â', 'ç', 'î', 'ï', 'ô', 'û', 'ù', 'œ'] };
  var LANG_NAME = { es: 'Spanish', fr: 'French' };
  var VOICE = { es: 'es-ES', fr: 'fr-FR' };
  var STARTERS = {
    es: ['ser', 'estar', 'tener', 'ir', 'hacer', 'poder', 'decir', 'querer', 'hablar', 'comer', 'vivir', 'levantarse'],
    fr: ['être', 'avoir', 'aller', 'faire', 'pouvoir', 'vouloir', 'venir', 'prendre', 'parler', 'finir', 'vendre', 'se lever'],
  };
  /* The tenses a first or second year course covers, shown by "Essentials". */
  var ESSENTIAL = {
    es: { present: 1, preterite: 1, imperfect: 1, future: 1, conditional: 1, perfect: 1, subjPresent: 1, impAffirmative: 1, impNegative: 1, pluperfect: 1, subjImperfect: 1 },
    fr: { present: 1, passeCompose: 1, imperfect: 1, future: 1, conditional: 1, subjPresent: 1, imperative: 1, pluperfect: 1, conditionalPerfect: 1 },
  };
  /* Practice sets: verbs worth drilling together. */
  var SETS = {
    es: [
      ['top', 'Top 20 verbs', 'ser estar tener ir hacer poder decir querer ver dar saber venir poner salir llegar pasar deber parecer seguir llevar'],
      ['irr', 'Irregular preterites', 'tener estar poder poner saber hacer querer venir decir traer conducir andar ir ser dar'],
      ['stem', 'Stem-changers', 'pensar querer empezar cerrar poder dormir volver contar pedir servir repetir jugar sentir preferir'],
      ['go', '"yo-go" verbs', 'tener venir poner salir hacer decir traer caer oír valer'],
      ['reg', 'Regular -ar, -er, -ir', 'hablar trabajar estudiar comer beber aprender vivir escribir abrir recibir'],
      ['refl', 'Reflexive verbs', 'levantarse ducharse acostarse despertarse vestirse sentarse llamarse irse quedarse divertirse'],
    ],
    fr: [
      ['top', 'Top 20 verbs', 'être avoir aller faire dire pouvoir vouloir savoir venir voir prendre devoir mettre falloir croire parler donner trouver passer tenir'],
      ['irr', 'Irregular essentials', 'être avoir aller faire dire pouvoir vouloir savoir venir voir prendre devoir mettre boire écrire lire'],
      ['etre', 'Verbs with être', 'aller venir arriver partir entrer sortir rester tomber naître mourir monter descendre retourner devenir revenir'],
      ['er', 'Spelling-change -er', 'manger commencer acheter appeler jeter lever préférer espérer payer employer envoyer'],
      ['reg', 'Regular -er, -ir, -re', 'parler aimer donner finir choisir réussir vendre attendre répondre perdre'],
      ['refl', 'Reflexive verbs', 'se lever se coucher se réveiller s\'habiller se laver se promener s\'asseoir se souvenir s\'amuser se dépêcher'],
    ],
  };

  /** Imperative tenses (not "imperfect", which also starts with imp). */
  function isImp(id) { return /^(impAffirmative|impNegative|imperative|imperativePast)$/.test(id); }
  /* Short subject labels for the tables, so a form never wraps under its pronoun. */
  var SHORT = { es: ['yo', 'tú', 'él/ella/Ud.', 'nosotros', 'vosotros', 'ellos/Uds.'], fr: ['je', 'tu', 'il/elle/on', 'nous', 'vous', 'ils/elles'] };

  function load() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* private window */ } }
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };

  function speak(text, lang) {
    try {
      if (!('speechSynthesis' in window)) return;
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.lang = VOICE[lang];
      var v = speechSynthesis.getVoices().filter(function (x) { return x.lang && x.lang.slice(0, 2) === lang; })[0];
      if (v) u.voice = v;
      u.rate = 0.9;
      speechSynthesis.speak(u);
    } catch (e) { /* no speech here */ }
  }

  /** The subject a form is read with: "yo tengo", "j'ai", "que nous soyons". */
  function withSubject(lang, tenseId, i, form) {
    if (form == null) return null;
    if (isImp(tenseId)) return form;
    if (lang === 'es') {
      var subj = ['yo', 'tú', 'él', 'nosotros', 'vosotros', 'ellos'][i];
      return (/^subj/.test(tenseId) ? 'que ' : '') + subj + ' ' + form;
    }
    var p = C.subjectFor('fr', i, form);
    var s = p === "j'" ? p + form : p + ' ' + form;
    if (/^subj/.test(tenseId)) s = (/^[aeiouyh]/.test(s) && p !== 'nous' && p !== 'vous' && p !== 'tu' ? "qu'" : 'que ') + s;
    return s;
  }

  function mount(host) {
    var state = load();
    state.lang = state.lang === 'fr' ? 'fr' : 'es';
    state.recent = state.recent || { es: [], fr: [] };
    state.saved = state.saved || { es: [], fr: [] };
    state.view = state.view || 'all';
    state.vosotros = state.vosotros !== false;
    state.highlight = state.highlight !== false;
    var cur = null;     // the conjugation on show
    var tab = 'conjugate';

    host.innerHTML =
      '<nav class="lg-tabs" role="tablist" aria-label="Flux Lingo">'
      + '<button type="button" role="tab" class="lg-tab" data-tab="conjugate">Conjugate</button>'
      + '<button type="button" role="tab" class="lg-tab" data-tab="practice">Practice</button>'
      + '<button type="button" role="tab" class="lg-tab" data-tab="translate">Translate</button>'
      + '</nav>'
      + '<section class="lg-panel" id="lgConj" role="tabpanel" aria-label="Conjugate"></section>'
      + '<section class="lg-panel" id="lgPractice" role="tabpanel" aria-label="Practice" hidden></section>'
      + '<section class="lg-panel" id="lgTranslate" role="tabpanel" aria-label="Translate" hidden></section>';
    var $ = function (sel) { return host.querySelector(sel); };
    var conjEl = $('#lgConj'), pracEl = $('#lgPractice'), trEl = $('#lgTranslate');

    /* ── Tabs and the address ──────────────────────────────────────────── */

    function setTab(t, quiet) {
      tab = t;
      host.querySelectorAll('.lg-tab').forEach(function (b) {
        var on = b.dataset.tab === t;
        b.setAttribute('aria-selected', String(on));
        b.classList.toggle('is-on', on);
      });
      conjEl.hidden = t !== 'conjugate';
      pracEl.hidden = t !== 'practice';
      trEl.hidden = t !== 'translate';
      if (t === 'translate' && !trEl.dataset.ready && window.FluxTranslator) { window.FluxTranslator.mount(trEl); trEl.dataset.ready = '1'; }
      if (t === 'practice' && !pracEl.dataset.ready) { drawPracticeSetup(); pracEl.dataset.ready = '1'; }
      if (!quiet) writeHash();
    }
    host.querySelector('.lg-tabs').addEventListener('click', function (e) {
      var b = e.target.closest('.lg-tab');
      if (b) setTab(b.dataset.tab);
    });
    function writeHash() {
      var h = tab === 'conjugate' ? '#' + state.lang + (cur ? '/' + encodeURIComponent(cur.infinitive) : '') : '#' + tab;
      if (location.hash !== h) history.replaceState(null, '', h);
    }
    function readHash() {
      var h = decodeURIComponent(location.hash.replace(/^#/, ''));
      var m = h.match(/^(es|fr)(?:\/(.+))?$/);
      if (m) { state.lang = m[1]; paintLang(); setTab('conjugate', true); if (m[2]) show(m[2]); return; }
      if (h === 'practice' || h === 'translate') { setTab(h, true); return; }
      setTab('conjugate', true);
    }

    /* ── Conjugate ─────────────────────────────────────────────────────── */

    conjEl.innerHTML =
      '<div class="lg-head">'
      + '<div class="lg-langs" role="radiogroup" aria-label="Language">'
      + '<button type="button" role="radio" class="lg-lang" data-lang="es"><span aria-hidden="true">ñ</span> Spanish</button>'
      + '<button type="button" role="radio" class="lg-lang" data-lang="fr"><span aria-hidden="true">ç</span> French</button></div>'
      + '<div class="lg-search"><label class="lg-sr" for="lgQ">Find a verb</label>'
      + '<input id="lgQ" class="lg-q" type="search" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="false" aria-controls="lgSugg" aria-autocomplete="list">'
      + '<ul id="lgSugg" class="lg-sugg" role="listbox" hidden></ul></div></div>'
      + '<div class="lg-chips" id="lgChips"></div>'
      + '<div id="lgVerb" aria-live="polite"></div>';
    var q = $('#lgQ'), sugg = $('#lgSugg'), verbEl = $('#lgVerb'), chips = $('#lgChips');

    function paintLang() {
      host.querySelectorAll('.lg-lang').forEach(function (b) {
        var on = b.dataset.lang === state.lang;
        b.setAttribute('aria-checked', String(on));
        b.classList.toggle('is-on', on);
      });
      q.placeholder = state.lang === 'es' ? 'Type a verb, any form, or English — tener, tuvimos, "to have"' : 'Type a verb, any form, or English — avoir, eûmes, "to have"';
      drawChips();
    }
    host.querySelector('.lg-langs').addEventListener('click', function (e) {
      var b = e.target.closest('.lg-lang');
      if (!b || b.dataset.lang === state.lang) return;
      state.lang = b.dataset.lang; save(state);
      cur = null; verbEl.innerHTML = ''; q.value = '';
      paintLang(); drawEmpty(); writeHash(); q.focus();
    });

    function drawChips() {
      var saved = state.saved[state.lang] || [], recent = (state.recent[state.lang] || []).filter(function (v) { return saved.indexOf(v) === -1; });
      var chip = function (v, cls) { return '<button type="button" class="lg-chip' + (cls || '') + '" data-verb="' + esc(v) + '">' + esc(v) + '</button>'; };
      var h = '';
      if (saved.length) h += '<span class="lg-chips-h">★ Saved</span>' + saved.map(function (v) { return chip(v, ' is-saved'); }).join('');
      if (recent.length) h += '<span class="lg-chips-h">Recent</span>' + recent.slice(0, 10).map(function (v) { return chip(v); }).join('');
      if (!h) h = '<span class="lg-chips-h">Try</span>' + STARTERS[state.lang].map(function (v) { return chip(v); }).join('');
      chips.innerHTML = h;
    }
    chips.addEventListener('click', function (e) { var b = e.target.closest('[data-verb]'); if (b) show(b.dataset.verb); });

    function drawEmpty() {
      verbEl.innerHTML = '<div class="lg-empty"><p class="lg-empty-h">Every tense of every ' + LANG_NAME[state.lang] + ' verb.</p>'
        + '<p>Type an infinitive (' + (state.lang === 'es' ? 'tener' : 'avoir') + '), any form you have seen (' + (state.lang === 'es' ? 'tuvieron, hubiéramos' : 'eûmes, soyez') + ') or the English (to have). Irregular forms are highlighted; tap any form to hear it.</p>'
        + '<div class="lg-starters">' + STARTERS[state.lang].map(function (v) { return '<button type="button" class="lg-chip" data-verb="' + esc(v) + '">' + esc(v) + '</button>'; }).join('') + '</div></div>';
    }
    verbEl.addEventListener('click', function (e) {
      var b = e.target.closest('[data-verb]');
      if (b) { show(b.dataset.verb); return; }
      var f = e.target.closest('[data-say]');
      if (f) speak(f.dataset.say, cur ? cur.lang : state.lang);
      var a = e.target.closest('[data-act]');
      if (!a || !cur) return;
      var act = a.dataset.act;
      if (act === 'save') {
        var list = state.saved[cur.lang] = state.saved[cur.lang] || [];
        var at = list.indexOf(cur.infinitive);
        if (at === -1) list.unshift(cur.infinitive); else list.splice(at, 1);
        save(state); drawVerb(); drawChips();
      } else if (act === 'listen') {
        speak(cur.infinitive + '. ' + cur.tenses.present.filter(Boolean).map(function (f, i) { return withSubject(cur.lang, 'present', cur.tenses.present.indexOf(f), f); }).join(', '), cur.lang);
      } else if (act === 'copy') {
        copyTable();
      } else if (act === 'print') {
        window.print();
      } else if (act === 'practice') {
        startPracticeWith([cur.infinitive], cur.lang);
      } else if (act === 'view') {
        state.view = a.dataset.v; save(state); drawVerb();
      } else if (act === 'vosotros') {
        state.vosotros = !state.vosotros; save(state); drawVerb();
      } else if (act === 'highlight') {
        state.highlight = !state.highlight; save(state); drawVerb();
      }
    });

    /* Suggestions while typing. */
    var active = -1, results = [];
    function suggest() {
      var text = q.value;
      results = text.trim() ? C.search(state.lang, text, 8) : [];
      active = results.length ? 0 : -1;
      if (!results.length) { sugg.hidden = true; q.setAttribute('aria-expanded', 'false'); return; }
      sugg.innerHTML = results.map(function (r, i) {
        var why = r.why === 'form' && r.hit ? formLabel(r.hit) : r.why === 'english' ? 'English match' : r.why === 'near' ? 'did you mean?' : '';
        return '<li role="option" id="lgOpt' + i + '" class="lg-opt' + (i === active ? ' is-on' : '') + '" data-i="' + i + '" aria-selected="' + (i === active) + '">'
          + '<b>' + esc(r.verb) + '</b><span class="lg-opt-g">' + esc(r.gloss) + '</span>'
          + (why ? '<span class="lg-opt-w">' + esc(why) + '</span>' : '') + '</li>';
      }).join('');
      sugg.hidden = false;
      q.setAttribute('aria-expanded', 'true');
      q.setAttribute('aria-activedescendant', 'lgOpt' + active);
    }
    function formLabel(hit) {
      var t = tenseName(state.lang, hit.tense);
      if (hit.person < 0) return 'participle / gerund';
      var who = isImp(hit.tense) ? C.imperativePersons(state.lang)[hit.person] : C.persons(state.lang)[hit.person];
      return '“' + hit.form + '” = ' + who + ', ' + t;
    }
    function moveActive(d) {
      if (!results.length) return;
      active = (active + d + results.length) % results.length;
      sugg.querySelectorAll('.lg-opt').forEach(function (li, i) { li.classList.toggle('is-on', i === active); li.setAttribute('aria-selected', String(i === active)); });
      q.setAttribute('aria-activedescendant', 'lgOpt' + active);
    }
    function pick(i) {
      var r = results[i];
      sugg.hidden = true; q.setAttribute('aria-expanded', 'false');
      if (!r) return;
      // "se lever" typed: keep it reflexive.
      var typed = q.value.trim().toLowerCase();
      var verb = r.verb;
      if (state.lang === 'fr' && /^(se |s'|s’)/.test(typed) && r.why !== 'form') verb = (/^[aeiouyéèêh]/.test(verb) ? "s'" : 'se ') + verb;
      show(verb, r.hit);
    }
    q.addEventListener('input', suggest);
    q.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); moveActive(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); moveActive(-1); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        if (results.length && active >= 0) pick(active);
        else if (C.looksLikeInfinitive(state.lang, q.value)) show(q.value);
      } else if (e.key === 'Escape') { sugg.hidden = true; q.setAttribute('aria-expanded', 'false'); }
    });
    sugg.addEventListener('mousedown', function (e) { var li = e.target.closest('.lg-opt'); if (li) { e.preventDefault(); pick(+li.dataset.i); } });
    document.addEventListener('click', function (e) { if (!e.target.closest('.lg-search')) { sugg.hidden = true; q.setAttribute('aria-expanded', 'false'); } });
    // "/" jumps to the search, as on most reference sites.
    document.addEventListener('keydown', function (e) {
      if (e.key === '/' && tab === 'conjugate' && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); q.focus(); q.select(); }
    });

    function tenseName(lang, id) {
      var out = id;
      C.groups(lang).forEach(function (g) { g.tenses.forEach(function (t) { if (t[0] === id) out = g.name.replace(/ ·.*$/, '') + ' ' + t[1].toLowerCase(); }); });
      if (id === 'nonfinite') out = 'participle';
      return out;
    }

    var flash = null;
    function show(verb, hit) {
      var r = null;
      try { r = C.conjugate(state.lang, verb); } catch (e) { r = null; }
      if (!r) {
        verbEl.innerHTML = '<div class="lg-empty"><p class="lg-empty-h">“' + esc(verb) + '” is not a ' + LANG_NAME[state.lang] + ' infinitive.</p><p>'
          + (state.lang === 'es' ? 'Spanish infinitives end in -ar, -er or -ir.' : 'French infinitives end in -er, -ir or -re.') + ' Try typing a form you have seen instead — the search finds the verb from it.</p></div>';
        return;
      }
      cur = r;
      flash = hit || null;
      q.value = r.infinitive;
      var rec = state.recent[r.lang] = (state.recent[r.lang] || []).filter(function (v) { return v !== r.infinitive; });
      rec.unshift(r.infinitive);
      if (rec.length > 12) rec.length = 12;
      save(state);
      drawVerb(); drawChips(); writeHash();
      document.title = r.infinitive + ' — conjugation · Flux Lingo';
      if (flash) {
        var cell = verbEl.querySelector('[data-cell="' + flash.tense + '-' + flash.person + '"]');
        if (cell) { cell.classList.add('is-flash'); cell.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
      }
    }

    function drawVerb() {
      var r = cur;
      if (!r) return;
      var lex = C.lexicon(r.lang);
      var gloss = lex[r.base] || lex[r.infinitive] || '';
      var saved = (state.saved[r.lang] || []).indexOf(r.infinitive) !== -1;
      var anyIrr = Object.keys(r.irregular).some(function (k) { return r.irregular[k].some(Boolean); }) || r.participleIrregular;
      var badges = '<span class="lg-badge ' + (anyIrr ? 'is-irr' : 'is-reg') + '">' + (anyIrr ? 'Irregular' : 'Regular') + '</span>';
      if (r.lang === 'fr') badges += '<span class="lg-badge">' + (r.group === 1 ? '1st group (-er)' : r.group === 2 ? '2nd group (-ir)' : '3rd group') + '</span>';
      if (r.reflexive) badges += '<span class="lg-badge">Reflexive</span>';
      if (r.model) badges += '<span class="lg-badge">like ' + esc(r.model) + '</span>';
      if (!r.known) badges += '<span class="lg-badge is-warn" title="Not in the Flux dictionary: conjugated by the regular rules for its ending.">Not in the dictionary</span>';
      var nonfinite = r.lang === 'es'
        ? nf('Gerund', r.gerund, r.gerundIrregular) + nf('Past participle', r.participle, r.participleIrregular)
        : nf('Present participle', r.participlePresent, false) + nf('Past participle', r.participle, r.participleIrregular)
          + nf('Auxiliary', r.auxiliary + (r.auxiliaryNote ? ' — ' + r.auxiliaryNote.replace(/^être; /, '') : ''), false, true);
      var view = state.view;
      var h = '<article class="lg-verb">'
        + '<header class="lg-vh"><div><h1 class="lg-inf" data-say="' + esc(r.infinitive) + '" title="Hear it">' + esc(r.infinitive) + '</h1>'
        + (gloss ? '<p class="lg-gloss">' + esc(gloss) + '</p>' : '') + '<div class="lg-badges">' + badges + '</div></div>'
        + '<div class="lg-actions">'
        + btn('listen', '🔊', 'Hear the present') + btn('save', saved ? '★' : '☆', saved ? 'Unsave' : 'Save', saved)
        + btn('copy', '⧉', 'Copy') + btn('print', '⎙', 'Print') + btn('practice', '✎', 'Practise this verb', false, true) + '</div></header>'
        + '<div class="lg-nf">' + nonfinite + '</div>'
        + (r.notes && r.notes.length ? '<ul class="lg-notes">' + r.notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul>' : '')
        + '<div class="lg-tools">'
        + '<div class="lg-seg" role="radiogroup" aria-label="Which tenses">'
        + '<button type="button" role="radio" data-act="view" data-v="essential" aria-checked="' + (view === 'essential') + '" class="' + (view === 'essential' ? 'is-on' : '') + '">Essentials</button>'
        + '<button type="button" role="radio" data-act="view" data-v="all" aria-checked="' + (view === 'all') + '" class="' + (view === 'all' ? 'is-on' : '') + '">All tenses</button></div>'
        + (r.lang === 'es' ? toggle('vosotros', 'vosotros', state.vosotros) : '')
        + toggle('highlight', 'Highlight irregular', state.highlight)
        + '</div>'
        + '<div class="lg-groups' + (state.highlight ? ' hl' : '') + '">' + C.groups(r.lang).map(function (g) { return drawGroup(r, g, view); }).join('') + '</div>'
        + '<p class="lg-foot">Tap any form to hear it. ' + (r.lang === 'fr' ? 'With être, the participle agrees: (e) feminine, (s) plural.' : 'Forms in colour are irregular or change their spelling.') + '</p>'
        + '</article>';
      verbEl.innerHTML = h;
    }
    function nf(label, val, irr, plain) {
      if (!val) return '';
      return '<div class="lg-nf-i"><span class="lg-nf-k">' + label + '</span><span class="lg-nf-v' + (irr ? ' is-irr' : '') + '"' + (plain ? '' : ' data-say="' + esc(val) + '"') + '>' + esc(val) + '</span></div>';
    }
    function btn(act, icon, label, on, wide) {
      return '<button type="button" class="lg-act' + (on ? ' is-on' : '') + (wide ? ' lg-act--wide' : '') + '" data-act="' + act + '" aria-label="' + esc(label) + '" title="' + esc(label) + '"><span aria-hidden="true">' + icon + '</span>' + (wide ? '<span>' + esc(label) + '</span>' : '') + '</button>';
    }
    function toggle(act, label, on) {
      return '<button type="button" class="lg-toggle' + (on ? ' is-on' : '') + '" data-act="' + act + '" role="switch" aria-checked="' + on + '"><span class="lg-sw" aria-hidden="true"></span>' + esc(label) + '</button>';
    }
    function drawGroup(r, g, view) {
      var ts = g.tenses.filter(function (t) { return view === 'all' || ESSENTIAL[r.lang][t[0]]; });
      if (!ts.length) return '';
      return '<section class="lg-group"><h2 class="lg-gh">' + esc(g.name) + '</h2><div class="lg-cards">'
        + ts.map(function (t) { return drawCard(r, t); }).join('') + '</div></section>';
    }
    function drawCard(r, t) {
      var id = t[0], forms = r.tenses[id] || [];
      var irr = r.irregular[id] || [];
      var alts = r.alts[id] || [];
      var imp = isImp(id);
      var persons = imp ? C.imperativePersons(r.lang) : SHORT[r.lang];
      var rows = forms.map(function (f, i) {
        if (f == null) return '';
        if (r.lang === 'es' && !state.vosotros && i === 4) return '';
        var pron = persons[i];
        var shown = esc(f);
        if (r.lang === 'fr' && !imp) {
          var p = C.subjectFor('fr', i, f);
          pron = (/^subj/.test(id) ? (p === "j'" ? "que j'" : (p === 'il' ? "qu'il / elle" : p === 'ils' ? "qu'ils / elles" : 'que ' + p)) : (p === "j'" ? "j'" : persons[i]));
        } else if (r.lang === 'es' && /^subj/.test(id)) pron = 'que ' + pron;
        var a = alts[i] && alts[i].length ? '<span class="lg-alt">also ' + alts[i].map(esc).join(', ') + '</span>' : '';
        var say = withSubject(r.lang, id, i, f).replace(/\(e\)|\(s\)/g, '');
        return '<li class="lg-row" data-cell="' + id + '-' + i + '"><span class="lg-pron">' + esc(pron) + '</span>'
          + '<span class="lg-form' + (irr[i] ? ' is-irr' : '') + '" data-say="' + esc(say) + '" tabindex="0" role="button" aria-label="' + esc(say) + (irr[i] ? ', irregular' : '') + '">' + shown + '</span>' + a + '</li>';
      }).join('');
      return '<div class="lg-card"><h3 class="lg-th" title="' + esc(t[3]) + '">' + esc(t[1]) + '<span class="lg-te">' + esc(t[2]) + '</span></h3>'
        + '<p class="lg-tu">' + esc(t[3]) + '</p><ul class="lg-rows">' + rows + '</ul></div>';
    }
    verbEl.addEventListener('keydown', function (e) {
      var f = e.target.closest('[data-say]');
      if (f && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); speak(f.dataset.say, cur ? cur.lang : state.lang); }
    });

    function copyTable() {
      var r = cur, lines = [r.infinitive + (C.lexicon(r.lang)[r.base] ? ' — ' + C.lexicon(r.lang)[r.base] : ''), ''];
      C.groups(r.lang).forEach(function (g) {
        g.tenses.forEach(function (t) {
          var fs = (r.tenses[t[0]] || []).map(function (f, i) { return f == null ? null : (isImp(t[0]) ? f : withSubject(r.lang, t[0], i, f)); }).filter(Boolean);
          lines.push(g.name + ' — ' + t[1] + ': ' + fs.join(', '));
        });
      });
      var text = lines.join('\n');
      var done = function () { var b = verbEl.querySelector('[data-act="copy"]'); if (b) { b.classList.add('is-on'); setTimeout(function () { b.classList.remove('is-on'); }, 1200); } };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () {});
    }

    /* ── Practice ──────────────────────────────────────────────────────── */

    var P = null;   // the round in progress
    /* What a round asks for: verb forms, or vocabulary in either direction.
       The vocabulary is FluxLangPractice's themed decks (the planner's Practice
       card), so a word fixed there is fixed here too. */
    function vocab() { return window.FluxLangPractice && FluxLangPractice.themes ? FluxLangPractice : null; }
    function kindLabel(kind, lang) {
      return kind === 'to' ? 'English → ' + LANG_NAME[lang] : kind === 'from' ? LANG_NAME[lang] + ' → English' : 'Verb forms';
    }
    function drawPracticeSetup(pre) {
      var lang = (pre && pre.lang) || state.lang;
      var st = state.practice || {};
      var kind = (pre && pre.kind) || (pre && pre.verbs ? 'verbs' : st.kind) || 'verbs';
      if (kind !== 'verbs' && !vocab()) kind = 'verbs';
      var tenses = st.tenses && st.tenses[lang] || (lang === 'es' ? ['present', 'preterite'] : ['present', 'passeCompose']);
      var verbs = (pre && pre.verbs) || (st.verbs && st.verbs[lang]) || SETS[lang][0][2].split(' ').slice(0, 10);
      var decks = st.decks && st.decks.length ? st.decks : ['school'];
      var V = vocab();
      var verbPanels = '<fieldset class="lg-fs lg-fs--wide"><legend>Verbs</legend><div class="lg-sets">' + SETS[lang].map(function (s) { return '<button type="button" class="lg-chip" data-set="' + s[0] + '">' + esc(s[1]) + '</button>'; }).join('') + '</div>'
        + '<label class="lg-sr" for="lgPVerbs">Verbs, separated by commas</label><textarea id="lgPVerbs" class="lg-pverbs" rows="2">' + esc(verbs.join(', ')) + '</textarea></fieldset>'
        + '<fieldset class="lg-fs lg-fs--wide"><legend>Tenses</legend><div class="lg-ptenses">'
        + C.groups(lang).map(function (g) {
          return '<div class="lg-ptg"><span class="lg-ptg-h">' + esc(g.name) + '</span>' + g.tenses.map(function (t) {
            return '<label class="lg-check"><input type="checkbox" value="' + t[0] + '"' + (tenses.indexOf(t[0]) !== -1 ? ' checked' : '') + '> ' + esc(t[1]) + '</label>';
          }).join('') + '</div>';
        }).join('') + '</div></fieldset>';
      var deckPanel = V ? '<fieldset class="lg-fs lg-fs--wide"><legend>Topics</legend><div class="lg-decks">'
        + V.themes().map(function (t) {
          return '<label class="lg-deck"><input type="checkbox" value="' + esc(t.id) + '"' + (decks.indexOf(t.id) !== -1 ? ' checked' : '') + '><span>' + esc(t.name) + ' <em>' + t.count + '</em></span></label>';
        }).join('') + '</div></fieldset>' : '';
      pracEl.innerHTML = '<div class="lg-pset">'
        + '<header class="lg-phead"><div><h2 class="lg-ph">Practice</h2><p class="lg-plead">' + (kind === 'verbs'
          ? 'Type the form. Instant marking, accents explained, and the ones you miss come back at the end.'
          : 'Translate the word. Articles and accents are pointed out, and the ones you miss come back at the end.') + '</p></div>'
        + '<div class="lg-langs" role="radiogroup" aria-label="Language">'
        + ['es', 'fr'].map(function (l) { return '<button type="button" role="radio" class="lg-lang' + (l === lang ? ' is-on' : '') + '" aria-checked="' + (l === lang) + '" data-plang="' + l + '">' + LANG_NAME[l] + '</button>'; }).join('') + '</div></header>'
        + '<div class="lg-kinds" role="radiogroup" aria-label="What to practise">'
        + ['verbs', 'to', 'from'].filter(function (k) { return k === 'verbs' || V; }).map(function (k) {
          var on = k === kind;
          return '<button type="button" role="radio" class="lg-kind' + (on ? ' is-on' : '') + '" aria-checked="' + on + '" data-kind="' + k + '"><b>' + esc(kindLabel(k, lang)) + '</b><span>'
            + (k === 'verbs' ? 'Conjugate in any tense' : k === 'to' ? 'See English, write ' + LANG_NAME[lang] : 'See ' + LANG_NAME[lang] + ', write English') + '</span></button>';
        }).join('') + '</div>'
        + '<div class="lg-pgrid">' + (kind === 'verbs' ? verbPanels : deckPanel) + '</div>'
        + '<div class="lg-pbar">'
        + '<div class="lg-seg" role="radiogroup" id="lgPMode" aria-label="Round length">' + [['timed', '2 minutes'], ['count', '20 questions'], ['endless', 'No limit']].map(function (m) {
          var on = (st.mode || 'timed') === m[0];
          return '<button type="button" role="radio" data-mode="' + m[0] + '" aria-checked="' + on + '" class="' + (on ? 'is-on' : '') + '">' + m[1] + '</button>';
        }).join('') + '</div>'
        + '<label class="lg-check"><input type="checkbox" id="lgPAcc"' + (st.strict ? ' checked' : '') + '> Accents must be right</label>'
        + (lang === 'es' && kind === 'verbs' ? '<label class="lg-check"><input type="checkbox" id="lgPVos"' + (st.vos === false ? '' : ' checked') + '> Include vosotros</label>' : '')
        + '<button type="button" class="lg-go" id="lgPStart">Start</button></div>'
        + '<p class="lg-perr" id="lgPErr" role="alert" hidden></p></div>';
      pracEl.querySelector('.lg-langs').addEventListener('click', function (e) {
        var b = e.target.closest('[data-plang]'); if (b) drawPracticeSetup({ lang: b.dataset.plang, kind: kind });
      });
      pracEl.querySelector('.lg-kinds').addEventListener('click', function (e) {
        var b = e.target.closest('[data-kind]'); if (!b) return;
        state.practice = state.practice || {}; state.practice.kind = b.dataset.kind; save(state);
        drawPracticeSetup({ lang: lang, kind: b.dataset.kind });
      });
      var sets = pracEl.querySelector('.lg-sets');
      if (sets) sets.addEventListener('click', function (e) {
        var b = e.target.closest('[data-set]'); if (!b) return;
        var s = SETS[lang].filter(function (x) { return x[0] === b.dataset.set; })[0];
        var list = s[2].match(/(se |s')?\S+/g);
        pracEl.querySelector('#lgPVerbs').value = list.join(', ');
      });
      pracEl.querySelector('#lgPMode').addEventListener('click', function (e) {
        var b = e.target.closest('[data-mode]'); if (!b) return;
        pracEl.querySelectorAll('#lgPMode [data-mode]').forEach(function (x) { var on = x === b; x.classList.toggle('is-on', on); x.setAttribute('aria-checked', String(on)); });
      });
      pracEl.querySelector('#lgPStart').addEventListener('click', function () {
        var mode = (pracEl.querySelector('#lgPMode .is-on') || {}).dataset;
        mode = mode ? mode.mode : 'timed';
        var strict = pracEl.querySelector('#lgPAcc').checked;
        var err = pracEl.querySelector('#lgPErr');
        state.practice = state.practice || {};
        state.practice.mode = mode; state.practice.strict = strict; state.practice.kind = kind;
        if (kind !== 'verbs') {
          var ds = [].slice.call(pracEl.querySelectorAll('.lg-decks input:checked')).map(function (x) { return x.value; });
          if (!ds.length) { err.hidden = false; err.textContent = 'Pick at least one topic.'; return; }
          state.practice.decks = ds;
          save(state);
          startRound(lang, [], [], mode, strict, true, null, { kind: kind, decks: ds });
          return;
        }
        var vs = pracEl.querySelector('#lgPVerbs').value.split(/[,\n]/).map(function (x) { return x.trim(); }).filter(Boolean);
        var ts = [].slice.call(pracEl.querySelectorAll('.lg-ptenses input:checked')).map(function (x) { return x.value; });
        var vosEl = pracEl.querySelector('#lgPVos');
        var vos = vosEl ? vosEl.checked : true;
        var bad = vs.filter(function (v) { try { return !C.conjugate(lang, v); } catch (e) { return true; } });
        if (!vs.length || !ts.length || bad.length) {
          err.hidden = false;
          err.textContent = !vs.length ? 'Add at least one verb.' : !ts.length ? 'Pick at least one tense.' : 'Not a ' + LANG_NAME[lang] + ' infinitive: ' + bad.join(', ') + '.';
          return;
        }
        state.practice.tenses = state.practice.tenses || {}; state.practice.tenses[lang] = ts;
        state.practice.verbs = state.practice.verbs || {}; state.practice.verbs[lang] = vs;
        state.practice.vos = vos;
        save(state);
        startRound(lang, vs, ts, mode, strict, vos);
      });
    }
    function startPracticeWith(verbs, lang) {
      setTab('practice');
      drawPracticeSetup({ lang: lang, verbs: verbs });
    }

    function buildPool(lang, verbs, tenses, vos) {
      var pool = [];
      verbs.forEach(function (v) {
        var r = C.conjugate(lang, v);
        tenses.forEach(function (t) {
          (r.tenses[t] || []).forEach(function (f, i) {
            if (f == null) return;
            if (lang === 'es' && !vos && i === 4) return;
            pool.push({ verb: r.infinitive, lang: lang, tense: t, person: i, answer: f, alts: (r.alts[t] && r.alts[t][i]) || [], irregular: !!(r.irregular[t] && r.irregular[t][i]) });
          });
        });
      });
      return pool;
    }
    /* English answers: "the teacher (m)" accepts "teacher" or "the teacher";
       "the mark / grade" accepts either word. */
    function englishAnswers(en) {
      return String(en).replace(/\([^)]*\)/g, '').split('/').map(function (x) { return x.trim(); }).filter(Boolean)
        .reduce(function (out, x) { out.push(x); var b = x.replace(/^(the|a|an|to)\s+/i, ''); if (b !== x) out.push(b); return out; }, []);
    }
    function buildVocabPool(lang, kind, decks) {
      var V = vocab(), col = lang === 'fr' ? 2 : 1, pool = [];
      if (!V) return pool;
      var names = {}; V.themes().forEach(function (t) { names[t.id] = t.name; });
      decks.forEach(function (id) {
        V.words(id).forEach(function (w) {
          var en = w[0], tl = w[col];
          if (!en || !tl) return;
          pool.push(kind === 'to'
            ? { vocab: true, kind: kind, lang: lang, prompt: en, answer: tl, alts: [], deck: names[id] || id }
            : { vocab: true, kind: kind, lang: lang, prompt: tl, answer: String(en).replace(/\s*\([^)]*\)/g, ''), alts: englishAnswers(en), deck: names[id] || id });
        });
      });
      return pool;
    }
    function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var x = a[i]; a[i] = a[j]; a[j] = x; } return a; }

    /** `only`: a fixed list of questions (the missed ones), each asked once. */
    function startRound(lang, verbs, tenses, mode, strict, vos, only, vo) {
      var pool = only ? shuffle(only.slice()) : shuffle(vo ? buildVocabPool(lang, vo.kind, vo.decks) : buildPool(lang, verbs, tenses, vos));
      var typesTarget = !vo || vo.kind === 'to';
      if (only && only[0] && only[0].vocab) typesTarget = only[0].kind === 'to';
      P = { lang: lang, vo: vo || null, pool: pool, at: 0, mode: only ? 'count' : mode, limit: only ? pool.length : mode === 'count' ? 20 : 0,
        strict: strict, right: 0, wrong: 0, streak: 0, best: 0, missed: [], started: Date.now(), timer: null, done: false, token: 0 };
      pracEl.innerHTML = '<div class="lg-round">'
        + '<div class="lg-rbar"><span class="lg-pill lg-pill--ok" id="lgRRight">0 ✓</span><span class="lg-pill lg-pill--bad" id="lgRWrong">0 ✗</span><span class="lg-pill" id="lgRStreak">🔥 0</span>'
        + '<span class="lg-pill lg-pill--clock" id="lgRClock"></span><button type="button" class="lg-act lg-act--wide" id="lgREnd"><span>End</span></button></div>'
        + '<div class="lg-prog" aria-hidden="true"><i id="lgRProg"></i></div>'
        + '<div class="lg-qcard"><p class="lg-qtense" id="lgQTense"></p><p class="lg-qverb" id="lgQVerb"></p>'
        + '<div class="lg-qline"><span class="lg-qpron" id="lgQPron"></span><input id="lgQIn" class="lg-qin" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Your answer"></div>'
        + '<div class="lg-acc" id="lgAcc"' + (typesTarget ? '' : ' hidden') + '>' + ACCENTS[lang].map(function (a) { return '<button type="button" class="lg-accb" data-ch="' + a + '" tabindex="-1">' + a + '</button>'; }).join('') + '</div>'
        + '<p class="lg-fb" id="lgFb" aria-live="assertive"></p>'
        + '<div class="lg-qbtns"><button type="button" class="lg-go" id="lgQCheck">Check</button><button type="button" class="lg-act lg-act--wide" id="lgQSkip"><span>Show answer</span></button></div></div></div>';
      var inp = pracEl.querySelector('#lgQIn');
      pracEl.querySelector('#lgAcc').addEventListener('mousedown', function (e) {
        var b = e.target.closest('[data-ch]'); if (!b) return;
        e.preventDefault();
        var s = inp.selectionStart, en = inp.selectionEnd;
        inp.value = inp.value.slice(0, s) + b.dataset.ch + inp.value.slice(en);
        inp.setSelectionRange(s + 1, s + 1);
      });
      pracEl.querySelector('#lgQCheck').addEventListener('click', check);
      pracEl.querySelector('#lgQSkip').addEventListener('click', function () { reveal(true); });
      pracEl.querySelector('#lgREnd').addEventListener('click', endRound);
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); check(); } });
      if (mode === 'timed') {
        P.timer = setInterval(function () {
          var left = 120 - Math.floor((Date.now() - P.started) / 1000);
          var c = pracEl.querySelector('#lgRClock');
          if (c) c.textContent = '⏱ ' + Math.max(0, Math.floor(left / 60)) + ':' + ('0' + Math.max(0, left % 60)).slice(-2);
          var bar = pracEl.querySelector('#lgRProg');
          if (bar) bar.style.width = Math.min(100, Math.round((Date.now() - P.started) / 1200)) + '%';
          if (left <= 0) endRound();
        }, 250);
      }
      ask();
    }
    function curQ() { return P.pool[P.at % P.pool.length]; }
    function ask() {
      if (P.limit && P.at >= P.limit) { endRound(); return; }
      if (P.at > 0 && P.at % P.pool.length === 0) shuffle(P.pool);
      var x = curQ();
      P.waiting = false;
      updateBar();
      if (x.vocab) {
        pracEl.querySelector('#lgQVerb').textContent = x.prompt;
        pracEl.querySelector('#lgQTense').textContent = kindLabel(x.kind, x.lang) + ' · ' + x.deck;
        pracEl.querySelector('#lgQPron').textContent = '';
        var vin = pracEl.querySelector('#lgQIn');
        vin.value = ''; vin.className = 'lg-qin'; vin.readOnly = false;
        vin.placeholder = x.kind === 'to' ? 'In ' + LANG_NAME[x.lang] : 'In English';
        vin.lang = x.kind === 'to' ? x.lang : 'en';
        vin.focus();
        pracEl.querySelector('#lgFb').innerHTML = '';
        pracEl.querySelector('#lgQCheck').textContent = 'Check';
        return;
      }
      var persons = isImp(x.tense) ? C.imperativePersons(x.lang) : C.persons(x.lang);
      pracEl.querySelector('#lgQVerb').textContent = x.verb;
      pracEl.querySelector('#lgQTense').textContent = tenseName(x.lang, x.tense);
      var pron = persons[x.person];
      if (/^subj/.test(x.tense)) pron = 'que ' + pron;
      if (isImp(x.tense)) pron = '(' + pron + ')';
      pracEl.querySelector('#lgQPron').textContent = pron;
      var inp = pracEl.querySelector('#lgQIn');
      inp.value = ''; inp.className = 'lg-qin'; inp.readOnly = false; inp.placeholder = ''; inp.lang = x.lang; inp.focus();
      pracEl.querySelector('#lgFb').innerHTML = '';
      pracEl.querySelector('#lgQCheck').textContent = 'Check';
    }
    function norm(s, strict) {
      s = String(s || '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/’/g, "'").replace(/[!¡¿?.]/g, '').replace(/\(e\)|\(s\)/g, '');
      return strict ? s : C.fold(s);
    }
    function check() {
      if (P.waiting) { next(); return; }
      var x = curQ();
      var inp = pracEl.querySelector('#lgQIn');
      var given = inp.value;
      if (!given.trim()) { inp.focus(); return; }
      var answers = [x.answer].concat(x.alts);
      if (x.vocab) {
        var V = vocab(), res = V ? V.judge(given, x.answer) : { ok: false, note: '' };
        var vok = x.kind === 'to'
          ? res.ok && (!P.strict || !/^Accents/.test(res.note))
          : answers.some(function (a) { return norm(a, false) === norm(given, false).replace(/^(the|a|an|to) /, '') || norm(a, false) === norm(given, false); });
        markVocab(x, vok, x.kind === 'to' ? res.note : '');
        return;
      }
      var ok = answers.some(function (a) { return norm(a, P.strict) === norm(given, P.strict); });
      var accentOnly = !ok && answers.some(function (a) { return norm(a, false) === norm(given, false); });
      // With être, the participle may agree: allée, allés, allées all count.
      if (!ok && /\(e\)/.test(x.answer)) {
        var stem = norm(x.answer.replace(/\(e\)\(s\)|\(e\)s|\(e\)/, ''), P.strict);
        var g = norm(given, P.strict);
        ok = [stem, stem + 'e', stem + 's', stem + 'es'].indexOf(g) !== -1;
      }
      var fb = pracEl.querySelector('#lgFb');
      if (ok) {
        P.right++; P.streak++; P.best = Math.max(P.best, P.streak);
        inp.classList.add('is-ok');
        var exact = answers.some(function (a) { return norm(a, true) === norm(given, true); });
        fb.innerHTML = '<span class="lg-ok">✓ Right</span>' + (!exact ? ' <span class="lg-note">— with accents: <b>' + esc(x.answer) + '</b></span>' : '') + (x.irregular ? ' <span class="lg-note">(irregular)</span>' : '');
        updateBar();
        // Moves on by itself; Enter moves on sooner. The token stops both from advancing twice.
        P.waiting = true;
        var tok = ++P.token;
        setTimeout(function () { if (P && !P.done && P.token === tok && P.waiting) next(); }, exact ? 500 : 1500);
      } else {
        P.wrong++; P.streak = 0;
        P.missed.push(x);
        inp.classList.add('is-bad');
        fb.innerHTML = '<span class="lg-bad">✗</span> ' + (accentOnly ? 'Check the accents: ' : 'Answer: ') + '<b>' + esc(x.answer) + '</b>' + (x.alts.length ? ' <span class="lg-note">(also ' + x.alts.map(esc).join(', ') + ')</span>' : '')
          + ' <span class="lg-note">— Enter for the next one</span>';
        P.waiting = true;
        pracEl.querySelector('#lgQCheck').textContent = 'Next';
        updateBar();
      }
    }
    function markVocab(x, ok, note) {
      var inp = pracEl.querySelector('#lgQIn'), fb = pracEl.querySelector('#lgFb');
      P.waiting = true;
      if (ok) {
        P.right++; P.streak++; P.best = Math.max(P.best, P.streak);
        inp.classList.add('is-ok');
        fb.innerHTML = '<span class="lg-ok">✓ Right</span>' + (note ? ' <span class="lg-note">— ' + esc(note) + '</span>' : '');
        var tok = ++P.token;
        setTimeout(function () { if (P && !P.done && P.token === tok && P.waiting) next(); }, note ? 1500 : 500);
      } else {
        P.wrong++; P.streak = 0; P.missed.push(x);
        inp.classList.add('is-bad');
        fb.innerHTML = '<span class="lg-bad">✗</span> Answer: <b>' + esc(x.answer) + '</b> <span class="lg-note">— Enter for the next one</span>';
        pracEl.querySelector('#lgQCheck').textContent = 'Next';
      }
      updateBar();
    }
    function reveal() {
      var x = curQ();
      P.wrong++; P.streak = 0; P.missed.push(x);
      pracEl.querySelector('#lgFb').innerHTML = 'Answer: <b>' + esc(x.answer) + '</b> <span class="lg-note">— Enter for the next one</span>';
      P.waiting = true;
      pracEl.querySelector('#lgQCheck').textContent = 'Next';
      pracEl.querySelector('#lgQIn').focus();
      updateBar();
    }
    function next() { P.token++; P.at++; ask(); }
    function updateBar() {
      pracEl.querySelector('#lgRRight').textContent = P.right + ' ✓';
      pracEl.querySelector('#lgRWrong').textContent = P.wrong + ' ✗';
      pracEl.querySelector('#lgRStreak').textContent = '🔥 ' + P.streak;
      var bar = pracEl.querySelector('#lgRProg');
      if (bar) {
        var f = P.limit ? (P.right + P.wrong) / P.limit : P.mode === 'timed' ? Math.min(1, (Date.now() - P.started) / 120000) : 0;
        bar.style.width = Math.round(f * 100) + '%';
      }
    }
    function endRound() {
      if (!P || P.done) return;
      P.done = true;
      clearInterval(P.timer);
      var total = P.right + P.wrong;
      var pct = total ? Math.round(P.right / total * 100) : 0;
      var seen = {}, missed = P.missed.filter(function (x) { var k = x.vocab ? x.prompt : x.verb + x.tense + x.person; if (seen[k]) return false; seen[k] = 1; return true; });
      pracEl.innerHTML = '<div class="lg-done"><h2 class="lg-ph">' + (pct >= 90 ? 'Excellent!' : pct >= 70 ? 'Nice work' : 'Keep going') + '</h2>'
        + '<p class="lg-big">' + P.right + ' / ' + total + ' <span>(' + pct + '%)</span></p><p class="lg-plead">Best streak: ' + P.best + '</p>'
        + (missed.length ? '<h3 class="lg-gh">To review</h3><ul class="lg-missed">' + missed.map(function (x) {
          if (x.vocab) return '<li><b>' + esc(x.answer) + '</b> <span>' + esc(x.prompt) + ' · ' + esc(x.deck) + '</span></li>';
          var persons = isImp(x.tense) ? C.imperativePersons(x.lang) : C.persons(x.lang);
          return '<li><b>' + esc(x.answer) + '</b> <span>' + esc(x.verb) + ' · ' + esc(tenseName(x.lang, x.tense)) + ' · ' + esc(persons[x.person]) + '</span></li>';
        }).join('') + '</ul>' : '<p>Nothing missed.</p>')
        + '<div class="lg-qbtns">' + (missed.length ? '<button type="button" class="lg-go" id="lgRetry">Practise the ' + missed.length + ' missed</button>' : '')
        + '<button type="button" class="lg-act lg-act--wide" id="lgAgain"><span>Same again</span></button><button type="button" class="lg-act lg-act--wide" id="lgSetup"><span>Change settings</span></button></div></div>';
      var last = P;
      var again = pracEl.querySelector('#lgAgain');
      again.addEventListener('click', function () {
        var st = state.practice;
        if (last.vo) startRound(last.lang, [], [], st.mode, st.strict, true, null, last.vo);
        else startRound(last.lang, st.verbs[last.lang], st.tenses[last.lang], st.mode, st.strict, st.vos);
      });
      pracEl.querySelector('#lgSetup').addEventListener('click', function () { drawPracticeSetup({ lang: last.lang, kind: last.vo ? last.vo.kind : 'verbs' }); });
      var retry = pracEl.querySelector('#lgRetry');
      if (retry) retry.addEventListener('click', function () { startRound(last.lang, [], [], 'count', last.strict, true, missed, last.vo); });
    }

    /* ── Start ─────────────────────────────────────────────────────────── */

    paintLang();
    drawEmpty();
    readHash();
    window.addEventListener('hashchange', readHash);
    return { show: show, setTab: setTab };
  }

  window.FluxLingo = { mount: mount };
})();
