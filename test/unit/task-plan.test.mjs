import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

/**
 * flux-task-plan.js — "Plan it out": a big task spread over the days before
 * it is due. Dates here are fixed: Monday 5 October 2026 to the week after.
 */
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(readFileSync(new URL('../../public/js/flux-task-plan.js', import.meta.url), 'utf8'), sandbox);
const P = sandbox.window.FluxTaskPlan;
const plan = (o) => JSON.parse(JSON.stringify(P.plan(o)));
const sum = (s) => s.reduce((t, x) => t + x.minutes, 0);

test('an essay due next Monday: weekdays only, under the daily limit, finished the day before', () => {
  const r = plan({ totalMin: 240, start: '2026-10-05', due: '2026-10-12', maxPerDay: 60, skipWeekends: true, steps: P.stepsFor('essay') });
  assert.deepEqual(r.sessions.map((s) => s.date), ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09']);
  assert.equal(sum(r.sessions), 240);
  assert.ok(r.sessions.every((s) => s.minutes % 5 === 0 && s.minutes <= 60));
  assert.equal(r.tight, false);
  assert.equal(r.sessions[0].label, 'Research and notes');
  assert.match(r.sessions[r.sessions.length - 1].label, /read-through/);
  assert.deepEqual(r.sessions.map((s) => s.part + '/' + s.of), ['1/5', '2/5', '3/5', '4/5', '5/5']);
});

test('a little work over many days is spread out, not crammed at the start or the end', () => {
  const r = plan({ totalMin: 60, start: '2026-10-05', due: '2026-10-15', maxPerDay: 60 });
  assert.equal(r.sessions.length, 3);
  assert.deepEqual(r.sessions.map((s) => s.date), ['2026-10-05', '2026-10-10', '2026-10-14']);
  assert.ok(r.sessions.every((s) => s.minutes === 20));
});

test('due tomorrow: one session today, over the limit if it must be, and it says so', () => {
  const r = plan({ totalMin: 120, start: '2026-10-05', due: '2026-10-06', maxPerDay: 60 });
  assert.deepEqual(r.sessions.map((s) => [s.date, s.minutes]), [['2026-10-05', 120]]);
  assert.equal(r.tight, true);
});

test('due today: the work still lands today', () => {
  const r = plan({ totalMin: 45, start: '2026-10-05', due: '2026-10-05', maxPerDay: 60 });
  assert.deepEqual(r.sessions.map((s) => [s.date, s.minutes]), [['2026-10-05', 45]]);
});

test('a day already full of other work and a rest day are passed over', () => {
  const r = plan({
    totalMin: 120, start: '2026-10-05', due: '2026-10-09', maxPerDay: 60,
    busy: (d) => (d === '2026-10-06' ? 60 : 0),
    skip: (d) => d === '2026-10-07',
  });
  assert.deepEqual(r.sessions.map((s) => s.date), ['2026-10-05', '2026-10-08']);
  assert.equal(sum(r.sessions), 120);
});

test('only weekends left: they are used rather than planning nothing', () => {
  const r = plan({ totalMin: 60, start: '2026-10-10', due: '2026-10-12', maxPerDay: 60, skipWeekends: true });
  assert.deepEqual(r.sessions.map((s) => s.date), ['2026-10-10', '2026-10-11']);
});

test('a task\'s own sub-tasks name the sessions, in order', () => {
  const steps = P.stepsFor('hw', [{ text: 'Questions 1-10' }, { text: 'Questions 11-20' }, { text: 'Check answers' }]);
  const r = plan({ totalMin: 90, start: '2026-10-05', due: '2026-10-08', maxPerDay: 60, steps });
  assert.deepEqual(r.sessions.map((s) => s.label), ['Questions 1-10', 'Questions 11-20', 'Check answers']);
});

test('more work than the days can hold: every day goes over evenly, and the plan still ends on time', () => {
  const r = plan({ totalMin: 300, start: '2026-10-05', due: '2026-10-08', maxPerDay: 60 });
  assert.equal(r.sessions.length, 3);
  assert.equal(sum(r.sessions), 300);
  assert.ok(r.sessions.every((s) => s.minutes === 100));
  assert.equal(r.tight, true);
});

test('nothing to plan gives nothing', () => {
  assert.deepEqual(plan({ totalMin: 0, start: '2026-10-05', due: '2026-10-09' }).sessions, []);
  assert.deepEqual(plan({ totalMin: 60, start: 'soon', due: '2026-10-09' }).sessions, []);
});
