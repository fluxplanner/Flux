/* ============================================================================
   FLUX READING LOG · CORE  ·  flux-reading-log-core.js
   Everything about the reading log that is not drawing: cleaning stored data,
   dates and weeks, streaks, weekly totals against the teacher's goal, the
   date range a printout covers, and merging two devices' copies.

   No DOM here, so test/unit/reading-log.test.mjs runs it in a bare VM. The
   screens live in flux-reading-log.js.

   DATES
   -----
   Every day is a local calendar date string, "2026-10-17", taken on the
   device where the reading was logged. Day arithmetic is done on those strings
   through UTC, never through local Date objects, so a daylight-saving change
   cannot make a day 23 or 25 hours long and push an entry into the wrong week,
   and a phone that has flown to another time zone still files yesterday's
   reading under yesterday.

   SYNC
   ----
   Books, entries and quotes each carry a stable id and an `updated` time.
   Two copies merge item by item: for each id the newer copy wins, so a phone
   and a laptop that both logged reading on the same day keep both entries.
   A deleted item stays as a small tombstone ({ id, deleted, updated }) so the
   deletion reaches the other devices instead of the item coming back.
   ========================================================================== */
(function () {
  'use strict';
  var root = typeof window !== 'undefined' ? window : globalThis;
  if (root.FluxReadingLogCore) return;

  var KEY = 'flux_reading_log_v1';
  var DAY_MS = 24 * 60 * 60 * 1000;
  var STATUSES = ['reading', 'finished', 'abandoned'];
  var LIMITS = { books: 500, entries: 6000, quotes: 3000 };

  /* ── Small helpers ──────────────────────────────────────────────────── */

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  var seq = 0;
  /** A stable id: time, a counter (two in the same millisecond) and randomness (two devices). */
  function uid(prefix) {
    seq = (seq + 1) % 1296;
    return (prefix || 'r') + Date.now().toString(36) + seq.toString(36) + Math.random().toString(36).slice(2, 8);
  }
  /** The local calendar date of a moment on this device. */
  function ymd(d) {
    d = d == null ? new Date() : (d instanceof Date ? d : new Date(d));
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function dayNum(s) {
    return Math.round(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / DAY_MS);
  }
  function fromDayNum(n) {
    var d = new Date(n * DAY_MS);
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  }
  /** A real calendar date written as YYYY-MM-DD (not 2026-02-30). */
  function isYMD(s) {
    return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && fromDayNum(dayNum(s)) === s;
  }
  function addDays(s, n) { return fromDayNum(dayNum(s) + n); }
  /** 0 = Sunday … 6 = Saturday. */
  function weekday(s) { return new Date(dayNum(s) * DAY_MS).getUTCDay(); }
  /** First day of the week holding `s`; weeks start on Monday unless startsOn is 0 (Sunday). */
  function weekStart(s, startsOn) {
    var first = startsOn === 0 ? 0 : 1;
    return addDays(s, -((weekday(s) - first + 7) % 7));
  }
  function daysBetween(a, b) { return dayNum(b) - dayNum(a); }

  function str(v, max) { return String(v == null ? '' : v).replace(/\s+$/, '').slice(0, max); }
  function line(v, max) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max); }
  /** A whole number in [lo, hi], or null for blank / nonsense / out of range. */
  function int(v, lo, hi) {
    if (v === '' || v == null || typeof v === 'boolean') return null;
    var n = Number(v);
    if (!isFinite(n)) return null;
    n = Math.round(n);
    return n < lo || n > hi ? null : n;
  }
  /** Minutes read, typed the way people say them: "25", "25 min", "1h",
   *  "1h 30", "1 hour 30 minutes", "1:30" or "1.5 hours". Null for blank,
   *  nonsense or more than `hi`. */
  function minutes(v, hi) {
    if (v === '' || v == null || typeof v === 'boolean') return null;
    if (typeof v === 'number') return int(v, 0, hi);
    var s = String(v).toLowerCase().replace(/,/g, '.').replace(/\s+/g, ' ').trim(), m, n;
    if ((m = s.match(/^(\d+):([0-5]\d)$/))) n = Number(m[1]) * 60 + Number(m[2]);
    else if ((m = s.match(/^(?:(\d+(?:\.\d+)?) ?(?:h|hr|hrs|hour|hours)(?![a-z]) ?(?:and )?)?(?:(\d+) ?(?:m|min|mins|minute|minutes)?)?$/)) && (m[1] || m[2])) {
      n = (m[1] ? Number(m[1]) * 60 : 0) + (m[2] ? Number(m[2]) : 0);
    } else return null;
    return int(n, 0, hi);
  }
  function stamp(v) { var n = Number(v); return isFinite(n) && n > 0 ? Math.round(n) : 0; }
  function id(v) { var s = String(v == null ? '' : v); return /^[A-Za-z0-9_-]{1,64}$/.test(s) ? s : ''; }

  /** JSON with sorted keys: two copies of the same thing always compare equal. */
  function canon(v) {
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    if (v && typeof v === 'object') {
      return '{' + Object.keys(v).sort().filter(function (k) { return v[k] !== undefined; })
        .map(function (k) { return JSON.stringify(k) + ':' + canon(v[k]); }).join(',') + '}';
    }
    return JSON.stringify(v === undefined ? null : v);
  }

  /* ── Cleaning what comes out of storage or the cloud ────────────────── */

  function tomb(x) { return { id: id(x.id), deleted: true, updated: stamp(x.updated) }; }

  function cleanBook(b) {
    if (!b || typeof b !== 'object' || !id(b.id)) return null;
    if (b.deleted) return tomb(b);
    var title = line(b.title, 200);
    if (!title) return null;
    return {
      id: id(b.id),
      title: title,
      author: line(b.author, 200),
      totalPages: int(b.totalPages, 1, 20000),
      status: STATUSES.indexOf(b.status) >= 0 ? b.status : 'reading',
      started: isYMD(b.started) ? b.started : '',
      finished: isYMD(b.finished) ? b.finished : '',
      rating: int(b.rating, 1, 5),
      reflection: str(b.reflection, 4000),
      updated: stamp(b.updated),
    };
  }

  function cleanEntry(e) {
    if (!e || typeof e !== 'object' || !id(e.id)) return null;
    if (e.deleted) return tomb(e);
    if (!isYMD(e.date)) return null;
    var from = int(e.fromPage, 0, 20000), to = int(e.toPage, 0, 20000);
    if (from != null && to != null && to < from) { var t = from; from = to; to = t; }
    var out = {
      id: id(e.id),
      date: e.date,
      bookId: id(e.bookId),
      fromPage: from,
      toPage: to,
      pages: int(e.pages, 0, 5000),
      minutes: int(e.minutes, 0, 1440),
      note: str(e.note, 500),
      updated: stamp(e.updated),
    };
    return out;
  }

  function cleanQuote(q) {
    if (!q || typeof q !== 'object' || !id(q.id)) return null;
    if (q.deleted) return tomb(q);
    var text = str(q.text, 2000).trim();
    if (!text) return null;
    return {
      id: id(q.id),
      bookId: id(q.bookId),
      text: text,
      page: line(q.page, 20),
      why: str(q.why, 2000),
      date: isYMD(q.date) ? q.date : '',
      updated: stamp(q.updated),
    };
  }

  function cleanGoal(g) {
    g = g && typeof g === 'object' ? g : {};
    return {
      unit: g.unit === 'pages' ? 'pages' : 'minutes',
      amount: int(g.amount, 0, 100000) || 0,
      weekStartsOn: g.weekStartsOn === 0 ? 0 : 1,
      updated: stamp(g.updated),
    };
  }

  function cleanPrefs(p) {
    p = p && typeof p === 'object' ? p : {};
    return {
      name: line(p.name, 120),
      className: line(p.className, 120),
      teacher: line(p.teacher, 120),
      updated: stamp(p.updated),
    };
  }

  function cleanList(list, fn, max) {
    var byId = {};
    (Array.isArray(list) ? list : []).forEach(function (x) {
      var c = fn(x);
      if (!c) return;
      byId[c.id] = byId[c.id] ? pickNewer(byId[c.id], c) : c;
    });
    return sortById(Object.keys(byId).map(function (k) { return byId[k]; })).slice(-max);
  }
  function sortById(list) { return list.sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; }); }

  /** Anything at all in, a well-formed log out. Deterministic: the same input always gives the same output. */
  function sanitise(raw) {
    var d = raw && typeof raw === 'object' ? raw : {};
    return {
      v: 1,
      books: cleanList(d.books, cleanBook, LIMITS.books),
      entries: cleanList(d.entries, cleanEntry, LIMITS.entries),
      quotes: cleanList(d.quotes, cleanQuote, LIMITS.quotes),
      goal: cleanGoal(d.goal),
      prefs: cleanPrefs(d.prefs),
    };
  }

  /* ── Merging two devices' copies ────────────────────────────────────── */

  /** The newer of two versions of one item. On a tie a deletion wins, then a fixed order, so every device picks the same one. */
  function pickNewer(x, y) {
    var ux = x.updated || 0, uy = y.updated || 0;
    if (ux !== uy) return ux > uy ? x : y;
    if (!!x.deleted !== !!y.deleted) return x.deleted ? x : y;
    return canon(x) >= canon(y) ? x : y;
  }

  function mergeById(a, b) {
    var byId = {};
    (a || []).concat(b || []).forEach(function (x) {
      if (!x || !x.id) return;
      byId[x.id] = byId[x.id] ? pickNewer(byId[x.id], x) : x;
    });
    return sortById(Object.keys(byId).map(function (k) { return byId[k]; }));
  }

  /** This device's log merged with the account's. Neither side loses an item the other has. */
  function mergeLog(local, remote) {
    var a = sanitise(local), b = sanitise(remote);
    return sanitise({
      books: mergeById(a.books, b.books),
      entries: mergeById(a.entries, b.entries),
      quotes: mergeById(a.quotes, b.quotes),
      goal: pickNewer(a.goal, b.goal),
      prefs: pickNewer(a.prefs, b.prefs),
    });
  }

  /** True when `merged` holds something `remote` does not: this device should push. */
  function differs(merged, remote) { return canon(sanitise(merged)) !== canon(sanitise(remote)); }

  /* ── Reading the log ────────────────────────────────────────────────── */

  function live(list) { return (list || []).filter(function (x) { return x && !x.deleted; }); }

  /** Pages an entry counts for: the number typed, else "from 12 to 30" read as 19 pages (both ends included). */
  function entryPages(e) {
    if (!e) return 0;
    if (e.pages != null) return e.pages;
    if (e.fromPage != null && e.toPage != null && e.toPage >= e.fromPage) return e.toPage - e.fromPage + 1;
    return 0;
  }
  function entryMinutes(e) { return (e && e.minutes) || 0; }
  function counts(e) { return entryPages(e) > 0 || entryMinutes(e) > 0; }

  function sum(entries) {
    var t = { minutes: 0, pages: 0, entries: 0, days: 0 }, days = {};
    entries.forEach(function (e) {
      t.minutes += entryMinutes(e);
      t.pages += entryPages(e);
      t.entries++;
      if (counts(e)) days[e.date] = 1;
    });
    t.days = Object.keys(days).length;
    return t;
  }

  /** Entries dated from `from` to `to`, both included. */
  function inRange(entries, from, to) {
    return live(entries).filter(function (e) { return e.date >= from && e.date <= to; });
  }

  /** Totals for the week holding `today`. */
  function weekTotals(entries, today, startsOn) {
    var start = weekStart(today, startsOn), end = addDays(start, 6);
    var t = sum(inRange(entries, start, end));
    t.start = start; t.end = end;
    return t;
  }

  /** How far this week is towards the goal. No goal set: target 0, pct 0. */
  function goalProgress(goal, week) {
    var g = cleanGoal(goal);
    var done = g.unit === 'pages' ? week.pages : week.minutes;
    var target = g.amount;
    return {
      unit: g.unit,
      done: done,
      target: target,
      left: Math.max(0, target - done),
      pct: target ? Math.min(100, Math.round(done / target * 100)) : 0,
      met: target > 0 && done >= target,
    };
  }

  /**
   * Days read in a row, ending today. Today not read yet does not break the
   * run — it is still today — so at 8am yesterday's streak still shows.
   * Entries dated after `today` (a phone set a day ahead) are ignored.
   */
  function streak(entries, today) {
    var days = {};
    live(entries).forEach(function (e) { if (counts(e) && e.date <= today) days[e.date] = 1; });
    var cur = 0, d = today;
    if (!days[d]) d = addDays(d, -1);
    while (days[d]) { cur++; d = addDays(d, -1); }
    var nums = Object.keys(days).map(dayNum).sort(function (a, b) { return a - b; });
    var best = 0, run = 0;
    nums.forEach(function (n, i) { run = i && n === nums[i - 1] + 1 ? run + 1 : 1; if (run > best) best = run; });
    return { current: cur, best: best, readToday: !!days[today] };
  }

  function totals(state) {
    var t = sum(live(state.entries));
    var books = live(state.books);
    t.booksFinished = books.filter(function (b) { return b.status === 'finished'; }).length;
    t.booksReading = books.filter(function (b) { return b.status === 'reading'; }).length;
    return t;
  }

  /** Furthest page reached and how much of the book that is. */
  function bookProgress(book, entries) {
    var mine = live(entries).filter(function (e) { return e.bookId === book.id; });
    var last = 0, pages = 0, minutes = 0;
    mine.forEach(function (e) {
      if (e.toPage != null && e.toPage > last) last = e.toPage;
      pages += entryPages(e);
      minutes += entryMinutes(e);
    });
    var reached = last || pages;
    var pct = book.totalPages ? Math.min(100, Math.round(reached / book.totalPages * 100)) : null;
    if (book.status === 'finished' && book.totalPages) pct = 100;
    return { lastPage: last, pages: pages, minutes: minutes, entries: mine.length, pct: pct };
  }

  /* ── What a printout covers ─────────────────────────────────────────── */

  /** The from/to dates for a named range, as of `today`. */
  function presetRange(name, today, startsOn, entries) {
    var ws = weekStart(today, startsOn);
    if (name === 'lastWeek') return { from: addDays(ws, -7), to: addDays(ws, -1) };
    if (name === 'last30') return { from: addDays(today, -29), to: today };
    if (name === 'all') {
      var first = live(entries).reduce(function (m, e) { return !m || e.date < m ? e.date : m; }, '');
      return { from: first && first < today ? first : today, to: today };
    }
    return { from: ws, to: addDays(ws, 6) };
  }

  /**
   * Everything a printout for `from`–`to` shows: the entries in order, the
   * books they are from (plus any book finished in the range), quotes saved in
   * the range, the totals, and a line per week against the goal.
   */
  function printRange(state, from, to) {
    if (!isYMD(from) || !isYMD(to)) return null;
    if (from > to) { var t = from; from = to; to = t; }
    var s = sanitise(state);
    var books = live(s.books), byId = {};
    books.forEach(function (b) { byId[b.id] = b; });
    var entries = inRange(s.entries, from, to).sort(function (a, b) {
      // Same day: in the order logged. Ids begin with the time they were made,
      // so they sort that way; an edit changes `updated` but not the order.
      return a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    var used = {};
    entries.forEach(function (e) { used[e.bookId] = 1; });
    var inBooks = books.filter(function (b) {
      return used[b.id] || (b.finished && b.finished >= from && b.finished <= to);
    });
    var quotes = live(s.quotes).filter(function (q) { return q.date && q.date >= from && q.date <= to; })
      .sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    var weeks = [], ws = weekStart(from, s.goal.weekStartsOn);
    for (var guard = 0; ws <= to && guard < 60; guard++, ws = addDays(ws, 7)) {
      var a = ws < from ? from : ws, we = addDays(ws, 6), b = we > to ? to : we;
      var wk = sum(inRange(entries, a, b));
      var done = s.goal.unit === 'pages' ? wk.pages : wk.minutes;
      weeks.push({ start: ws, end: we, from: a, to: b, minutes: wk.minutes, pages: wk.pages, days: wk.days,
        partial: a !== ws || b !== we, met: s.goal.amount > 0 && done >= s.goal.amount });
    }
    return {
      from: from, to: to, days: daysBetween(from, to) + 1,
      entries: entries, books: inBooks, quotes: quotes, bookById: byId,
      totals: sum(entries), weeks: weeks, goal: s.goal,
    };
  }

  root.FluxReadingLogCore = {
    KEY: KEY, STATUSES: STATUSES, LIMITS: LIMITS,
    uid: uid, ymd: ymd, isYMD: isYMD, addDays: addDays, weekday: weekday, weekStart: weekStart,
    daysBetween: daysBetween, dayNum: dayNum, fromDayNum: fromDayNum, int: int, minutes: minutes, canon: canon,
    sanitise: sanitise, cleanBook: cleanBook, cleanEntry: cleanEntry, cleanQuote: cleanQuote,
    cleanGoal: cleanGoal, cleanPrefs: cleanPrefs,
    pickNewer: pickNewer, mergeById: mergeById, mergeLog: mergeLog, differs: differs,
    live: live, entryPages: entryPages, entryMinutes: entryMinutes, inRange: inRange,
    weekTotals: weekTotals, goalProgress: goalProgress, streak: streak, totals: totals,
    bookProgress: bookProgress, presetRange: presetRange, printRange: printRange,
  };
})();
