/* ════════════════════════════════════════════════════════════════════════════
 * Flux AI Planner Skills — Akiflow-class planning brain for the agent loop.
 *
 * Registers eight tools into window.FluxAgentLoop so Flux AI can do everything
 * Akiflow's assistant does (and then some): auto time-block the day, find free
 * slots, bulk-rescue overdue work, smart-snooze, natural-language capture,
 * focus blocks, daily shutdown and weekly review rituals.
 *
 * Time-blocking writes optional planStart/planEnd ("HH:MM") onto tasks —
 * additive fields; nothing else in the app is required to know about them.
 * Depends on app.js globals (tasks, save, syncKey, render*) — all guarded,
 * same pattern as flux-agent-loop.js.
 * ──────────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  const haveTasks = () => typeof tasks !== 'undefined' && Array.isArray(tasks);
  const todayISO = () => (typeof todayStr === 'function' ? todayStr() : new Date().toISOString().slice(0, 10));
  const addDaysISO = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  const hm = (mins) => `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
  const row = (t) => ({ id: t.id, name: t.name, date: t.date || '', priority: t.priority || 'med', estTime: t.estTime || 0, planStart: t.planStart || '', planEnd: t.planEnd || '', done: !!t.done });

  function persist() {
    try { save('tasks', tasks); } catch (e) {}
    try { if (typeof syncKey === 'function') syncKey('tasks', tasks); } catch (e) {}
    try { if (typeof renderTasks === 'function') renderTasks(); } catch (e) {}
    try { if (typeof renderCalendar === 'function') renderCalendar(); } catch (e) {}
  }
  function findTask(ref) {
    if (!haveTasks() || ref == null) return null;
    const byId = tasks.find((t) => String(t.id) === String(ref));
    if (byId) return byId;
    const q = String(ref).toLowerCase();
    return tasks.find((t) => !t.done && (t.name || '').toLowerCase().includes(q)) || null;
  }
  const prioRank = { high: 0, med: 1, low: 2 };

  /* Busy intervals today (minutes since midnight) from planned tasks. */
  function busyToday() {
    if (!haveTasks()) return [];
    const today = todayISO();
    return tasks
      .filter((t) => !t.done && t.date === today && t.planStart && t.planEnd)
      .map((t) => [t.planStart, t.planEnd].map((s) => (+s.slice(0, 2)) * 60 + (+s.slice(3, 5))))
      .sort((a, b) => a[0] - b[0]);
  }
  function freeSlots(fromMin, untilMin, minLen) {
    const busy = busyToday();
    const out = [];
    let cursor = fromMin;
    for (const [s, e] of busy) {
      if (s - cursor >= minLen) out.push([cursor, s]);
      cursor = Math.max(cursor, e);
    }
    if (untilMin - cursor >= minLen) out.push([cursor, untilMin]);
    return out;
  }

  const SKILLS = {
    planMyDay: {
      def: {
        description: 'Auto time-block today: assigns planStart/planEnd to today\'s (and optionally overdue) unfinished tasks in priority order, from now until endHour (default 21). Returns the built schedule.',
        params: '{includeOverdue?,endHour?,breakMins?}',
      },
      run(a) {
        if (!haveTasks()) return { ok: false, error: 'tasks unavailable' };
        a = a || {};
        const today = todayISO();
        const now = new Date();
        let cursor = Math.max(now.getHours() * 60 + now.getMinutes() + 5, 7 * 60);
        const end = Math.min(Math.max(+a.endHour || 21, 8), 24) * 60;
        const gap = Math.max(+a.breakMins || 10, 0);
        const pool = tasks
          .filter((t) => !t.done && (t.date === today || (a.includeOverdue && t.date && t.date < today)))
          .sort((x, y) => (prioRank[x.priority] ?? 1) - (prioRank[y.priority] ?? 1) || (y.urgencyScore || 0) - (x.urgencyScore || 0));
        const planned = [];
        const unplaced = [];
        for (const t of pool) {
          const len = Math.min(Math.max(+t.estTime || 30, 10), 240);
          if (cursor + len > end) { unplaced.push(t.name); continue; }
          t.planStart = hm(cursor);
          t.planEnd = hm(cursor + len);
          if (t.date < today) t.date = today;
          planned.push(row(t));
          cursor += len + gap;
        }
        if (planned.length) persist();
        return { ok: true, planned, unplaced, note: planned.length ? 'Times written to planStart/planEnd on each task.' : 'Nothing to plan.' };
      },
    },

    findFreeSlots: {
      def: {
        description: 'List free time slots today between now and endHour (default 21), skipping already time-blocked tasks. minMins filters short gaps (default 25).',
        params: '{endHour?,minMins?}',
      },
      run(a) {
        a = a || {};
        const now = new Date();
        const from = now.getHours() * 60 + now.getMinutes();
        const until = Math.min(Math.max(+a.endHour || 21, 8), 24) * 60;
        const minLen = Math.max(+a.minMins || 25, 5);
        const slots = freeSlots(from, until, minLen).map(([s, e]) => ({ start: hm(s), end: hm(e), mins: e - s }));
        return { ok: true, slots, totalFreeMins: slots.reduce((n, s) => n + s.mins, 0) };
      },
    },

    rescheduleOverdue: {
      def: {
        description: 'Rescue overdue tasks: move every unfinished task dated before today to a new date. to: "today" (default) | "tomorrow" | YYYY-MM-DD. Optional limit.',
        params: '{to?,limit?}',
      },
      run(a) {
        if (!haveTasks()) return { ok: false, error: 'tasks unavailable' };
        a = a || {};
        const today = todayISO();
        const to = a.to === 'tomorrow' ? addDaysISO(1) : (/^\d{4}-\d{2}-\d{2}$/.test(a.to || '') ? a.to : today);
        const overdue = tasks.filter((t) => !t.done && t.date && t.date < today);
        const moved = overdue.slice(0, Math.min(Math.max(+a.limit || 50, 1), 100));
        moved.forEach((t) => { t.date = to; t.rescheduled = (t.rescheduled || 0) + 1; });
        if (moved.length) persist();
        return { ok: true, movedCount: moved.length, to, tasks: moved.map(row) };
      },
    },

    smartSnooze: {
      def: {
        description: 'Snooze one task (by id or fuzzy name). until: "tonight" | "tomorrow" (default) | "weekend" | "nextweek" | YYYY-MM-DD. Clears its time block.',
        params: '{id|name,until?}',
      },
      run(a) {
        const t = findTask(a && (a.id != null ? a.id : a.name));
        if (!t) return { ok: false, error: 'task not found' };
        const u = (a && a.until) || 'tomorrow';
        const day = new Date().getDay();
        if (u === 'tonight') { t.planStart = '19:00'; t.planEnd = hm(19 * 60 + Math.min(Math.max(+t.estTime || 30, 10), 240)); t.date = todayISO(); }
        else if (u === 'weekend') t.date = addDaysISO(((6 - day) + 7) % 7 || 7);
        else if (u === 'nextweek') t.date = addDaysISO(((8 - day) % 7) || 7);
        else if (/^\d{4}-\d{2}-\d{2}$/.test(u)) t.date = u;
        else t.date = addDaysISO(1);
        if (u !== 'tonight') { delete t.planStart; delete t.planEnd; }
        persist();
        return { ok: true, task: row(t) };
      },
    },

    quickCapture: {
      def: {
        description: 'Natural-language task capture, Akiflow command-bar style. Parses date words (today/tomorrow/mon..sun/"next week"), time ("3pm", "15:30"), duration ("45m","1h"), priority ("!high"/"urgent"/"!low"), subject ("#biology") out of one string and creates the task.',
        params: '{text}',
      },
      run(a) {
        if (!haveTasks()) return { ok: false, error: 'tasks unavailable' };
        let s = String((a && a.text) || '').trim();
        if (!s) return { ok: false, error: 'text required' };
        const t = { id: Date.now() + Math.random(), priority: 'med', subject: '', type: 'hw', estTime: 0, notes: '', subtasks: [], done: false, rescheduled: 0, createdAt: Date.now(), date: '' };
        const eat = (re, fn) => { const m = s.match(re); if (m) { fn(m); s = s.replace(re, ' '); } };
        eat(/#(\w[\w-]*)/, (m) => { t.subject = m[1]; });
        eat(/!(high|low|med)\b/i, (m) => { t.priority = m[1].toLowerCase(); });
        eat(/\b(urgent|asap)\b/i, () => { t.priority = 'high'; });
        eat(/\b(\d+(?:\.\d+)?)\s*h(?:ours?)?\b/i, (m) => { t.estTime = Math.round(+m[1] * 60); });
        eat(/\b(\d+)\s*m(?:ins?|inutes?)?\b/i, (m) => { if (!t.estTime) t.estTime = +m[1]; });
        eat(/\btomorrow\b/i, () => { t.date = addDaysISO(1); });
        eat(/\btoday\b/i, () => { t.date = todayISO(); });
        eat(/\bnext week\b/i, () => { const d = new Date().getDay(); t.date = addDaysISO(((8 - d) % 7) || 7); });
        eat(/\b(?:on |by )?(mon|tue|wed|thu|fri|sat|sun)[a-z]*\b/i, (m) => {
          const idx = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(m[1].toLowerCase());
          const diff = ((idx - new Date().getDay()) + 7) % 7 || 7;
          t.date = addDaysISO(diff);
        });
        eat(/\b(\d{4}-\d{2}-\d{2})\b/, (m) => { t.date = m[1]; });
        eat(/\b(?:at )?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i, (m) => {
          let h = +m[1] % 12; if (m[3].toLowerCase() === 'pm') h += 12;
          const start = h * 60 + (+(m[2] || 0));
          t.planStart = hm(start); t.planEnd = hm(start + (t.estTime || 30));
          if (!t.date) t.date = todayISO();
        });
        t.name = s.replace(/\s+/g, ' ').trim().slice(0, 200) || 'New task';
        try { if (typeof calcUrgency === 'function') t.urgencyScore = calcUrgency(t); } catch (e) {}
        tasks.unshift(t);
        persist();
        return { ok: true, task: row(t), parsed: { subject: t.subject, priority: t.priority, estTime: t.estTime } };
      },
    },

    createFocusBlock: {
      def: {
        description: 'Reserve a deep-work block today: creates a "Focus" task time-blocked into the next free slot that fits mins (default 50). Optional label.',
        params: '{mins?,label?}',
      },
      run(a) {
        if (!haveTasks()) return { ok: false, error: 'tasks unavailable' };
        a = a || {};
        const mins = Math.min(Math.max(+a.mins || 50, 15), 180);
        const now = new Date();
        const from = now.getHours() * 60 + now.getMinutes() + 5;
        const slot = freeSlots(from, 22 * 60, mins)[0];
        if (!slot) return { ok: false, error: 'no free slot big enough today' };
        const t = {
          id: Date.now() + Math.random(), name: (a.label ? String(a.label).slice(0, 120) : 'Focus block'),
          date: todayISO(), priority: 'high', subject: '', type: 'other', estTime: mins,
          planStart: hm(slot[0]), planEnd: hm(slot[0] + mins),
          notes: 'Deep-work block reserved by Flux AI.', subtasks: [], done: false, rescheduled: 0, createdAt: Date.now(),
        };
        tasks.unshift(t);
        persist();
        return { ok: true, task: row(t) };
      },
    },

    dailyShutdown: {
      def: {
        description: 'Akiflow-style end-of-day ritual data: what got done today, what is left (with suggestion to snooze or plan), and tomorrow\'s top three.',
        params: '{}',
      },
      run() {
        if (!haveTasks()) return { ok: false, error: 'tasks unavailable' };
        const today = todayISO();
        const tomorrow = addDaysISO(1);
        const doneToday = tasks.filter((t) => t.done && t.completedAt && new Date(t.completedAt).toISOString().slice(0, 10) === today);
        const leftToday = tasks.filter((t) => !t.done && t.date === today);
        const overdue = tasks.filter((t) => !t.done && t.date && t.date < today);
        const tomorrowTop = tasks.filter((t) => !t.done && t.date === tomorrow)
          .sort((x, y) => (prioRank[x.priority] ?? 1) - (prioRank[y.priority] ?? 1)).slice(0, 3);
        return {
          ok: true,
          doneTodayCount: doneToday.length,
          doneToday: doneToday.slice(0, 10).map((t) => t.name),
          leftToday: leftToday.map(row),
          overdueCount: overdue.length,
          tomorrowTop: tomorrowTop.map(row),
        };
      },
    },

    weeklyReview: {
      def: {
        description: 'Weekly review data: completed vs added over the past 7 days, per-subject completion counts, overdue backlog, and next-7-days load in minutes.',
        params: '{}',
      },
      run() {
        if (!haveTasks()) return { ok: false, error: 'tasks unavailable' };
        const today = todayISO();
        const weekAgo = Date.now() - 7 * 864e5;
        const next7 = addDaysISO(7);
        const done7 = tasks.filter((t) => t.done && t.completedAt && t.completedAt >= weekAgo);
        const added7 = tasks.filter((t) => t.createdAt && t.createdAt >= weekAgo);
        const bySubject = {};
        done7.forEach((t) => { const k = t.subject || '(none)'; bySubject[k] = (bySubject[k] || 0) + 1; });
        const upcoming = tasks.filter((t) => !t.done && t.date && t.date >= today && t.date <= next7);
        return {
          ok: true,
          completedLast7: done7.length,
          addedLast7: added7.length,
          completedBySubject: bySubject,
          overdueBacklog: tasks.filter((t) => !t.done && t.date && t.date < today).length,
          next7DayTaskCount: upcoming.length,
          next7DayMinutes: upcoming.reduce((n, t) => n + (+t.estTime || 0), 0),
        };
      },
    },
  };

  /* Register once FluxAgentLoop exists (script order independent). */
  let tries = 0;
  const reg = setInterval(() => {
    tries += 1;
    const AL = window.FluxAgentLoop;
    if (AL && typeof AL.registerTool === 'function') {
      Object.entries(SKILLS).forEach(([name, s]) => AL.registerTool(name, s.def, s.run));
      clearInterval(reg);
      window.FluxPlannerSkills = { names: Object.keys(SKILLS) };
    }
    if (tries > 60) clearInterval(reg);
  }, 500);
})();
