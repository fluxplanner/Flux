/* ============================================================================
   FLUX · PLAN MY WEEK  ·  flux-week-plan.js
   The next seven days of study: what to work on, which day, what time, and
   why. Plan it out (flux-task-plan.js) spreads ONE task over the days before
   it is due; this fits ALL the open work into the week around everything
   else the student has on.

   Pure: no DOM, no storage, no clock. The dialog (flux-week-plan-ui.js) reads
   the planner — tasks, classes, calendar events, rest days, the study time
   the student confirms — and hands it over as plain data. Same inputs, same
   plan, every time.

     propose(o) → { days, blocks, unscheduled, planned, later, drop }

   The rules, in order:
     · Study happens inside the student's study hours, around classes and
       calendar events, never on a rest day and never past the daily limit.
     · Overdue work goes first, then by due date (high priority first when
       two are due the same day).
     · Work ends the day before it is due. The due day is used only when it
       is due today, or when there is no room at all before it.
     · Work due after this week gets this week's fair share, so it still
       finishes on time. Less than a short block's worth waits.
     · No estimate: the usual time for that kind of task, and the reason
       says so.
     · Each task is split into blocks of at most an hour, on the emptiest days
       it can go on, one a day while there are days to spare.
     · Blocks already done stay. Blocks the student moved stay where they put
       them. The rest are planned again and keep their ids, so planning twice
       changes nothing and never makes a second copy of a block.
   ========================================================================== */
(function () {
  'use strict';

  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  /* Minutes to plan when a task has no estimate. Smaller than Plan it out's
     (those are a whole project); homework matches the dashboard's ~30 min. */
  const DEFAULT_MIN = { hw: 30, reading: 30, other: 30, quiz: 45, lab: 60, test: 90, essay: 120, project: 120 };
  const PRI = { high: 0, med: 1, low: 2 };
  // Mon–Fri after school, Saturday off, Sunday afternoon. Only ever a starting
  // point: the dialog says so and the student changes it.
  const DEFAULT_DAY = { on: true, start: '16:00', end: '21:00' };
  const DEFAULT_WEEK = [
    { on: true, start: '14:00', end: '19:00' },
    DEFAULT_DAY, DEFAULT_DAY, DEFAULT_DAY, DEFAULT_DAY, DEFAULT_DAY,
    { on: false, start: '10:00', end: '17:00' },
  ];

  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function parse(ymd) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ''));
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function fmt(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function addDays(ymd, n) { const d = parse(ymd); d.setDate(d.getDate() + n); return fmt(d); }
  function daysBetween(a, b) { return Math.round((parse(b) - parse(a)) / 864e5); }
  /** "16:30" → 990. Anything else → null. */
  function toMin(hm) {
    if (typeof hm === 'number' && isFinite(hm)) return Math.max(0, Math.min(1440, Math.round(hm)));
    const m = /^(\d{1,2}):(\d{2})/.exec(String(hm || ''));
    if (!m || +m[1] > 24 || +m[2] > 59) return null;
    return Math.min(1440, +m[1] * 60 + +m[2]);
  }
  function toHM(min) { const m = Math.max(0, Math.min(1439, Math.round(min))); return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }
  /** 900 → "3:00 PM". */
  function clock(min) { const hh = Math.floor(min / 60) % 24; return (hh % 12 || 12) + ':' + pad(min % 60) + ' ' + (hh >= 12 ? 'PM' : 'AM'); }
  const up = (m, step) => Math.ceil(m / step) * step;
  const r5 = (m) => Math.round(m / 5) * 5;
  const cmpBlock = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (toMin(a.start) || 0) - (toMin(b.start) || 0));

  /** "today", "tomorrow", "Thu" within the week, else "Oct 19". */
  function dayWord(ymd, today) {
    const d = daysBetween(today, ymd);
    if (d === 0) return 'today';
    if (d === 1) return 'tomorrow';
    if (d === -1) return 'yesterday';
    const p = parse(ymd);
    if (d > 1 && d < 7) return DOW[p.getDay()];
    return MON[p.getMonth()] + ' ' + p.getDate();
  }
  const cap1 = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  /** "Due Thu", "Due today", "Overdue since yesterday". */
  function dueLead(date, today) {
    const d = daysBetween(today, date);
    return d < 0 ? 'Overdue since ' + dayWord(date, today) : d === 0 ? 'Due today' : 'Due ' + dayWord(date, today);
  }

  /** Study hours for each weekday (0 = Sunday), filling gaps with the defaults. */
  function normAvail(a) {
    return DEFAULT_WEEK.map((def, wd) => {
      const x = Array.isArray(a) ? a[wd] : null;
      if (!x || typeof x !== 'object') return { on: def.on, start: def.start, end: def.end };
      const s = toMin(x.start), e = toMin(x.end);
      return { on: x.on !== false, start: s == null ? def.start : toHM(s), end: e == null ? def.end : (e >= 1440 ? '23:59' : toHM(e)) };
    });
  }

  /** Suggested study hours: after the last class ends (half an hour later), else 4 PM. */
  function defaultAvail(classes) {
    let last = null;
    (classes || []).forEach((c) => {
      const e = toMin(c && c.timeEnd);
      if (e != null && e < 20 * 60 && (last == null || e > last)) last = e;
    });
    const start = last == null ? '16:00' : toHM(Math.min(18 * 60, Math.max(15 * 60, up(last + 30, 15))));
    return normAvail(null).map((d, wd) => (wd >= 1 && wd <= 5 ? { on: true, start, end: d.end } : d));
  }

  /** Does a class meet on this date? Weekdays only. An A/B class meets when the
      cycle says so; with no cycle set up it is assumed to (better to keep the
      time clear than double-book it). */
  function classMeets(c, ymd, cycleLabel) {
    const p = parse(ymd);
    if (!c || !p) return false;
    const wd = p.getDay();
    if (wd === 0 || wd === 6) return false;
    const days = String(c.days || '').trim();
    if (!days || /mon\s*-\s*fri/i.test(days)) return true;
    const ab = /^([A-Za-z0-9]+)\s+Day$/i.exec(days);
    if (ab) return !cycleLabel || String(cycleLabel).toUpperCase() === ab[1].toUpperCase();
    return days.split(/[\/,\s]+/).some((d) => d.slice(0, 3).toLowerCase() === DOW[wd].toLowerCase());
  }

  /** A commitment as minutes. No start → it can't block time (null). No end →
      an hour, marked as assumed. */
  function normBusy(b) {
    if (!b) return null;
    const s = toMin(b.start);
    if (s == null) return null;
    let e = toMin(b.end);
    const assumed = e == null || e <= s;
    if (assumed) e = Math.min(1440, s + 60);
    return { start: s, end: e, label: String(b.label || 'Busy'), assumed: assumed };
  }

  /** Free [start,end) ranges of a window once the busy ranges are taken out. */
  function freeRanges(win, busy) {
    let out = win ? [{ start: win.start, end: win.end }] : [];
    busy.forEach((b) => {
      const next = [];
      out.forEach((r) => {
        if (b.end <= r.start || b.start >= r.end) { next.push(r); return; }
        if (b.start > r.start) next.push({ start: r.start, end: b.start });
        if (b.end < r.end) next.push({ start: b.end, end: r.end });
      });
      out = next;
    });
    return out.filter((r) => r.end - r.start >= 5);
  }

  function seqOf(key) { const m = /:(\d+)$/.exec(String(key || '')); return m ? +m[1] : 0; }

  function propose(o) {
    o = o || {};
    const today = o.today;
    if (!parse(today)) return { days: [], blocks: [], unscheduled: [], planned: [], later: [], drop: [] };
    const N = Math.max(1, Math.min(14, Math.round(+o.days || 7)));
    const last = addDays(today, N - 1);
    const maxPerDay = Math.max(15, Math.round(+o.maxPerDay || 120));
    const minBlock = Math.max(5, +o.minBlock || 20);
    const maxBlock = Math.max(minBlock, +o.maxBlock || 60);
    const gap = o.gap != null ? Math.max(0, +o.gap) : 10;
    const avail = normAvail(o.avail);
    const rest = new Set(o.rest || []);
    const commits = o.commitments || {};
    const load = o.load || {};
    const nowMin = toMin(o.nowMin);

    const days = [];
    for (let i = 0; i < N; i++) {
      const date = addDays(today, i);
      const wd = parse(date).getDay(), a = avail[wd];
      const isRest = rest.has(date);
      let s = toMin(a.start), e = toMin(a.end);
      const off = !a.on || s == null || e == null || e - s < 5;
      // Today: nothing in the past, and a few minutes to get going.
      if (i === 0 && nowMin != null && s != null) s = Math.max(s, up(nowMin + gap, 15));
      const win = !off && !isRest && e - s >= 5 ? { start: s, end: e } : null;
      days.push({
        date: date, wd: wd, label: DOW[wd], rest: isRest, off: off, win: win,
        busy: (commits[date] || []).map(normBusy).filter(Boolean),
        cap: off || isRest ? 0 : Math.max(0, maxPerDay - Math.max(0, +load[date] || 0)),
        used: 0, blocks: [],
      });
    }
    const dayOf = (date) => days.find((d) => d.date === date) || null;
    // Every taken range on a day, padded by the gap so blocks get a breather.
    const taken = (day) => day.busy.concat(day.blocks.map((b) => ({ start: b.s, end: b.s + b.minutes })))
      .map((r) => ({ start: r.start - gap, end: r.end + gap }));
    // `endBy`: on the day something is due, finish before its due time.
    const ranges = (day, endBy) => freeRanges(day.win && endBy != null ? { start: day.win.start, end: Math.min(day.win.end, endBy - gap) } : day.win, taken(day));
    const roomOn = (day, endBy) => {
      const left = day.cap - day.used;
      if (left < 5) return 0;
      const big = ranges(day, endBy).reduce((m, r) => Math.max(m, r.end - up(r.start, 15)), 0);
      return Math.max(0, Math.min(left, big));
    };
    const slotOn = (day, size, endBy) => {
      const r = ranges(day, endBy).find((x) => up(x.start, 15) + size <= x.end);
      return r ? up(r.start, 15) : null;
    };

    // Blocks from an earlier plan: done ones and moved ones stay put; the rest
    // are let go and planned again, handing their ids on.
    const byTask = {};
    const group = (tid) => byTask[tid] || (byTask[tid] = { keptMin: 0, released: [], maxSeq: 0 });
    (o.blocks || []).forEach((b) => {
      if (!b || !parse(b.date)) return;
      const g = group(String(b.taskId));
      g.maxSeq = Math.max(g.maxSeq, seqOf(b.key));
      const s = toMin(b.start), min = Math.max(0, Math.round(+b.minutes || 0));
      const day = dayOf(b.date);
      const keep = (why) => {
        if (!day || s == null) return;
        day.blocks.push({ key: b.key, id: b.id, taskId: b.taskId, name: b.name, s: s, minutes: min, kept: why, pinned: !!b.pinned });
        day.used += min;
      };
      if (b.done) { keep('done'); return; }
      const missed = b.date < today || (b.date === today && nowMin != null && s != null && s + min <= nowMin);
      const live = b.date === today && nowMin != null && s != null && s <= nowMin && nowMin < s + min;
      if (!missed && (b.pinned || live || b.date > last)) {
        g.keptMin += min;
        keep(live ? 'live' : 'pinned');
        return;
      }
      g.released.push({ id: b.id, key: b.key, date: b.date, start: b.start, minutes: min, missed: missed });
    });

    const unscheduled = [], planned = [], later = [], cands = [];
    (o.tasks || []).forEach((t) => {
      if (!t || t.done) return;
      if (t.planned) { planned.push({ taskId: t.id, name: t.name }); return; }
      if (!parse(t.date)) { unscheduled.push({ taskId: t.id, name: t.name, minutes: 0, reason: 'No due date yet. Add one and plan again.' }); return; }
      const est = +t.estTime > 0 ? Math.round(+t.estTime) : 0;
      const total = est || DEFAULT_MIN[t.type] || DEFAULT_MIN.other;
      const g = byTask[String(t.id)];
      const left = Math.max(0, total - Math.max(0, +t.doneMin || 0) - (g ? g.keptMin : 0));
      if (left < 5) return;
      const d = daysBetween(today, t.date);
      let need = left;
      if (t.date > last) {
        // This week's share of the days left before it is due.
        const share = left * N / Math.max(N, d);
        if (share < Math.min(minBlock, left)) { later.push({ taskId: t.id, name: t.name, date: t.date }); return; }
        need = Math.min(left, Math.max(5, r5(share)));
      }
      cands.push({ t: t, tid: String(t.id), d: d, est: est, total: total, left: left, need: need });
    });
    cands.sort((a, b) => (a.t.date < b.t.date ? -1 : a.t.date > b.t.date ? 1 : 0)
      || ((PRI[a.t.priority] != null ? PRI[a.t.priority] : 1) - (PRI[b.t.priority] != null ? PRI[b.t.priority] : 1))
      || (a.tid < b.tid ? -1 : a.tid > b.tid ? 1 : 0));

    const reasons = {};
    cands.forEach((c) => {
      const t = c.t;
      const dueBy = toMin(t.time);
      let elig = c.d < 0 ? days.slice() : c.d === 0 ? days.slice(0, 1) : days.filter((x) => x.date < t.date);
      let onDue = false;
      // No room before it is due: the due day itself, but only when the task
      // says what time it is due — otherwise after school is already too late.
      if (c.d > 0 && t.date <= last && dueBy != null && !elig.some((x) => roomOn(x) >= Math.min(c.need, minBlock))) {
        elig = days.filter((x) => x.date === t.date);
        onDue = true;
      }
      const endBy = (day) => (day.date === t.date ? dueBy : null);
      const urgent = c.d < 0;
      const mine = [];
      let left = c.need;
      for (let guard = 0; left >= 5 && guard < 60; guard++) {
        const parts = Math.max(1, Math.ceil(left / maxBlock));
        const want = parts === 1 ? left : Math.min(maxBlock, up(left / parts, 5));
        const floor = Math.min(want, minBlock);
        const opts = elig.map((day) => ({ day: day, room: roomOn(day, endBy(day)) })).filter((x) => x.room >= floor);
        if (!opts.length) break;
        // Late work as soon as possible, more than one block a day if need be;
        // the rest on the emptiest day it isn't on yet.
        const fresh = urgent ? [] : opts.filter((x) => !mine.some((b) => b.date === x.day.date));
        const pool = fresh.length ? fresh : opts;
        pool.sort((a, b) => (urgent ? 0 : a.day.used - b.day.used) || (a.day.date < b.day.date ? -1 : 1));
        const pick = pool[0].day, room = Math.floor(pool[0].room / 5) * 5;
        // The only day left takes as much as it can, not just an even share.
        const alone = !opts.some((x) => x.day !== pick);
        const size = alone ? Math.min(left, maxBlock, room) : Math.min(want, room);
        const s = slotOn(pick, size, endBy(pick));
        if (s == null || size < 5) break;
        const blk = { taskId: t.id, s: s, minutes: size, date: pick.date };
        pick.blocks.push(blk); pick.used += size;
        mine.push(blk);
        left -= size;
      }
      const placed = c.need - left;
      const lead = dueLead(t.date, today);
      if (mine.length) {
        const bits = [lead];
        if (!c.est) bits.push('no estimate, so ~' + c.total + ' min');
        if (c.need < c.left) bits.push(c.need + ' of ~' + c.left + ' min this week');
        else if (c.est) bits.push('~' + c.left + ' min left');
        const nd = new Set(mine.map((b) => b.date)).size;
        if (mine.length > 1) bits.push(nd > 1 ? 'split over ' + nd + ' days' : 'in ' + mine.length + ' blocks');
        if (onDue) bits.push('on the day it’s due (no room before)');
        reasons[c.tid] = { text: bits.join(', '), detail: bits.slice(1).join(', ') };
      }
      if (left >= 5) {
        const when = c.d < 0 ? 'this week' : c.d === 0 ? 'today' : 'before then';
        const timed = elig.filter((x) => x.win);
        let why;
        if (!elig.length || elig.every((x) => x.rest)) why = c.d === 0 ? 'today is a rest day' : 'there are only rest days ' + when;
        else if (!timed.length) why = 'there’s no study time ' + (elig.every((x) => x.off || x.rest) ? 'set ' : 'left ') + when;
        else if (timed.every((x) => x.cap - x.used < Math.min(left, minBlock))) why = 'your daily limit (' + maxPerDay + ' min) is used up ' + when;
        else why = 'there’s no free time left in your study hours ' + when;
        // Due today at a time before study time even starts: say that, not "no room".
        const early = !placed && c.d === 0 && dueBy != null && days[0].win && dueBy - gap <= days[0].win.start;
        unscheduled.push({
          taskId: t.id, name: t.name, minutes: left, of: c.need,
          reason: early ? 'Due today at ' + clock(dueBy) + ', before your study time starts.'
            : placed ? lead + '. Only ' + placed + ' of ' + c.need + ' min fit: ' + why + '.' : lead + ', and ' + why + '.',
        });
      }
    });

    // Hand the ids of let-go blocks on to the new ones, task by task, in time
    // order; a block that is no longer needed is dropped.
    const fresh = {};
    days.forEach((day) => day.blocks.forEach((b) => {
      if (b.kept) return;
      (fresh[String(b.taskId)] || (fresh[String(b.taskId)] = [])).push(b);
    }));
    const drop = [];
    Object.keys(byTask).forEach((tid) => { if (!fresh[tid]) fresh[tid] = []; });
    Object.keys(fresh).forEach((tid) => {
      const g = group(tid);
      const olds = g.released.slice().sort(cmpBlock);
      const news = fresh[tid].sort((a, b) => cmpBlock({ date: a.date, start: a.s }, { date: b.date, start: b.s }));
      const pair = (b, old) => {
        olds.splice(olds.indexOf(old), 1);
        b.id = old.id; b.key = old.key;
        const same = old.date === b.date && toMin(old.start) === b.s && old.minutes === b.minutes;
        b.was = same ? null : { date: old.date, start: old.start, minutes: old.minutes, missed: old.missed };
      };
      // A block landing where an old one already is keeps that one; the rest
      // take the old ones in time order.
      news.forEach((b) => { const old = olds.find((x) => x.date === b.date && toMin(x.start) === b.s); if (old) pair(b, old); });
      news.forEach((b) => {
        if (b.key) return;
        if (olds.length) pair(b, olds[0]);
        else { b.id = null; b.key = tid + ':' + (++g.maxSeq); b.was = null; b.isNew = true; }
      });
      olds.forEach((x) => drop.push({ id: x.id, key: x.key, taskId: tid, date: x.date, start: x.start, minutes: x.minutes, missed: x.missed }));
    });

    const names = {}, dues = {};
    (o.tasks || []).forEach((t) => { if (t) { names[String(t.id)] = t.name; dues[String(t.id)] = t.date; } });
    const blocks = [];
    days.forEach((day) => {
      day.blocks.sort((a, b) => a.s - b.s);
      day.blocks.forEach((b) => {
        const tid = String(b.taskId);
        blocks.push({
          key: b.key, id: b.id == null ? null : b.id, taskId: b.taskId, name: names[tid] || b.name || '', due: dues[tid] || '',
          date: day.date, start: toHM(b.s), end: toHM(b.s + b.minutes), minutes: b.minutes,
          kept: b.kept || null, pinned: !!b.pinned, isNew: !!b.isNew, was: b.was || null,
          reason: b.kept === 'done' ? 'Done' : b.kept === 'live' ? 'Happening now' : b.kept ? 'You moved this one' : (reasons[tid] ? reasons[tid].text : ''),
          // The reason after "Due Thu": that part stays true as the week goes on.
          detail: !b.kept && reasons[tid] ? reasons[tid].detail : null,
        });
      });
    });
    // "1 of 3": every block a task has this week, in time order.
    const per = {};
    blocks.forEach((b) => (per[String(b.taskId)] || (per[String(b.taskId)] = [])).push(b));
    Object.keys(per).forEach((tid) => per[tid].forEach((b, i, arr) => { b.part = i + 1; b.of = arr.length; }));

    return {
      days: days.map((d) => ({
        date: d.date, label: d.label, rest: d.rest, off: d.off, open: !!d.win,
        win: d.win ? { start: toHM(d.win.start), end: d.win.end >= 1440 ? '23:59' : toHM(d.win.end) } : null,
        cap: d.cap, used: d.used,
        busy: d.busy.map((b) => ({ start: toHM(b.start), end: toHM(b.end), label: b.label, assumed: b.assumed })),
      })),
      blocks: blocks, unscheduled: unscheduled, planned: planned, later: later, drop: drop,
      maxPerDay: maxPerDay,
    };
  }

  /** What is wrong with a block where the student has put it: nothing ([]), or
      short reasons — a clash, outside study hours, a rest day, after it's due,
      over the daily limit. `day` is one of propose()'s days; `others` the
      other blocks on it. Late work is late anyway, so it isn't warned about
      being after its due date. */
  function warnings(block, day, others, maxPerDay, today) {
    const out = [];
    const s = toMin(block && block.start), m = Math.max(0, +(block && block.minutes) || 0);
    if (!day || s == null) return out;
    const e = s + m;
    if (day.rest) out.push('That’s a rest day');
    else if (!day.win || s < toMin(day.win.start) || e > toMin(day.win.end)) out.push('Outside your study time');
    (day.busy || []).forEach((b) => { if (s < toMin(b.end) && e > toMin(b.start)) out.push('Clashes with ' + b.label); });
    if ((others || []).some((b) => b !== block && b.key !== block.key && s < toMin(b.start) + (+b.minutes || 0) && e > toMin(b.start))) out.push('Overlaps another block');
    if (block.due && block.date > block.due && !(today && block.due < today)) out.push('After it’s due');
    const total = (others || []).filter((b) => b !== block && b.key !== block.key).reduce((t, b) => t + (+b.minutes || 0), 0) + m;
    if (maxPerDay && total > maxPerDay) out.push('Over your daily limit');
    return out;
  }

  window.FluxWeekPlan = {
    propose: propose, warnings: warnings, classMeets: classMeets, defaultAvail: defaultAvail, normAvail: normAvail,
    toMin: toMin, toHM: toHM, addDays: addDays, dayWord: dayWord, dueLead: dueLead, DEFAULT_MIN: DEFAULT_MIN, cap1: cap1,
  };
})();
