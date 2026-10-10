import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

/**
 * flux-week-plan.js — "Plan my week": the open work fitted into the next seven
 * days around classes, events, rest days and the student's study hours.
 * Dates are fixed: Monday 5 October 2026, 10:00 in the morning.
 */
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(readFileSync(new URL('../../public/js/flux-week-plan.js', import.meta.url), 'utf8'), sandbox);
const W = sandbox.window.FluxWeekPlan;
const clone = (x) => JSON.parse(JSON.stringify(x));
const plan = (o) => clone(W.propose({ today: '2026-10-05', nowMin: 600, maxPerDay: 120, ...o }));
const task = (id, date, estTime, extra) => ({ id, name: 'Task ' + id, date, estTime, type: 'hw', priority: 'med', ...extra });
const of = (r, id) => r.blocks.filter((b) => b.taskId === id).map((b) => [b.date, b.start, b.minutes]);
/** What the dialog writes back after "Approve": each block a task with an id. */
const applied = (r, extra) => r.blocks.map((b, i) => ({ id: b.id ?? 5000 + i, key: b.key, taskId: b.taskId, date: b.date, start: b.start, minutes: b.minutes, done: false, pinned: false, ...(extra ? extra(b) : {}) }));

test('two tasks: due-soon first, spread over the emptiest days before each is due, with a reason', () => {
  const r = plan({ tasks: [task(1, '2026-10-07', 45, { name: 'Algebra homework' }), task(2, '2026-10-08', 90, { name: 'History essay', type: 'essay' })] });
  assert.deepEqual(of(r, 1), [['2026-10-05', '16:00', 45]]);
  assert.deepEqual(of(r, 2), [['2026-10-06', '16:00', 45], ['2026-10-07', '16:00', 45]]);
  assert.equal(r.blocks.find((b) => b.taskId === 1).reason, 'Due Wed, ~45 min left');
  assert.equal(r.blocks.find((b) => b.taskId === 2).reason, 'Due Thu, ~90 min left, split over 2 days');
  assert.deepEqual(r.blocks.filter((b) => b.taskId === 2).map((b) => b.part + '/' + b.of), ['1/2', '2/2']);
  assert.deepEqual(r.unscheduled, []);
  assert.equal(r.days.length, 7);
});

test('the same week planned twice gives the same plan', () => {
  const o = { tasks: [task(1, '2026-10-07', 45), task(2, '2026-10-09', 150), task(3, '2026-10-06', 0)] };
  assert.deepEqual(plan(o), plan(o));
});

test('classes, events and weekly activities are worked around, with a short breather', () => {
  const r = plan({
    tasks: [task(1, '2026-10-07', 45)],
    commitments: { '2026-10-05': [{ start: '16:00', end: '17:30', label: 'Soccer' }], '2026-10-06': [{ start: '15:30', label: 'Piano' }] },
  });
  // Both days are empty, so the earlier one wins; the block starts after
  // soccer and a ten-minute breather, on the quarter hour.
  assert.deepEqual(of(r, 1), [['2026-10-05', '17:45', 45]]);
  const tue = r.days.find((d) => d.date === '2026-10-06');
  assert.deepEqual(tue.busy, [{ start: '15:30', end: '16:30', label: 'Piano', assumed: true }]);
});

test('a commitment with no start time blocks nothing', () => {
  const r = plan({ tasks: [task(1, '2026-10-06', 30)], commitments: { '2026-10-05': [{ label: 'Field trip' }] } });
  assert.deepEqual(of(r, 1), [['2026-10-05', '16:00', 30]]);
});

test('rest days and days switched off get nothing; work moves to the days around them', () => {
  const avail = W.normAvail(null);
  avail[1] = { on: false, start: '16:00', end: '21:00' }; // no study on Mondays
  const r = plan({ avail, rest: ['2026-10-06'], tasks: [task(1, '2026-10-09', 90)] });
  assert.deepEqual(of(r, 1).map((x) => x[0]), ['2026-10-07', '2026-10-08']);
  const mon = r.days[0], tue = r.days[1];
  assert.equal(mon.off, true); assert.equal(mon.cap, 0);
  assert.equal(tue.rest, true); assert.equal(tue.cap, 0);
});

test('the daily limit holds, and what does not fit is listed with why', () => {
  const r = plan({ maxPerDay: 60, tasks: [task(1, '2026-10-06', 60, { name: 'Lab write-up' }), task(2, '2026-10-06', 45, { name: 'Reading' })] });
  assert.ok(r.days.every((d) => d.used <= 60));
  assert.deepEqual(of(r, 1), [['2026-10-05', '16:00', 60]]);
  assert.deepEqual(of(r, 2), []);
  assert.deepEqual(r.unscheduled.map((u) => [u.name, u.minutes]), [['Reading', 45]]);
  assert.equal(r.unscheduled[0].reason, 'Due tomorrow, and your daily limit (60 min) is used up before then.');
});

test('part of a task fits: the rest is listed, saying how much fitted', () => {
  const r = plan({ maxPerDay: 60, tasks: [task(1, '2026-10-06', 100, { name: 'Project' })] });
  assert.deepEqual(of(r, 1), [['2026-10-05', '16:00', 60]]);
  assert.equal(r.unscheduled[0].minutes, 40);
  assert.match(r.unscheduled[0].reason, /^Due tomorrow\. Only 60 of 100 min fit: your daily limit/);
});

test('no estimate: the usual time for the type, and the reason says so', () => {
  const r = plan({ tasks: [task(1, '2026-10-08', 0), task(2, '2026-10-09', null, { type: 'test' })] });
  assert.equal(r.blocks.find((b) => b.taskId === 1).minutes, 30);
  assert.equal(r.blocks.find((b) => b.taskId === 1).reason, 'Due Thu, no estimate, so ~30 min');
  assert.equal(r.blocks.filter((b) => b.taskId === 2).reduce((s, b) => s + b.minutes, 0), 90);
  assert.match(r.blocks.find((b) => b.taskId === 2).reason, /^Due Fri, no estimate, so ~90 min, split over 2 days$/);
});

test('no due date: not guessed at, listed instead', () => {
  const r = plan({ tasks: [task(1, '', 30, { name: 'Someday' })] });
  assert.deepEqual(r.blocks, []);
  assert.deepEqual(r.unscheduled.map((u) => [u.name, u.reason]), [['Someday', 'No due date yet. Add one and plan again.']]);
});

test('due today after study hours are over: listed, not squeezed in', () => {
  const r = plan({ nowMin: 21 * 60 + 30, tasks: [task(1, '2026-10-05', 30, { name: 'Worksheet' })] });
  assert.deepEqual(r.blocks, []);
  assert.equal(r.unscheduled[0].reason, 'Due today, and there’s no study time left today.');
});

test('today starts after now, on the quarter hour', () => {
  const r = plan({ nowMin: 16 * 60 + 20, tasks: [task(1, '2026-10-06', 30)] });
  assert.deepEqual(of(r, 1), [['2026-10-05', '16:30', 30]]);
});

test('due after the week: this week\'s fair share; far off: it waits', () => {
  const r = plan({ tasks: [task(1, '2026-10-19', 120, { name: 'Essay' }), task(2, '2026-11-19', 120, { name: 'Semester review' })] });
  assert.equal(r.blocks.filter((b) => b.taskId === 1).reduce((s, b) => s + b.minutes, 0), 60);
  assert.equal(r.blocks.find((b) => b.taskId === 1).reason, 'Due Oct 19, 60 of ~120 min this week');
  assert.deepEqual(r.later.map((l) => l.name), ['Semester review']);
  assert.deepEqual(r.unscheduled, []);
});

test('overdue work goes first and as soon as possible', () => {
  const r = plan({ tasks: [task(2, '2026-10-08', 45), task(1, '2026-10-03', 30, { name: 'Late quiz corrections' })] });
  assert.deepEqual(of(r, 1), [['2026-10-05', '16:00', 30]]);
  assert.equal(r.blocks.find((b) => b.taskId === 1).reason, 'Overdue since Oct 3, ~30 min left');
});

test('due tomorrow with no room before: the due day only when it is due late enough', () => {
  const avail = clone(W.normAvail(null));
  avail[1] = { on: false, start: '16:00', end: '21:00' };
  // No due time: after school on the due day is probably too late. Listed.
  let r = plan({ avail, tasks: [task(1, '2026-10-06', 30, { name: 'Worksheet' })] });
  assert.deepEqual(of(r, 1), []);
  assert.equal(r.unscheduled[0].reason, 'Due tomorrow, and there’s no study time set before then.');
  // Due at 11:59 PM: the evening of the due day is fine, and it says so.
  r = plan({ avail, tasks: [task(1, '2026-10-06', 30, { time: '23:59' })] });
  assert.deepEqual(of(r, 1), [['2026-10-06', '16:00', 30]]);
  assert.match(r.blocks[0].reason, /on the day it’s due \(no room before\)/);
  // Due at 5 PM: finished (with a breather) before then.
  r = plan({ avail, tasks: [task(1, '2026-10-06', 60, { time: '17:00' })] });
  assert.deepEqual(of(r, 1), [['2026-10-06', '16:00', 50]]);
  assert.equal(r.unscheduled[0].minutes, 10);
});

test('due today at a set time: blocks end before it', () => {
  const r = plan({ nowMin: 16 * 60, tasks: [task(1, '2026-10-05', 30, { time: '16:30' })] });
  assert.deepEqual(of(r, 1), []);
  assert.match(r.unscheduled[0].reason, /^Due today, and there’s no free time left in your study hours today\.$/);
});

test('due today before study time even starts: says so', () => {
  const r = plan({ tasks: [task(1, '2026-10-05', 20, { time: '15:00', name: 'Worksheet' })] });
  assert.deepEqual(of(r, 1), []);
  assert.equal(r.unscheduled[0].reason, 'Due today at 3:00 PM, before your study time starts.');
});

test('a block whose task has gone keeps its own name', () => {
  const r = plan({ tasks: [], blocks: [{ id: 9, key: '77:1', taskId: 77, name: 'Old essay', date: '2026-10-06', start: '16:00', minutes: 30, done: false, pinned: true }] });
  assert.deepEqual(r.blocks.map((b) => [b.name, b.kept]), [['Old essay', 'pinned']]);
});

test('a task already planned with Plan it out is left alone, and its sessions count against the day', () => {
  const r = plan({
    maxPerDay: 60,
    load: { '2026-10-05': 60 },
    tasks: [task(1, '2026-10-09', 240, { planned: true, name: 'Big essay' }), task(2, '2026-10-07', 30)],
  });
  assert.deepEqual(r.planned.map((p) => p.name), ['Big essay']);
  assert.deepEqual(of(r, 1), []);
  assert.deepEqual(of(r, 2), [['2026-10-06', '16:00', 30]]);
});

test('high priority first when two are due the same day', () => {
  const r = plan({ maxPerDay: 30, tasks: [task(1, '2026-10-06', 30, { priority: 'low', name: 'Low' }), task(2, '2026-10-06', 30, { priority: 'high', name: 'High' })] });
  assert.deepEqual(of(r, 2), [['2026-10-05', '16:00', 30]]);
  assert.deepEqual(r.unscheduled.map((u) => u.name), ['Low']);
});

test('planning again after approving: same blocks, same ids, nothing new, nothing dropped', () => {
  const tasks = [task(1, '2026-10-07', 45), task(2, '2026-10-09', 150), task(3, '2026-10-19', 120)];
  const first = plan({ tasks });
  const again = plan({ tasks, blocks: applied(first) });
  assert.equal(again.blocks.length, first.blocks.length);
  assert.ok(again.blocks.every((b) => b.id != null && !b.isNew && b.was === null));
  assert.deepEqual(again.blocks.map((b) => b.key), first.blocks.map((b) => b.key));
  assert.deepEqual(again.drop, []);
  assert.equal(new Set(again.blocks.map((b) => b.key)).size, again.blocks.length);
});

test('a block done stays and counts as done; a moved block stays where it was put', () => {
  const tasks = [task(2, '2026-10-09', 150)];
  const first = plan({ tasks });
  const blocks = applied(first);
  blocks[0].done = true;
  blocks[1].pinned = true; blocks[1].date = '2026-10-08'; blocks[1].start = '19:00';
  // The task's done minutes come from its done blocks.
  const again = plan({ tasks: [task(2, '2026-10-09', 150, { doneMin: blocks[0].minutes })], blocks });
  const done = again.blocks.find((b) => b.key === blocks[0].key);
  assert.equal(done.kept, 'done');
  const moved = again.blocks.find((b) => b.key === blocks[1].key);
  assert.deepEqual([moved.kept, moved.date, moved.start], ['pinned', '2026-10-08', '19:00']);
  assert.equal(moved.reason, 'You moved this one');
  const total = again.blocks.filter((b) => !b.kept).reduce((s, b) => s + b.minutes, 0);
  assert.equal(total + blocks[0].minutes + blocks[1].minutes, 150);
  assert.equal(new Set(again.blocks.map((b) => b.key)).size, again.blocks.length);
});

test('a missed block is planned again under the same id, and says where it was', () => {
  const tasks = [task(1, '2026-10-09', 45)];
  const first = plan({ today: '2026-10-05', tasks });
  // Two days later, Monday's block was never done.
  const again = clone(W.propose({ today: '2026-10-07', nowMin: 600, maxPerDay: 120, tasks, blocks: applied(first) }));
  assert.equal(again.blocks.length, 1);
  assert.equal(again.blocks[0].id, 5000);
  assert.equal(again.blocks[0].key, first.blocks[0].key);
  assert.equal(again.blocks[0].date, '2026-10-07');
  assert.deepEqual(again.blocks[0].was, { date: '2026-10-05', start: '16:00', minutes: 45, missed: true });
});

test('blocks a task no longer needs are dropped; never a done one', () => {
  const first = plan({ tasks: [task(1, '2026-10-09', 90)] });
  const blocks = applied(first);
  blocks[0].done = true;
  const again = plan({ tasks: [], blocks });
  assert.deepEqual(again.drop.map((d) => d.key), [blocks[1].key]);
  assert.deepEqual(again.blocks.map((b) => [b.key, b.kept]), [[blocks[0].key, 'done']]);
});

test('a new block for a task gets a key after its existing ones', () => {
  const first = plan({ tasks: [task(1, '2026-10-09', 45)] });
  const again = plan({ tasks: [task(1, '2026-10-09', 120)], blocks: applied(first) });
  const keys = again.blocks.map((b) => b.key).sort();
  assert.deepEqual(keys, ['1:1', '1:2']);
  assert.equal(again.blocks.filter((b) => b.isNew).length, 1);
});

test('a block that lands where it already was keeps its id, even when an earlier one is new', () => {
  // Thursday's block is already there; another was taken out. Planning again
  // (Monday and Tuesday full) adds one on Wednesday, before it — Thursday's
  // stays Thursday's rather than "moving" to Wednesday.
  const tasks = [task(1, '2026-10-09', 90)];
  const thu = { id: 7001, key: '1:2', taskId: 1, date: '2026-10-08', start: '16:00', minutes: 45, done: false, pinned: false };
  const r = plan({ tasks, blocks: [thu], load: { '2026-10-05': 120, '2026-10-06': 120 } });
  assert.deepEqual(of(r, 1), [['2026-10-07', '16:00', 45], ['2026-10-08', '16:00', 45]]);
  const kept = r.blocks.find((b) => b.id === 7001);
  assert.deepEqual([kept.date, kept.start, kept.was], ['2026-10-08', '16:00', null]);
  assert.deepEqual(r.blocks.filter((b) => b.isNew).map((b) => b.key), ['1:3']);
});

test('a block happening right now is left alone', () => {
  const first = plan({ tasks: [task(1, '2026-10-06', 45)] });
  const again = plan({ nowMin: 16 * 60 + 15, tasks: [task(1, '2026-10-06', 45)], blocks: applied(first) });
  assert.deepEqual(again.blocks.map((b) => [b.start, b.kept]), [['16:00', 'live']]);
});

test('classMeets: every day, A/B days, named days, never weekends', () => {
  assert.equal(W.classMeets({ days: '' }, '2026-10-05', ''), true);
  assert.equal(W.classMeets({ days: 'Mon-Fri' }, '2026-10-10', ''), false); // Saturday
  assert.equal(W.classMeets({ days: 'A Day' }, '2026-10-05', 'A'), true);
  assert.equal(W.classMeets({ days: 'A Day' }, '2026-10-05', 'B'), false);
  assert.equal(W.classMeets({ days: 'B Day' }, '2026-10-05', ''), true); // no cycle set up: keep the time clear
  assert.equal(W.classMeets({ days: 'Mon/Wed/Fri' }, '2026-10-07', ''), true);
  assert.equal(W.classMeets({ days: 'Tue/Thu' }, '2026-10-07', ''), false);
  assert.equal(W.classMeets({ days: 'Thu' }, '2026-10-08', ''), true);
});

test('defaultAvail: half an hour after the last class, else 4 PM; Saturday off', () => {
  const a = clone(W.defaultAvail([{ timeEnd: '14:50' }, { timeEnd: '15:10' }]));
  assert.deepEqual(a[1], { on: true, start: '15:45', end: '21:00' });
  assert.equal(a[6].on, false);
  assert.deepEqual(clone(W.defaultAvail([]))[3], { on: true, start: '16:00', end: '21:00' });
});

test('warnings for a block the student moved', () => {
  const r = plan({ tasks: [task(1, '2026-10-07', 45)], commitments: { '2026-10-06': [{ start: '17:00', end: '18:00', label: 'Soccer' }] } });
  const tue = r.days[1];
  const b = { key: 'x', date: '2026-10-06', start: '17:30', minutes: 45, due: '2026-10-07' };
  assert.deepEqual(clone(W.warnings(b, tue, [], 120, '2026-10-05')), ['Clashes with Soccer']);
  const late = { key: 'y', date: '2026-10-09', start: '16:00', minutes: 45, due: '2026-10-07' };
  assert.deepEqual(clone(W.warnings(late, r.days[4], [], 120, '2026-10-05')), ['After it’s due']);
  const early = { key: 'z', date: '2026-10-06', start: '07:00', minutes: 30, due: '2026-10-07' };
  assert.deepEqual(clone(W.warnings(early, tue, [{ key: 'q', start: '16:00', minutes: 100 }], 120, '2026-10-05')), ['Outside your study time', 'Over your daily limit']);
});

test('nothing to plan gives an empty week, not an error', () => {
  const r = plan({ tasks: [] });
  assert.equal(r.blocks.length, 0);
  assert.equal(r.days.length, 7);
  assert.deepEqual(clone(W.propose({ today: 'soon' })).days, []);
});
