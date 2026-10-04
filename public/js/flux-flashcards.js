/* ============================================================================
   FLUX FLASHCARDS  ·  flux-flashcards.js
   The page: a library of decks, five ways to study them, an editor, import
   from anywhere, share links and printing. The logic it stands on (scheduler,
   marking, parsing, tests, links) is flux-flash-core.js.

   ROUTES (the hash, so the back button works and a link opens the same view)
     #/                      library
     #/new                   a new deck, straight into the editor
     #/deck/<id>             one deck: progress, study modes, its cards
     #/deck/<id>/edit        editor
     #/deck/<id>/learn       spaced repetition (the Learn mode)
     #/deck/<id>/cards       flip cards, sorted into know / still learning
     #/deck/<id>/write       type the answer
     #/deck/<id>/test        a practice test
     #/deck/<id>/match       the match game
     #/review                every due card from every deck
     #/import                paste, a file, notes → cards
     #share=<code>           someone's shared deck, to copy
   ========================================================================== */
(function () {
  'use strict';
  if (window.FluxFlashcards) return;
  var F = window.FluxFlash;

  var SB_URL = 'https://lfigdijuqmbensebnevo.supabase.co';
  var SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmaWdkaWp1cW1iZW5zZWJuZXZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNjEzMDgsImV4cCI6MjA4ODkzNzMwOH0.qG1d9DLKrs0qqLgAp-6UGdaU7xWvlg2sWq-oD-y2kVo';
  var PLANNER_KEY = 'sb-lfigdijuqmbensebnevo-auth-token';
  var PREFS = 'flux_flash_prefs_v1';

  var LANGS = [
    ['', 'Not set'], ['en-US', 'English'], ['es-ES', 'Spanish'], ['fr-FR', 'French'], ['de-DE', 'German'],
    ['it-IT', 'Italian'], ['pt-BR', 'Portuguese'], ['nl-NL', 'Dutch'], ['zh-CN', 'Chinese (Mandarin)'],
    ['ja-JP', 'Japanese'], ['ko-KR', 'Korean'], ['ar-SA', 'Arabic'], ['hi-IN', 'Hindi'], ['ru-RU', 'Russian'],
    ['tr-TR', 'Turkish'], ['pl-PL', 'Polish'], ['sv-SE', 'Swedish'],
  ];

  /* ── Little things ──────────────────────────────────────────────────── */

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  /** Card text: **bold**, H_2O, x^2, x^{-1}, and line breaks. */
  function fmt(s) {
    return esc(s)
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/_\{([^}]*)\}|_(\d+)/g, function (m, a, b) { return '<sub>' + (a != null ? a : b) + '</sub>'; })
      .replace(/\^\{([^}]*)\}|\^(-?\d+|[+-])/g, function (m, a, b) { return '<sup>' + (a != null ? a : b) + '</sup>'; })
      .replace(/\n/g, '<br>');
  }
  function sizeClass(s) {
    var n = String(s || '').length;
    return n > 260 ? 'is-xs' : n > 140 ? 'is-sm' : n > 50 ? 'is-md' : n > 14 ? 'is-lg' : 'is-xl';
  }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
  function $(sel, el) { return (el || document).querySelector(sel); }
  function $$(sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }

  function toast(text, kind) {
    var t = document.createElement('div');
    t.className = 'ff-toast' + (kind ? ' ff-toast--' + kind : '');
    t.setAttribute('role', 'status');
    t.textContent = text;
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('is-in'); });
    setTimeout(function () { t.classList.remove('is-in'); setTimeout(function () { t.remove(); }, 300); }, 2400);
  }

  function prefs() {
    try { return JSON.parse(localStorage.getItem(PREFS) || '{}') || {}; } catch (e) { return {}; }
  }
  function setPref(k, v) {
    var p = prefs(); p[k] = v;
    try { localStorage.setItem(PREFS, JSON.stringify(p)); } catch (e) {}
  }

  var ICON = {
    back: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    speak: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/></svg>',
    star: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>',
    shuffle: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>',
    brain: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M12 5v13"/></svg>',
    cards: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="6" width="15" height="14" rx="2"/><path d="M7 2h13a2 2 0 0 1 2 2v12"/></svg>',
    pen: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    test: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
    match: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
    flame: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M12 2s5 4.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 1-3.5S9 10 10 10c0-3 2-8 2-8Z"/></svg>',
    sparkle: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8z"/></svg>',
    link: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>',
    print: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>',
    download: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>',
    edit: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    undo: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/></svg>',
  };

  /* ── Speech ─────────────────────────────────────────────────────────── */

  var canSpeak = typeof window.speechSynthesis !== 'undefined' && typeof window.SpeechSynthesisUtterance !== 'undefined';
  function speak(text, lang) {
    if (!canSpeak || !text) return;
    try {
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(String(text).replace(/[*_^{}]/g, ''));
      if (lang) {
        u.lang = lang;
        var pre = lang.slice(0, 2);
        var v = speechSynthesis.getVoices().filter(function (x) { return x.lang === lang; })[0]
          || speechSynthesis.getVoices().filter(function (x) { return x.lang && x.lang.slice(0, 2) === pre; })[0];
        if (v) u.voice = v;
      }
      u.rate = 0.95;
      speechSynthesis.speak(u);
    } catch (e) {}
  }
  function speakBtn(text, lang, extra) {
    if (!canSpeak) return '';
    return '<button type="button" class="ff-icon-btn' + (extra ? ' ' + extra : '') + '" data-speak="' + esc(text) + '" data-lang="' + esc(lang || '') + '" aria-label="Read aloud" title="Read aloud">' + ICON.speak + '</button>';
  }

  /* ── Signed-in AI (borrowing the planner's session, read-only) ──────── */

  function plannerSession() {
    try {
      var s = JSON.parse(localStorage.getItem(PLANNER_KEY) || 'null');
      if (s && s.currentSession) s = s.currentSession;
      if (!s || !s.access_token) return null;
      return s;
    } catch (e) { return null; }
  }
  function sessionFresh(s) {
    return !!(s && s.expires_at && s.expires_at * 1000 > Date.now() + 60 * 1000);
  }

  var AI_SYSTEM = 'You write study flashcards. From the student\'s material, make clear, accurate cards that test one idea each. '
    + 'Terms are short (a word, name, date or question). Definitions are one or two plain sentences, no more than 30 words, in the language of the material. '
    + 'Never invent facts that are not in the material. Respond ONLY with JSON: {"title":"short deck title","cards":[{"term":"…","def":"…"}]}.';

  function aiCards(text, count) {
    var s = plannerSession();
    if (!s) return Promise.reject(new Error('signin'));
    if (!sessionFresh(s)) return Promise.reject(new Error('stale'));
    return fetch(SB_URL + '/functions/v1/ai-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.access_token, apikey: SB_ANON },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: AI_SYSTEM },
          { role: 'user', content: 'Make about ' + count + ' flashcards from this:\n\n' + text.slice(0, 24000) },
        ],
        responseFormat: 'json_object',
      }),
    }).then(function (res) {
      if (!res.ok) return res.json().catch(function () { return {}; }).then(function (e) { throw new Error(e.error || ('AI request failed (' + res.status + ')')); });
      return res.json();
    }).then(function (data) {
      var txt = (data && data.content && data.content[0] && data.content[0].text) || '';
      txt = txt.replace(/```json|```/g, '').trim();
      var m = txt.match(/\{[\s\S]*\}/);
      var parsed = JSON.parse(m ? m[0] : txt);
      var cards = (parsed.cards || []).map(function (c) {
        return { term: String(c.term || c.q || c.question || '').trim(), def: String(c.def || c.definition || c.a || c.answer || '').trim() };
      }).filter(function (c) { return c.term && c.def; });
      if (!cards.length) throw new Error('The AI did not return any cards. Try a longer piece of text.');
      return { title: parsed.title || '', cards: cards };
    });
  }

  /** Without AI: the import parser, then "X is Y" sentences. */
  function heuristicCards(text) {
    var cards = F.parseImport(text);
    if (cards.length) return cards;
    var out = [];
    String(text || '').split(/(?<=[.!?])\s+|\n+/).forEach(function (sentence) {
      var m = sentence.trim().match(/^(?:an?\s+|the\s+)?([^,.;:]{2,60}?)\s+(is|are|was|were|means|refers to|is defined as)\s+(.{8,240})$/i);
      if (m && m[1].split(/\s+/).length <= 6) out.push({ term: m[1].trim().replace(/^./, function (c) { return c.toUpperCase(); }), def: m[3].trim().replace(/\.$/, '') });
    });
    return out;
  }

  /* ── Share links ────────────────────────────────────────────────────── */

  function streamBytes(bytes, stream) {
    var s = new Blob([bytes]).stream().pipeThrough(stream);
    return new Response(s).arrayBuffer().then(function (b) { return new Uint8Array(b); });
  }
  function shareCode(deck) {
    if (typeof CompressionStream === 'undefined') return Promise.resolve(F.encodeShare(deck));
    var json = new TextEncoder().encode(JSON.stringify(F.sharePayload(deck)));
    return streamBytes(json, new CompressionStream('deflate-raw'))
      .then(function (z) { return 'z' + F.b64urlFromBytes(z); })
      .catch(function () { return F.encodeShare(deck); });
  }
  function readShareCode(code) {
    if (code[0] === 'z') {
      if (typeof DecompressionStream === 'undefined') return Promise.reject(new Error('This browser cannot open compressed links. Try Chrome, Edge or Safari 16.4+.'));
      return streamBytes(F.bytesFromB64url(code.slice(1)), new DecompressionStream('deflate-raw'))
        .then(function (b) { return F.fromSharePayload(JSON.parse(new TextDecoder().decode(b))); });
    }
    return Promise.resolve().then(function () { return F.decodeShare(code); });
  }
  function shareUrl(code) { return location.origin + location.pathname + '#share=' + code; }

  function copyText(text, done) {
    try {
      navigator.clipboard.writeText(text).then(function () { toast(done || 'Copied'); }, function () { window.prompt('Copy this:', text); });
    } catch (e) { window.prompt('Copy this:', text); }
  }
  function download(name, text, type) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/plain' }));
    a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function safeName(s) { return String(s || 'flashcards').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'flashcards'; }
  function csvCell(s) { s = String(s || ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }

  /* ── The app ────────────────────────────────────────────────────────── */

  function mount(host) {
    var view = null;       // the current view's { onKey, cleanup }
    var lastRoute = '';

    function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }
    function deckOr404(id) {
      var d = F.getDeck(id);
      if (!d) { host.innerHTML = '<div class="ff-empty"><h2>That deck is not here</h2><p>It may have been deleted, or it lives on another device that has not synced yet.</p><a class="ff-btn ff-btn--primary" href="#/">All decks</a></div>'; }
      return d;
    }
    function setView(v) {
      if (view && view.cleanup) try { view.cleanup(); } catch (e) {}
      view = v || null;
    }

    function render() {
      var h = location.hash || '#/';
      if (h === lastRoute && view && view.sticky) return;
      lastRoute = h;
      setView(null);
      try { if (canSpeak) speechSynthesis.cancel(); } catch (e) {}
      window.scrollTo(0, 0);
      var m;
      if ((m = h.match(/^#share=(.+)$/))) return viewShared(m[1]);
      if (h === '#/new') return viewNew();
      if (h === '#/review') return viewLearn(null);
      if (h === '#/import' || (m = h.match(/^#\/deck\/([^/]+)\/import$/))) return viewImport(m ? m[1] : null);
      if ((m = h.match(/^#\/deck\/([^/]+)(?:\/(\w+))?$/))) {
        var id = decodeURIComponent(m[1]), mode = m[2] || '';
        var deck = deckOr404(id);
        if (!deck) return;
        if (mode === 'edit') return viewEdit(deck);
        if (mode === 'learn') return viewLearn(deck);
        if (mode === 'cards') return viewCards(deck);
        if (mode === 'write') return viewWrite(deck);
        if (mode === 'test') return viewTest(deck);
        if (mode === 'match') return viewMatch(deck);
        return viewDeck(deck);
      }
      return viewLibrary();
    }

    function backBar(href, label, right) {
      return '<div class="ff-bar"><a class="ff-back" href="' + href + '">' + ICON.back + '<span>' + esc(label) + '</span></a><span class="ff-grow"></span>' + (right || '') + '</div>';
    }

    /* ── Library ─────────────────────────────────────────────────────── */

    function deckTile(d) {
      var p = F.progress(d), due = F.dueCount(d);
      var seg = function (n, cls) { return n ? '<i class="' + cls + '" style="flex:' + n + '"></i>' : ''; };
      return '<a class="ff-deck" href="#/deck/' + encodeURIComponent(d.id) + '">'
        + '<div class="ff-deck-top"><span class="ff-deck-title">' + esc(d.title) + '</span>'
        + (due ? '<span class="ff-due" title="Cards due for review">' + due + ' due</span>' : '') + '</div>'
        + (d.desc ? '<div class="ff-deck-desc">' + esc(d.desc) + '</div>' : '')
        + '<div class="ff-meter" aria-hidden="true">' + seg(p.mastered, 'm-mastered') + seg(p.known, 'm-known') + seg(p.learning, 'm-learning') + seg(p.fresh, 'm-new') + '</div>'
        + '<div class="ff-deck-foot">' + plural(p.total, 'card') + (p.total ? ' · ' + Math.round((p.mastered + p.known) / p.total * 100) + '% known' : '') + '</div>'
        + '</a>';
    }

    function plannerNotesWithCards() {
      try {
        var notes = JSON.parse(localStorage.getItem('flux_notes') || '[]');
        return (Array.isArray(notes) ? notes : []).filter(function (n) { return n && Array.isArray(n.flashcards) && n.flashcards.length; });
      } catch (e) { return []; }
    }

    function viewLibrary() {
      var all = F.decks();
      var now = Date.now();
      var due = all.reduce(function (s, d) { return s + F.dueCount(d, now); }, 0);
      var stats = F.readStats();
      var today = stats.days[F.ymd()] || 0;
      var streak = F.streak(stats);
      var q = prefs().libSearch || '';
      var samples = (window.FluxFlashSamples || []).filter(function (s) {
        return !all.some(function (d) { return d.sample === s.id; });
      });
      var fromNotes = plannerNotesWithCards();

      host.innerHTML =
        '<section class="ff-hero">'
        + '<div class="ff-hero-text"><h1>Flashcards that remember for you</h1>'
        + '<p>Flux schedules every card for the moment you are about to forget it, so a few minutes a day is enough. No ads, ever.</p></div>'
        + '<div class="ff-today">'
        + '<div class="ff-stat"><b>' + due + '</b><span>due now</span></div>'
        + '<div class="ff-stat"><b class="ff-flame">' + ICON.flame + streak + '</b><span>day streak</span></div>'
        + '<div class="ff-stat"><b>' + today + '</b><span>reviewed today</span></div>'
        + (due ? '<a class="ff-btn ff-btn--primary ff-btn--big" href="#/review">Review ' + plural(due, 'card') + '</a>'
          : all.length ? '<span class="ff-caught">' + ICON.test.replace('22', '18').replace('22', '18') + ' All caught up</span>' : '')
        + '</div></section>'
        + '<div class="ff-actions">'
        + '<a class="ff-btn ff-btn--primary" href="#/new">' + ICON.plus + 'New deck</a>'
        + '<a class="ff-btn" href="#/import" data-tab="paste">' + ICON.download + 'Import</a>'
        + '<a class="ff-btn" href="#/import" data-tab="ai">' + ICON.sparkle + 'Make from notes</a>'
        + (all.length > 4 ? '<input class="ff-search" type="search" placeholder="Search decks" aria-label="Search decks" value="' + esc(q) + '">' : '')
        + '</div>'
        + (all.length ? '<div class="ff-grid" id="ffDecks"></div>'
          : '<div class="ff-empty ff-empty--start"><h2>Start your first deck</h2><p>Type your own, paste from Quizlet or a list, turn your notes into cards, or copy a ready-made deck below.</p></div>')
        + (fromNotes.length ? '<h2 class="ff-h2">From your Flux notes</h2><div class="ff-grid ff-grid--small">'
          + fromNotes.map(function (n) {
            var already = all.some(function (d) { return d.fromNote === String(n.id); });
            return '<div class="ff-sample"><div class="ff-sample-title">' + esc(n.title || 'Untitled note') + '</div><div class="ff-deck-foot">' + plural(n.flashcards.length, 'card') + '</div>'
              + (already ? '<span class="ff-muted">Added</span>' : '<button type="button" class="ff-btn ff-btn--small" data-note="' + esc(n.id) + '">Add as a deck</button>') + '</div>';
          }).join('') + '</div>' : '')
        + (samples.length ? '<h2 class="ff-h2">Ready-made decks</h2><div class="ff-grid ff-grid--small">'
          + samples.map(function (s) {
            return '<div class="ff-sample"><div class="ff-sample-title"><span aria-hidden="true">' + s.emoji + '</span> ' + esc(s.title) + '</div>'
              + '<div class="ff-deck-desc">' + esc(s.desc) + '</div><div class="ff-deck-foot">' + plural(s.cards.length, 'card') + '</div>'
              + '<button type="button" class="ff-btn ff-btn--small" data-sample="' + esc(s.id) + '">Add to my decks</button></div>';
          }).join('') + '</div>' : '')
        + '<div class="ff-foot-actions">'
        + (all.length ? '<button type="button" class="ff-link" data-act="backup">Back up all decks</button>' : '')
        + '<label class="ff-link">Restore a backup<input type="file" accept=".json,application/json" hidden data-act="restore"></label>'
        + '</div>'
        + '<p class="ff-note">' + (plannerSession() ? 'Signed in: your decks save to your Flux account whenever you open the planner, and come with you to your other devices.'
          : 'Your decks are saved on this device. Sign in to the Flux Planner and they come with you to your other devices.') + '</p>';

      function drawDecks() {
        var box = $('#ffDecks', host); if (!box) return;
        var term = (prefs().libSearch || '').toLowerCase();
        var list = all.filter(function (d) { return !term || (d.title + ' ' + (d.desc || '')).toLowerCase().indexOf(term) >= 0; });
        // Due first, then most recently touched.
        list.sort(function (a, b) { return (F.dueCount(b, now) > 0) - (F.dueCount(a, now) > 0) || (b.updated || 0) - (a.updated || 0); });
        box.innerHTML = list.length ? list.map(deckTile).join('') : '<p class="ff-muted">No decks match.</p>';
      }
      drawDecks();

      host.onclick = function (e) {
        var t = e.target.closest('[data-sample],[data-note],[data-act],[data-tab]');
        if (!t) return;
        if (t.dataset.tab) { setPref('importTab', t.dataset.tab); return; }
        if (t.dataset.sample) {
          var s = (window.FluxFlashSamples || []).filter(function (x) { return x.id === t.dataset.sample; })[0];
          if (!s) return;
          var d = F.newDeck({ title: s.title, desc: s.desc, termLang: s.termLang, defLang: s.defLang, cards: s.cards });
          d.sample = s.id;
          F.putDeck(d);
          toast('Added “' + s.title + '”');
          go('#/deck/' + encodeURIComponent(d.id));
        } else if (t.dataset.note) {
          var n = plannerNotesWithCards().filter(function (x) { return String(x.id) === t.dataset.note; })[0];
          if (!n) return;
          var nd = F.newDeck({ title: n.title || 'From my notes', cards: n.flashcards.map(function (c) { return { term: c.q || c.question || '', def: c.a || c.answer || '' }; }) });
          nd.fromNote = String(n.id);
          F.putDeck(nd);
          go('#/deck/' + encodeURIComponent(nd.id));
        } else if (t.dataset.act === 'backup') {
          download('flux-flashcards-backup-' + F.ymd() + '.json', JSON.stringify({ flux: 'flashcards', v: 1, decks: F.decks() }, null, 1), 'application/json');
        }
      };
      var restore = $('[data-act="restore"]', host);
      if (restore) restore.onchange = function () {
        var f = restore.files && restore.files[0];
        if (!f) return;
        f.text().then(function (txt) {
          var data = JSON.parse(txt);
          var list = Array.isArray(data) ? data : data.decks;
          if (!Array.isArray(list)) throw new Error('bad');
          var have = F.readStore();
          var merged = F.mergeDecks(have.decks, list.filter(function (d) { return d && d.id && Array.isArray(d.cards); }));
          F.writeStore({ v: 1, decks: merged });
          toast('Restored ' + plural(list.length, 'deck'));
          render();
        }).catch(function () { toast('That file is not a Flux Flashcards backup', 'warn'); });
      };
      var search = $('.ff-search', host);
      if (search) search.oninput = function () { setPref('libSearch', search.value); drawDecks(); };
      setView({ cleanup: function () { host.onclick = null; } });
    }

    /* ── One deck ────────────────────────────────────────────────────── */

    function viewDeck(deck) {
      var p = F.progress(deck), due = F.dueCount(deck);
      var newToday = Math.min(p.fresh, deck.newPerDay || 20);
      var stars = deck.cards.filter(function (c) { return c.star; }).length;
      var exam = deck.examAt ? Math.ceil((deck.examAt - Date.now()) / F.DAY) : null;
      var mode = function (href, icon, name, sub, primary) {
        return '<a class="ff-mode' + (primary ? ' ff-mode--primary' : '') + '" href="' + href + '">'
          + '<span class="ff-mode-ico">' + icon + '</span><span class="ff-mode-name">' + name + '</span><span class="ff-mode-sub">' + sub + '</span></a>';
      };
      var base = '#/deck/' + encodeURIComponent(deck.id);
      var few = deck.cards.length < 1;

      host.innerHTML = backBar('#/', 'All decks',
        '<a class="ff-btn ff-btn--small" href="' + base + '/edit">' + ICON.edit + 'Edit</a>')
        + '<header class="ff-deck-head"><h1>' + esc(deck.title) + '</h1>'
        + (deck.desc ? '<p class="ff-deck-desc">' + esc(deck.desc) + '</p>' : '')
        + '<div class="ff-deck-meta">' + plural(p.total, 'card')
        + (exam != null ? (exam >= 0 ? ' · <b>Exam in ' + plural(exam, 'day') + '</b>' : ' · Exam passed') : '')
        + (stars ? ' · ' + stars + ' starred' : '') + '</div>'
        + '<div class="ff-progress" aria-label="Progress">'
        + ['mastered', 'known', 'learning', 'new'].map(function (k) {
          var n = k === 'new' ? p.fresh : p[k];
          return '<div class="ff-prog-item"><i class="m-' + k + '"></i><b>' + n + '</b><span>' + (k === 'new' ? 'new' : k === 'known' ? 'known' : k) + '</span></div>';
        }).join('') + '</div></header>'
        + (few ? '<div class="ff-empty"><h2>No cards yet</h2><p>Add some cards to start studying.</p><a class="ff-btn ff-btn--primary" href="' + base + '/edit">Add cards</a> <a class="ff-btn" href="' + base + '/import">Import</a></div>'
          : '<div class="ff-modes">'
          + mode(base + '/learn', ICON.brain, 'Learn', due || newToday ? (due ? due + ' due' : '') + (due && newToday ? ' · ' : '') + (newToday ? newToday + ' new' : '') : 'All done for today', true)
          + mode(base + '/cards', ICON.cards, 'Flashcards', 'Flip and sort')
          + mode(base + '/write', ICON.pen, 'Write', 'Type the answer')
          + mode(base + '/test', ICON.test, 'Test', 'A practice test')
          + mode(base + '/match', ICON.match, 'Match', deck.bestMatch ? 'Best ' + (deck.bestMatch / 1000).toFixed(1) + 's' : 'Beat the clock')
          + '</div>')
        + '<div class="ff-tools">'
        + '<button type="button" class="ff-btn ff-btn--small" data-act="share">' + ICON.link + 'Share</button>'
        + '<button type="button" class="ff-btn ff-btn--small" data-act="print">' + ICON.print + 'Print</button>'
        + '<button type="button" class="ff-btn ff-btn--small" data-act="csv">' + ICON.download + 'Export</button>'
        + '<button type="button" class="ff-btn ff-btn--small" data-act="copy">Copy as text</button>'
        + '<button type="button" class="ff-btn ff-btn--small ff-btn--danger" data-act="delete">' + ICON.trash + 'Delete</button>'
        + '</div>'
        + (deck.cards.length ? '<h2 class="ff-h2">' + plural(deck.cards.length, 'card') + '</h2><div class="ff-list">'
          + deck.cards.map(function (c) {
            var st = c.s && c.s.state && c.s.state !== 'new' ? (c.s.state === 'review' ? ((c.s.S || 0) >= 21 ? 'mastered' : 'known') : 'learning') : 'new';
            return '<div class="ff-row" data-id="' + esc(c.id) + '"><i class="ff-dot m-' + st + '" title="' + st + '"></i>'
              + '<div class="ff-row-term">' + fmt(c.term) + '</div><div class="ff-row-def">' + fmt(c.def) + '</div>'
              + '<div class="ff-row-tools">' + speakBtn(c.term, deck.termLang)
              + '<button type="button" class="ff-icon-btn ff-star' + (c.star ? ' is-on' : '') + '" data-star="' + esc(c.id) + '" aria-pressed="' + (c.star ? 'true' : 'false') + '" aria-label="Star" title="Star">' + ICON.star + '</button></div></div>';
          }).join('') + '</div>' : '');

      host.onclick = function (e) {
        var t = e.target.closest('[data-act],[data-star],[data-speak]');
        if (!t) return;
        if (t.dataset.speak != null) return speak(t.dataset.speak, t.dataset.lang);
        if (t.dataset.star) {
          var c = deck.cards.filter(function (x) { return x.id === t.dataset.star; })[0];
          if (!c) return;
          c.star = !c.star; F.putDeck(deck);
          t.classList.toggle('is-on', c.star); t.setAttribute('aria-pressed', c.star ? 'true' : 'false');
          return;
        }
        var act = t.dataset.act;
        if (act === 'share') openShare(deck);
        else if (act === 'print') printDeck(deck);
        else if (act === 'csv') download(safeName(deck.title) + '.csv', 'term,definition\n' + deck.cards.map(function (c) { return csvCell(c.term) + ',' + csvCell(c.def); }).join('\n'), 'text/csv');
        else if (act === 'copy') copyText(deck.cards.map(function (c) { return c.term.replace(/\t|\n/g, ' ') + '\t' + c.def.replace(/\t|\n/g, ' '); }).join('\n'), 'Copied — paste into Quizlet, Anki or a spreadsheet');
        else if (act === 'delete') {
          if (!window.confirm('Delete “' + deck.title + '” and its ' + plural(deck.cards.length, 'card') + '? This cannot be undone.')) return;
          F.removeDeck(deck.id); toast('Deleted'); go('#/');
        }
      };
      setView({ cleanup: function () { host.onclick = null; } });
    }

    /* ── Share ───────────────────────────────────────────────────────── */

    function modal(html, onReady) {
      var ov = document.createElement('div');
      ov.className = 'ff-modal-ov';
      ov.innerHTML = '<div class="ff-modal" role="dialog" aria-modal="true">' + html + '</div>';
      document.body.appendChild(ov);
      requestAnimationFrame(function () { ov.classList.add('is-in'); });
      function close() { ov.remove(); document.removeEventListener('keydown', onEsc, true); }
      function onEsc(e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } }
      document.addEventListener('keydown', onEsc, true);
      ov.addEventListener('click', function (e) { if (e.target === ov || e.target.closest('[data-close]')) close(); });
      if (onReady) onReady(ov, close);
      return close;
    }

    function openShare(deck) {
      if (!deck.cards.length) { toast('Add some cards first', 'warn'); return; }
      shareCode(deck).then(function (code) {
        var url = shareUrl(code);
        modal('<h2>Share “' + esc(deck.title) + '”</h2>'
          + '<p class="ff-muted">Anyone with this link can copy the deck into their own Flux Flashcards. Your progress stays yours. No account needed to open it.</p>'
          + '<div class="ff-share-row"><input class="ff-input" readonly value="' + esc(url) + '" aria-label="Share link"><button type="button" class="ff-btn ff-btn--primary" data-copy>Copy</button></div>'
          + (url.length > 8000 ? '<p class="ff-warn">This is a very big deck, so the link is long. If it does not open, use Export and send the file instead.</p>' : '')
          + '<div class="ff-modal-foot">' + (navigator.share ? '<button type="button" class="ff-btn" data-native>Share…</button>' : '') + '<button type="button" class="ff-btn" data-close>Done</button></div>',
        function (ov) {
          var inp = $('input', ov); inp.focus(); inp.select();
          $('[data-copy]', ov).onclick = function () { copyText(url, 'Link copied'); };
          var nat = $('[data-native]', ov);
          if (nat) nat.onclick = function () { navigator.share({ title: deck.title + ' · Flux Flashcards', url: url }).catch(function () {}); };
        });
      });
    }

    function viewShared(code) {
      host.innerHTML = '<div class="ff-empty"><p>Opening the shared deck…</p></div>';
      readShareCode(code).then(function (deck) {
        host.innerHTML = backBar('#/', 'My decks')
          + '<header class="ff-deck-head"><span class="ff-pill">Shared with you</span><h1>' + esc(deck.title) + '</h1>'
          + (deck.desc ? '<p class="ff-deck-desc">' + esc(deck.desc) + '</p>' : '')
          + '<div class="ff-deck-meta">' + plural(deck.cards.length, 'card') + '</div></header>'
          + '<div class="ff-actions"><button type="button" class="ff-btn ff-btn--primary ff-btn--big" data-save>Save to my decks</button></div>'
          + '<div class="ff-list">' + deck.cards.slice(0, 200).map(function (c) {
            return '<div class="ff-row"><div class="ff-row-term">' + fmt(c.term) + '</div><div class="ff-row-def">' + fmt(c.def) + '</div></div>';
          }).join('') + '</div>'
          + (deck.cards.length > 200 ? '<p class="ff-muted">…and ' + (deck.cards.length - 200) + ' more.</p>' : '');
        $('[data-save]', host).onclick = function () {
          F.putDeck(deck);
          toast('Saved to your decks');
          history.replaceState(null, '', location.pathname + '#/deck/' + encodeURIComponent(deck.id));
          render();
        };
      }).catch(function (err) {
        host.innerHTML = '<div class="ff-empty"><h2>This link did not open</h2><p>' + esc(err && err.message && err.message.length < 140 ? err.message : 'It may have been cut short when it was copied. Ask for the link again.') + '</p><a class="ff-btn ff-btn--primary" href="#/">My decks</a></div>';
      });
    }

    /* ── Print: a fold-down-the-middle sheet ─────────────────────────── */

    function printDeck(deck) {
      var old = document.getElementById('ffPrint');
      if (old) old.remove();
      var el = document.createElement('div');
      el.id = 'ffPrint';
      el.className = 'ff-print';
      el.innerHTML = '<h1>' + esc(deck.title) + '</h1><p>Fold along the middle line: test yourself on the left, check on the right.</p>'
        + '<table><tbody>' + deck.cards.map(function (c, i) {
          return '<tr><td class="n">' + (i + 1) + '</td><td>' + fmt(c.term) + '</td><td>' + fmt(c.def) + '</td></tr>';
        }).join('') + '</tbody></table><footer>Flux Flashcards</footer>';
      document.body.appendChild(el);
      document.body.classList.add('ff-printing');
      var done = function () { document.body.classList.remove('ff-printing'); el.remove(); window.removeEventListener('afterprint', done); };
      window.addEventListener('afterprint', done);
      setTimeout(function () { window.print(); setTimeout(done, 1000); }, 50);
    }

    /* ── Editor ──────────────────────────────────────────────────────── */

    function viewNew() {
      var deck = F.newDeck({ title: '', cards: [{}, {}, {}] });
      deck._unsaved = true;
      viewEdit(deck);
    }

    function langSelect(name, val) {
      return '<select class="ff-input" name="' + name + '">' + LANGS.map(function (l) {
        return '<option value="' + l[0] + '"' + (l[0] === (val || '') ? ' selected' : '') + '>' + esc(l[1]) + '</option>';
      }).join('') + '</select>';
    }

    function viewEdit(deck) {
      var isNew = !!deck._unsaved;
      var saveTimer = null, dirty = false;
      var base = '#/deck/' + encodeURIComponent(deck.id);
      var examVal = deck.examAt ? F.ymd(deck.examAt) : '';

      host.innerHTML = backBar(isNew ? '#/' : base, isNew ? 'All decks' : 'Back to deck',
        '<span class="ff-saved" aria-live="polite"></span><button type="button" class="ff-btn ff-btn--primary ff-btn--small" data-done>Done</button>')
        + '<div class="ff-editor">'
        + '<input class="ff-input ff-title-input" name="title" placeholder="Deck title, e.g. “Biology: the cell”" value="' + esc(deck.title) + '" aria-label="Deck title">'
        + '<input class="ff-input" name="desc" placeholder="Description (optional)" value="' + esc(deck.desc) + '" aria-label="Description">'
        + '<details class="ff-settings"><summary>Languages, exam date and daily limit</summary><div class="ff-settings-grid">'
        + '<label>Term language' + langSelect('termLang', deck.termLang) + '</label>'
        + '<label>Definition language' + langSelect('defLang', deck.defLang) + '</label>'
        + '<label>Exam date<input class="ff-input" type="date" name="examAt" value="' + examVal + '"></label>'
        + '<label>New cards a day<input class="ff-input" type="number" min="1" max="500" name="newPerDay" value="' + (deck.newPerDay || 20) + '"></label>'
        + '</div><p class="ff-muted">With an exam date, Learn makes sure you see every card again before the exam. Languages make Read aloud use the right accent.</p></details>'
        + '<div class="ff-edit-tools"><a class="ff-btn ff-btn--small" href="' + base + '/import" data-needsave>' + ICON.download + 'Import cards</a>'
        + '<button type="button" class="ff-btn ff-btn--small" data-swap>⇄ Swap terms and definitions</button>'
        + '<span class="ff-muted ff-hint">Enter moves on · Shift+Enter for a new line · H_2O and x^2 work</span></div>'
        + '<ol class="ff-edit-list" id="ffRows"></ol>'
        + '<button type="button" class="ff-btn ff-add-card" data-add>' + ICON.plus + 'Add a card</button>'
        + '</div>';

      var list = $('#ffRows', host);
      function rowHtml(c, i) {
        return '<li class="ff-edit-row" data-id="' + esc(c.id) + '"><span class="ff-edit-n">' + (i + 1) + '</span>'
          + '<label class="ff-edit-cell"><textarea class="ff-input" rows="1" data-f="term" placeholder="Term" aria-label="Term ' + (i + 1) + '">' + esc(c.term) + '</textarea><span>Term</span></label>'
          + '<label class="ff-edit-cell"><textarea class="ff-input" rows="1" data-f="def" placeholder="Definition" aria-label="Definition ' + (i + 1) + '">' + esc(c.def) + '</textarea><span>Definition</span></label>'
          + '<button type="button" class="ff-icon-btn" data-del aria-label="Delete card ' + (i + 1) + '" title="Delete card">' + ICON.trash + '</button></li>';
      }
      function grow(ta) { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight + 2, 320) + 'px'; }
      function draw() {
        list.innerHTML = deck.cards.map(rowHtml).join('');
        $$('textarea', list).forEach(grow);
      }
      draw();

      function readMeta() {
        var g = function (n) { var el = $('[name="' + n + '"]', host); return el ? el.value : ''; };
        deck.title = g('title').trim();
        deck.desc = g('desc').trim();
        deck.termLang = g('termLang');
        deck.defLang = g('defLang');
        var ex = g('examAt');
        deck.examAt = ex ? new Date(ex + 'T09:00:00').getTime() : null;
        deck.newPerDay = Math.max(1, Math.min(500, parseInt(g('newPerDay'), 10) || 20));
      }
      function hasContent() { return deck.title || deck.cards.some(function (c) { return c.term || c.def; }); }
      function persist(final) {
        readMeta();
        if (!hasContent()) return false;
        var out = Object.assign({}, deck);
        delete out._unsaved;
        if (!out.title) out.title = 'Untitled deck';
        // Blank rows are for typing into, not for keeping.
        out.cards = out.cards.filter(function (c) { return c.term.trim() || c.def.trim(); });
        if (final) deck.cards = out.cards;
        F.putDeck(out);
        dirty = false;
        if (deck._unsaved) {
          delete deck._unsaved;
          isNew = false;
          history.replaceState(null, '', location.pathname + base + '/edit');
          lastRoute = location.hash;
        }
        var s = $('.ff-saved', host); if (s) { s.textContent = 'Saved'; clearTimeout(s._t); s._t = setTimeout(function () { s.textContent = ''; }, 1500); }
        return true;
      }
      function schedule() { dirty = true; clearTimeout(saveTimer); saveTimer = setTimeout(function () { persist(false); }, 400); }

      host.oninput = function (e) {
        var ta = e.target.closest('textarea[data-f]');
        if (ta) {
          var row = ta.closest('.ff-edit-row');
          var c = deck.cards.filter(function (x) { return x.id === row.dataset.id; })[0];
          if (c) c[ta.dataset.f] = ta.value;
          grow(ta);
        }
        schedule();
      };
      host.onchange = schedule;
      function addCard(focus) {
        var c = F.newCard({});
        deck.cards.push(c);
        list.insertAdjacentHTML('beforeend', rowHtml(c, deck.cards.length - 1));
        if (focus) $('.ff-edit-row:last-child textarea', list).focus();
      }
      host.onkeydown = function (e) {
        var ta = e.target.closest('textarea[data-f]');
        if (!ta || e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
        e.preventDefault();
        var row = ta.closest('.ff-edit-row');
        if (ta.dataset.f === 'term') { $('textarea[data-f="def"]', row).focus(); return; }
        var next = row.nextElementSibling;
        if (next) $('textarea', next).focus(); else addCard(true);
      };
      host.onclick = function (e) {
        var t = e.target;
        if (t.closest('[data-add]')) { addCard(true); return; }
        if (t.closest('[data-del]')) {
          var row = t.closest('.ff-edit-row');
          deck.cards = deck.cards.filter(function (x) { return x.id !== row.dataset.id; });
          draw(); schedule(); return;
        }
        if (t.closest('[data-swap]')) {
          deck.cards.forEach(function (c) { var x = c.term; c.term = c.def; c.def = x; delete c.s; });
          var tl = deck.termLang; deck.termLang = deck.defLang; deck.defLang = tl;
          var a = $('[name="termLang"]', host), b = $('[name="defLang"]', host);
          if (a && b) { var v = a.value; a.value = b.value; b.value = v; }
          draw(); schedule(); toast('Swapped. Progress on these cards starts again.'); return;
        }
        if (t.closest('[data-needsave]')) {
          if (!persist(false)) { e.preventDefault(); toast('Give the deck a title first', 'warn'); }
          return;
        }
        if (t.closest('[data-done]')) {
          clearTimeout(saveTimer);
          if (!persist(true)) { go('#/'); return; }
          go(base);
        }
      };
      if (isNew) $('[name="title"]', host).focus();
      setView({
        sticky: true,
        cleanup: function () {
          clearTimeout(saveTimer);
          if (dirty && hasContent()) persist(false);
          host.oninput = host.onchange = host.onkeydown = host.onclick = null;
        },
      });
    }

    /* ── Import ──────────────────────────────────────────────────────── */

    function viewImport(intoId) {
      var into = intoId ? F.getDeck(decodeURIComponent(intoId)) : null;
      var tab = prefs().importTab || 'paste';
      if (!/^(paste|ai|file)$/.test(tab)) tab = 'paste';
      var signedIn = !!plannerSession();
      var found = [];
      var aiTitle = '';

      host.innerHTML = backBar(into ? '#/deck/' + encodeURIComponent(into.id) + '/edit' : '#/', into ? 'Back to editor' : 'All decks')
        + '<h1 class="ff-page-title">' + (into ? 'Add cards to “' + esc(into.title) + '”' : 'Import cards') + '</h1>'
        + '<div class="ff-tabs" role="tablist">'
        + [['paste', 'Paste a list'], ['ai', 'From notes'], ['file', 'Open a file']].map(function (t) {
          return '<button type="button" role="tab" class="ff-tab' + (t[0] === tab ? ' is-on' : '') + '" data-tab="' + t[0] + '" aria-selected="' + (t[0] === tab) + '">' + t[1] + '</button>';
        }).join('') + '</div>'
        + '<div class="ff-import" id="ffImp"></div>'
        + '<div class="ff-preview" id="ffPrev"></div>';

      var box = $('#ffImp', host), prev = $('#ffPrev', host);

      function drawPreview(note) {
        if (!found.length) { prev.innerHTML = note ? '<p class="ff-muted">' + note + '</p>' : ''; return; }
        prev.innerHTML = '<div class="ff-prev-head"><b>' + plural(found.length, 'card') + ' found</b>'
          + (into ? '' : '<input class="ff-input" id="ffNewTitle" placeholder="Deck title" value="' + esc(aiTitle) + '">')
          + '<button type="button" class="ff-btn ff-btn--primary" data-create>' + (into ? 'Add ' + plural(found.length, 'card') : 'Create deck') + '</button></div>'
          + '<div class="ff-list">' + found.slice(0, 300).map(function (c) {
            return '<div class="ff-row"><div class="ff-row-term">' + fmt(c.term) + '</div><div class="ff-row-def">' + fmt(c.def) + '</div></div>';
          }).join('') + '</div>' + (found.length > 300 ? '<p class="ff-muted">…and ' + (found.length - 300) + ' more.</p>' : '');
      }

      function drawTab() {
        $$('.ff-tab', host).forEach(function (b) { var on = b.dataset.tab === tab; b.classList.toggle('is-on', on); b.setAttribute('aria-selected', on); });
        found = []; aiTitle = ''; drawPreview();
        if (tab === 'paste') {
          box.innerHTML = '<p class="ff-muted">Paste from Quizlet (Export → Copy), a spreadsheet, or any list like <code>mitochondria - makes ATP</code>. One card per line.</p>'
            + '<textarea class="ff-input ff-paste" rows="10" placeholder="perro&#9;dog&#10;gato&#9;cat&#10;casa - house"></textarea>'
            + '<div class="ff-import-opts"><label>Between term and definition <select class="ff-input" name="between">'
            + '<option value="auto">Work it out</option><option value="tab">Tab</option><option value="comma">Comma</option><option value="dash">Dash ( - )</option><option value="colon">Colon ( : )</option><option value="equals">Equals ( = )</option><option value="custom">Custom…</option></select></label>'
            + '<input class="ff-input ff-custom" name="betweenCustom" placeholder="e.g. ||" hidden>'
            + '<label>Between cards <select class="ff-input" name="cards"><option value="newline">New line</option><option value="semicolon">Semicolon</option><option value="blank">Blank line</option></select></label></div>';
          var run = function () {
            var b = $('[name="between"]', box).value;
            var cust = $('[name="betweenCustom"]', box);
            cust.hidden = b !== 'custom';
            var between = b === 'custom' ? (cust.value || 'auto') : b;
            found = F.parseImport($('.ff-paste', box).value, { between: between, cards: $('[name="cards"]', box).value });
            drawPreview($('.ff-paste', box).value.trim() ? 'No cards found yet. Pick what goes between each term and its definition.' : '');
          };
          // input only: a change event fires on blur, and redrawing the preview
          // then would swap the Create button out from under the click.
          box.oninput = run; box.onchange = null;
          setTimeout(function () { var t = $('.ff-paste', box); if (t) t.focus(); }, 0);
        } else if (tab === 'ai') {
          box.innerHTML = '<p class="ff-muted">Paste your notes, a chapter or a study guide' + (signedIn ? ' and Flux AI turns it into cards.' : '. <b>Sign in to the Flux Planner</b> to have AI write the cards; without it, Flux picks out lines like “X is Y” and “term: definition”.') + '</p>'
            + '<textarea class="ff-input ff-paste" rows="12" placeholder="Photosynthesis is the process by which plants make glucose from carbon dioxide and water using light energy…"></textarea>'
            + '<div class="ff-import-opts"><label>About <select class="ff-input" name="count"><option>10</option><option selected>20</option><option>30</option><option>50</option></select> cards</label>'
            + '<button type="button" class="ff-btn ff-btn--primary" data-make>' + ICON.sparkle + (signedIn ? 'Make cards' : 'Find cards') + '</button></div>';
          box.oninput = null; box.onchange = null;
        } else {
          box.innerHTML = '<p class="ff-muted">A CSV or text file (term, definition per line), a Quizlet or Anki text export, or a Flux deck file.</p>'
            + '<label class="ff-drop"><input type="file" accept=".csv,.tsv,.txt,.json,text/plain,text/csv,application/json" hidden><span>' + ICON.download + ' Choose a file</span></label>';
          box.oninput = null;
          box.onchange = function (e) {
            var f = e.target.files && e.target.files[0];
            if (!f) return;
            f.text().then(function (txt) {
              if (/\.json$/i.test(f.name)) {
                var j = JSON.parse(txt);
                var d = Array.isArray(j.decks) ? j.decks[0] : j;
                found = (d.cards || []).map(function (c) { return { term: c.term || '', def: c.def || '' }; });
                aiTitle = d.title || '';
              } else {
                found = F.parseImport(txt);
                aiTitle = f.name.replace(/\.\w+$/, '').replace(/[-_]+/g, ' ');
              }
              drawPreview('No cards found in that file.');
            }).catch(function () { toast('Could not read that file', 'warn'); });
          };
        }
      }
      drawTab();

      host.onclick = function (e) {
        var t = e.target.closest('[data-tab],[data-make],[data-create]');
        if (!t) return;
        if (t.dataset.tab) { tab = t.dataset.tab; setPref('importTab', tab); drawTab(); return; }
        if (t.hasAttribute('data-make')) {
          var text = $('.ff-paste', box).value.trim();
          if (!text) { toast('Paste some notes first', 'warn'); return; }
          var count = parseInt($('[name="count"]', box).value, 10) || 20;
          if (!signedIn) { found = heuristicCards(text); drawPreview('No “X is Y” or “term: definition” lines found. Sign in to the Flux Planner to let AI write cards from any notes.'); return; }
          t.disabled = true; t.classList.add('is-busy');
          prev.innerHTML = '<div class="ff-thinking"><span></span><span></span><span></span> Writing your cards…</div>';
          aiCards(text, count).then(function (res) {
            found = res.cards; aiTitle = res.title; drawPreview();
          }).catch(function (err) {
            var msg = err.message === 'stale' ? 'Your sign-in needs refreshing: open the <a href="index.html">Flux Planner</a> once, then come back and press Make cards again.'
              : err.message === 'signin' ? 'Sign in to the Flux Planner to use AI.'
              : esc(err.message || 'Something went wrong.');
            found = heuristicCards(text);
            drawPreview(msg);
            if (found.length) prev.insertAdjacentHTML('afterbegin', '<p class="ff-warn">' + msg + ' Meanwhile, these were found without AI:</p>');
          }).then(function () { t.disabled = false; t.classList.remove('is-busy'); });
          return;
        }
        if (t.hasAttribute('data-create')) {
          if (into) {
            found.forEach(function (c) { into.cards.push(F.newCard(c)); });
            F.putDeck(into);
            toast('Added ' + plural(found.length, 'card'));
            go('#/deck/' + encodeURIComponent(into.id) + '/edit');
          } else {
            var title = ($('#ffNewTitle', host) || {}).value || aiTitle || 'Imported deck';
            var d = F.newDeck({ title: title.trim() || 'Imported deck', cards: found });
            F.putDeck(d);
            toast('Created “' + d.title + '”');
            go('#/deck/' + encodeURIComponent(d.id));
          }
        }
      };
      setView({ cleanup: function () { host.onclick = null; box.oninput = box.onchange = null; } });
    }

    /* ── Learn: spaced repetition ────────────────────────────────────── */

    function viewLearn(deck) {
      // One deck, or every deck's due cards (#/review).
      var decks = deck ? [deck] : F.decks();
      var now = Date.now();
      var items = [];
      decks.forEach(function (d) {
        var q = deck ? F.queue(d, now, Math.max(0, (d.newPerDay || 20) - newSeenToday(d))) : F.queue(d, now, 0);
        q.forEach(function (c) { items.push({ deck: d, card: c }); });
      });
      if (!deck) items.sort(function (a, b) { return a.card.s.due - b.card.s.due; });
      var total = items.length, done = 0, again = 0;
      var cur = null, revealed = false, typed = null, undoStack = [];
      var dir = prefs().learnDir || 'term';
      var exitHref = deck ? '#/deck/' + encodeURIComponent(deck.id) : '#/';

      function newSeenToday(d) {
        var start = new Date(); start.setHours(0, 0, 0, 0);
        return (d.cards || []).filter(function (c) { return c.s && (c.s.first || 0) >= start.getTime(); }).length;
      }

      host.innerHTML = backBar(exitHref, deck ? deck.title : 'All decks',
        '<button type="button" class="ff-btn ff-btn--small" data-undo hidden>' + ICON.undo + 'Undo</button>'
        + '<div class="ff-seg" role="group" aria-label="Show first"><button type="button" data-dir="term">Term first</button><button type="button" data-dir="def">Definition first</button></div>')
        + '<div class="ff-session"><div class="ff-sbar"><i></i></div><div class="ff-scount"></div></div>'
        + '<div id="ffStage"></div>';
      var stage = $('#ffStage', host);
      function syncDir() { $$('[data-dir]', host).forEach(function (b) { b.classList.toggle('is-on', b.dataset.dir === dir); }); }
      syncDir();

      function bar() {
        var left = items.length + (cur ? 1 : 0);
        $('.ff-sbar i', host).style.width = (total ? Math.round(done / (done + left) * 100) : 100) + '%';
        $('.ff-scount', host).textContent = left ? left + ' to go' : '';
        var u = $('[data-undo]', host); if (u) u.hidden = !undoStack.length;
      }

      function next() {
        cur = items.shift() || null;
        revealed = false; typed = null;
        bar();
        if (!cur) return finish();
        draw();
      }
      function sides() {
        var c = cur.card, d = cur.deck;
        return dir === 'def'
          ? { q: c.def, a: c.term, ql: d.defLang, al: d.termLang }
          : { q: c.term, a: c.def, ql: d.termLang, al: d.defLang };
      }
      function draw() {
        var s = sides(), c = cur.card, d = cur.deck;
        var opts = { retention: d.retention || 0.9, examAt: d.examAt || null };
        var pv = revealed ? F.preview(c, Date.now(), opts) : null;
        var tag = F.isNew(c) ? '<span class="ff-tag ff-tag--new">New</span>' : c.s.state === 'review' ? '' : '<span class="ff-tag">Learning</span>';
        var verdict = '';
        if (revealed && typed != null && typed.trim()) {
          var r = F.check(typed, s.a);
          verdict = '<div class="ff-verdict ff-verdict--' + (r.ok ? 'ok' : 'no') + '">' + (r.ok ? (r.verdict === 'correct' ? '✓ Correct' : '✓ ' + esc(r.note)) : '✗ You wrote “' + esc(typed) + '”') + '</div>';
          cur.suggest = r.ok ? F.GOOD : F.AGAIN;
        } else cur.suggest = null;
        stage.innerHTML = '<div class="ff-learn">'
          + '<div class="ff-learn-card">'
          + '<div class="ff-learn-top">' + tag + (deck ? '' : '<span class="ff-muted">' + esc(d.title) + '</span>') + '<span class="ff-grow"></span>'
          + speakBtn(s.q, s.ql) + '<button type="button" class="ff-icon-btn ff-star' + (c.star ? ' is-on' : '') + '" data-star aria-label="Star" title="Star (S)">' + ICON.star + '</button></div>'
          + '<div class="ff-learn-q ' + sizeClass(s.q) + '">' + fmt(s.q) + '</div>'
          + (revealed ? '<div class="ff-learn-a"><div class="ff-learn-a-text ' + sizeClass(s.a) + '">' + fmt(s.a) + '</div>' + speakBtn(s.a, s.al) + '</div>' + verdict : '')
          + '</div>'
          + (revealed
            ? '<div class="ff-grades" role="group" aria-label="How well did you know it?">'
              + [[F.AGAIN, 'Again', 'again'], [F.HARD, 'Hard', 'hard'], [F.GOOD, 'Good', 'good'], [F.EASY, 'Easy', 'easy']].map(function (g) {
                return '<button type="button" class="ff-grade ff-grade--' + g[2] + (cur.suggest === g[0] ? ' is-suggested' : '') + '" data-grade="' + g[0] + '"><b>' + g[1] + '</b><span>' + F.fmtWait(pv[g[0]].due - Date.now()) + '</span><kbd>' + g[0] + '</kbd></button>';
              }).join('') + '</div>'
            : '<form class="ff-reveal" autocomplete="off"><input class="ff-input" name="typed" placeholder="Type your answer (optional), or just reveal" aria-label="Your answer" autocapitalize="off" spellcheck="false">'
              + '<button type="submit" class="ff-btn ff-btn--primary ff-btn--big">Show answer <kbd>Space</kbd></button></form>')
          + '</div>';
        if (!revealed) {
          var form = $('.ff-reveal', stage);
          form.onsubmit = function (e) { e.preventDefault(); typed = form.typed.value; reveal(); };
        }
      }
      function reveal() { if (!cur || revealed) return; revealed = true; draw(); }
      function grade(g) {
        if (!cur || !revealed) return;
        var c = cur.card, d = cur.deck;
        undoStack.push({ item: cur, prev: c.s ? JSON.parse(JSON.stringify(c.s)) : null, again: g === F.AGAIN });
        F.review(c, g, Date.now(), { retention: d.retention || 0.9, examAt: d.examAt || null });
        F.putDeck(d);
        F.logReview(1);
        done++;
        if (g === F.AGAIN) again++;
        // Still in short steps: it comes back later in this session.
        if (c.s.state === 'learning' || c.s.state === 'relearning') items.splice(Math.min(items.length, 3 + Math.floor(Math.random() * 3)), 0, cur);
        next();
      }
      function undo() {
        var h = undoStack.pop();
        if (!h) return;
        var i = items.indexOf(h.item); if (i >= 0) items.splice(i, 1);
        if (cur) items.unshift(cur);
        if (h.prev) h.item.card.s = h.prev; else delete h.item.card.s;
        F.putDeck(h.item.deck);
        F.logReview(-1);
        done = Math.max(0, done - 1);
        if (h.again) again = Math.max(0, again - 1);
        cur = h.item; revealed = true; typed = null;
        bar(); draw();
      }
      function finish() {
        var nextDue = null;
        decks.forEach(function (d) { d.cards.forEach(function (c) { if (c.s && c.s.due && c.s.state !== 'new' && (nextDue == null || c.s.due < nextDue)) nextDue = c.s.due; }); });
        var streak = F.streak();
        stage.innerHTML = '<div class="ff-finish">'
          + '<div class="ff-finish-ico" aria-hidden="true">' + (done ? '🎉' : '✨') + '</div>'
          + '<h2>' + (done ? 'Done for now' : 'Nothing due right now') + '</h2>'
          + (done ? '<p>You reviewed ' + plural(done, 'card') + (again ? ', and ' + again + ' will come back sooner' : '') + '.</p>' : '<p>Every card is scheduled for later. Come back when they are due, or practise another way.</p>')
          + (streak ? '<p class="ff-flame-line">' + ICON.flame + ' ' + plural(streak, 'day') + ' in a row</p>' : '')
          + (nextDue ? '<p class="ff-muted">Next review: ' + (nextDue - Date.now() < F.DAY ? 'in ' + F.fmtWait(Math.max(F.MIN, nextDue - Date.now())) : new Date(nextDue).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })) + '</p>' : '')
          + '<div class="ff-actions ff-actions--center">'
          + (deck ? '<a class="ff-btn ff-btn--primary" href="#/deck/' + encodeURIComponent(deck.id) + '/cards">Practise with flashcards</a><a class="ff-btn" href="#/deck/' + encodeURIComponent(deck.id) + '/test">Take a practice test</a>' : '')
          + '<a class="ff-btn" href="' + exitHref + '">' + (deck ? 'Back to deck' : 'All decks') + '</a></div></div>';
      }

      host.onclick = function (e) {
        var t = e.target.closest('[data-grade],[data-dir],[data-undo],[data-star],[data-speak]');
        if (!t) {
          if (cur && !revealed && e.target.closest('.ff-learn-card')) reveal();
          return;
        }
        if (t.dataset.speak != null) return speak(t.dataset.speak, t.dataset.lang);
        if (t.dataset.grade) return grade(+t.dataset.grade);
        if (t.dataset.dir) { dir = t.dataset.dir; setPref('learnDir', dir); syncDir(); if (cur) draw(); return; }
        if (t.hasAttribute('data-undo')) return undo();
        if (t.hasAttribute('data-star') && cur) { cur.card.star = !cur.card.star; F.putDeck(cur.deck); t.classList.toggle('is-on', cur.card.star); }
      };
      next();
      setView({
        onKey: function (e) {
          var inInput = e.target && e.target.tagName === 'INPUT';
          if (!cur) return;
          if (!revealed) {
            if (!inInput && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); reveal(); }
            return;
          }
          if (/^[1-4]$/.test(e.key)) { e.preventDefault(); grade(+e.key); }
          else if (e.key === ' ' || e.key === 'Enter') { if (!e.target.closest || !e.target.closest('.ff-grade')) { e.preventDefault(); grade(cur.suggest || F.GOOD); } }
          else if ((e.key === 'z' && (e.metaKey || e.ctrlKey)) || e.key === 'u') { e.preventDefault(); undo(); }
          else if (e.key === 's' || e.key === 'S') { cur.card.star = !cur.card.star; F.putDeck(cur.deck); draw(); }
        },
        cleanup: function () { host.onclick = null; },
      });
    }

    /* ── Flashcards: flip, swipe, sort ───────────────────────────────── */

    function viewCards(deck) {
      var p = prefs();
      var starOnly = !!p.starOnly && deck.cards.some(function (c) { return c.star; });
      var shuffled = !!p.shuffle;
      var defFirst = p.cardsDir === 'def';
      var pool, i, flipped, known, learning;

      function start(cards) {
        pool = shuffled ? F.shuffle(cards) : cards.slice();
        i = 0; flipped = false; known = []; learning = [];
      }
      function baseCards() { return starOnly ? deck.cards.filter(function (c) { return c.star; }) : deck.cards; }
      start(baseCards());

      host.innerHTML = backBar('#/deck/' + encodeURIComponent(deck.id), deck.title,
        '<button type="button" class="ff-icon-btn' + (shuffled ? ' is-on' : '') + '" data-opt="shuffle" aria-pressed="' + shuffled + '" title="Shuffle">' + ICON.shuffle + '</button>'
        + (deck.cards.some(function (c) { return c.star; }) ? '<button type="button" class="ff-icon-btn ff-star' + (starOnly ? ' is-on' : '') + '" data-opt="star" aria-pressed="' + starOnly + '" title="Starred only">' + ICON.star + '</button>' : '')
        + '<div class="ff-seg" role="group" aria-label="Show first"><button type="button" data-cdir="term"' + (defFirst ? '' : ' class="is-on"') + '>Term</button><button type="button" data-cdir="def"' + (defFirst ? ' class="is-on"' : '') + '>Definition</button></div>')
        + '<div class="ff-session"><div class="ff-sort"><span class="ff-sort-l"><b>0</b> still learning</span><span class="ff-scount"></span><span class="ff-sort-k"><b>0</b> know</span></div></div>'
        + '<div id="ffStage"></div>';
      var stage = $('#ffStage', host);

      function counts() {
        $('.ff-sort-l b', host).textContent = learning.length;
        $('.ff-sort-k b', host).textContent = known.length;
        $('.ff-scount', host).textContent = pool.length ? Math.min(i + 1, pool.length) + ' / ' + pool.length : '';
      }
      function draw(anim) {
        counts();
        if (i >= pool.length) return roundEnd();
        var c = pool[i];
        var front = defFirst ? c.def : c.term, back = defFirst ? c.term : c.def;
        var fl = defFirst ? deck.defLang : deck.termLang, bl = defFirst ? deck.termLang : deck.defLang;
        stage.innerHTML = '<div class="ff-flip-wrap">'
          + '<div class="ff-flip' + (flipped ? ' is-flipped' : '') + (anim ? ' is-' + anim : '') + '" tabindex="0" role="button" aria-label="Card. Press space to flip.">'
          + '<div class="ff-flip-in">'
          + '<div class="ff-face ff-face--front"><div class="ff-face-tools">' + speakBtn(front, fl) + '<button type="button" class="ff-icon-btn ff-star' + (c.star ? ' is-on' : '') + '" data-star title="Star">' + ICON.star + '</button></div><div class="ff-face-text ' + sizeClass(front) + '">' + fmt(front) + '</div><div class="ff-face-hint">Tap to flip</div></div>'
          + '<div class="ff-face ff-face--back"><div class="ff-face-tools">' + speakBtn(back, bl) + '</div><div class="ff-face-text ' + sizeClass(back) + '">' + fmt(back) + '</div></div>'
          + '</div><div class="ff-swipe-l">Still learning</div><div class="ff-swipe-k">Know it</div></div>'
          + '<div class="ff-card-nav">'
          + '<button type="button" class="ff-round ff-round--l" data-sort="learning" aria-label="Still learning (left arrow)" title="Still learning (←)">✗</button>'
          + '<button type="button" class="ff-btn ff-btn--small" data-prev' + (i ? '' : ' disabled') + '>' + ICON.undo + 'Back</button>'
          + '<button type="button" class="ff-round ff-round--k" data-sort="known" aria-label="Know it (right arrow)" title="Know it (→)">✓</button>'
          + '</div><p class="ff-muted ff-center ff-kbd-hint">Space flips · ← still learning · → know it · swipe on a phone</p></div>';
        bindSwipe($('.ff-flip', stage));
      }
      function flip() { flipped = !flipped; var el = $('.ff-flip', stage); if (el) el.classList.toggle('is-flipped', flipped); }
      function sort(where) {
        if (i >= pool.length) return;
        (where === 'known' ? known : learning).push(pool[i]);
        i++; flipped = false;
        draw(where === 'known' ? 'in-r' : 'in-l');
      }
      function prev() {
        if (!i) return;
        i--;
        var c = pool[i];
        known = known.filter(function (x) { return x !== c; });
        learning = learning.filter(function (x) { return x !== c; });
        flipped = false; draw();
      }
      function roundEnd() {
        var all = known.length + learning.length;
        stage.innerHTML = '<div class="ff-finish"><div class="ff-finish-ico" aria-hidden="true">' + (learning.length ? '💪' : '🎉') + '</div>'
          + '<h2>' + (learning.length ? 'You know ' + known.length + ' of ' + all : 'You know all ' + all + '!') + '</h2>'
          + '<div class="ff-donut" style="--p:' + (all ? Math.round(known.length / all * 100) : 0) + '"><span>' + (all ? Math.round(known.length / all * 100) : 0) + '%</span></div>'
          + '<div class="ff-actions ff-actions--center">'
          + (learning.length ? '<button type="button" class="ff-btn ff-btn--primary" data-again>Keep studying the ' + plural(learning.length, 'card') + '</button>' : '')
          + '<button type="button" class="ff-btn" data-restart>Start over</button>'
          + '<a class="ff-btn" href="#/deck/' + encodeURIComponent(deck.id) + '/learn">Lock it in with Learn</a></div></div>';
        counts();
      }

      function bindSwipe(el) {
        var x0 = null, y0 = 0, dx = 0, moved = false, pid = null;
        el.addEventListener('pointerdown', function (e) {
          if (e.target.closest('button')) return;
          x0 = e.clientX; y0 = e.clientY; dx = 0; moved = false; pid = e.pointerId;
        });
        el.addEventListener('pointermove', function (e) {
          if (x0 == null || e.pointerId !== pid) return;
          dx = e.clientX - x0;
          if (!moved && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(e.clientY - y0)) { moved = true; try { el.setPointerCapture(pid); } catch (er) {} }
          if (moved) {
            el.style.transform = 'translateX(' + dx + 'px) rotate(' + dx / 25 + 'deg)';
            el.classList.toggle('is-going-k', dx > 60);
            el.classList.toggle('is-going-l', dx < -60);
          }
        });
        var end = function (e) {
          if (x0 == null) return;
          var wasMoved = moved, d = dx;
          x0 = null; el.style.transform = ''; el.classList.remove('is-going-k', 'is-going-l');
          if (wasMoved && Math.abs(d) > 90) sort(d > 0 ? 'known' : 'learning');
          else if (!wasMoved && e.type === 'pointerup' && !e.target.closest('button')) flip();
        };
        el.addEventListener('pointerup', end);
        el.addEventListener('pointercancel', end);
      }

      host.onclick = function (e) {
        var t = e.target.closest('[data-sort],[data-prev],[data-again],[data-restart],[data-opt],[data-cdir],[data-star],[data-speak]');
        if (!t) return;
        if (t.dataset.speak != null) return speak(t.dataset.speak, t.dataset.lang);
        if (t.dataset.sort) return sort(t.dataset.sort);
        if (t.hasAttribute('data-prev')) return prev();
        if (t.hasAttribute('data-again')) { start(learning); draw(); return; }
        if (t.hasAttribute('data-restart')) { start(baseCards()); draw(); return; }
        if (t.hasAttribute('data-star')) { var c = pool[i]; c.star = !c.star; F.putDeck(deck); t.classList.toggle('is-on', c.star); return; }
        if (t.dataset.cdir) {
          defFirst = t.dataset.cdir === 'def'; setPref('cardsDir', t.dataset.cdir);
          $$('[data-cdir]', host).forEach(function (b) { b.classList.toggle('is-on', b === t); });
          flipped = false; draw(); return;
        }
        if (t.dataset.opt === 'shuffle') { shuffled = !shuffled; setPref('shuffle', shuffled); t.classList.toggle('is-on', shuffled); t.setAttribute('aria-pressed', shuffled); start(baseCards()); draw(); return; }
        if (t.dataset.opt === 'star') { starOnly = !starOnly; setPref('starOnly', starOnly); t.classList.toggle('is-on', starOnly); t.setAttribute('aria-pressed', starOnly); start(baseCards()); draw(); }
      };
      draw();
      setView({
        onKey: function (e) {
          if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
          if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); if (i < pool.length) flip(); }
          else if (e.key === 'ArrowRight') { e.preventDefault(); sort('known'); }
          else if (e.key === 'ArrowLeft') { e.preventDefault(); sort('learning'); }
          else if (e.key === 'Backspace' || (e.key === 'z' && (e.metaKey || e.ctrlKey))) { e.preventDefault(); prev(); }
        },
        cleanup: function () { host.onclick = null; },
      });
    }

    /* ── Write ───────────────────────────────────────────────────────── */

    function viewWrite(deck) {
      // 'term' = answer with the term. Long definitions default to that:
      // typing out a paragraph is not practice, it is dictation.
      var avgDef = deck.cards.reduce(function (n, c) { return n + c.def.length; }, 0) / Math.max(1, deck.cards.length);
      var defFirst = prefs().writeDir ? prefs().writeDir === 'term' : avgDef > 45;
      var round, missed, idx, right, state;
      function start(cards) { round = F.shuffle(cards); missed = []; idx = 0; right = 0; state = 'ask'; }
      start(deck.cards);

      host.innerHTML = backBar('#/deck/' + encodeURIComponent(deck.id), deck.title,
        '<div class="ff-seg" role="group" aria-label="Answer with"><button type="button" data-wdir="def"' + (defFirst ? '' : ' class="is-on"') + '>Answer with definition</button><button type="button" data-wdir="term"' + (defFirst ? ' class="is-on"' : '') + '>Answer with term</button></div>')
        + '<div class="ff-session"><div class="ff-sbar"><i></i></div><div class="ff-scount"></div></div><div id="ffStage"></div>';
      var stage = $('#ffStage', host);

      function bar() {
        $('.ff-sbar i', host).style.width = (round.length ? Math.round(idx / round.length * 100) : 100) + '%';
        $('.ff-scount', host).textContent = round.length && idx < round.length ? (idx + 1) + ' / ' + round.length + ' · ' + right + ' right' : '';
      }
      function qa(c) { return defFirst ? { q: c.def, a: c.term, ql: deck.defLang } : { q: c.term, a: c.def, ql: deck.termLang }; }
      function ask() {
        bar();
        if (idx >= round.length) return end();
        var c = round[idx], s = qa(c);
        state = 'ask';
        stage.innerHTML = '<div class="ff-learn"><div class="ff-learn-card"><div class="ff-learn-top"><span class="ff-grow"></span>' + speakBtn(s.q, s.ql) + '</div>'
          + '<div class="ff-learn-q ' + sizeClass(s.q) + '">' + fmt(s.q) + '</div></div>'
          + '<form class="ff-write" autocomplete="off"><input class="ff-input ff-input--big" name="ans" placeholder="Type the ' + (defFirst ? 'term' : 'definition') + '" aria-label="Your answer" autocapitalize="off" spellcheck="false">'
          + '<button type="submit" class="ff-btn ff-btn--primary">Check</button><button type="button" class="ff-btn" data-dunno>I don’t know</button></form>'
          + '<div class="ff-feedback" aria-live="polite"></div></div>';
        var form = $('.ff-write', stage);
        form.ans.focus();
        form.onsubmit = function (e) { e.preventDefault(); if (state === 'ask') mark(form.ans.value); else nextQ(); };
      }
      function mark(given) {
        var c = round[idx], s = qa(c);
        var r = given.trim() ? F.check(given, s.a) : { ok: false, verdict: 'wrong' };
        state = 'shown';
        if (r.ok) right++; else missed.push(c);
        var fb = $('.ff-feedback', stage);
        fb.innerHTML = r.ok
          ? '<div class="ff-verdict ff-verdict--ok">✓ ' + (r.verdict === 'correct' ? 'Correct' : esc(r.note)) + '</div>'
          : '<div class="ff-verdict ff-verdict--no">' + (given.trim() ? '✗ Not quite' : 'The answer is') + '</div>'
            + '<div class="ff-answer"><span class="ff-muted">Correct answer</span><div>' + fmt(s.a) + '</div></div>'
            + (given.trim() ? '<button type="button" class="ff-link" data-override>I was right — count it</button>' : '');
        var inp = $('[name="ans"]', stage);
        inp.readOnly = true;
        inp.classList.add(r.ok ? 'is-ok' : 'is-no');
        var btn = $('.ff-write [type="submit"]', stage); btn.textContent = 'Next'; btn.focus();
        var dk = $('[data-dunno]', stage); if (dk) dk.remove();
        bar();
      }
      function nextQ() { idx++; ask(); }
      function end() {
        var pct = round.length ? Math.round(right / round.length * 100) : 0;
        stage.innerHTML = '<div class="ff-finish"><div class="ff-donut" style="--p:' + pct + '"><span>' + pct + '%</span></div>'
          + '<h2>' + right + ' of ' + round.length + ' right</h2>'
          + '<div class="ff-actions ff-actions--center">'
          + (missed.length ? '<button type="button" class="ff-btn ff-btn--primary" data-missed>Practise the ' + plural(missed.length, 'one') + ' you missed</button>' : '')
          + '<button type="button" class="ff-btn" data-restart>Start over</button></div></div>';
      }
      host.onclick = function (e) {
        var t = e.target.closest('[data-dunno],[data-override],[data-missed],[data-restart],[data-wdir],[data-speak]');
        if (!t) return;
        if (t.dataset.speak != null) return speak(t.dataset.speak, t.dataset.lang);
        if (t.hasAttribute('data-dunno')) return mark('');
        if (t.hasAttribute('data-override')) { right++; missed.pop(); t.replaceWith(Object.assign(document.createElement('span'), { className: 'ff-muted', textContent: 'Counted as right.' })); bar(); $('.ff-write [type="submit"]', stage).focus(); return; }
        if (t.hasAttribute('data-missed')) { start(missed); ask(); return; }
        if (t.hasAttribute('data-restart')) { start(deck.cards); ask(); return; }
        if (t.dataset.wdir) {
          defFirst = t.dataset.wdir === 'term'; setPref('writeDir', t.dataset.wdir);
          $$('[data-wdir]', host).forEach(function (b) { b.classList.toggle('is-on', b === t); });
          start(deck.cards); ask();
        }
      };
      ask();
      setView({ cleanup: function () { host.onclick = null; } });
    }

    /* ── Test ────────────────────────────────────────────────────────── */

    function viewTest(deck) {
      var p = prefs();
      var max = deck.cards.length;
      host.innerHTML = backBar('#/deck/' + encodeURIComponent(deck.id), deck.title)
        + '<h1 class="ff-page-title">Practice test</h1><div id="ffStage"></div>';
      var stage = $('#ffStage', host);
      var qs = null;

      function setup() {
        var count = Math.min(p.testCount || 20, max);
        var types = p.testTypes || ['mc', 'tf', 'written'];
        stage.innerHTML = '<form class="ff-test-setup">'
          + '<label>Questions <input class="ff-input" type="number" name="count" min="1" max="' + max + '" value="' + count + '"> <span class="ff-muted">of ' + max + '</span></label>'
          + '<fieldset><legend>Question types</legend>'
          + [['mc', 'Multiple choice'], ['tf', 'True / false'], ['written', 'Written']].map(function (t) {
            return '<label class="ff-check"><input type="checkbox" name="types" value="' + t[0] + '"' + (types.indexOf(t[0]) >= 0 ? ' checked' : '') + '> ' + t[1] + '</label>';
          }).join('') + '</fieldset>'
          + '<label>Answer with <select class="ff-input" name="dir"><option value="term"' + (p.testDir === 'term' || !p.testDir ? ' selected' : '') + '>Definitions</option><option value="def"' + (p.testDir === 'def' ? ' selected' : '') + '>Terms</option><option value="both"' + (p.testDir === 'both' ? ' selected' : '') + '>Both</option></select></label>'
          + '<button type="submit" class="ff-btn ff-btn--primary ff-btn--big">Start test</button></form>';
        $('form', stage).onsubmit = function (e) {
          e.preventDefault();
          var f = e.target;
          var tps = $$('[name="types"]:checked', f).map(function (x) { return x.value; });
          if (!tps.length) { toast('Pick at least one question type', 'warn'); return; }
          p.testCount = Math.max(1, Math.min(max, parseInt(f.count.value, 10) || 10));
          p.testTypes = tps; p.testDir = f.dir.value;
          setPref('testCount', p.testCount); setPref('testTypes', tps); setPref('testDir', p.testDir);
          qs = F.buildTest(deck.cards, { count: p.testCount, types: tps, dir: p.testDir });
          drawTest();
        };
      }
      function drawTest() {
        stage.innerHTML = '<form class="ff-test" autocomplete="off">' + qs.map(function (q, n) {
          var head = '<div class="ff-q-head"><span>' + (n + 1) + ' of ' + qs.length + '</span><span class="ff-muted">' + (q.type === 'mc' ? 'Choose the answer' : q.type === 'tf' ? 'True or false?' : 'Write the answer') + '</span></div>';
          var body = '';
          if (q.type === 'mc') body = '<div class="ff-q-prompt ' + sizeClass(q.prompt) + '">' + fmt(q.prompt) + '</div><div class="ff-opts">' + q.options.map(function (o, k) {
            return '<label class="ff-opt"><input type="radio" name="q' + n + '" value="' + k + '"><span>' + fmt(o) + '</span></label>';
          }).join('') + '</div>';
          else if (q.type === 'tf') body = '<div class="ff-tf"><div class="ff-q-prompt">' + fmt(q.prompt) + '</div><div class="ff-tf-eq">=</div><div class="ff-q-prompt ff-q-shown">' + fmt(q.shown) + '</div></div>'
            + '<div class="ff-opts ff-opts--2"><label class="ff-opt"><input type="radio" name="q' + n + '" value="1"><span>True</span></label><label class="ff-opt"><input type="radio" name="q' + n + '" value="0"><span>False</span></label></div>';
          else body = '<div class="ff-q-prompt ' + sizeClass(q.prompt) + '">' + fmt(q.prompt) + '</div><input class="ff-input" name="q' + n + '" placeholder="Your answer" autocapitalize="off" spellcheck="false">';
          return '<section class="ff-q" data-n="' + n + '">' + head + body + '<div class="ff-q-mark"></div></section>';
        }).join('') + '<button type="submit" class="ff-btn ff-btn--primary ff-btn--big">Submit test</button></form>';
        $('.ff-test', stage).onsubmit = function (e) { e.preventDefault(); markTest(e.target); };
      }
      function markTest(form) {
        var answers = qs.map(function (q, n) {
          var el = form['q' + n];
          if (q.type === 'mc') { var r = $('[name="q' + n + '"]:checked', form); return r ? q.options[+r.value] : null; }
          if (q.type === 'tf') { var t = $('[name="q' + n + '"]:checked', form); return t ? t.value === '1' : null; }
          return el ? el.value : '';
        });
        var res = F.gradeTest(qs, answers);
        $$('.ff-q', form).forEach(function (sec, n) {
          var m = res.marks[n], q = qs[n];
          sec.classList.add(m.ok ? 'is-right' : 'is-wrong');
          $$('input', sec).forEach(function (x) { x.disabled = true; });
          if (q.type === 'mc') $$('.ff-opt', sec).forEach(function (o, k) { if (q.options[k] === q.answer) o.classList.add('is-answer'); });
          if (q.type === 'tf') $$('.ff-opt', sec).forEach(function (o, k) { if ((k === 0) === q.truth) o.classList.add('is-answer'); });
          $('.ff-q-mark', sec).innerHTML = m.ok ? '<span class="ff-ok">✓ Right' + (m.check && m.check.note ? ' — ' + esc(m.check.note) : '') + '</span>'
            : '<span class="ff-no">✗ ' + (q.type === 'tf' ? 'It is ' + (q.truth ? 'true' : 'false') + (q.truth ? '' : '. The answer is “' + esc(q.answer) + '”') : 'Answer: ' + esc(q.answer)) + '</span>';
        });
        var btn = $('[type="submit"]', form); btn.remove();
        stage.insertAdjacentHTML('afterbegin', '<div class="ff-score"><div class="ff-donut" style="--p:' + res.pct + '"><span>' + res.pct + '%</span></div>'
          + '<div><h2>' + res.right + ' of ' + res.total + ' right</h2><p class="ff-muted">' + (res.pct >= 90 ? 'Excellent — you are ready.' : res.pct >= 70 ? 'Good. Review the ones you missed below.' : 'Keep going: Learn mode will bring the tricky ones back.') + '</p>'
          + '<div class="ff-actions"><button type="button" class="ff-btn ff-btn--primary" data-new>New test</button><a class="ff-btn" href="#/deck/' + encodeURIComponent(deck.id) + '/learn">Study with Learn</a></div></div></div>');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      host.onclick = function (e) { if (e.target.closest('[data-new]')) setup(); };
      setup();
      setView({ cleanup: function () { host.onclick = null; } });
    }

    /* ── Match ───────────────────────────────────────────────────────── */

    function viewMatch(deck) {
      var tiles, picked, left, t0, timer, penalty;
      host.innerHTML = backBar('#/deck/' + encodeURIComponent(deck.id), deck.title, '<span class="ff-clock" aria-live="off">0.0s</span>')
        + '<div id="ffStage"></div>';
      var stage = $('#ffStage', host), clock = $('.ff-clock', host);

      function intro() {
        clearInterval(timer);
        clock.textContent = '0.0s';
        stage.innerHTML = '<div class="ff-finish"><div class="ff-finish-ico" aria-hidden="true">⏱️</div><h2>Match every term to its definition</h2>'
          + '<p class="ff-muted">As fast as you can. A wrong pair adds a second.' + (deck.bestMatch ? ' Your best: <b>' + (deck.bestMatch / 1000).toFixed(1) + 's</b>' : '') + '</p>'
          + '<button type="button" class="ff-btn ff-btn--primary ff-btn--big" data-go>Start</button></div>';
      }
      function go_() {
        if (deck.cards.length < 2) { toast('Add at least two cards to play', 'warn'); return; }
        tiles = F.matchTiles(deck.cards, 6);
        picked = null; left = tiles.length / 2; penalty = 0;
        stage.innerHTML = '<div class="ff-match">' + tiles.map(function (t, k) {
          return '<button type="button" class="ff-tile ' + sizeClass(t.text) + '" data-k="' + k + '">' + fmt(t.text) + '</button>';
        }).join('') + '</div>';
        t0 = performance.now();
        timer = setInterval(function () { clock.textContent = ((performance.now() - t0 + penalty) / 1000).toFixed(1) + 's'; }, 100);
      }
      function tap(btn) {
        var k = +btn.dataset.k, t = tiles[k];
        if (btn.classList.contains('is-gone')) return;
        if (picked == null) { picked = k; btn.classList.add('is-picked'); return; }
        if (picked === k) { picked = null; btn.classList.remove('is-picked'); return; }
        var a = tiles[picked], other = $('[data-k="' + picked + '"]', stage);
        if (a.key === t.key && a.side !== t.side) {
          other.classList.remove('is-picked'); other.classList.add('is-gone'); btn.classList.add('is-gone');
          picked = null; left--;
          if (!left) win();
        } else {
          penalty += 1000;
          other.classList.remove('is-picked'); other.classList.add('is-wrong'); btn.classList.add('is-wrong');
          setTimeout(function () { other.classList.remove('is-wrong'); btn.classList.remove('is-wrong'); }, 450);
          picked = null;
        }
      }
      function win() {
        clearInterval(timer);
        var ms = Math.round(performance.now() - t0 + penalty);
        clock.textContent = (ms / 1000).toFixed(1) + 's';
        var best = !deck.bestMatch || ms < deck.bestMatch;
        if (best) { deck.bestMatch = ms; F.putDeck(deck); }
        stage.innerHTML = '<div class="ff-finish"><div class="ff-finish-ico" aria-hidden="true">' + (best ? '🏆' : '✅') + '</div>'
          + '<h2>' + (ms / 1000).toFixed(1) + ' seconds</h2><p>' + (best ? 'A new best for this deck!' : 'Your best is ' + (deck.bestMatch / 1000).toFixed(1) + 's.') + '</p>'
          + '<button type="button" class="ff-btn ff-btn--primary ff-btn--big" data-go>Play again</button></div>';
      }
      host.onclick = function (e) {
        if (e.target.closest('[data-go]')) return go_();
        var b = e.target.closest('.ff-tile'); if (b) tap(b);
      };
      intro();
      setView({ cleanup: function () { clearInterval(timer); host.onclick = null; } });
    }

    /* ── Wiring ──────────────────────────────────────────────────────── */

    function onKey(e) {
      if (document.querySelector('.ff-modal-ov')) return;
      if (view && view.onKey) view.onKey(e);
    }
    document.addEventListener('keydown', onKey);
    window.addEventListener('hashchange', render);
    // Another tab (the planner syncing, or a second Flashcards tab) changed the decks.
    window.addEventListener('storage', function (e) {
      if (e.key === F.STORE && (!location.hash || location.hash === '#/' )) render();
    });
    render();
    return { render: render };
  }

  window.FluxFlashcards = { mount: mount, _heuristicCards: heuristicCards, _fmt: fmt };
})();
