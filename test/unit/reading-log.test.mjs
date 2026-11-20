import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

/**
 * flux-reading-log-core.js: dates and weeks, streaks, weekly totals against
 * the teacher's goal, what a printout covers, and merging two devices' logs.
 */
const sandbox = { window: {}, Math, Date, JSON };
vm.createContext(sandbox);
vm.runInContext(readFileSync(new URL('../../public/js/flux-reading-log-core.js', import.meta.url), 'utf8'), sandbox);
const C = sandbox.window.FluxReadingLogCore;
/** Arrays made inside the VM belong to another realm; compare their contents. */
const plain = (x) => JSON.parse(JSON.stringify(x));

const book = (id, extra = {}) => ({ id, title: 'Book ' + id, author: 'A', status: 'reading', updated: 1, ...extra });
const entry = (id, date, extra = {}) => ({ id, date, bookId: 'b1', minutes: 20, updated: 1, ...extra });

/* ── dates ──────────────────────────────────────────────────────────── */

test('day arithmetic works on calendar dates, across months, years and leap days', () => {
  assert.equal(C.addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(C.addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(C.addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(C.addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(C.isYMD('2026-02-30'), false, 'not a real date');
  assert.equal(C.isYMD('2026-2-3'), false);
  assert.equal(C.isYMD('2026-02-28'), true);
});

test('weeks start on Monday by default, or on Sunday', () => {
  // 2026-10-17 is a Saturday.
  assert.equal(C.weekday('2026-10-17'), 6);
  assert.equal(C.weekStart('2026-10-17'), '2026-10-12');
  assert.equal(C.weekStart('2026-10-17', 0), '2026-10-11');
  // A Sunday belongs to the week before when weeks start on Monday…
  assert.equal(C.weekStart('2026-10-18', 1), '2026-10-12');
  // …and starts its own week when weeks start on Sunday.
  assert.equal(C.weekStart('2026-10-18', 0), '2026-10-18');
  assert.equal(C.weekStart('2026-10-12', 1), '2026-10-12');
});

test('a daylight-saving change does not move a day into another week', () => {
  const saved = process.env.TZ;
  try {
    for (const tz of ['America/Los_Angeles', 'Europe/London', 'Australia/Sydney', 'UTC']) {
      process.env.TZ = tz;
      // US clocks go back on 1 Nov 2026, UK on 25 Oct, Sydney forward on 4 Oct.
      assert.equal(C.addDays('2026-10-31', 1), '2026-11-01', tz);
      assert.equal(C.addDays('2026-10-24', 2), '2026-10-26', tz);
      assert.equal(C.weekStart('2026-11-01'), '2026-10-26', tz);
      assert.equal(C.weekStart('2026-11-02'), '2026-11-02', tz);
      assert.equal(C.weekStart('2026-10-05'), '2026-10-05', tz);
      const wk = C.weekTotals([entry('a', '2026-10-26'), entry('b', '2026-11-01'), entry('c', '2026-11-02')], '2026-10-29', 1);
      assert.equal(wk.minutes, 40, tz + ': Monday to Sunday, not the next Monday');
    }
  } finally {
    if (saved === undefined) delete process.env.TZ; else process.env.TZ = saved;
  }
});

test('"today" is the date where the student is, so late-night reading counts for that day', () => {
  const saved = process.env.TZ;
  try {
    // 05:30 UTC on Saturday 17 Oct is still Friday evening in California.
    const instant = Date.UTC(2026, 9, 17, 5, 30);
    process.env.TZ = 'America/Los_Angeles';
    assert.equal(C.ymd(instant), '2026-10-16');
    process.env.TZ = 'Pacific/Auckland';
    assert.equal(C.ymd(instant), '2026-10-17');
    process.env.TZ = 'Asia/Kolkata';
    assert.equal(C.ymd(instant), '2026-10-17');
  } finally {
    if (saved === undefined) delete process.env.TZ; else process.env.TZ = saved;
  }
  // Logged on Sunday night (Monday weeks): it belongs to the week that is ending.
  const entries = [entry('sun', '2026-10-18', { minutes: 45 })];
  assert.equal(C.weekTotals(entries, '2026-10-18', 1).minutes, 45);
  assert.equal(C.weekTotals(entries, '2026-10-19', 1).minutes, 0, 'a new week starts at zero');
  assert.equal(C.weekTotals(entries, '2026-10-19', 0).minutes, 45, 'unless weeks start on Sunday');
});

/* ── pages, totals, goal ────────────────────────────────────────────── */

test('pages count a typed number, else from–to with both pages included', () => {
  assert.equal(C.entryPages({ pages: 15, fromPage: 1, toPage: 100 }), 15, 'a typed count wins');
  assert.equal(C.entryPages({ fromPage: 12, toPage: 30 }), 19);
  assert.equal(C.entryPages({ fromPage: 1, toPage: 30 }) + C.entryPages({ fromPage: 31, toPage: 45 }), 45,
    'consecutive sessions add up to the pages read');
  assert.equal(C.entryPages({ fromPage: 30 }), 0, 'only a start page: nothing to count');
  assert.equal(C.entryPages({ minutes: 20 }), 0);
  const swapped = C.cleanEntry({ id: 'x', date: '2026-10-17', fromPage: 30, toPage: 12 });
  assert.deepEqual([swapped.fromPage, swapped.toPage], [12, 30], 'pages typed the wrong way round are swapped');
});

test('weekly totals and progress towards the goal', () => {
  const entries = [
    entry('a', '2026-10-12', { minutes: 30, pages: 10 }),
    entry('b', '2026-10-12', { minutes: 15, fromPage: 11, toPage: 20 }),
    entry('c', '2026-10-15', { minutes: 40 }),
    entry('d', '2026-10-11', { minutes: 60 }),            // the Sunday before
    entry('e', '2026-10-19', { minutes: 60 }),            // the Monday after
    { id: 'f', deleted: true, updated: 2 },
  ];
  const wk = C.weekTotals(entries, '2026-10-17', 1);
  assert.deepEqual(plain(wk), { minutes: 85, pages: 20, entries: 3, days: 2, start: '2026-10-12', end: '2026-10-18' });
  assert.deepEqual(plain(C.goalProgress({ unit: 'minutes', amount: 120 }, wk)),
    { unit: 'minutes', done: 85, target: 120, left: 35, pct: 71, met: false });
  assert.deepEqual(plain(C.goalProgress({ unit: 'pages', amount: 20 }, wk)),
    { unit: 'pages', done: 20, target: 20, left: 0, pct: 100, met: true });
  assert.equal(C.goalProgress({ unit: 'minutes', amount: 0 }, wk).pct, 0, 'no goal: no progress bar');
  assert.equal(C.goalProgress({ unit: 'minutes', amount: 0 }, wk).met, false);
  assert.equal(C.goalProgress({ unit: 'minutes', amount: 50 }, wk).pct, 100, 'never past 100%');
});

test('streak: days in a row, today not read yet does not break it', () => {
  const e = (d) => entry(d, d);
  const entries = [e('2026-10-10'), e('2026-10-11'), e('2026-10-12'), e('2026-10-14'), e('2026-10-15'), e('2026-10-16')];
  assert.deepEqual(plain(C.streak(entries, '2026-10-16')), { current: 3, best: 3, readToday: true });
  assert.deepEqual(plain(C.streak(entries, '2026-10-17')), { current: 3, best: 3, readToday: false });
  assert.equal(C.streak(entries, '2026-10-18').current, 0, 'a whole day missed ends it');
  // Over a month and a year boundary.
  const ny = ['2026-12-30', '2026-12-31', '2027-01-01'].map(e);
  assert.equal(C.streak(ny, '2027-01-01').current, 3);
  // Two entries on one day are one day; an entry with no pages or minutes is not reading.
  const twice = [e('2026-10-16'), entry('x', '2026-10-16'), entry('z', '2026-10-15', { minutes: 0 })];
  assert.equal(C.streak(twice, '2026-10-16').current, 1);
  // A deleted entry does not count; nor does one dated in the future.
  assert.equal(C.streak([{ id: '2026-10-16', deleted: true, updated: 3 }, e('2026-10-18')], '2026-10-16').current, 0);
  assert.equal(C.streak([], '2026-10-16').best, 0);
});

test('book progress follows the furthest page reached', () => {
  const b = { id: 'b1', totalPages: 200, status: 'reading' };
  const entries = [entry('a', '2026-10-01', { fromPage: 1, toPage: 40 }), entry('c', '2026-10-02', { fromPage: 41, toPage: 50 })];
  assert.deepEqual(plain(C.bookProgress(b, entries)), { lastPage: 50, pages: 50, minutes: 40, entries: 2, pct: 25 });
  assert.equal(C.bookProgress({ ...b, status: 'finished' }, entries).pct, 100);
  assert.equal(C.bookProgress({ id: 'b1', status: 'reading' }, entries).pct, null, 'no page count: no percentage');
});

/* ── cleaning ───────────────────────────────────────────────────────── */

test('anything stored is cleaned, deterministically', () => {
  const junk = {
    books: [null, { id: 'b1', title: '  Macbeth ', status: 'eaten', rating: 9, totalPages: -4 }, { id: 'bad id!', title: 'x' }, { id: 'b2' }],
    entries: [{ id: 'e1', date: '2026-02-30' }, { id: 'e2', date: '2026-10-01', minutes: '25', pages: 'lots' }, 'nope'],
    quotes: [{ id: 'q1', text: '   ' }, { id: 'q2', text: 'Fair is foul', page: 12 }],
    goal: { unit: 'hours', amount: '150', weekStartsOn: 0 },
  };
  const s = C.sanitise(junk);
  assert.deepEqual(plain(s.books.map((b) => [b.id, b.title, b.status, b.rating, b.totalPages])), [['b1', 'Macbeth', 'reading', null, null]]);
  assert.deepEqual(plain(s.entries.map((e) => [e.id, e.minutes, e.pages])), [['e2', 25, null]]);
  assert.deepEqual(plain(s.quotes.map((q) => [q.id, q.page])), [['q2', '12']]);
  assert.deepEqual(plain(s.goal), { unit: 'minutes', amount: 150, weekStartsOn: 0, updated: 0 });
  assert.equal(C.canon(C.sanitise(junk)), C.canon(C.sanitise(JSON.parse(JSON.stringify(junk)))));
  assert.equal(C.canon(C.sanitise(s)), C.canon(s), 'cleaning twice changes nothing');
  assert.deepEqual(plain(C.sanitise(undefined).entries), []);
});

test('ids are unique even when made in the same millisecond', () => {
  const seen = new Set();
  for (let i = 0; i < 2000; i++) seen.add(C.uid('e'));
  assert.equal(seen.size, 2000);
  assert.match([...seen][0], /^e[a-z0-9]+$/);
});

/* ── merging two devices ────────────────────────────────────────────── */

test('two devices logging on the same day both keep their entries', () => {
  const laptop = { books: [book('b1')], entries: [entry('lap1', '2026-10-17', { minutes: 25, updated: 100 })] };
  const phone = { books: [book('b1')], entries: [entry('ph1', '2026-10-17', { minutes: 15, updated: 101 })] };
  const merged = C.mergeLog(laptop, phone);
  assert.deepEqual(plain(merged.entries.map((e) => e.id)), ['lap1', 'ph1']);
  assert.equal(C.weekTotals(merged.entries, '2026-10-17').minutes, 40);
  assert.equal(C.differs(merged, phone), true, 'the laptop has to push what the phone lacks');
  assert.equal(C.differs(C.mergeLog(merged, phone), merged), false, 'merging again changes nothing');
  assert.equal(C.canon(C.mergeLog(phone, laptop)), C.canon(merged), 'the order of the merge does not matter');
});

test('an edit is merged by its time: the newer copy wins', () => {
  const old = { entries: [entry('e1', '2026-10-17', { minutes: 10, updated: 100 })] };
  const edited = { entries: [entry('e1', '2026-10-17', { minutes: 35, updated: 200 })] };
  assert.equal(C.mergeLog(old, edited).entries[0].minutes, 35);
  assert.equal(C.mergeLog(edited, old).entries[0].minutes, 35);
  assert.equal(C.differs(C.mergeLog(edited, old), edited), false, 'nothing new to push');
});

test('a deletion reaches the other device and does not come back', () => {
  const here = { entries: [{ id: 'e1', deleted: true, updated: 300 }, entry('e2', '2026-10-17', { updated: 100 })] };
  const there = { entries: [entry('e1', '2026-10-16', { updated: 100 }), entry('e2', '2026-10-17', { updated: 100 })] };
  const m = C.mergeLog(there, here);
  assert.equal(m.entries.find((e) => e.id === 'e1').deleted, true);
  assert.deepEqual(plain(C.live(m.entries).map((e) => e.id)), ['e2']);
  // …but an edit made after the deletion brings it back, as the newest change.
  const revived = { entries: [entry('e1', '2026-10-16', { minutes: 50, updated: 400 })] };
  assert.equal(C.mergeLog(m, revived).entries.find((e) => e.id === 'e1').minutes, 50);
  // A tie between an edit and a deletion: every device picks the deletion.
  const tie = C.mergeLog({ entries: [entry('t', '2026-10-01', { updated: 5 })] }, { entries: [{ id: 't', deleted: true, updated: 5 }] });
  assert.equal(tie.entries[0].deleted, true);
});

test('books, quotes, the goal and the print details all merge', () => {
  const a = {
    books: [book('b1', { status: 'finished', updated: 50 })],
    quotes: [{ id: 'q1', bookId: 'b1', text: 'One', date: '2026-10-01', updated: 10 }],
    goal: { unit: 'pages', amount: 100, updated: 70 },
    prefs: { name: 'Sam', updated: 5 },
  };
  const b = {
    books: [book('b1', { status: 'reading', updated: 40 }), book('b2', { updated: 41 })],
    quotes: [{ id: 'q2', bookId: 'b2', text: 'Two', date: '2026-10-02', updated: 11 }],
    goal: { unit: 'minutes', amount: 120, updated: 60 },
    prefs: { name: 'Samira K', updated: 9 },
  };
  const m = C.mergeLog(a, b);
  assert.deepEqual(plain(m.books.map((x) => [x.id, x.status])), [['b1', 'finished'], ['b2', 'reading']]);
  assert.deepEqual(plain(m.quotes.map((q) => q.id)), ['q1', 'q2']);
  assert.deepEqual(plain(m.goal), { unit: 'pages', amount: 100, weekStartsOn: 1, updated: 70 });
  assert.equal(m.prefs.name, 'Samira K');
});

test('an account with no reading log yet merges to this device\'s log, and asks for a push', () => {
  const local = { books: [book('b1')], entries: [entry('e1', '2026-10-17')] };
  const m = C.mergeLog(local, {});
  assert.equal(m.entries.length, 1);
  assert.equal(C.differs(m, {}), true);
  assert.equal(C.differs(C.mergeLog({}, {}), {}), false, 'two empty logs: nothing to push');
});

/* ── printing ───────────────────────────────────────────────────────── */

test('a printout covers exactly the chosen dates', () => {
  const state = {
    books: [book('b1', { title: 'Macbeth' }), book('b2', { title: 'Beloved', status: 'finished', finished: '2026-10-14' }), book('b3', { title: 'Unread' })],
    entries: [
      entry('e0', '2026-10-11', { minutes: 99 }),
      entry('e2', '2026-10-13', { minutes: 20, updated: 5 }),
      entry('e1', '2026-10-12', { minutes: 30, pages: 12 }),
      entry('e3', '2026-10-13', { minutes: 10, updated: 2 }),
      entry('e4', '2026-10-18', { minutes: 25 }),
      entry('e5', '2026-10-19', { minutes: 40 }),
      { id: 'e6', deleted: true, updated: 9 },
    ],
    quotes: [
      { id: 'q1', bookId: 'b1', text: 'In range', date: '2026-10-12', updated: 1 },
      { id: 'q2', bookId: 'b1', text: 'Too early', date: '2026-10-01', updated: 1 },
    ],
    goal: { unit: 'minutes', amount: 60 },
  };
  const p = C.printRange(state, '2026-10-12', '2026-10-18');
  assert.deepEqual(plain(p.entries.map((e) => e.id)), ['e1', 'e2', 'e3', 'e4'], 'by date, then in the order logged');
  assert.deepEqual(plain(p.totals), { minutes: 85, pages: 12, entries: 4, days: 3 });
  assert.deepEqual(plain(p.books.map((b) => b.title)), ['Macbeth', 'Beloved'], 'books read, and a book finished in the range');
  assert.deepEqual(plain(p.quotes.map((q) => q.id)), ['q1']);
  assert.equal(p.days, 7);
  assert.deepEqual(plain(p.weeks), [{ start: '2026-10-12', end: '2026-10-18', from: '2026-10-12', to: '2026-10-18', minutes: 85, pages: 12, days: 3, partial: false, met: true }]);

  const swapped = C.printRange(state, '2026-10-18', '2026-10-12');
  assert.equal(swapped.from, '2026-10-12', 'dates the wrong way round are swapped');
  assert.equal(C.printRange(state, '2026-10-12', 'soon'), null);

  // A range across two weeks is split into a line per week, part weeks marked.
  const two = C.printRange(state, '2026-10-16', '2026-10-19');
  assert.deepEqual(plain(two.weeks.map((w) => [w.start, w.from, w.to, w.minutes, w.partial])),
    [['2026-10-12', '2026-10-16', '2026-10-18', 25, true], ['2026-10-19', '2026-10-19', '2026-10-19', 40, true]]);
  // Only the last day.
  assert.deepEqual(plain(C.printRange(state, '2026-10-19', '2026-10-19').entries.map((e) => e.id)), ['e5']);
});

test('preset ranges: this week, last week, last 30 days, everything', () => {
  const today = '2026-10-17';
  assert.deepEqual(plain(C.presetRange('thisWeek', today, 1)), { from: '2026-10-12', to: '2026-10-18' });
  assert.deepEqual(plain(C.presetRange('lastWeek', today, 1)), { from: '2026-10-05', to: '2026-10-11' });
  assert.deepEqual(plain(C.presetRange('lastWeek', today, 0)), { from: '2026-10-04', to: '2026-10-10' });
  assert.deepEqual(plain(C.presetRange('last30', today, 1)), { from: '2026-09-18', to: today });
  assert.deepEqual(plain(C.presetRange('all', today, 1, [entry('a', '2026-09-02'), entry('b', '2026-10-01')])), { from: '2026-09-02', to: today });
  assert.deepEqual(plain(C.presetRange('all', today, 1, [])), { from: today, to: today });
});

/* ── typed minutes ──────────────────────────────────────────────────── */

test('minutes are read the way people type them', () => {
  const cases = { '25': 25, ' 25 min ': 25, '25 minutes': 25, '1h': 60, '1h 30': 90, '1h30m': 90, '1 hour 30 minutes': 90,
    '1 hour and 5 minutes': 65, '2 hours': 120, '1:30': 90, '0:45': 45, '1.5 hours': 90, '1,5 h': 90, '90m': 90 };
  for (const [typed, want] of Object.entries(cases)) assert.equal(C.minutes(typed, 1440), want, typed);
  for (const typed of ['', 'lots', '1:75', '25 pages', '-5', '25 h']) assert.equal(C.minutes(typed, 1440), null, typed);
  assert.equal(C.minutes(30, 1440), 30);
});
