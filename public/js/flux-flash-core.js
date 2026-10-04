/* ============================================================================
   FLUX FLASHCARDS · CORE  ·  flux-flash-core.js
   Everything about flashcards that is not drawing: the deck store, the memory
   scheduler, answer checking, import parsing, quiz building and share links.

   No DOM here, so the unit tests run it in a bare VM, and the planner bundle
   loads it too: the planner is what carries decks to the cloud (see SYNC).

   THE SCHEDULER
   -------------
   FSRS-4.5 with its published default weights — the model behind the best
   spaced-repetition apps. Each card carries a stability S (days until recall
   drops to 90%) and a difficulty D (1–10). A review moves both, and the next
   interval is the time until recall is predicted to fall to the target
   retention (90% by default; a deck with an exam date never schedules past
   that date). New and lapsed cards go through short steps (1, 5, 10 minutes)
   before they are given days.

   SYNC
   ----
   Decks live in localStorage under one key, shared by flashcards.html and the
   planner (same site). When signed in, the planner puts them in the account
   payload it already syncs, merging deck by deck on `updated`, so a deck
   follows you to your other devices. A deleted deck is kept as a tombstone so
   the deletion travels too.
   ========================================================================== */
(function () {
  'use strict';
  var root = typeof window !== 'undefined' ? window : globalThis;
  if (root.FluxFlash) return;

  var STORE = 'flux_flash_decks_v1';
  var STATS = 'flux_flash_stats_v1';
  var MIN = 60 * 1000, DAY = 24 * 60 * MIN;

  /* ── Small helpers ──────────────────────────────────────────────────── */

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(t) {
    var d = new Date(t == null ? Date.now() : t);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function shuffle(a, rnd) {
    rnd = rnd || Math.random;
    var b = a.slice();
    for (var i = b.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = b[i]; b[i] = b[j]; b[j] = t;
    }
    return b;
  }

  /* ── FSRS-4.5 ───────────────────────────────────────────────────────── */

  var W = [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474,
    0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755];
  var DECAY = -0.5, FACTOR = 19 / 81;
  var AGAIN = 1, HARD = 2, GOOD = 3, EASY = 4;

  function retrievability(elapsedDays, S) {
    return Math.pow(1 + FACTOR * elapsedDays / S, DECAY);
  }
  function intervalFor(S, retention) {
    return S / FACTOR * (Math.pow(retention, 1 / DECAY) - 1);
  }
  function initD(g) { return clamp(W[4] - (g - 3) * W[5], 1, 10); }
  function initS(g) { return Math.max(W[g - 1], 0.1); }
  function nextD(D, g) {
    var d = D - W[6] * (g - 3);
    return clamp(W[7] * initD(GOOD) + (1 - W[7]) * d, 1, 10);
  }
  function successS(D, S, R, g) {
    var hard = g === HARD ? W[15] : 1, easy = g === EASY ? W[16] : 1;
    return S * (1 + Math.exp(W[8]) * (11 - D) * Math.pow(S, -W[9]) * (Math.exp(W[10] * (1 - R)) - 1) * hard * easy);
  }
  function failS(D, S, R) {
    return Math.min(S, W[11] * Math.pow(D, -W[12]) * (Math.pow(S + 1, W[13]) - 1) * Math.exp(W[14] * (1 - R)));
  }

  /** Whole days, at least 1, never past the exam and never more than ~3 years. */
  function days(S, opts) {
    var r = (opts && opts.retention) || 0.9;
    var ivl = clamp(Math.round(intervalFor(S, r)), 1, 1000);
    if (opts && opts.examAt && opts.now) {
      var left = Math.floor((opts.examAt - opts.now) / DAY);
      if (left >= 1) ivl = Math.min(ivl, left);
    }
    return ivl;
  }

  /**
   * What each of the four answers would do to a card, without changing it.
   * Returns { 1: s, 2: s, 3: s, 4: s } where each s is the card's next `s`
   * (state, S, D, due, …). The buttons use this to label themselves "1m",
   * "10m", "3d" before you press one.
   */
  function preview(card, now, opts) {
    now = now || Date.now();
    opts = Object.assign({ now: now }, opts || {});
    var s = card.s || { state: 'new' };
    var out = {};
    var base = { reps: (s.reps || 0) + 1, lapses: s.lapses || 0, last: now, first: s.first || now };

    if (!s.state || s.state === 'new') {
      [AGAIN, HARD, GOOD, EASY].forEach(function (g) {
        var n = Object.assign({}, base, { D: initD(g), S: initS(g) });
        if (g === EASY) { n.state = 'review'; n.ivl = days(n.S, opts); n.due = now + n.ivl * DAY; }
        else { n.state = 'learning'; n.due = now + [1, 5, 10][g - 1] * MIN; n.ivl = 0; }
        out[g] = n;
      });
      return out;
    }

    if (s.state === 'learning' || s.state === 'relearning') {
      var relearn = s.state === 'relearning';
      [AGAIN, HARD, GOOD, EASY].forEach(function (g) {
        var n = Object.assign({}, base, { D: s.D, S: s.S });
        if (g === AGAIN) { n.state = s.state; n.due = now + (relearn ? 10 : 5) * MIN; n.ivl = 0; }
        else if (g === HARD) { n.state = s.state; n.due = now + 10 * MIN; n.ivl = 0; }
        else {
          n.D = nextD(s.D, g);
          if (g === EASY) n.S = s.S * W[16];
          n.state = 'review';
          n.ivl = days(n.S, opts);
          if (g === EASY) n.ivl = Math.max(n.ivl, days(s.S, opts) + 1);
          n.due = now + n.ivl * DAY;
        }
        out[g] = n;
      });
      return out;
    }

    // Review.
    var elapsed = Math.max(0, (now - (s.last || now)) / DAY);
    var R = retrievability(elapsed, s.S);
    var ivls = {};
    [AGAIN, HARD, GOOD, EASY].forEach(function (g) {
      var n = Object.assign({}, base, { D: nextD(s.D, g) });
      if (g === AGAIN) {
        n.S = failS(s.D, s.S, R);
        n.state = 'relearning'; n.lapses = (s.lapses || 0) + 1;
        n.due = now + 10 * MIN; n.ivl = 0;
      } else {
        n.S = successS(s.D, s.S, R, g);
        n.state = 'review';
        ivls[g] = days(n.S, opts);
      }
      out[g] = n;
    });
    // Keep the buttons in order: hard ≤ good < easy.
    ivls[HARD] = Math.min(ivls[HARD], ivls[GOOD]);
    ivls[GOOD] = Math.max(ivls[GOOD], ivls[HARD] + 1);
    ivls[EASY] = Math.max(ivls[EASY], ivls[GOOD] + 1);
    if (opts.examAt) {
      var left = Math.floor((opts.examAt - now) / DAY);
      if (left >= 1) [HARD, GOOD, EASY].forEach(function (g) { ivls[g] = Math.min(ivls[g], left); });
    }
    [HARD, GOOD, EASY].forEach(function (g) { out[g].ivl = ivls[g]; out[g].due = now + ivls[g] * DAY; });
    return out;
  }

  function review(card, grade, now, opts) {
    var n = preview(card, now, opts)[grade];
    card.s = n;
    return card;
  }

  /** "1m", "10m", "3d", "2mo", "1.2y" — the label for a button. */
  function fmtWait(ms) {
    var m = ms / MIN;
    if (m < 60) return Math.max(1, Math.round(m)) + 'm';
    var h = m / 60;
    if (h < 24) return Math.round(h) + 'h';
    var d = h / 24;
    if (d < 30) return Math.round(d) + 'd';
    if (d < 365) return Math.round(d / 30) + 'mo';
    return (Math.round(d / 36.5) / 10) + 'y';
  }

  function isDue(card, now) {
    var s = card.s;
    if (!s || !s.state || s.state === 'new') return false;
    return (s.due || 0) <= (now || Date.now());
  }
  function isNew(card) { return !card.s || !card.s.state || card.s.state === 'new'; }

  /** New / learning / known / mastered counts, for the bars. */
  function progress(deck) {
    var p = { total: 0, fresh: 0, learning: 0, known: 0, mastered: 0 };
    (deck.cards || []).forEach(function (c) {
      p.total++;
      var s = c.s;
      if (!s || !s.state || s.state === 'new') p.fresh++;
      else if (s.state !== 'review') p.learning++;
      else if ((s.S || 0) >= 21) p.mastered++;
      else p.known++;
    });
    return p;
  }

  /**
   * Today's review queue: due cards first (most overdue first), then up to
   * `newLimit` new cards in deck order.
   */
  function queue(deck, now, newLimit) {
    now = now || Date.now();
    var cards = deck.cards || [];
    var due = cards.filter(function (c) { return isDue(c, now); })
      .sort(function (a, b) { return a.s.due - b.s.due; });
    var limit = newLimit == null ? 20 : newLimit;
    var fresh = cards.filter(isNew).slice(0, limit);
    return due.concat(fresh);
  }
  function dueCount(deck, now) {
    now = now || Date.now();
    return (deck.cards || []).filter(function (c) { return isDue(c, now); }).length;
  }

  /* ── Answer checking ────────────────────────────────────────────────── */

  function stripAccents(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function norm(s, keepAccents) {
    var t = String(s == null ? '' : s).toLowerCase().replace(/\([^)]*\)/g, ' ');
    if (!keepAccents) t = stripAccents(t);
    return t.replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
      .replace(/^(the|a|an|to|el|la|los|las|le|les|un|une|der|die|das) /, '');
  }
  function lev(a, b) {
    if (a === b) return 0;
    var m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    var prev = [], cur = [];
    for (var j = 0; j <= n; j++) prev[j] = j;
    for (var i = 1; i <= m; i++) {
      cur = [i];
      for (j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[n];
  }
  /** Every acceptable answer: "big / large; huge" accepts each. */
  function alternatives(ans) {
    var whole = String(ans || '');
    // " or " only splits short answers: in a sentence it is part of the meaning.
    var re = whole.split(/\s+/).length <= 6 ? /\s*(?:\/|;|\bor\b|\n)\s*/i : /\s*(?:\/|;|\n)\s*/;
    var parts = whole.split(re).filter(Boolean);
    return [whole].concat(parts.length > 1 ? parts : []);
  }

  /**
   * Is `given` an answer to `expected`?
   *   correct  exactly, ignoring case, punctuation, a leading article and
   *            anything in brackets
   *   accent   right apart from accents (counted right, with a note)
   *   typo     a letter or two out (counted right, with a note)
   *   wrong
   */
  function check(given, expected) {
    var g = norm(given, true), gA = norm(given, false);
    if (!gA) return { verdict: 'wrong', ok: false };
    var best = { verdict: 'wrong', ok: false };
    alternatives(expected).some(function (alt) {
      var e = norm(alt, true), eA = norm(alt, false);
      if (!eA) return false;
      if (g === e) { best = { verdict: 'correct', ok: true }; return true; }
      if (gA === eA) { best = { verdict: 'accent', ok: true, note: 'Watch the accents: ' + alt.trim() }; return false; }
      var allow = eA.length >= 12 ? 2 : eA.length >= 5 ? 1 : 0;
      if (allow && best.verdict === 'wrong' && lev(gA, eA) <= allow) {
        best = { verdict: 'typo', ok: true, note: 'Nearly — it is spelt ' + alt.trim() };
      }
      return false;
    });
    return best;
  }

  /* ── Import ─────────────────────────────────────────────────────────── */

  function csvRows(text, sep) {
    var rows = [], row = [], cell = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (q) {
        if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (ch === '"') q = false;
        else cell += ch;
      } else if (ch === '"' && cell === '') q = true;
      else if (ch === sep) { row.push(cell); cell = ''; }
      else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else if (ch !== '\r') cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  var SEPS = [
    { id: 'tab', label: 'Tab', re: /\t/ },
    { id: 'dash', label: ' - ', re: /\s+[-–—]\s+/ },
    { id: 'colon', label: ':', re: /\s*:\s+/ },
    { id: 'equals', label: '=', re: /\s*=\s*/ },
    { id: 'comma', label: ',', re: /,/ },
    { id: 'semicolon', label: ';', re: /;/ },
  ];

  /** The separator most lines agree on, or null. */
  function detectSep(lines) {
    var best = null, bestN = 0;
    SEPS.forEach(function (s) {
      var n = lines.filter(function (l) { return s.re.test(l); }).length;
      if (n > bestN) { best = s.id; bestN = n; }
    });
    return bestN >= Math.max(1, Math.ceil(lines.length * 0.6)) ? best : null;
  }

  /**
   * Paste from Quizlet (Export: tab between, new line between), a CSV, or a
   * list like "mitochondria - makes ATP". Returns [{term, def}].
   * opts.between: 'auto' | sep id | a custom string
   * opts.cards: 'newline' (default) | 'semicolon' | 'blank' | custom string
   */
  function parseImport(text, opts) {
    opts = opts || {};
    text = String(text || '').replace(/\r\n?/g, '\n').trim();
    if (!text) return [];
    var between = opts.between || 'auto';
    var cardSep = opts.cards || 'newline';

    if (cardSep === 'newline' && (between === 'comma' || (between === 'auto' && /^"|",|,"/m.test(text) && !/\t/.test(text)))) {
      return csvRows(text, ',').map(function (r) { return { term: (r[0] || '').trim(), def: r.slice(1).join(', ').trim() }; })
        .filter(function (c) { return c.term && c.def; });
    }

    var chunks;
    if (cardSep === 'newline') chunks = text.split('\n');
    else if (cardSep === 'semicolon') chunks = text.split(';');
    else if (cardSep === 'blank') chunks = text.split(/\n\s*\n/);
    else chunks = text.split(cardSep);
    chunks = chunks.map(function (c) { return c.trim(); }).filter(Boolean);

    var re;
    if (between === 'auto') {
      var id = detectSep(chunks);
      if (!id) {
        // Alternating lines: term, definition, term, definition.
        if (cardSep === 'newline' && chunks.length >= 2 && chunks.length % 2 === 0) {
          var pairs = [];
          for (var i = 0; i < chunks.length; i += 2) pairs.push({ term: chunks[i], def: chunks[i + 1] });
          return pairs;
        }
        return [];
      }
      re = SEPS.filter(function (s) { return s.id === id; })[0].re;
    } else {
      var known = SEPS.filter(function (s) { return s.id === between; })[0];
      re = known ? known.re : new RegExp(between.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    }
    return chunks.map(function (c) {
      var m = c.match(re);
      if (!m) return null;
      var at = m.index;
      return { term: c.slice(0, at).replace(/^[•*\-\d.)\s]+/, '').trim(), def: c.slice(at + m[0].length).trim() };
    }).filter(function (c) { return c && c.term && c.def; });
  }

  /* ── Tests and games ────────────────────────────────────────────────── */

  /**
   * A practice test. `dir` is 'term' (show the term, answer the definition),
   * 'def', or 'both'. Question types are spread across multiple choice,
   * true/false and written, as many of each as `types` allows.
   */
  function buildTest(cards, opts) {
    opts = opts || {};
    var rnd = opts.random || Math.random;
    var n = Math.min(opts.count || 20, cards.length);
    var types = (opts.types && opts.types.length) ? opts.types : ['mc', 'tf', 'written'];
    var dir = opts.dir || 'term';
    var picked = shuffle(cards, rnd).slice(0, n);
    return picked.map(function (c, i) {
      var type = types[i % types.length];
      if (type === 'mc' && cards.length < 4) type = cards.length >= 2 ? 'tf' : 'written';
      if (type === 'tf' && cards.length < 2) type = 'written';
      var flip = dir === 'def' || (dir === 'both' && rnd() < 0.5);
      // Nobody should have to type out a paragraph: written questions with a
      // long answer ask the other way round.
      if (type === 'written') {
        var ans = flip ? c.term : c.def, other = flip ? c.def : c.term;
        if (ans.length > 60 && other.length < ans.length) flip = !flip;
      }
      var prompt = flip ? c.def : c.term, answer = flip ? c.term : c.def;
      var side = flip ? 'term' : 'def';
      var q = { id: c.id, type: type, prompt: prompt, answer: answer, side: side };
      if (type === 'mc') {
        var others = shuffle(cards.filter(function (o) { return o.id !== c.id && o[side] !== answer; }), rnd)
          .map(function (o) { return o[side]; });
        var uniq = [];
        others.forEach(function (o) { if (uniq.indexOf(o) < 0) uniq.push(o); });
        q.options = shuffle([answer].concat(uniq.slice(0, 3)), rnd);
      } else if (type === 'tf') {
        var truth = rnd() < 0.5;
        var wrong = cards.filter(function (o) { return o.id !== c.id && o[side] !== answer; });
        if (!wrong.length) truth = true;
        q.shown = truth ? answer : wrong[Math.floor(rnd() * wrong.length)][side];
        q.truth = truth;
      }
      return q;
    });
  }

  function gradeTest(questions, answers) {
    var right = 0;
    var marks = questions.map(function (q, i) {
      var a = answers[i], ok = false, res = null;
      if (q.type === 'mc') ok = a === q.answer;
      else if (q.type === 'tf') ok = a === q.truth;
      else { res = check(a, q.answer); ok = res.ok; }
      if (ok) right++;
      return { ok: ok, given: a, check: res };
    });
    return { right: right, total: questions.length, pct: questions.length ? Math.round(right / questions.length * 100) : 0, marks: marks };
  }

  /** Six pairs (or fewer) for the match game, as shuffled tiles. */
  function matchTiles(cards, n, rnd) {
    var pairs = shuffle(cards, rnd).slice(0, Math.min(n || 6, cards.length));
    var tiles = [];
    pairs.forEach(function (c) {
      tiles.push({ key: c.id, side: 'term', text: c.term });
      tiles.push({ key: c.id, side: 'def', text: c.def });
    });
    return shuffle(tiles, rnd);
  }

  /* ── Share links ────────────────────────────────────────────────────── */

  function b64urlFromBytes(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function bytesFromB64url(str) {
    var s = str.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin = atob(s), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  /**
   * Only what someone else needs: no progress. `o` is the original deck's id
   * and `a` its creator, both carried unchanged through every re-share, so a
   * copy of a copy still names who made it and can be merged back into the
   * original. `by` is whoever sent this link.
   */
  function sharePayload(deck, sharer) {
    var p = { t: deck.title || 'Flashcards', c: (deck.cards || []).map(function (c) { return [c.term, c.def]; }) };
    if (deck.desc) p.d = deck.desc;
    if (deck.termLang) p.tl = deck.termLang;
    if (deck.defLang) p.dl = deck.defLang;
    p.o = (deck.origin && deck.origin.id) || deck.id;
    var maker = (deck.origin && deck.origin.author) || deck.author || sharer || '';
    if (maker) p.a = String(maker).slice(0, 80);
    if (sharer && sharer !== maker) p.by = String(sharer).slice(0, 80);
    return p;
  }
  function fromSharePayload(p) {
    if (!p || !Array.isArray(p.c)) throw new Error('Not a Flux deck');
    var d = newDeck({
      title: String(p.t || 'Shared deck').slice(0, 120),
      desc: p.d ? String(p.d).slice(0, 500) : '',
      termLang: p.tl || '', defLang: p.dl || '',
      cards: p.c.slice(0, 2000).map(function (r) { return { term: String(r[0] || ''), def: String(r[1] || '') }; }),
    });
    if (p.o) d.origin = { id: String(p.o).slice(0, 64), author: p.a ? String(p.a).slice(0, 80) : '' };
    if (p.by) d.sharedBy = String(p.by).slice(0, 80);
    return d;
  }
  /** Who made a deck, for "Made by …". */
  function creator(deck) { return (deck && ((deck.origin && deck.origin.author) || deck.author)) || ''; }
  /** My deck that this shared one is a version of: the original, or another copy of it. */
  function relatedDeck(shared, list) {
    var o = shared.origin && shared.origin.id;
    if (!o) return null;
    return (list || []).filter(function (d) { return !d.deleted && (d.id === o || (d.origin && d.origin.id === o)); })[0] || null;
  }
  function termKey(s) { return norm(s, true); }
  /** What a returned copy would change: cards it adds, and cards whose definition it rewrote. */
  function diffDecks(mine, theirs) {
    var byTerm = {};
    (mine.cards || []).forEach(function (c) { byTerm[termKey(c.term)] = c; });
    var added = [], changed = [];
    (theirs.cards || []).forEach(function (c) {
      var k = termKey(c.term);
      if (!k) return;
      var m = byTerm[k];
      if (!m) added.push(c);
      else if (String(m.def).trim() !== String(c.def).trim()) changed.push({ card: m, def: c.def });
    });
    return { added: added, changed: changed };
  }
  /** Bring a returned copy into my deck. Progress on cards I already had is kept. */
  function mergeInto(mine, theirs, opts) {
    var dif = diffDecks(mine, theirs);
    dif.added.forEach(function (c) { mine.cards.push(newCard({ term: c.term, def: c.def })); });
    if (opts && opts.takeChanges) dif.changed.forEach(function (x) { x.card.def = x.def; });
    return { added: dif.added.length, changed: opts && opts.takeChanges ? dif.changed.length : 0 };
  }
  /** "j" + base64url(JSON). The page compresses when it can ("z" prefix). */
  function encodeShare(deck, sharer) {
    var json = JSON.stringify(sharePayload(deck, sharer));
    return 'j' + b64urlFromBytes(new TextEncoder().encode(json));
  }
  function decodeShare(code) {
    if (code[0] !== 'j') throw new Error('Unknown share format');
    return fromSharePayload(JSON.parse(new TextDecoder().decode(bytesFromB64url(code.slice(1)))));
  }

  /* ── Decks and the store ────────────────────────────────────────────── */

  function newCard(c) {
    return { id: (c && c.id) || uid(), term: String((c && c.term) || ''), def: String((c && c.def) || ''), star: !!(c && c.star) };
  }
  function newDeck(d) {
    d = d || {};
    var now = Date.now();
    return {
      id: d.id || uid(),
      title: d.title || 'Untitled deck',
      desc: d.desc || '',
      termLang: d.termLang || '',
      defLang: d.defLang || '',
      examAt: d.examAt || null,
      author: d.author || '',
      created: now,
      updated: now,
      cards: (d.cards || []).map(newCard),
    };
  }

  function storage() {
    try { return root.localStorage || null; } catch (e) { return null; }
  }
  function readStore() {
    var ls = storage();
    try {
      var v = ls && JSON.parse(ls.getItem(STORE) || 'null');
      if (v && Array.isArray(v.decks)) return v;
    } catch (e) {}
    return { v: 1, decks: [] };
  }
  function writeStore(st) {
    var ls = storage();
    try { if (ls) ls.setItem(STORE, JSON.stringify(st)); } catch (e) { return false; }
    return true;
  }
  function decks() { return readStore().decks.filter(function (d) { return !d.deleted; }); }
  function getDeck(id) { return decks().filter(function (d) { return d.id === id; })[0] || null; }
  function putDeck(deck) {
    var st = readStore();
    deck.updated = Date.now();
    var i = st.decks.findIndex(function (d) { return d.id === deck.id; });
    if (i >= 0) st.decks[i] = deck; else st.decks.unshift(deck);
    return writeStore(st);
  }
  function removeDeck(id) {
    var st = readStore();
    st.decks = st.decks.map(function (d) { return d.id === id ? { id: id, deleted: true, updated: Date.now() } : d; });
    return writeStore(st);
  }

  /* ── Study stats: a streak and today's count ────────────────────────── */

  function readStats() {
    var ls = storage();
    try { var v = ls && JSON.parse(ls.getItem(STATS) || 'null'); if (v && v.days) return v; } catch (e) {}
    return { days: {} };
  }
  function logReview(n) {
    var st = readStats();
    var k = ymd();
    st.days[k] = (st.days[k] || 0) + (n || 1);
    // Keep a year.
    var keys = Object.keys(st.days).sort();
    while (keys.length > 400) delete st.days[keys.shift()];
    st.updated = Date.now();
    var ls = storage();
    try { if (ls) ls.setItem(STATS, JSON.stringify(st)); } catch (e) {}
  }
  function streak(stats, now) {
    stats = stats || readStats();
    var d = new Date(now || Date.now()), n = 0;
    // Today not studied yet doesn't break yesterday's streak.
    if (!stats.days[ymd(d)]) d.setDate(d.getDate() - 1);
    while (stats.days[ymd(d)]) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  /* ── Cloud slice (used by the planner's sync) ───────────────────────── */

  function mergeDecks(a, b) {
    var byId = {};
    (a || []).concat(b || []).forEach(function (d) {
      if (!d || !d.id) return;
      var cur = byId[d.id];
      if (!cur || (d.updated || 0) > (cur.updated || 0)) byId[d.id] = d;
    });
    return Object.keys(byId).map(function (k) { return byId[k]; })
      .sort(function (x, y) { return (y.updated || 0) - (x.updated || 0); });
  }
  function mergeStats(a, b) {
    var days = {};
    [a, b].forEach(function (s) {
      if (s && s.days) Object.keys(s.days).forEach(function (k) { days[k] = Math.max(days[k] || 0, s.days[k] || 0); });
    });
    return { days: days, updated: Math.max((a && a.updated) || 0, (b && b.updated) || 0) };
  }
  var PUSHED = 'flux_flash_pushed_at';
  function newest(list) {
    return (list || []).reduce(function (m, d) { return Math.max(m, (d && d.updated) || 0); }, 0);
  }
  function getCloudSlice() {
    var st = readStore();
    // Remember how new the pushed copy was, so the planner can tell on its
    // next start whether this device has changes the account has not seen.
    var ls = storage();
    try { if (ls) ls.setItem(PUSHED, String(Math.max(newest(st.decks), readStats().updated || 0))); } catch (e) {}
    return { decks: st.decks, stats: readStats() };
  }
  /** Merge what the account holds into this device. True when this device had something newer, so the caller should push. */
  function applyFromCloud(slice) {
    if (!slice || typeof slice !== 'object') return false;
    var local = readStore();
    var merged = mergeDecks(local.decks, slice.decks);
    writeStore({ v: 1, decks: merged });
    var stats = mergeStats(readStats(), slice.stats);
    var ls = storage();
    try { if (ls) ls.setItem(STATS, JSON.stringify(stats)); } catch (e) {}
    var remote = {};
    (slice.decks || []).forEach(function (d) { if (d && d.id) remote[d.id] = d.updated || 0; });
    return merged.some(function (d) { return !(d.id in remote) || (d.updated || 0) > remote[d.id]; });
  }

  /* In the planner (it has syncKey): push when decks change in another tab —
     flashcards.html open alongside — or changed here before this start. */
  if (typeof document !== 'undefined' && root.addEventListener) {
    var nudge = function () { try { if (typeof root.syncKey === 'function') root.syncKey('flashDecks'); } catch (e) {} };
    root.addEventListener('storage', function (e) { if (e.key === STORE || e.key === STATS) nudge(); });
    setTimeout(function () {
      if (typeof root.syncKey !== 'function') return;
      var ls = storage();
      var pushed = 0;
      try { pushed = Number(ls && ls.getItem(PUSHED)) || 0; } catch (e) {}
      if (Math.max(newest(readStore().decks), readStats().updated || 0) > pushed) nudge();
    }, 9000);
  }

  root.FluxFlash = {
    STORE: STORE, STATS: STATS, DAY: DAY, MIN: MIN,
    AGAIN: AGAIN, HARD: HARD, GOOD: GOOD, EASY: EASY,
    uid: uid, ymd: ymd, shuffle: shuffle,
    retrievability: retrievability, intervalFor: intervalFor,
    preview: preview, review: review, fmtWait: fmtWait,
    isDue: isDue, isNew: isNew, progress: progress, queue: queue, dueCount: dueCount,
    check: check, norm: norm, lev: lev,
    parseImport: parseImport, detectSep: detectSep, SEPS: SEPS,
    buildTest: buildTest, gradeTest: gradeTest, matchTiles: matchTiles,
    sharePayload: sharePayload, fromSharePayload: fromSharePayload,
    creator: creator, relatedDeck: relatedDeck, diffDecks: diffDecks, mergeInto: mergeInto,
    encodeShare: encodeShare, decodeShare: decodeShare,
    b64urlFromBytes: b64urlFromBytes, bytesFromB64url: bytesFromB64url,
    newDeck: newDeck, newCard: newCard,
    decks: decks, getDeck: getDeck, putDeck: putDeck, removeDeck: removeDeck,
    readStore: readStore, writeStore: writeStore,
    readStats: readStats, logReview: logReview, streak: streak,
    mergeDecks: mergeDecks, getCloudSlice: getCloudSlice, applyFromCloud: applyFromCloud,
  };
})();
