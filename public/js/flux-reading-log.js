/* ============================================================================
   FLUX READING LOG  ·  flux-reading-log.js   (+ public/css/flux-reading-log.css)
   A reading log for literature classes, asked for by a teacher.

     · Dashboard card (#readingLogCard, dashboard section "reading"): this
       week against the goal, the streak, and "Log today" in one line. It can
       be hidden like any dashboard section (Settings → Layout).
     · Its own page (#readingLog panel): the daily log, books, quotes, the
       weekly goal, and a printout for a chosen date range to hand in.
     · Study tools → English → Literature → Reading log opens the page too,
       and so does its own tab in the sidebar's Learn group (app.js
       DEFAULT_TABS, id readingLog).

   Data lives under one key (flux_reading_log_v1) through the app's own
   load/save, and travels with the account as the `readingLog` slice of the
   planner's cloud payload (getCloudSlice / applyFromCloud, wired in app.js).
   Every book, entry and quote has a stable id, and applyFromCloud merges
   item by item rather than replacing, so a phone and a laptop that both log
   on the same day keep both entries. The merging and all the counting live
   in flux-reading-log-core.js, which has unit tests.

   Nothing here talks to the network or to Flux AI.
   ========================================================================== */
(function () {
  'use strict';
  if (window.FluxReadingLog) return;
  var C = window.FluxReadingLogCore;
  if (!C) return;

  var KEY = C.KEY;
  var SLICE = 'readingLog';
  var SECTION = 'reading';
  var HIDDEN_KEY = 'flux_dashboard_hidden_sections_v1';

  /* ── storage ─────────────────────────────────────────────────────────────
     Read fresh for every change rather than trusting a copy held in memory:
     the app's load() follows whichever account is signed in, and a copy kept
     from before a switch must never be written over the next account's log. */
  function readRaw() {
    try {
      if (typeof window.load === 'function') return window.load(KEY, null);
      return JSON.parse(localStorage.getItem(KEY) || 'null');
    } catch (e) { return null; }
  }
  function writeRaw(v) {
    try {
      if (typeof window.save === 'function') window.save(KEY, v);
      else localStorage.setItem(KEY, JSON.stringify(v));
    } catch (e) {}
  }
  function cur() { return C.sanitise(readRaw()); }

  /** Change the log: fn edits a fresh copy, which is then saved, synced and redrawn. */
  function mutate(fn) {
    var s = cur();
    var out = fn(s);
    s = C.sanitise(s);
    writeRaw(s);
    // Same contract every other synced module uses; a no-op when signed out.
    try { if (typeof window.syncKey === 'function') window.syncKey(SLICE, s); } catch (e) {}
    renderAll();
    return out;
  }
  function stampFor(old) { return Math.max(Date.now(), ((old && old.updated) || 0) + 1); }
  function upsert(list, item) {
    var i = list.findIndex(function (x) { return x.id === item.id; });
    if (i >= 0) list[i] = item; else list.push(item);
  }
  function remove(list, id) {
    var old = list.find(function (x) { return x.id === id; });
    upsert(list, { id: id, deleted: true, updated: stampFor(old) });
  }

  /* ── small helpers ───────────────────────────────────────────────────── */

  var $ = function (id) { return document.getElementById(id); };
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function today() { return C.ymd(new Date()); }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
  function minutesText(m) {
    if (m < 60) return plural(m, 'minute');
    var h = Math.floor(m / 60), r = m % 60;
    return plural(h, 'hour') + (r ? ' ' + plural(r, 'minute') : '');
  }
  function shortMinutes(m) {
    if (m < 60) return m + ' min';
    var h = Math.floor(m / 60), r = m % 60;
    return h + ' h' + (r ? ' ' + r + ' min' : '');
  }
  function dayText(ymd, long) {
    if (!C.isYMD(ymd)) return '';
    var d = new Date(C.dayNum(ymd) * 86400000);
    var opts = long ? { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' } : { weekday: 'short', day: 'numeric', month: 'short' };
    opts.timeZone = 'UTC';
    try { return d.toLocaleDateString(undefined, opts); } catch (e) { return ymd; }
  }
  function relDay(ymd) {
    var t = today();
    if (ymd === t) return 'Today';
    if (ymd === C.addDays(t, -1)) return 'Yesterday';
    return dayText(ymd);
  }
  function unitWord(unit, n) { return unit === 'pages' ? (n === 1 ? 'page' : 'pages') : (n === 1 ? 'minute' : 'minutes'); }
  function val(id) { var el = $(id); return el ? el.value : ''; }
  function setVal(id, v) { var el = $(id); if (el) el.value = v == null ? '' : v; }
  function say(id, msg, bad) {
    var el = $(id);
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('is-bad', !!bad);
  }
  function toast(msg, type) { try { if (typeof window.showToast === 'function') window.showToast(msg, type || 'success'); } catch (e) {} }
  function profileName() {
    try {
      var p = typeof window.load === 'function' ? window.load('profile', {}) : null;
      if (p && p.name) return String(p.name);
    } catch (e) {}
    return '';
  }

  var STATUS_LABEL = { reading: 'Reading now', finished: 'Finished', abandoned: 'Stopped reading' };
  var TABS = [
    { id: 'log', label: 'Daily log' },
    { id: 'books', label: 'Books' },
    { id: 'quotes', label: 'Quotes' },
    { id: 'print', label: 'Print' },
  ];

  function liveBooks(s) {
    var order = { reading: 0, finished: 1, abandoned: 2 };
    return C.live(s.books).sort(function (a, b) {
      return (order[a.status] - order[b.status]) || a.title.localeCompare(b.title);
    });
  }
  function bookTitle(s, id) {
    var b = C.live(s.books).find(function (x) { return x.id === id; });
    return b ? b.title : 'A deleted book';
  }
  /** The book most recently logged that is still being read: the likeliest one for "Log today". */
  function likelyBook(s) {
    var reading = liveBooks(s).filter(function (b) { return b.status === 'reading'; });
    if (!reading.length) return '';
    var ids = {};
    reading.forEach(function (b) { ids[b.id] = 1; });
    var last = C.live(s.entries).filter(function (e) { return ids[e.bookId]; })
      .sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : (a.id < b.id ? 1 : -1); })[0];
    return last ? last.bookId : reading[0].id;
  }
  /** Fill a book <select> without losing what is chosen in it. */
  function fillBookSelect(sel, s, opts) {
    if (!sel) return;
    opts = opts || {};
    var keep = sel.value;
    var books = liveBooks(s);
    if (opts.readingOnly) {
      var r = books.filter(function (b) { return b.status === 'reading'; });
      if (r.length) books = r;
    }
    var html = (opts.placeholder ? '<option value="">' + esc(opts.placeholder) + '</option>' : '') +
      books.map(function (b) {
        var tag = b.status === 'reading' ? '' : ' (' + STATUS_LABEL[b.status].toLowerCase() + ')';
        return '<option value="' + esc(b.id) + '">' + esc(b.title + tag) + '</option>';
      }).join('');
    if (sel.innerHTML !== html) sel.innerHTML = html;
    var want = keep && books.some(function (b) { return b.id === keep; }) ? keep : (opts.prefer || '');
    if (want) sel.value = want;
  }

  /* ── weekly summary bits (card and page) ─────────────────────────────── */

  function weekInfo(s) {
    var t = today();
    var wk = C.weekTotals(s.entries, t, s.goal.weekStartsOn);
    return { today: t, week: wk, goal: C.goalProgress(s.goal, wk), streak: C.streak(s.entries, t),
      todayTotals: C.weekTotals(C.inRange(s.entries, t, t), t, s.goal.weekStartsOn) };
  }
  function progressHTML(info, label) {
    var g = info.goal;
    if (!g.target) {
      return '<p class="frl-nogoal">This week: <strong>' + esc(shortMinutes(info.week.minutes)) + '</strong> and <strong>' +
        plural(info.week.pages, 'page') + '</strong>. ' +
        '<button type="button" class="frl-link" data-frl-act="open-goal">Set your weekly goal</button></p>';
    }
    var text = g.done + ' of ' + g.target + ' ' + unitWord(g.unit, g.target);
    var after = g.met ? 'Goal reached this week' : g.left + ' ' + unitWord(g.unit, g.left) + ' to go';
    return '<div class="frl-prog">' +
      '<div class="frl-prog-top"><span class="frl-prog-label">' + esc(label || 'This week') + '</span>' +
      '<span class="frl-prog-num">' + esc(text) + '</span></div>' +
      '<div class="frl-bar" role="progressbar" aria-label="Weekly reading goal" aria-valuemin="0" aria-valuemax="' + g.target +
      '" aria-valuenow="' + Math.min(g.done, g.target) + '" aria-valuetext="' + esc(text + ', ' + g.pct + ' percent') + '">' +
      '<div class="frl-bar-fill' + (g.met ? ' is-met' : '') + '" style="width:' + g.pct + '%"></div></div>' +
      '<p class="frl-prog-after' + (g.met ? ' is-met' : '') + '">' + esc(after) + '</p></div>';
  }
  function streakText(st) {
    if (st.current >= 2) return 'Read ' + st.current + ' days in a row';
    if (st.current === 1) return st.readToday ? 'Read today: day 1 of a streak' : 'Read yesterday: keep it going today';
    return 'Read today to start a streak';
  }

  /* ════════════════════════════════════════════════════════════════════════
     DASHBOARD CARD
     ════════════════════════════════════════════════════════════════════════ */

  function cardShell() {
    return '<div class="frl-card card">' +
      '<div class="frl-card-head">' +
        '<h2 class="frl-card-title" id="frlCardH">Reading log</h2>' +
        '<div class="frl-card-links">' +
          '<button type="button" class="frl-link" data-frl-act="open">Open reading log</button>' +
          '<button type="button" class="frl-link frl-link--quiet" data-frl-act="hide-card" aria-label="Hide the reading log card from the dashboard">Hide</button>' +
        '</div>' +
      '</div>' +
      '<div id="frlCardStats" class="frl-card-stats"></div>' +
      '<form id="frlQuickForm" class="frl-quick" novalidate aria-label="Log today\'s reading">' +
        '<div class="frl-quick-row">' +
          '<label class="frl-field frl-field--grow"><span>Book</span><select id="frlQuickBook"></select></label>' +
          '<label class="frl-field frl-field--num"><span>Minutes</span><input id="frlQuickMin" type="number" inputmode="numeric" min="1" max="1440" step="1"></label>' +
          '<label class="frl-field frl-field--num"><span>Pages</span><input id="frlQuickPages" type="number" inputmode="numeric" min="1" max="5000" step="1"></label>' +
          '<button type="submit" class="frl-btn frl-btn--primary frl-quick-go">Log today</button>' +
        '</div>' +
        '<p class="frl-msg" role="status" id="frlQuickMsg"></p>' +
      '</form>' +
      '<form id="frlQuickBookForm" class="frl-quick" novalidate hidden aria-label="Add the book you are reading">' +
        '<div class="frl-quick-row">' +
          '<label class="frl-field frl-field--grow"><span>What are you reading?</span><input id="frlQuickTitle" type="text" maxlength="200" autocomplete="off"></label>' +
          '<button type="submit" class="frl-btn frl-btn--primary frl-quick-go">Add book</button>' +
        '</div>' +
        '<p class="frl-msg" role="status" id="frlQuickBookMsg"></p>' +
      '</form>' +
    '</div>';
  }

  function mountCard() {
    var host = $('readingLogCard');
    if (!host) return null;
    if (!host.querySelector('.frl-card')) {
      host.innerHTML = cardShell();
      $('frlQuickForm').addEventListener('submit', function (ev) { ev.preventDefault(); quickLog(); });
      $('frlQuickBookForm').addEventListener('submit', function (ev) { ev.preventDefault(); quickAddBook(); });
    }
    return host;
  }

  function renderCard(s) {
    var host = mountCard();
    if (!host) return;
    s = s || cur();
    var info = weekInfo(s);
    var td = info.todayTotals;
    var todayBits = td.minutes || td.pages
      ? 'Today: ' + [td.minutes ? shortMinutes(td.minutes) : '', td.pages ? plural(td.pages, 'page') : ''].filter(Boolean).join(', ')
      : 'Nothing logged today yet';
    $('frlCardStats').innerHTML = progressHTML(info) +
      '<ul class="frl-chips" aria-label="Reading so far">' +
        '<li class="frl-chip' + (info.streak.current ? ' is-on' : '') + '">' + esc(streakText(info.streak)) + '</li>' +
        '<li class="frl-chip">' + esc(todayBits) + '</li>' +
      '</ul>';
    var hasBooks = C.live(s.books).length > 0;
    $('frlQuickForm').hidden = !hasBooks;
    $('frlQuickBookForm').hidden = hasBooks;
    fillBookSelect($('frlQuickBook'), s, { prefer: likelyBook(s) });
    host.hidden = false;
  }

  function quickLog() {
    var bookId = val('frlQuickBook');
    var minutes = C.int(val('frlQuickMin'), 0, 1440);
    var pages = C.int(val('frlQuickPages'), 0, 5000);
    if (!bookId) return say('frlQuickMsg', 'Pick the book you read.', true);
    if ((val('frlQuickMin') && minutes == null) || (val('frlQuickPages') && pages == null)) {
      return say('frlQuickMsg', 'Minutes go up to 1440 and pages up to 5000. Check the numbers.', true);
    }
    if (!minutes && !pages) {
      say('frlQuickMsg', 'Fill in the minutes you read, the pages, or both.', true);
      var m = $('frlQuickMin'); if (m) m.focus();
      return;
    }
    var title = '';
    mutate(function (s) {
      title = bookTitle(s, bookId);
      s.entries.push({ id: C.uid('e'), date: today(), bookId: bookId, minutes: minutes || null, pages: pages || null, updated: Date.now() });
    });
    setVal('frlQuickMin', ''); setVal('frlQuickPages', '');
    var what = [minutes ? minutesText(minutes) : '', pages ? plural(pages, 'page') : ''].filter(Boolean).join(' and ');
    say('frlQuickMsg', 'Logged ' + what + ' of ' + title + ' for today.');
  }

  function quickAddBook() {
    var title = String(val('frlQuickTitle')).trim();
    if (!title) {
      say('frlQuickBookMsg', 'Type the title of the book first.', true);
      var t = $('frlQuickTitle'); if (t) t.focus();
      return;
    }
    addBook({ title: title, status: 'reading', started: today() });
    setVal('frlQuickTitle', '');
    say('frlQuickMsg', 'Added ' + title + '. Now log what you read today.');
    var m = $('frlQuickMin'); if (m) m.focus();
  }

  function hideCard() {
    var hidden = [];
    try { hidden = (typeof window.load === 'function' ? window.load(HIDDEN_KEY, []) : []) || []; } catch (e) {}
    if (hidden.indexOf(SECTION) < 0) hidden = hidden.concat(SECTION);
    if (window.FluxPersonal && typeof window.FluxPersonal.setDashboardHidden === 'function') window.FluxPersonal.setDashboardHidden(hidden);
    else if (typeof window.save === 'function') window.save(HIDDEN_KEY, hidden);
    // The button that had focus has gone; hand focus to the next thing on the dashboard.
    var next = document.querySelector('#dashboard .dash-v2-work-title');
    if (next) { next.setAttribute('tabindex', '-1'); try { next.focus({ preventScroll: true }); } catch (e) {} }
    toast('Reading log card hidden. Bring it back in Settings, Layout. The page stays in the sidebar, under Learn.', 'info');
  }

  /* ════════════════════════════════════════════════════════════════════════
     THE PAGE
     ════════════════════════════════════════════════════════════════════════ */

  var ui = { tab: 'log', editing: { entry: '', book: '', quote: '' }, confirm: '', days: 21 };

  function num(id, label, max, extra) {
    return '<label class="frl-field"><span>' + label + '</span><input id="' + id + '" type="number" inputmode="numeric" min="0" max="' + max + '" step="1"' + (extra || '') + '></label>';
  }

  function pageShell() {
    var ratingOpts = '<option value="">No rating</option>' + [1, 2, 3, 4, 5].map(function (n) {
      var w = n === 1 ? ' (did not like it)' : n === 3 ? ' (it was okay)' : n === 5 ? ' (loved it)' : '';
      return '<option value="' + n + '">' + n + ' out of 5' + w + '</option>';
    }).join('');
    return '<div class="frl" id="frlRoot">' +

      '<section class="card frl-sum" aria-labelledby="frlSumH">' +
        '<h2 class="frl-h2" id="frlSumH" tabindex="-1">This week</h2>' +
        '<div id="frlSummary"></div>' +
        '<details class="frl-goal" id="frlGoal">' +
          '<summary>Weekly goal</summary>' +
          '<form id="frlGoalForm" class="frl-form" novalidate>' +
            '<p class="frl-hint">Use the goal your teacher set, for example 120 minutes or 100 pages a week. Leave it at 0 for no goal.</p>' +
            '<div class="frl-grid frl-grid--3">' +
              num('frlGoalAmount', 'Amount each week', 100000) +
              '<label class="frl-field"><span>Counted in</span><select id="frlGoalUnit"><option value="minutes">Minutes</option><option value="pages">Pages</option></select></label>' +
              '<label class="frl-field"><span>Week starts on</span><select id="frlGoalStart"><option value="1">Monday</option><option value="0">Sunday</option></select></label>' +
            '</div>' +
            '<div class="frl-actions"><button type="submit" class="frl-btn frl-btn--primary">Save goal</button></div>' +
            '<p class="frl-msg" role="status" id="frlGoalMsg"></p>' +
          '</form>' +
        '</details>' +
      '</section>' +

      '<div class="frl-tabs" role="tablist" aria-label="Reading log">' +
        TABS.map(function (t) {
          return '<button type="button" role="tab" class="frl-tab" id="frlTab-' + t.id + '" aria-controls="frlPane-' + t.id +
            '" aria-selected="false" tabindex="-1" data-frl-tab="' + t.id + '">' + t.label + '</button>';
        }).join('') +
      '</div>' +

      /* Daily log */
      '<section class="frl-pane" role="tabpanel" id="frlPane-log" aria-labelledby="frlTab-log" hidden>' +
        '<div class="card">' +
          '<h3 class="frl-h3" id="frlEntryH" tabindex="-1">Log reading</h3>' +
          '<p class="frl-empty" id="frlEntryNoBook" hidden>Add the book you are reading first, on the ' +
            '<button type="button" class="frl-link" data-frl-act="tab" data-tab="books">Books</button> tab.</p>' +
          '<form id="frlEntryForm" class="frl-form" novalidate aria-labelledby="frlEntryH">' +
            '<div class="frl-grid frl-grid--2">' +
              '<label class="frl-field"><span>Date</span><input id="frlEntryDate" type="date" required></label>' +
              '<label class="frl-field"><span>Book</span><select id="frlEntryBook" required></select></label>' +
            '</div>' +
            '<fieldset class="frl-fieldset"><legend>Pages read <span class="frl-opt">(from and to, or just the number)</span></legend>' +
              '<div class="frl-grid frl-grid--3">' +
                num('frlEntryFrom', 'From page', 20000) + num('frlEntryTo', 'To page', 20000) + num('frlEntryPages', 'Or number of pages', 5000) +
              '</div>' +
              '<p class="frl-hint" id="frlEntryPagesHint" aria-live="polite"></p>' +
            '</fieldset>' +
            '<div class="frl-grid frl-grid--2">' +
              num('frlEntryMin', 'Minutes read', 1440) +
              '<label class="frl-field"><span>Note <span class="frl-opt">(optional)</span></span><input id="frlEntryNote" type="text" maxlength="500" autocomplete="off"></label>' +
            '</div>' +
            '<div class="frl-actions">' +
              '<button type="submit" class="frl-btn frl-btn--primary" id="frlEntrySubmit">Save entry</button>' +
              '<button type="button" class="frl-btn" id="frlEntryCancel" data-frl-act="cancel-edit" data-kind="entry" hidden>Cancel editing</button>' +
            '</div>' +
            '<p class="frl-msg" role="status" id="frlEntryMsg"></p>' +
          '</form>' +
        '</div>' +
        '<div class="card"><h3 class="frl-h3" id="frlEntriesH" tabindex="-1">Your log</h3><div id="frlEntries"></div></div>' +
      '</section>' +

      /* Books */
      '<section class="frl-pane" role="tabpanel" id="frlPane-books" aria-labelledby="frlTab-books" hidden>' +
        '<div class="card">' +
          '<h3 class="frl-h3" id="frlBookH" tabindex="-1">Add a book</h3>' +
          '<form id="frlBookForm" class="frl-form" novalidate aria-labelledby="frlBookH">' +
            '<div class="frl-grid frl-grid--2">' +
              '<label class="frl-field"><span>Title</span><input id="frlBookTitle" type="text" maxlength="200" required autocomplete="off"></label>' +
              '<label class="frl-field"><span>Author <span class="frl-opt">(optional)</span></span><input id="frlBookAuthor" type="text" maxlength="200" autocomplete="off"></label>' +
            '</div>' +
            '<div class="frl-grid frl-grid--3">' +
              num('frlBookPages', 'Total pages <span class="frl-opt">(optional)</span>', 20000) +
              '<label class="frl-field"><span>Status</span><select id="frlBookStatus">' +
                C.STATUSES.map(function (k) { return '<option value="' + k + '">' + STATUS_LABEL[k] + '</option>'; }).join('') +
              '</select></label>' +
              '<label class="frl-field"><span>Rating</span><select id="frlBookRating">' + ratingOpts + '</select></label>' +
            '</div>' +
            '<div class="frl-grid frl-grid--2">' +
              '<label class="frl-field"><span>Started on <span class="frl-opt">(optional)</span></span><input id="frlBookStarted" type="date"></label>' +
              '<label class="frl-field"><span>Finished on <span class="frl-opt">(optional)</span></span><input id="frlBookFinished" type="date"></label>' +
            '</div>' +
            '<label class="frl-field"><span>Short reflection <span class="frl-opt">(optional)</span></span>' +
              '<textarea id="frlBookReflection" rows="3" maxlength="4000" aria-describedby="frlBookReflectionHint"></textarea></label>' +
            '<p class="frl-hint" id="frlBookReflectionHint">A few sentences: what stayed with you, and why.</p>' +
            '<div class="frl-actions">' +
              '<button type="submit" class="frl-btn frl-btn--primary" id="frlBookSubmit">Save book</button>' +
              '<button type="button" class="frl-btn" id="frlBookCancel" data-frl-act="cancel-edit" data-kind="book" hidden>Cancel editing</button>' +
            '</div>' +
            '<p class="frl-msg" role="status" id="frlBookMsg"></p>' +
          '</form>' +
        '</div>' +
        '<div class="card"><h3 class="frl-h3" id="frlBooksH" tabindex="-1">Your books</h3><div id="frlBooks"></div></div>' +
      '</section>' +

      /* Quotes */
      '<section class="frl-pane" role="tabpanel" id="frlPane-quotes" aria-labelledby="frlTab-quotes" hidden>' +
        '<div class="card">' +
          '<h3 class="frl-h3" id="frlQuoteH" tabindex="-1">Save a quote</h3>' +
          '<p class="frl-empty" id="frlQuoteNoBook" hidden>Add a book first, on the ' +
            '<button type="button" class="frl-link" data-frl-act="tab" data-tab="books">Books</button> tab.</p>' +
          '<form id="frlQuoteForm" class="frl-form" novalidate aria-labelledby="frlQuoteH">' +
            '<div class="frl-grid frl-grid--2">' +
              '<label class="frl-field"><span>Book</span><select id="frlQuoteBook" required></select></label>' +
              '<label class="frl-field"><span>Page <span class="frl-opt">(optional)</span></span><input id="frlQuotePage" type="text" maxlength="20" inputmode="numeric" autocomplete="off"></label>' +
            '</div>' +
            '<label class="frl-field"><span>Quote</span><textarea id="frlQuoteText" rows="3" maxlength="2000" required></textarea></label>' +
            '<label class="frl-field"><span>Why it matters <span class="frl-opt">(optional)</span></span><textarea id="frlQuoteWhy" rows="2" maxlength="2000"></textarea></label>' +
            '<div class="frl-actions">' +
              '<button type="submit" class="frl-btn frl-btn--primary" id="frlQuoteSubmit">Save quote</button>' +
              '<button type="button" class="frl-btn" id="frlQuoteCancel" data-frl-act="cancel-edit" data-kind="quote" hidden>Cancel editing</button>' +
            '</div>' +
            '<p class="frl-msg" role="status" id="frlQuoteMsg"></p>' +
          '</form>' +
        '</div>' +
        '<div class="card"><h3 class="frl-h3" id="frlQuotesH" tabindex="-1">Your quotes</h3><div id="frlQuotes"></div></div>' +
      '</section>' +

      /* Print */
      '<section class="frl-pane" role="tabpanel" id="frlPane-print" aria-labelledby="frlTab-print" hidden>' +
        '<div class="card">' +
          '<h3 class="frl-h3" id="frlPrintH" tabindex="-1">Print or save as PDF</h3>' +
          '<p class="frl-hint">Choose the dates your teacher asked for. In the print window, choose "Save as PDF" to get a file instead of paper.</p>' +
          '<form id="frlPrintForm" class="frl-form" novalidate aria-labelledby="frlPrintH">' +
            '<div class="frl-presets" role="group" aria-label="Quick dates">' +
              '<button type="button" class="frl-btn frl-btn--sm" data-frl-act="preset" data-preset="thisWeek">This week</button>' +
              '<button type="button" class="frl-btn frl-btn--sm" data-frl-act="preset" data-preset="lastWeek">Last week</button>' +
              '<button type="button" class="frl-btn frl-btn--sm" data-frl-act="preset" data-preset="last30">Last 30 days</button>' +
              '<button type="button" class="frl-btn frl-btn--sm" data-frl-act="preset" data-preset="all">Everything</button>' +
            '</div>' +
            '<div class="frl-grid frl-grid--2">' +
              '<label class="frl-field"><span>From</span><input id="frlPrintFrom" type="date"></label>' +
              '<label class="frl-field"><span>To</span><input id="frlPrintTo" type="date"></label>' +
            '</div>' +
            '<div class="frl-grid frl-grid--3">' +
              '<label class="frl-field"><span>Your name</span><input id="frlPrintName" type="text" maxlength="120" autocomplete="name"></label>' +
              '<label class="frl-field"><span>Class <span class="frl-opt">(optional)</span></span><input id="frlPrintClass" type="text" maxlength="120" autocomplete="off"></label>' +
              '<label class="frl-field"><span>Teacher <span class="frl-opt">(optional)</span></span><input id="frlPrintTeacher" type="text" maxlength="120" autocomplete="off"></label>' +
            '</div>' +
            '<div class="frl-checks" role="group" aria-label="Include in the printout">' +
              '<label class="frl-check"><input type="checkbox" id="frlPrintNotes" checked> Notes on each day</label>' +
              '<label class="frl-check"><input type="checkbox" id="frlPrintReflections" checked> Book reflections</label>' +
              '<label class="frl-check"><input type="checkbox" id="frlPrintQuotes" checked> Quotes</label>' +
            '</div>' +
            '<p class="frl-print-sum" id="frlPrintSummary" aria-live="polite"></p>' +
            '<div class="frl-actions"><button type="submit" class="frl-btn frl-btn--primary" id="frlPrintGo">Print or save as PDF</button></div>' +
            '<p class="frl-msg" role="status" id="frlPrintMsg"></p>' +
          '</form>' +
        '</div>' +
      '</section>' +
    '</div>';
  }

  function mountPage() {
    var host = $('readingLogMount');
    if (!host) return null;
    if ($('frlRoot')) return host;
    host.innerHTML = pageShell();
    $('frlGoalForm').addEventListener('submit', function (ev) { ev.preventDefault(); saveGoal(); });
    $('frlEntryForm').addEventListener('submit', function (ev) { ev.preventDefault(); saveEntry(); });
    $('frlBookForm').addEventListener('submit', function (ev) { ev.preventDefault(); saveBook(); });
    $('frlQuoteForm').addEventListener('submit', function (ev) { ev.preventDefault(); saveQuote(); });
    $('frlPrintForm').addEventListener('submit', function (ev) { ev.preventDefault(); printLog(); });
    ['frlEntryFrom', 'frlEntryTo', 'frlEntryPages'].forEach(function (id) { $(id).addEventListener('input', pagesHint); });
    ['frlPrintFrom', 'frlPrintTo', 'frlPrintNotes', 'frlPrintReflections', 'frlPrintQuotes'].forEach(function (id) {
      $(id).addEventListener('input', function () { renderPrintSummary(); });
      $(id).addEventListener('change', function () { renderPrintSummary(); });
    });
    $('frlBookStatus').addEventListener('change', function () {
      if (this.value === 'finished' && !val('frlBookFinished')) setVal('frlBookFinished', today());
    });
    $('frlRoot').querySelector('.frl-tabs').addEventListener('keydown', tabKeys);
    var s = cur();
    resetEntryForm(s);
    resetBookForm();
    resetQuoteForm();
    fillGoalForm(s);
    var r = C.presetRange('thisWeek', today(), s.goal.weekStartsOn);
    setVal('frlPrintFrom', r.from); setVal('frlPrintTo', r.to);
    setVal('frlPrintName', s.prefs.name || profileName());
    setVal('frlPrintClass', s.prefs.className);
    setVal('frlPrintTeacher', s.prefs.teacher);
    showTab(ui.tab, false);
    return host;
  }

  /* ── tabs ── */
  function showTab(id, focus) {
    if (!TABS.some(function (t) { return t.id === id; })) id = 'log';
    ui.tab = id;
    TABS.forEach(function (t) {
      var b = $('frlTab-' + t.id), p = $('frlPane-' + t.id);
      if (!b || !p) return;
      var on = t.id === id;
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
      b.classList.toggle('is-on', on);
      p.hidden = !on;
    });
    if (focus) { var b = $('frlTab-' + id); if (b) b.focus(); }
  }
  function tabKeys(ev) {
    var keys = { ArrowRight: 1, ArrowLeft: -1, Home: 'first', End: 'last' };
    if (!(ev.key in keys)) return;
    ev.preventDefault();
    var i = TABS.findIndex(function (t) { return t.id === ui.tab; });
    var k = keys[ev.key];
    i = k === 'first' ? 0 : k === 'last' ? TABS.length - 1 : (i + k + TABS.length) % TABS.length;
    showTab(TABS[i].id, true);
  }

  /* ── summary ── */
  function renderSummary(s) {
    var info = weekInfo(s);
    var tot = C.totals(s);
    $('frlSummary').innerHTML = progressHTML(info, dayText(info.week.start) + ' to ' + dayText(info.week.end)) +
      '<dl class="frl-stats">' +
        '<div class="frl-stat"><dt>Streak</dt><dd>' + plural(info.streak.current, 'day') + '</dd><dd class="frl-stat-sub">Best: ' + plural(info.streak.best, 'day') + '</dd></div>' +
        '<div class="frl-stat"><dt>This week</dt><dd>' + esc(shortMinutes(info.week.minutes)) + '</dd><dd class="frl-stat-sub">' + plural(info.week.pages, 'page') + ', ' + plural(info.week.days, 'day') + ' read</dd></div>' +
        '<div class="frl-stat"><dt>All time</dt><dd>' + esc(shortMinutes(tot.minutes)) + '</dd><dd class="frl-stat-sub">' + plural(tot.pages, 'page') + ', ' + plural(tot.booksFinished, 'book') + ' finished</dd></div>' +
      '</dl>';
  }

  function fillGoalForm(s) {
    setVal('frlGoalAmount', s.goal.amount || '');
    setVal('frlGoalUnit', s.goal.unit);
    setVal('frlGoalStart', String(s.goal.weekStartsOn));
  }
  function saveGoal() {
    var raw = val('frlGoalAmount');
    var amount = raw === '' ? 0 : C.int(raw, 0, 100000);
    if (amount == null) return say('frlGoalMsg', 'Type a whole number, like 120.', true);
    var unit = val('frlGoalUnit') === 'pages' ? 'pages' : 'minutes';
    var start = val('frlGoalStart') === '0' ? 0 : 1;
    mutate(function (s) { s.goal = { unit: unit, amount: amount, weekStartsOn: start, updated: stampFor(s.goal) }; });
    say('frlGoalMsg', amount ? 'Goal saved: ' + amount + ' ' + unitWord(unit, amount) + ' a week.' : 'Goal cleared.');
  }

  /* ── daily log ── */
  function pagesHint() {
    var from = C.int(val('frlEntryFrom'), 0, 20000), to = C.int(val('frlEntryTo'), 0, 20000);
    var count = C.int(val('frlEntryPages'), 0, 5000);
    var msg = '';
    if (count != null && val('frlEntryPages') !== '') msg = plural(count, 'page') + '.';
    else if (from != null && to != null) {
      msg = to >= from ? 'That counts as ' + plural(C.entryPages({ fromPage: from, toPage: to }), 'page') + ' (both pages included).'
        : 'The "to" page is before the "from" page.';
    }
    say('frlEntryPagesHint', msg);
  }
  function resetEntryForm(s) {
    ui.editing.entry = '';
    s = s || cur();
    setVal('frlEntryDate', today());
    var d = $('frlEntryDate'); if (d) d.max = today();
    ['frlEntryFrom', 'frlEntryTo', 'frlEntryPages', 'frlEntryMin', 'frlEntryNote'].forEach(function (id) { setVal(id, ''); });
    fillBookSelect($('frlEntryBook'), s, { prefer: likelyBook(s) });
    var b = $('frlEntryBook'); if (b) b.value = likelyBook(s) || b.value;
    $('frlEntryH').textContent = 'Log reading';
    $('frlEntrySubmit').textContent = 'Save entry';
    $('frlEntryCancel').hidden = true;
    say('frlEntryPagesHint', '');
  }
  function editEntry(id) {
    var s = cur();
    var e = C.live(s.entries).find(function (x) { return x.id === id; });
    if (!e) return;
    showTab('log');
    ui.editing.entry = id;
    fillBookSelect($('frlEntryBook'), s);
    setVal('frlEntryDate', e.date); setVal('frlEntryBook', e.bookId);
    setVal('frlEntryFrom', e.fromPage); setVal('frlEntryTo', e.toPage); setVal('frlEntryPages', e.pages);
    setVal('frlEntryMin', e.minutes); setVal('frlEntryNote', e.note);
    $('frlEntryH').textContent = 'Edit entry';
    $('frlEntrySubmit').textContent = 'Save changes';
    $('frlEntryCancel').hidden = false;
    pagesHint();
    say('frlEntryMsg', '');
    $('frlEntryH').focus();
  }
  function saveEntry() {
    var date = val('frlEntryDate'), bookId = val('frlEntryBook');
    var fields = {
      fromPage: val('frlEntryFrom'), toPage: val('frlEntryTo'), pages: val('frlEntryPages'), minutes: val('frlEntryMin'),
    };
    var n = {
      fromPage: C.int(fields.fromPage, 0, 20000), toPage: C.int(fields.toPage, 0, 20000),
      pages: C.int(fields.pages, 0, 5000), minutes: C.int(fields.minutes, 0, 1440),
    };
    var bad = Object.keys(fields).filter(function (k) { return fields[k] !== '' && n[k] == null; });
    if (!C.isYMD(date)) return fail('frlEntryMsg', 'frlEntryDate', 'Pick the date you read.');
    if (date > today()) return fail('frlEntryMsg', 'frlEntryDate', 'That date is in the future. Pick today or an earlier day.');
    if (!bookId) return fail('frlEntryMsg', 'frlEntryBook', 'Pick the book you read.');
    if (bad.length) return fail('frlEntryMsg', bad[0] === 'minutes' ? 'frlEntryMin' : bad[0] === 'pages' ? 'frlEntryPages' : bad[0] === 'fromPage' ? 'frlEntryFrom' : 'frlEntryTo',
      'Check the numbers: pages up to 5000 in one go, minutes up to 1440.');
    if ((n.fromPage != null) !== (n.toPage != null) && n.pages == null) {
      return fail('frlEntryMsg', n.fromPage == null ? 'frlEntryFrom' : 'frlEntryTo', 'Fill in both the "from" and "to" page, or just the number of pages.');
    }
    if (n.fromPage != null && n.toPage != null && n.toPage < n.fromPage) return fail('frlEntryMsg', 'frlEntryTo', 'The "to" page is before the "from" page.');
    var pages = C.entryPages(n);
    if (!pages && !n.minutes) return fail('frlEntryMsg', 'frlEntryMin', 'Fill in the pages you read, the minutes, or both.');
    var editing = ui.editing.entry;
    var title = '';
    mutate(function (s) {
      title = bookTitle(s, bookId);
      var old = editing ? s.entries.find(function (x) { return x.id === editing; }) : null;
      upsert(s.entries, {
        id: old ? old.id : C.uid('e'), date: date, bookId: bookId,
        fromPage: n.fromPage, toPage: n.toPage, pages: n.pages, minutes: n.minutes,
        note: val('frlEntryNote'), updated: stampFor(old),
      });
    });
    resetEntryForm();
    var when = date === today() ? 'today' : date === C.addDays(today(), -1) ? 'yesterday' : dayText(date);
    say('frlEntryMsg', (editing ? 'Entry updated: ' : 'Saved: ') + title + ', ' + when + '.');
    if (editing) { var h = $('frlEntriesH'); if (h) h.focus(); }
  }
  function fail(msgId, fieldId, msg) {
    say(msgId, msg, true);
    var f = $(fieldId);
    if (f) { f.setAttribute('aria-invalid', 'true'); f.focus(); setTimeout(function () { f.removeAttribute('aria-invalid'); }, 4000); }
    return false;
  }

  function confirmHTML(kind, id, question) {
    return '<span class="frl-confirm" role="group" aria-label="' + esc(question) + '">' +
      '<span class="frl-confirm-q">' + esc(question) + '</span>' +
      '<button type="button" class="frl-mini frl-mini--danger" data-frl-act="confirm-del" data-kind="' + kind + '" data-id="' + esc(id) + '">Delete</button>' +
      '<button type="button" class="frl-mini" data-frl-act="cancel-del" data-frl-keep>Keep</button></span>';
  }
  function rowActs(kind, id, label, question) {
    if (ui.confirm === kind + ':' + id) return confirmHTML(kind, id, question);
    return '<button type="button" class="frl-mini" data-frl-act="edit" data-kind="' + kind + '" data-id="' + esc(id) + '" aria-label="Edit ' + esc(label) + '">Edit</button>' +
      '<button type="button" class="frl-mini" data-frl-act="ask-del" data-kind="' + kind + '" data-id="' + esc(id) + '" aria-label="Delete ' + esc(label) + '">Delete</button>';
  }
  function pagesText(e) {
    var p = C.entryPages(e);
    var bits = [];
    if (e.fromPage != null && e.toPage != null) bits.push('pages ' + e.fromPage + ' to ' + e.toPage);
    if (p) bits.push(plural(p, 'page'));
    if (e.minutes) bits.push(shortMinutes(e.minutes));
    return bits.join(' · ');
  }

  function renderEntries(s) {
    var host = $('frlEntries');
    var entries = C.live(s.entries);
    if (!entries.length) {
      host.innerHTML = '<p class="frl-empty">Nothing logged yet. Each time you read, add the pages or minutes above, or use "Log today" on the dashboard.</p>';
      return;
    }
    var byDay = {};
    entries.forEach(function (e) { (byDay[e.date] = byDay[e.date] || []).push(e); });
    var days = Object.keys(byDay).sort().reverse();
    var shown = days.slice(0, ui.days);
    host.innerHTML = shown.map(function (d) {
      var list = byDay[d].sort(function (a, b) { return a.id < b.id ? -1 : 1; });
      var t = list.reduce(function (acc, e) { acc.m += C.entryMinutes(e); acc.p += C.entryPages(e); return acc; }, { m: 0, p: 0 });
      var tot = [t.m ? shortMinutes(t.m) : '', t.p ? plural(t.p, 'page') : ''].filter(Boolean).join(', ');
      return '<div class="frl-day"><h4 class="frl-day-h">' + esc(relDay(d)) + (d === today() || d === C.addDays(today(), -1) ? ' <span class="frl-day-date">' + esc(dayText(d)) + '</span>' : '') +
        (tot ? ' <span class="frl-day-tot">' + esc(tot) + '</span>' : '') + '</h4><ul class="frl-list">' +
        list.map(function (e) {
          var title = bookTitle(s, e.bookId);
          return '<li class="frl-row"><div class="frl-row-main"><span class="frl-row-title">' + esc(title) + '</span>' +
            '<span class="frl-row-meta">' + esc(pagesText(e)) + '</span>' +
            (e.note ? '<span class="frl-row-note">' + esc(e.note) + '</span>' : '') + '</div>' +
            '<div class="frl-row-acts">' + rowActs('entry', e.id, 'entry: ' + title + ', ' + dayText(d), 'Delete this entry?') + '</div></li>';
        }).join('') + '</ul></div>';
    }).join('') +
      (days.length > shown.length ? '<button type="button" class="frl-btn frl-btn--sm frl-more" data-frl-act="more-days">Show older days (' + (days.length - shown.length) + ' more)</button>' : '');
  }

  /* ── books ── */
  function resetBookForm() {
    ui.editing.book = '';
    ['frlBookTitle', 'frlBookAuthor', 'frlBookPages', 'frlBookRating', 'frlBookFinished', 'frlBookReflection'].forEach(function (id) { setVal(id, ''); });
    setVal('frlBookStatus', 'reading');
    setVal('frlBookStarted', today());
    $('frlBookH').textContent = 'Add a book';
    $('frlBookSubmit').textContent = 'Save book';
    $('frlBookCancel').hidden = true;
  }
  function editBook(id) {
    var b = C.live(cur().books).find(function (x) { return x.id === id; });
    if (!b) return;
    showTab('books');
    ui.editing.book = id;
    setVal('frlBookTitle', b.title); setVal('frlBookAuthor', b.author); setVal('frlBookPages', b.totalPages);
    setVal('frlBookStatus', b.status); setVal('frlBookRating', b.rating == null ? '' : String(b.rating));
    setVal('frlBookStarted', b.started); setVal('frlBookFinished', b.finished); setVal('frlBookReflection', b.reflection);
    $('frlBookH').textContent = 'Edit ' + b.title;
    $('frlBookSubmit').textContent = 'Save changes';
    $('frlBookCancel').hidden = false;
    say('frlBookMsg', '');
    $('frlBookH').focus();
  }
  function addBook(f) {
    var id = C.uid('b');
    mutate(function (s) {
      s.books.push({ id: id, title: f.title, author: f.author || '', totalPages: f.totalPages || null, status: f.status || 'reading',
        started: f.started || '', finished: f.finished || '', rating: f.rating || null, reflection: f.reflection || '', updated: Date.now() });
    });
    return id;
  }
  function saveBook() {
    var title = String(val('frlBookTitle')).trim();
    if (!title) return fail('frlBookMsg', 'frlBookTitle', 'Type the title of the book.');
    var pagesRaw = val('frlBookPages');
    var totalPages = C.int(pagesRaw, 1, 20000);
    if (pagesRaw !== '' && totalPages == null) return fail('frlBookMsg', 'frlBookPages', 'Total pages should be a whole number, like 320.');
    var started = val('frlBookStarted'), finished = val('frlBookFinished');
    if (started && finished && finished < started) return fail('frlBookMsg', 'frlBookFinished', 'The finish date is before the start date.');
    var f = {
      title: title, author: String(val('frlBookAuthor')).trim(), totalPages: totalPages, status: val('frlBookStatus'),
      started: started, finished: finished, rating: C.int(val('frlBookRating'), 1, 5), reflection: val('frlBookReflection'),
    };
    var editing = ui.editing.book;
    if (editing) {
      mutate(function (s) {
        var old = s.books.find(function (x) { return x.id === editing; });
        upsert(s.books, Object.assign({ id: editing }, f, { updated: stampFor(old) }));
      });
    } else addBook(f);
    resetBookForm();
    say('frlBookMsg', (editing ? 'Saved changes to ' : 'Added ') + title + '.');
    if (editing) { var h = $('frlBooksH'); if (h) h.focus(); }
  }
  function stars(n) { return n ? '<span aria-hidden="true" class="frl-stars">' + '★★★★★'.slice(0, n) + '<span class="frl-stars-off">' + '★★★★★'.slice(n) + '</span></span>' : ''; }

  function renderBooks(s) {
    var host = $('frlBooks');
    var books = liveBooks(s);
    if (!books.length) {
      host.innerHTML = '<p class="frl-empty">No books yet. Add the one you are reading above.</p>';
      return;
    }
    var counts = {};
    C.live(s.entries).forEach(function (e) { counts[e.bookId] = (counts[e.bookId] || 0) + 1; });
    var quotes = {};
    C.live(s.quotes).forEach(function (q) { quotes[q.bookId] = (quotes[q.bookId] || 0) + 1; });
    host.innerHTML = '<ul class="frl-list frl-books">' + books.map(function (b) {
      var pr = C.bookProgress(b, s.entries);
      var bar = '';
      if (pr.pct != null) {
        var reach = b.status === 'finished' ? b.totalPages : (pr.lastPage || pr.pages);
        var label = 'Page ' + reach + ' of ' + b.totalPages + ' (' + pr.pct + '%)';
        bar = '<div class="frl-bar frl-bar--thin" role="progressbar" aria-label="How far through ' + esc(b.title) + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pr.pct + '" aria-valuetext="' + esc(label) + '">' +
          '<div class="frl-bar-fill' + (pr.pct >= 100 ? ' is-met' : '') + '" style="width:' + pr.pct + '%"></div></div><p class="frl-book-sub">' + esc(label) + '</p>';
      }
      var logged = pr.entries ? plural(pr.entries, 'session') + ' logged' + (pr.pages ? ' · ' + plural(pr.pages, 'page') : '') + (pr.minutes ? ' · ' + shortMinutes(pr.minutes) : '') : 'Not logged yet';
      var dates = [b.started ? 'Started ' + dayText(b.started, true) : '', b.finished ? 'Finished ' + dayText(b.finished, true) : ''].filter(Boolean).join(' · ');
      var n = (counts[b.id] || 0), q = (quotes[b.id] || 0);
      var ask = 'Delete ' + b.title + (n || q ? ' and its ' + [n ? plural(n, 'log entry', 'log entries') : '', q ? plural(q, 'quote') : ''].filter(Boolean).join(' and ') : '') + '?';
      return '<li class="frl-book">' +
        '<div class="frl-book-head"><div><h4 class="frl-book-title">' + esc(b.title) + '</h4>' +
          (b.author ? '<p class="frl-book-author">' + esc(b.author) + '</p>' : '') + '</div>' +
          '<span class="frl-badge frl-badge--' + b.status + '">' + STATUS_LABEL[b.status] + '</span></div>' +
        bar +
        '<p class="frl-book-sub">' + esc(logged) + '</p>' +
        (dates ? '<p class="frl-book-sub">' + esc(dates) + '</p>' : '') +
        (b.rating ? '<p class="frl-book-sub">' + stars(b.rating) + ' <span>Rated ' + b.rating + ' out of 5</span></p>' : '') +
        (b.reflection ? '<p class="frl-book-refl">' + esc(b.reflection) + '</p>' : '') +
        '<div class="frl-row-acts frl-book-acts">' +
          (ui.confirm === 'book:' + b.id ? '' : '<button type="button" class="frl-mini" data-frl-act="add-quote" data-id="' + esc(b.id) + '" aria-label="Save a quote from ' + esc(b.title) + '">Add quote</button>') +
          rowActs('book', b.id, b.title, ask) +
        '</div></li>';
    }).join('') + '</ul>';
  }

  /* ── quotes ── */
  function resetQuoteForm(s) {
    ui.editing.quote = '';
    s = s || cur();
    ['frlQuoteText', 'frlQuotePage', 'frlQuoteWhy'].forEach(function (id) { setVal(id, ''); });
    fillBookSelect($('frlQuoteBook'), s, { prefer: likelyBook(s) });
    $('frlQuoteH').textContent = 'Save a quote';
    $('frlQuoteSubmit').textContent = 'Save quote';
    $('frlQuoteCancel').hidden = true;
  }
  function editQuote(id) {
    var s = cur();
    var q = C.live(s.quotes).find(function (x) { return x.id === id; });
    if (!q) return;
    showTab('quotes');
    ui.editing.quote = id;
    fillBookSelect($('frlQuoteBook'), s);
    setVal('frlQuoteBook', q.bookId); setVal('frlQuoteText', q.text); setVal('frlQuotePage', q.page); setVal('frlQuoteWhy', q.why);
    $('frlQuoteH').textContent = 'Edit quote';
    $('frlQuoteSubmit').textContent = 'Save changes';
    $('frlQuoteCancel').hidden = false;
    say('frlQuoteMsg', '');
    $('frlQuoteH').focus();
  }
  function saveQuote() {
    var bookId = val('frlQuoteBook'), text = String(val('frlQuoteText')).trim();
    if (!bookId) return fail('frlQuoteMsg', 'frlQuoteBook', 'Pick the book the quote is from.');
    if (!text) return fail('frlQuoteMsg', 'frlQuoteText', 'Type or paste the quote.');
    var editing = ui.editing.quote;
    mutate(function (s) {
      var old = editing ? s.quotes.find(function (x) { return x.id === editing; }) : null;
      upsert(s.quotes, { id: old ? old.id : C.uid('q'), bookId: bookId, text: text, page: val('frlQuotePage'),
        why: val('frlQuoteWhy'), date: (old && old.date) || today(), updated: stampFor(old) });
    });
    resetQuoteForm();
    say('frlQuoteMsg', editing ? 'Quote updated.' : 'Quote saved.');
    if (editing) { var h = $('frlQuotesH'); if (h) h.focus(); }
  }
  function renderQuotes(s) {
    var host = $('frlQuotes');
    var quotes = C.live(s.quotes);
    if (!quotes.length) {
      host.innerHTML = '<p class="frl-empty">No quotes yet. When a line stands out, save it here with the page, and a note on why it matters.</p>';
      return;
    }
    var byBook = {};
    quotes.forEach(function (q) { (byBook[q.bookId] = byBook[q.bookId] || []).push(q); });
    var order = liveBooks(s).map(function (b) { return b.id; });
    Object.keys(byBook).forEach(function (k) { if (order.indexOf(k) < 0) order.push(k); });
    host.innerHTML = order.filter(function (k) { return byBook[k]; }).map(function (k) {
      var title = bookTitle(s, k);
      return '<div class="frl-day"><h4 class="frl-day-h">' + esc(title) + '</h4><ul class="frl-list">' +
        byBook[k].sort(function (a, b) { return a.id < b.id ? -1 : 1; }).map(function (q) {
          var meta = [q.page ? 'Page ' + q.page : '', q.date ? 'Saved ' + dayText(q.date) : ''].filter(Boolean).join(' · ');
          return '<li class="frl-row frl-quote"><div class="frl-row-main"><blockquote class="frl-quote-text">' + esc(q.text) + '</blockquote>' +
            (meta ? '<span class="frl-row-meta">' + esc(meta) + '</span>' : '') +
            (q.why ? '<p class="frl-quote-why"><span class="frl-quote-why-l">Why it matters:</span> ' + esc(q.why) + '</p>' : '') + '</div>' +
            '<div class="frl-row-acts">' + rowActs('quote', q.id, 'quote from ' + title, 'Delete this quote?') + '</div></li>';
        }).join('') + '</ul></div>';
    }).join('');
  }

  /* ── deleting (asked first, inline) ── */
  function askDelete(kind, id) {
    ui.confirm = kind + ':' + id;
    renderAll();
    var keep = document.querySelector('#frlRoot [data-frl-keep]');
    if (keep) keep.focus();
  }
  function doDelete(kind, id) {
    ui.confirm = '';
    var heading = { entry: 'frlEntriesH', book: 'frlBooksH', quote: 'frlQuotesH' }[kind];
    var what = '';
    mutate(function (s) {
      if (kind === 'entry') { remove(s.entries, id); what = 'Entry deleted.'; }
      if (kind === 'quote') { remove(s.quotes, id); what = 'Quote deleted.'; }
      if (kind === 'book') {
        what = bookTitle(s, id) + ' deleted.';
        remove(s.books, id);
        C.live(s.entries).filter(function (e) { return e.bookId === id; }).forEach(function (e) { remove(s.entries, e.id); });
        C.live(s.quotes).filter(function (q) { return q.bookId === id; }).forEach(function (q) { remove(s.quotes, q.id); });
      }
    });
    if (ui.editing[kind] === id) { if (kind === 'entry') resetEntryForm(); if (kind === 'book') resetBookForm(); if (kind === 'quote') resetQuoteForm(); }
    var h = $(heading); if (h) h.focus();
    say({ entry: 'frlEntryMsg', book: 'frlBookMsg', quote: 'frlQuoteMsg' }[kind], what);
  }

  /* ════════════════════════════════════════════════════════════════════════
     PRINTING
     A clean black-on-white page built into #frlPrintRoot. The print
     stylesheet (flux-reading-log.css) shows only that element while
     body.frl-printing is set, so printing anything else in Flux is unchanged.
     ════════════════════════════════════════════════════════════════════════ */

  function printOpts() {
    return {
      from: val('frlPrintFrom'), to: val('frlPrintTo'),
      name: String(val('frlPrintName')).trim(), className: String(val('frlPrintClass')).trim(), teacher: String(val('frlPrintTeacher')).trim(),
      notes: !!($('frlPrintNotes') && $('frlPrintNotes').checked),
      reflections: !!($('frlPrintReflections') && $('frlPrintReflections').checked),
      quotes: !!($('frlPrintQuotes') && $('frlPrintQuotes').checked),
    };
  }
  function renderPrintSummary(s) {
    var el = $('frlPrintSummary');
    if (!el) return;
    var o = printOpts();
    var p = C.printRange(s || cur(), o.from, o.to);
    if (!p) { el.textContent = 'Pick a "from" and a "to" date.'; return; }
    if (!p.entries.length) { el.textContent = 'Nothing is logged between these dates yet. You can still print a blank log.'; return; }
    el.textContent = 'This printout covers ' + plural(p.days, 'day') + ': ' + plural(p.totals.entries, 'entry', 'entries') + ', ' +
      minutesText(p.totals.minutes) + ', ' + plural(p.totals.pages, 'page') + ', read on ' + plural(p.totals.days, 'day') +
      (o.quotes && p.quotes.length ? ', and ' + plural(p.quotes.length, 'quote') : '') + '.';
  }

  function printHTML(s, o) {
    var p = C.printRange(s, o.from, o.to);
    if (!p) return '';
    var g = p.goal;
    var range = dayText(p.from, true) + ' to ' + dayText(p.to, true);
    var meta = [['Name', o.name], ['Class', o.className], ['Teacher', o.teacher], ['Dates', range]];
    var h = '<div class="frl-p">' +
      '<div class="frl-p-brand"><img src="public/flux-planner-logo.png" alt="" width="36" height="36"><span>Flux Planner</span></div>' +
      '<h1>Reading log</h1>' +
      '<table class="frl-p-meta"><tbody>' + meta.map(function (m) {
        return '<tr><th scope="row">' + m[0] + '</th><td>' + (m[1] ? esc(m[1]) : '<span class="frl-p-blank"></span>') + '</td></tr>';
      }).join('') + '</tbody></table>' +
      '<p class="frl-p-sum"><strong>Total:</strong> ' + esc(minutesText(p.totals.minutes)) + ', ' + plural(p.totals.pages, 'page') +
        ', read on ' + plural(p.totals.days, 'day') + ' out of ' + p.days + '.' +
        (g.amount ? ' <strong>Weekly goal:</strong> ' + g.amount + ' ' + unitWord(g.unit, g.amount) + '.' : '') + '</p>';

    if (g.amount && p.weeks.length) {
      h += '<h2>Week by week</h2><table class="frl-p-table"><thead><tr><th scope="col">Week</th><th scope="col">Minutes</th><th scope="col">Pages</th><th scope="col">Goal</th></tr></thead><tbody>' +
        p.weeks.map(function (w) {
          var label = dayText(w.from) + ' to ' + dayText(w.to) + (w.partial ? ' (part of a week)' : '');
          return '<tr><td>' + esc(label) + '</td><td>' + w.minutes + '</td><td>' + w.pages + '</td><td>' + (w.met ? 'Met' : w.end >= today() ? 'Week not over' : (w.partial ? 'Part week' : 'Not met')) + '</td></tr>';
        }).join('') + '</tbody></table>';
    }

    h += '<h2>Daily log</h2>';
    if (!p.entries.length) h += '<p>No reading logged between these dates.</p>';
    else {
      h += '<table class="frl-p-table"><thead><tr><th scope="col">Date</th><th scope="col">Book</th><th scope="col">Pages</th><th scope="col">Minutes</th>' +
        (o.notes ? '<th scope="col">Note</th>' : '') + '</tr></thead><tbody>' +
        p.entries.map(function (e) {
          var b = p.bookById[e.bookId];
          var pg = C.entryPages(e);
          var pages = (e.fromPage != null && e.toPage != null ? e.fromPage + '–' + e.toPage + (pg ? ' (' + pg + ')' : '') : (pg || ''));
          return '<tr><td>' + esc(dayText(e.date)) + '</td><td>' + esc(b ? b.title : 'A deleted book') + '</td><td>' + esc(pages) + '</td><td>' + (e.minutes || '') + '</td>' +
            (o.notes ? '<td>' + esc(e.note || '') + '</td>' : '') + '</tr>';
        }).join('') +
        '</tbody><tfoot><tr><th scope="row" colspan="2">Total</th><td>' + p.totals.pages + '</td><td>' + p.totals.minutes + '</td>' + (o.notes ? '<td></td>' : '') + '</tr></tfoot></table>';
    }

    if (p.books.length) {
      h += '<h2>Books</h2>' + p.books.map(function (b) {
        var bits = [STATUS_LABEL[b.status], b.totalPages ? b.totalPages + ' pages' : '', b.started ? 'started ' + dayText(b.started, true) : '',
          b.finished ? 'finished ' + dayText(b.finished, true) : '', b.rating ? 'rated ' + b.rating + ' out of 5' : ''].filter(Boolean).join(' · ');
        return '<div class="frl-p-book"><h3>' + esc(b.title) + (b.author ? ' <span class="frl-p-by">by ' + esc(b.author) + '</span>' : '') + '</h3>' +
          '<p class="frl-p-small">' + esc(bits) + '</p>' +
          (o.reflections && b.reflection ? '<p class="frl-p-refl"><strong>Reflection:</strong> ' + esc(b.reflection) + '</p>' : '') + '</div>';
      }).join('');
    }

    if (o.quotes && p.quotes.length) {
      h += '<h2>Quotes</h2>' + p.quotes.map(function (q) {
        var b = p.bookById[q.bookId];
        return '<div class="frl-p-quote"><blockquote>' + esc(q.text) + '</blockquote>' +
          '<p class="frl-p-small">' + esc((b ? b.title : 'A deleted book') + (q.page ? ', page ' + q.page : '')) + '</p>' +
          (q.why ? '<p class="frl-p-why"><strong>Why it matters:</strong> ' + esc(q.why) + '</p>' : '') + '</div>';
      }).join('');
    }

    h += '<div class="frl-p-sign">' +
      '<div class="frl-p-line"><span>Student signature</span><span class="frl-p-rule"></span><span>Date</span><span class="frl-p-rule frl-p-rule--short"></span></div>' +
      '<div class="frl-p-line"><span>Parent or guardian signature</span><span class="frl-p-rule"></span><span>Date</span><span class="frl-p-rule frl-p-rule--short"></span></div>' +
      '</div>' +
      '<p class="frl-p-foot">Printed from Flux Planner on ' + esc(dayText(today(), true)) + '.</p></div>';
    return h;
  }

  function printLog() {
    var o = printOpts();
    if (!C.isYMD(o.from) || !C.isYMD(o.to)) return fail('frlPrintMsg', C.isYMD(o.from) ? 'frlPrintTo' : 'frlPrintFrom', 'Pick a "from" and a "to" date.');
    // Remember the name, class and teacher for next time (and on other devices).
    var s = cur();
    if (o.name !== s.prefs.name || o.className !== s.prefs.className || o.teacher !== s.prefs.teacher) {
      mutate(function (st) { st.prefs = { name: o.name, className: o.className, teacher: o.teacher, updated: stampFor(st.prefs) }; });
      s = cur();
    }
    var rootEl = $('frlPrintRoot');
    if (!rootEl) {
      rootEl = document.createElement('div');
      rootEl.id = 'frlPrintRoot';
      document.body.appendChild(rootEl);
    }
    rootEl.innerHTML = printHTML(s, o);
    document.body.classList.add('frl-printing');
    var done = function () {
      document.body.classList.remove('frl-printing');
      window.removeEventListener('afterprint', done);
    };
    window.addEventListener('afterprint', done);
    if (navigator.standalone === true) {
      say('frlPrintMsg', 'Printing does not work in the home-screen app on iPhone and iPad. Open Flux in Safari, then print from there.', true);
    } else say('frlPrintMsg', 'Opening the print window…');
    // The logo is fetched the first time; printing before it arrives leaves a blank space on the paper.
    var go = function () { try { window.print(); } catch (e) { done(); say('frlPrintMsg', 'Printing is not available here.', true); } };
    var logo = rootEl.querySelector('.frl-p-brand img');
    if (!logo || logo.complete) return go();
    var started = false;
    var once = function () { if (!started) { started = true; go(); } };
    logo.addEventListener('load', once);
    logo.addEventListener('error', once);
    setTimeout(once, 1500);
  }

  /* ════════════════════════════════════════════════════════════════════════
     DRAWING, NAVIGATION, EVENTS
     ════════════════════════════════════════════════════════════════════════ */

  function pageVisible() { var p = $('readingLog'); return !!(p && $('frlRoot')); }

  function renderPage(s) {
    if (!pageVisible()) return;
    s = s || cur();
    renderSummary(s);
    renderEntries(s);
    renderBooks(s);
    renderQuotes(s);
    renderPrintSummary(s);
    var hasBooks = C.live(s.books).length > 0;
    $('frlEntryNoBook').hidden = hasBooks;
    $('frlEntryForm').hidden = !hasBooks;
    $('frlQuoteNoBook').hidden = hasBooks;
    $('frlQuoteForm').hidden = !hasBooks;
    fillBookSelect($('frlEntryBook'), s, { prefer: likelyBook(s) });
    fillBookSelect($('frlQuoteBook'), s, { prefer: likelyBook(s) });
    var goalOpen = $('frlGoal') && $('frlGoal').open;
    var focusInGoal = document.activeElement && $('frlGoalForm') && $('frlGoalForm').contains(document.activeElement);
    if (!goalOpen || !focusInGoal) fillGoalForm(s);
  }

  function renderAll() {
    var s = cur();
    try { renderCard(s); } catch (e) { console.warn('[FluxReadingLog] card', e); }
    try { renderPage(s); } catch (e) { console.warn('[FluxReadingLog] page', e); }
  }

  /** Open the page (optionally on a tab, or with the goal open) and move focus to it. */
  function open(where) {
    mountPage();
    if (where === 'goal') { showTab(ui.tab); var g = $('frlGoal'); if (g) g.open = true; }
    else if (where) showTab(where);
    if (typeof window.nav === 'function') window.nav('readingLog');
    renderAll();
    var target = where === 'goal' ? $('frlGoalAmount') : $('frlSumH');
    try { var p = $('readingLog'); if (p && where !== 'goal') p.scrollTop = 0; } catch (e) {}
    focusWhenShown(target, 0);
  }
  /* The panel switch can be animated, and an element that is not shown yet
     cannot take focus, so try again on the next frames until it can. */
  function focusWhenShown(el, n) {
    if (!el) return;
    if (el.getClientRects().length) {
      try { el.focus({ preventScroll: el.id !== 'frlGoalAmount' }); } catch (e) { el.focus(); }
      if (document.activeElement === el || n > 40) return;
    }
    if (n > 40) return;
    requestAnimationFrame(function () { focusWhenShown(el, n + 1); });
  }

  document.addEventListener('click', function (ev) {
    var t = ev.target && ev.target.closest ? ev.target.closest('[data-frl-act],[data-frl-tab]') : null;
    if (!t) return;
    var tab = t.getAttribute('data-frl-tab');
    if (tab) { showTab(tab, true); return; }
    var act = t.getAttribute('data-frl-act'), kind = t.getAttribute('data-kind'), id = t.getAttribute('data-id');
    if (act === 'open') open();
    else if (act === 'open-goal') open('goal');
    else if (act === 'hide-card') hideCard();
    else if (act === 'tab') { showTab(t.getAttribute('data-tab'), true); }
    else if (act === 'edit') { if (kind === 'entry') editEntry(id); if (kind === 'book') editBook(id); if (kind === 'quote') editQuote(id); }
    else if (act === 'cancel-edit') {
      if (kind === 'entry') { resetEntryForm(); say('frlEntryMsg', 'Editing cancelled.'); $('frlEntriesH').focus(); }
      if (kind === 'book') { resetBookForm(); say('frlBookMsg', 'Editing cancelled.'); $('frlBooksH').focus(); }
      if (kind === 'quote') { resetQuoteForm(); say('frlQuoteMsg', 'Editing cancelled.'); $('frlQuotesH').focus(); }
    }
    else if (act === 'ask-del') askDelete(kind, id);
    else if (act === 'confirm-del') doDelete(kind, id);
    else if (act === 'cancel-del') {
      var was = ui.confirm.split(':');
      ui.confirm = '';
      renderAll();
      var back = document.querySelector('#frlRoot [data-frl-act="ask-del"][data-kind="' + was[0] + '"][data-id="' + (was[1] || '').replace(/"/g, '') + '"]');
      if (back) back.focus();
    }
    else if (act === 'add-quote') { showTab('quotes'); resetQuoteForm(); setVal('frlQuoteBook', id); var q = $('frlQuoteText'); if (q) q.focus(); }
    else if (act === 'more-days') { ui.days += 30; renderAll(); var h = $('frlEntriesH'); if (h) h.focus(); }
    else if (act === 'preset') {
      var s = cur();
      var r = C.presetRange(t.getAttribute('data-preset'), today(), s.goal.weekStartsOn, s.entries);
      setVal('frlPrintFrom', r.from); setVal('frlPrintTo', r.to);
      renderPrintSummary(s);
    }
  });

  document.addEventListener('flux-nav', function (e) {
    var id = e && e.detail && e.detail.panel;
    if (id === 'readingLog') { mountPage(); renderAll(); }
    else if (id === 'dashboard') { try { renderCard(); } catch (err) {} }
  });
  // Another tab changed the log, or the day rolled over while Flux sat open.
  window.addEventListener('storage', function (e) { if (e.key && e.key.indexOf(KEY) >= 0) renderAll(); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) renderAll(); });

  /* ── Study tools → English → Literature → Reading log ── */
  (function registerStudyTool(tries) {
    var H = window.fluxStudyHub;
    if (!H || !H.register) { if (tries < 100) setTimeout(function () { registerStudyTool(tries + 1); }, 100); return; }
    H.register('english', [{
      id: 'lit-reading-log', name: 'Reading log', icon: '📖',
      desc: 'reading log books pages minutes weekly reading goal streak quotes print hand in teacher literature',
      render: function (body) {
        var s = cur(), info = weekInfo(s);
        body.innerHTML = '<div class="fsh-card frl-tool"><h3>Reading log</h3>' +
          '<p class="frl-hint">Log the pages or minutes you read each day, track the weekly goal your teacher set, keep quotes, and print the log to hand in.</p>' +
          progressHTML(info) +
          '<p class="frl-hint">' + esc(streakText(info.streak)) + '.</p>' +
          '<button type="button" class="frl-btn frl-btn--primary" data-frl-act="open">Open reading log</button></div>';
      },
    }]);
  })(0);

  // The topbar shows PANEL_TITLES[id]; without this it would read "readingLog".
  try { if (typeof PANEL_TITLES === 'object' && PANEL_TITLES) PANEL_TITLES.readingLog = 'Reading log'; } catch (e) {}

  /* ── sync (called from app.js getCloudPayload / syncFromCloud) ── */
  function getCloudSlice() { return cur(); }
  /** Merge the account's copy into this device's, item by item. True when this device had something the account lacks, so the caller should push. */
  function applyFromCloud(slice) {
    if (!slice || typeof slice !== 'object') return false;
    var local = cur();
    var merged = C.mergeLog(local, slice);
    if (C.differs(merged, local)) { writeRaw(merged); renderAll(); }
    return C.differs(merged, slice);
  }

  window.FluxReadingLog = {
    KEY: KEY,
    getCloudSlice: getCloudSlice,
    applyFromCloud: applyFromCloud,
    open: open,
    render: renderAll,
    state: cur,
    addBook: addBook,
    printHTML: function (o) { return printHTML(cur(), o); },
  };

  renderAll();
})();
