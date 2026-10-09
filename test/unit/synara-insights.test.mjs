import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';

/*
 * Synara's pattern engine (public/synara/js/insights.js) and the "3 days
 * ago" in its seizure history. These are the lines a student is most
 * likely to believe, so each test pins something that was once wrong:
 * a dose missed AFTER a seizure counted as coming before it, a dose
 * nobody logged called "missed", a late dose every few days passed off
 * as a pattern, "most" meaning two of four, windows that didn't match
 * their own text, and a list that said "2 days ago" under a header that
 * said 3.
 *
 * The files are browser modules under public/, so esbuild (already here
 * for the web bundles) bundles them and the result is imported.
 */

const { outputFiles } = buildSync({
  stdin: {
    contents: `export * from './insights.js';
               export { timeAgo } from './util.js';
               export { seed } from './seed.js';`,
    resolveDir: fileURLToPath(new URL('../../public/synara/js', import.meta.url)),
  },
  bundle: true, format: 'esm', write: false, platform: 'neutral',
});
const { insights, summary, timeAgo, seed } =
  await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'));

/* ---- A fixed local clock: everything in Synara is local time. ---- */

const RealDate = Date;

/** Run `fn` as if it were `when` ("YYYY-MM-DDTHH:mm", local) right now. */
function at(when, fn) {
  const now = new RealDate(when).getTime();
  globalThis.Date = class extends RealDate {
    constructor(...args) { if (args.length) super(...args); else super(now); }
    static now() { return now; }
  };
  try { return fn(); } finally { globalThis.Date = RealDate; }
}

/* ---- Records ---- */

const pad = (n) => String(n).padStart(2, '0');
/** "YYYY-MM-DD", `back` days before the (fake) today. */
function day(back) {
  const d = new Date();
  d.setDate(d.getDate() - back);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const record = () => ({ profile: {}, meds: [], doses: {}, seizures: [], checkins: {}, contacts: [], card: {}, settings: {} });
const seizure = (stamp) => ({ id: `sz-${stamp}`, at: stamp, duration: 60 });

/** One medication at `times`, tracked for `days` days, every dose logged taken. */
function allTaken(days, times = ['08:00', '20:00']) {
  const s = record();
  s.meds = [{ id: 'm1', name: 'Levetiracetam', added: day(days), ended: null, schedule: [{ from: day(days), times }] }];
  for (let back = days; back >= 1; back--) {
    s.doses[day(back)] = Object.fromEntries(times.map((t) => [`m1|${t}`, { status: 'taken', at: `${day(back)}T${t}` }]));
  }
  return s;
}
const mark = (s, back, time, status) => { s.doses[day(back)][`m1|${time}`] = { status, at: `${day(back)}T23:00` }; };
const find = (s, id) => insights(s).find((i) => i.id === id);

/* ============================================================
   Seizures after a missed or late dose
   ============================================================ */

test('a dose missed after a seizure is not counted as coming before it', () => {
  at('2026-10-07T12:00', () => {
    const s = allTaken(60);
    for (const back of [5, 20, 40]) {
      s.seizures.push(seizure(`${day(back)}T07:00`));
      mark(s, back, '20:00', 'missed');   // 13 hours AFTER the seizure
    }
    assert.equal(find(s, 'dose-proximity'), undefined);
  });
});

test('only the 48 hours before count: a dose missed 63 hours earlier does not', () => {
  at('2026-10-07T12:00', () => {
    const s = allTaken(60, ['08:00']);
    for (const back of [5, 20, 40]) {
      s.seizures.push(seizure(`${day(back)}T23:00`));
      mark(s, back + 2, '08:00', 'missed');
    }
    assert.equal(find(s, 'dose-proximity'), undefined);
  });
});

test('a dose nobody logged is not called missed', () => {
  at('2026-10-07T12:00', () => {
    const s = allTaken(60);
    s.doses = {};   // tracked for 60 days, nothing ever logged
    for (const back of [5, 20, 40]) s.seizures.push(seizure(`${day(back)}T15:00`));
    assert.equal(find(s, 'dose-proximity'), undefined);
  });
});

test('it has to beat chance: with a late dose every other evening, nothing is claimed', () => {
  at('2026-10-07T12:00', () => {
    const s = allTaken(60);
    for (let back = 1; back <= 60; back += 2) mark(s, back, '20:00', 'late');
    // Every one of these follows a late dose, as almost any 48 hours would.
    for (const back of [6, 22, 42]) s.seizures.push(seizure(`${day(back)}T15:00`));
    assert.equal(find(s, 'dose-proximity'), undefined);
  });
});

test('a real pattern is reported with the comparison, and without claiming a cause', () => {
  at('2026-10-07T12:00', () => {
    const s = allTaken(60);
    for (const back of [5, 20, 40]) {
      s.seizures.push(seizure(`${day(back)}T15:00`));
      mark(s, back + 1, '20:00', 'missed');   // the evening before
    }
    const ins = find(s, 'dose-proximity');
    assert.ok(ins, 'a missed dose before every seizure, and almost never otherwise, is a pattern');
    assert.equal(ins.title, '3 of your 3 seizures came after a missed or late dose');
    assert.match(ins.detail, /less than 48 hours after a dose marked missed or late/);
    assert.match(ins.detail, /Only \d+% of your 48-hour stretches without a seizure had one/);
    assert.match(ins.detail, /doesn't show the dose caused the seizure/);
    assert.match(ins.detail, /neurologist/);
    assert.match(ins.detail, /don't change how you take your medicine on your own/);
    const [, base] = ins.evidence.match(/^3\/3 seizures · 100% vs (\d+)% at other times$/);
    assert.ok(Number(base) < 20, `the baseline (${base}%) should be the few stretches with a miss`);
  });
});

test('several seizures on one day after one missed dose are one occasion, not a pattern', () => {
  at('2026-10-07T12:00', () => {
    const s = allTaken(60);
    for (const t of ['09:00', '11:00', '14:00']) s.seizures.push(seizure(`${day(10)}T${t}`));
    mark(s, 11, '20:00', 'missed');
    assert.equal(find(s, 'dose-proximity'), undefined);
  });
});

test('with under two weeks to compare against, it says nothing', () => {
  at('2026-10-07T12:00', () => {
    const s = allTaken(10);
    for (const back of [2, 5, 8]) {
      s.seizures.push(seizure(`${day(back)}T15:00`));
      mark(s, back + 1, '20:00', 'missed');
    }
    assert.equal(find(s, 'dose-proximity'), undefined);
  });
});

test('the example data still shows its planted dose pattern, because it is real', () => {
  at('2026-10-09T17:00', () => {
    const s = seed(record());
    const ins = insights(s)[0];
    assert.equal(ins.id, 'dose-proximity');
    assert.equal(ins.title, '3 of your 4 seizures came after a missed or late dose');
    assert.equal(ins.evidence, '3/4 seizures · 75% vs 19% at other times');
  });
});

/* ============================================================
   Other patterns: only what the log shows
   ============================================================ */

test('"most" means more than half, and the time of day is not a dose-timing nudge', () => {
  at('2026-10-07T12:00', () => {
    const s = record();
    s.seizures = [`${day(3)}T13:00`, `${day(10)}T14:00`, `${day(20)}T07:00`, `${day(28)}T21:00`].map(seizure);
    assert.equal(find(s, 'time-of-day'), undefined, '2 of 4 is not most');

    s.seizures[3] = seizure(`${day(28)}T15:30`);
    const ins = find(s, 'time-of-day');
    assert.equal(ins.title, 'Most of your seizures happened in the early afternoon (12pm–4pm)');
    assert.equal(ins.evidence, '3/4 seizures · 75%');
    assert.doesNotMatch(ins.detail, /dose/i);
  });
});

test('stress is described alongside other triggers, not as what causes them', () => {
  at('2026-10-07T12:00', () => {
    const s = record();
    for (let back = 1; back <= 20; back++) s.checkins[day(back)] = { stress: 2, sleepHours: 8 };
    for (const back of [3, 9, 15]) {
      s.checkins[day(back)].stress = 5;
      s.seizures.push(seizure(`${day(back)}T12:00`));
    }
    const ins = find(s, 'stress');
    assert.ok(ins);
    assert.match(ins.detail, /alongside other commonly reported triggers/);
    assert.doesNotMatch(ins.detail, /acts alone|the things that do/);
  });
});

test('the frequency trend compares two windows of the length it names', () => {
  at('2026-10-07T12:00', () => {
    const s = record();
    // Used to read "1 in the last 15 days, against 3 in the 15 days before",
    // counting two seizures from 30 and 31 days back as "the 15 days before".
    s.seizures = [1, 15, 30, 31].map((back) => seizure(`${day(back)}T12:00`));
    assert.equal(find(s, 'frequency'), undefined, 'one in each 15-day window is no change');

    s.seizures = [2, 5, 8, 12, 25, 40].map((back) => seizure(`${day(back)}T12:00`));
    const ins = find(s, 'frequency');
    assert.equal(ins.title, 'More seizures in the most recent stretch');
    assert.match(ins.detail, /^4 seizures in the last 20 days, against 1 in the 20 days before\./);
  });
});

test('"in the last 30 days" is today and the 29 days before, and nothing dated ahead', () => {
  at('2026-10-07T12:00', () => {
    const s = record();
    s.seizures = [0, 10, 29, 30].map((back) => seizure(`${day(back)}T09:00`));
    assert.equal(summary(s).seizuresLast30, 3);

    s.seizures = [seizure(`${day(5)}T09:00`), seizure(`${day(-3)}T09:00`)];   // one dated 3 days ahead
    assert.equal(summary(s).seizuresLast30, 1);
    assert.equal(summary(s).daysSince, 0, 'never "-3 days since the last"');
  });
});

/* ============================================================
   timeAgo agrees with "days since the last"
   ============================================================ */

test('the history counts calendar days, as the header does', () => {
  at('2026-10-07T01:27', () => {   // a Wednesday, just after midnight
    const s = record();
    s.seizures = [seizure('2026-10-04T15:40')];
    assert.equal(summary(s).daysSince, 3);
    assert.equal(timeAgo('2026-10-04T15:40'), '3 days ago');   // was "2 days ago"
    assert.equal(timeAgo('2026-09-26T09:00'), '11 days ago');
    assert.equal(timeAgo('2026-10-05T20:00'), '2 days ago');
    assert.equal(timeAgo('2026-10-06T00:10'), 'yesterday');
    assert.equal(timeAgo('2026-10-06T23:50'), '1h ago');
    assert.equal(timeAgo('2026-10-07T00:42'), '45m ago');
    assert.equal(timeAgo('2026-10-07T01:27'), 'just now');
  });
});

test('at every hour of the following days, the list and the header give the same day count', () => {
  const when = '2026-10-04T15:40';
  for (let h = 24; h <= 120; h++) {
    const now = new RealDate(2026, 9, 4, 15 + h, 40);
    at(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:40`, () => {
      const { daysSince } = summary({ ...record(), seizures: [seizure(when)] });
      const ago = timeAgo(when);
      const n = ago === 'yesterday' ? 1 : Number((ago.match(/^(\d+) days ago$/) || [])[1]);
      assert.equal(n, daysSince, `${now}: "${ago}" against ${daysSince} days since`);
    });
  }
});

test('timeAgo takes the time to measure from', () => {
  assert.equal(timeAgo('2026-10-04T15:40', new RealDate(2026, 9, 7, 1, 27)), '3 days ago');
  assert.equal(timeAgo('2026-08-01T10:00', new RealDate(2026, 9, 7, 1, 27)), '2 months ago');
});
