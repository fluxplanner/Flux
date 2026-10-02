/* ============================================================================
   FLUX · PLAN IT OUT  ·  flux-task-plan.js
   Spread a big task over the days before it is due (Azfer, 2026-10-01:
   "break up assignments into pieces … tell you what to do every day to finish
   in time").

   Pure: no DOM, no storage. Given how long the work takes, the days there are
   and how much fits in a day, it says what to do on which day. The dialog in
   app.js asks the questions and turns each session into a task on its day.

     plan({ totalMin, start, due, maxPerDay, skipWeekends, skip, busy, steps })
       → { sessions: [{ date, minutes, label, part, of }], tight, days }

   The rules, in order:
     · Work ends the day before it is due, so the due day is a spare one. A
       task due today or tomorrow has no spare day and may use the due day.
     · Weekends (if asked) and the planner's rest days are skipped — unless
       that leaves nothing, in which case they are used after all.
     · A day already full of other work (less than a short session free) is
       passed over while there are other days.
     · Sessions are spread out across the days, not piled at the end, each at
       least `minChunk` minutes and no more than the daily limit where the
       days allow. When they cannot, `tight` says so and the extra goes on
       evenly — the plan still finishes on time.
     · Each session is named after the step of the work it covers.
   ========================================================================== */
(function () {
  'use strict';

  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function parse(ymd) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ''));
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function fmt(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function addDays(ymd, n) { const d = parse(ymd); d.setDate(d.getDate() + n); return fmt(d); }
  function weekend(ymd) { const g = parse(ymd).getDay(); return g === 0 || g === 6; }
  const round5 = (m) => Math.max(5, Math.round(m / 5) * 5);

  /* The steps a kind of task usually goes through, with how much of the time
     each one takes. A task's own sub-tasks, if it has any, beat these. */
  const TEMPLATES = {
    essay: [['Research and notes', 2], ['Outline', 1], ['Write the draft', 3], ['Revise', 2], ['Final read-through', 1]],
    project: [['Plan it', 1], ['Research', 2], ['Make it', 4], ['Polish', 2], ['Final check', 1]],
    test: [['Gather your notes', 1], ['Review the topics', 2], ['Practice questions', 3], ['Fix weak spots', 2], ['Light review', 1]],
    quiz: [['Review the topics', 2], ['Practice questions', 2], ['Quick check', 1]],
    lab: [['Read the method', 1], ['Data and results', 1], ['Analysis', 2], ['Write it up', 3], ['Check it', 1]],
    reading: [['Read', 1]],
  };
  const DEFAULT_MIN = { essay: 240, project: 360, test: 180, quiz: 90, lab: 180, reading: 120, hw: 90, other: 120 };

  /** Steps for a task: its sub-tasks if it has them, else its type's template. */
  function stepsFor(type, subtasks) {
    const own = (subtasks || []).map((s) => String((s && s.text) || s || '').trim()).filter(Boolean);
    if (own.length) return own.map((name) => ({ name: name, weight: 1 }));
    const t = TEMPLATES[type];
    if (t) return t.map((x) => ({ name: x[0], weight: x[1] }));
    return [{ name: 'Get started', weight: 1 }, { name: 'Keep going', weight: 2 }, { name: 'Finish and check', weight: 1 }];
  }
  function defaultMinutes(type) { return DEFAULT_MIN[type] || DEFAULT_MIN.other; }

  /** Name a session after the step it mostly covers ("Outline"), or both steps
      when it splits them about evenly ("Outline, then write the draft"). */
  function labelFor(steps, from, to, total) {
    if (steps.length === 1) return steps[0].name;
    const W = steps.reduce((s, x) => s + (x.weight > 0 ? x.weight : 1), 0);
    let at = 0;
    const cover = steps.map((x) => {
      const a = at, b = at + total * (x.weight > 0 ? x.weight : 1) / W;
      at = b;
      return { name: x.name, m: Math.max(0, Math.min(b, to) - Math.max(a, from)) };
    }).filter((c) => c.m > 0.5);
    if (!cover.length) return steps[steps.length - 1].name;
    const len = to - from;
    const big = cover.filter((c) => c.m >= len * 0.35);
    if (big.length >= 2) return big[0].name + ', then ' + big[1].name.charAt(0).toLowerCase() + big[1].name.slice(1);
    return cover.reduce((a, b) => (b.m > a.m ? b : a)).name;
  }

  function plan(o) {
    const total = Math.max(0, Math.round(+o.totalMin || 0));
    const minChunk = Math.max(5, +o.minChunk || 20);
    const maxPerDay = Math.max(minChunk, +o.maxPerDay || 60);
    const start = o.start, due = o.due;
    if (!total || !parse(start) || !parse(due)) return { sessions: [], tight: false, days: 0 };
    const skip = typeof o.skip === 'function' ? o.skip : () => false;
    const busy = typeof o.busy === 'function' ? o.busy : () => 0;
    const steps = o.steps && o.steps.length ? o.steps : [{ name: 'Work on it', weight: 1 }];

    // Every day from the start up to the day before it is due (the due day itself
    // when there is no day before it), never before the start.
    const last = due > start ? addDays(due, -1) : start;
    const all = [];
    for (let d = start; d <= last && all.length < 400; d = addDays(d, 1)) all.push(d);
    let days = all.filter((d) => !skip(d) && !(o.skipWeekends && weekend(d)));
    if (!days.length) days = all.slice();
    const cap = (d) => Math.max(0, maxPerDay - Math.max(0, +busy(d) || 0));
    const free = days.filter((d) => cap(d) >= minChunk);
    const pool = free.length ? free : days;

    // As many sessions as keep each one at least minChunk long, but at least
    // enough that none has to exceed the daily limit — spread evenly across
    // the days, starting with the first.
    let k = Math.min(pool.length, Math.max(1, Math.floor(total / minChunk)));
    k = Math.max(k, Math.min(pool.length, Math.ceil(total / maxPerDay)));
    const chosen = k === 1 ? [pool[0]] : Array.from({ length: k }, (_, i) => pool[Math.round(i * (pool.length - 1) / (k - 1))]);

    // Even shares, held to each day's room; what does not fit moves to days
    // with room left, and only then goes over the limit.
    const share = total / k;
    const alloc = chosen.map((d) => Math.min(cap(d), share));
    let left = total - alloc.reduce((s, m) => s + m, 0);
    for (let i = 0; i < k && left > 0.5; i++) {
      const room = cap(chosen[i]) - alloc[i];
      if (room > 0) { const add = Math.min(room, left); alloc[i] += add; left -= add; }
    }
    const over = left > 0.5;
    if (over) for (let i = 0; i < k; i++) alloc[i] += left / k;

    // Whole five-minute blocks that still add up to the total.
    const mins = alloc.map(round5);
    let diff = total - mins.reduce((s, m) => s + m, 0);
    for (let guard = 0; Math.abs(diff) >= 5 && guard < 400; guard++) {
      const i = diff > 0 ? mins.indexOf(Math.min.apply(null, mins)) : mins.indexOf(Math.max.apply(null, mins));
      if (diff < 0 && mins[i] <= 5) break;
      mins[i] += diff > 0 ? 5 : -5;
      diff += diff > 0 ? -5 : 5;
    }

    const planned = mins.reduce((s, m) => s + m, 0);
    let at = 0;
    const sessions = chosen.map((date, i) => {
      const from = at;
      at += mins[i];
      return { date: date, minutes: mins[i], label: labelFor(steps, from, at, planned), part: i + 1, of: k };
    });
    return { sessions: sessions, tight: over || Math.max.apply(null, mins) > maxPerDay + 4, days: all.length };
  }

  window.FluxTaskPlan = { plan: plan, stepsFor: stepsFor, defaultMinutes: defaultMinutes, addDays: addDays };
})();
