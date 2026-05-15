/**
 * Flux Planner — Behavior Engine
 *
 * Pure functions that compute behavioral signals (cognitive load,
 * momentum tier, friction aging, recovery mode, next-best-task).
 *
 * No DOM. No globals. Returns plain objects so callers can render
 * however they like (vanilla DOM in app.js, React in /web).
 *
 * Wired up via flux-kit-bootstrap.js → window.FluxKit.behavior, and
 * connected to the existing event bus in core/events.js so other
 * modules can subscribe to:
 *   - 'cognitive_load_shift'  (detail: {score, prev, level, breakdown})
 *   - 'task_momentum_gain'    (detail: {level, tier})
 *   - 'streak_decay_warning'  (detail: {streak, lastActiveAt, hoursIdle})
 *   - 'recovery_mode_enter'   (detail: {score})
 *   - 'recovery_mode_exit'    (detail: {score})
 */

import { emit } from './events.js';

// ─────────────────────────────────────────────────────────────────────
// Cognitive load
// ─────────────────────────────────────────────────────────────────────

const RECOVERY_THRESHOLD = 85;
const QUICK_WIN_MINUTES = 15;

/**
 * Compute a 0–100 cognitive load score.
 *
 * Inputs are minimal so this works in both the static app and /web.
 *
 * @param {Object} input
 * @param {Array}  input.tasks        Tasks: {done, date, priority, type, srsReview, estTime, ...}
 * @param {Array}  [input.classes]    Today's classes/events (used for time-of-day weighting).
 * @param {Date}   [input.now]        Defaults to new Date().
 * @returns {{score:number, level:'low'|'med'|'high', breakdown:Object}}
 */
export function calcCognitiveLoad({ tasks = [], classes = [], now } = {}) {
  const t = now instanceof Date ? now : new Date();
  const ts = isoDate(t);
  const startOfToday = new Date(t.toDateString());

  const active = tasks.filter((x) => x && !x.done);

  const overdue = active.filter((x) => {
    if (!x.date) return false;
    const d = new Date(`${x.date}T00:00:00`);
    return d < startOfToday;
  });

  const todayTasks = active.filter((x) => x.date === ts);
  const highPri = active.filter((x) => x.priority === 'high');
  const srsCount = active.filter((x) => x.srsReview).length;

  const examWindow = active.filter((x) => isExamSoon(x, t));
  const examWeight = examWindow.reduce(
    (acc, x) => acc + (daysUntil(x.date, t) <= 2 ? 18 : 10),
    0,
  );

  const circadian = circadianFactor(t.getHours());

  const raw =
    overdue.length * 15 +
    todayTasks.length * 8 +
    highPri.length * 10 +
    examWeight -
    srsCount * 0.5;

  const score = clamp(Math.round(raw * circadian), 0, 100);

  return {
    score,
    level: score >= RECOVERY_THRESHOLD ? 'high' : score >= 60 ? 'med' : 'low',
    breakdown: {
      overdue: overdue.length,
      today: todayTasks.length,
      highPri: highPri.length,
      srs: srsCount,
      examsSoon: examWindow.length,
      circadianFactor: circadian,
    },
  };
}

/** Whether to drop into "Recovery Mode" (hide non-essential tasks). */
export function inRecoveryMode(score) {
  return Number(score) >= RECOVERY_THRESHOLD;
}

/** Tasks short enough to be suggested as quick wins during high load. */
export function getQuickWins(tasks = [], maxMinutes = QUICK_WIN_MINUTES) {
  return (tasks || [])
    .filter((t) => t && !t.done)
    .filter((t) => {
      const m = Number(t.estTime || 0);
      if (!m) return false;
      return m > 0 && m <= maxMinutes;
    })
    .sort((a, b) => (a.estTime || 0) - (b.estTime || 0));
}

// ─────────────────────────────────────────────────────────────────────
// Friction & aging
// ─────────────────────────────────────────────────────────────────────

/**
 * Returns the friction tier for a task based on reschedule count.
 * Used by the renderer to add CSS classes / glow / nudge prompts.
 */
export function frictionTier(task) {
  const r = Number(task?.rescheduled || 0);
  if (r >= 5) return 'severe';
  if (r >= 3) return 'aged';
  if (r >= 1) return 'warning';
  return 'none';
}

/** True iff the task should trigger an AI "split this" prompt now. */
export function shouldOfferSplit(task) {
  return frictionTier(task) === 'aged' && !task?.frictionHandled;
}

// ─────────────────────────────────────────────────────────────────────
// Momentum tier (Blue → Orange → Purple)
// ─────────────────────────────────────────────────────────────────────

/**
 * Map a session multiplier (1, 2, 3, 5, 7…) to a flame appearance.
 *
 * @param {number} multiplier
 * @returns {{tier:string, label:string, gradient:[string,string], glow:string}}
 */
export function momentumState(multiplier) {
  const m = Number(multiplier || 0);
  if (m >= 5) {
    return {
      tier: 'inferno',
      label: `${m}× momentum`,
      gradient: ['#a855f7', '#7c3aed'],
      glow: 'rgba(168,85,247,.55)',
    };
  }
  if (m >= 3) {
    return {
      tier: 'blaze',
      label: `${m}× momentum`,
      gradient: ['#fb923c', '#f97316'],
      glow: 'rgba(251,146,60,.5)',
    };
  }
  if (m >= 2) {
    return {
      tier: 'spark',
      label: `${m}× momentum`,
      gradient: ['#60a5fa', '#3b82f6'],
      glow: 'rgba(96,165,250,.45)',
    };
  }
  return {
    tier: 'idle',
    label: 'No streak yet',
    gradient: ['#475569', '#334155'],
    glow: 'rgba(148,163,184,.18)',
  };
}

// ─────────────────────────────────────────────────────────────────────
// Predictive helpers
// ─────────────────────────────────────────────────────────────────────

/**
 * Given a list of free time slots and the current task pool, suggest the
 * best task to fit each slot. Used by Predictive Gap Filling.
 *
 * @param {Array<{startMin:number, endMin:number}>} freeSlots
 * @param {Array} tasks
 * @returns {Array<{slot:Object, task:Object|null}>}
 */
export function suggestForGaps(freeSlots = [], tasks = []) {
  const open = (tasks || []).filter((t) => t && !t.done);
  return (freeSlots || []).map((slot) => {
    const minutes = Math.max(0, Number(slot.endMin) - Number(slot.startMin));
    if (minutes <= 0) return { slot, task: null };
    const candidates = open
      .filter((t) => Number(t.estTime || 0) > 0 && Number(t.estTime) <= minutes)
      .sort(
        (a, b) =>
          // Prefer fits closer to the slot length, then higher priority
          slotFit(a, minutes) - slotFit(b, minutes) ||
          priorityWeight(b.priority) - priorityWeight(a.priority),
      );
    return { slot, task: candidates[0] || null };
  });
}

// ─────────────────────────────────────────────────────────────────────
// Driver: compute + emit (call from the renderer)
// ─────────────────────────────────────────────────────────────────────

let _lastLoad = 0;
let _lastInRecovery = false;
let _lastMomentumTier = 'idle';
let _streakDecayFiredFor = null;

/**
 * Run a full behavior tick. Computes load + momentum + decay and
 * fires events for anything that changed.
 *
 * Returns the same payload every time so callers can also render.
 */
export function tick({
  tasks = [],
  classes = [],
  momentumLevel = 0,
  streak = 0,
  lastActiveAt = null,
  now,
} = {}) {
  const t = now instanceof Date ? now : new Date();
  const load = calcCognitiveLoad({ tasks, classes, now: t });

  if (load.score !== _lastLoad) {
    emit('cognitive_load_shift', {
      score: load.score,
      prev: _lastLoad,
      level: load.level,
      breakdown: load.breakdown,
    });
    _lastLoad = load.score;
  }

  const recovery = inRecoveryMode(load.score);
  if (recovery !== _lastInRecovery) {
    emit(recovery ? 'recovery_mode_enter' : 'recovery_mode_exit', {
      score: load.score,
    });
    _lastInRecovery = recovery;
  }

  const flame = momentumState(momentumLevel);
  if (flame.tier !== _lastMomentumTier) {
    emit('task_momentum_gain', {
      level: momentumLevel,
      tier: flame.tier,
    });
    _lastMomentumTier = flame.tier;
  }

  if (streak > 0 && lastActiveAt) {
    const last = new Date(lastActiveAt);
    const hoursIdle = (t - last) / 3_600_000;
    const today = isoDate(t);
    const lastDay = isoDate(last);
    const sameDay = today === lastDay;
    if (!sameDay && t.getHours() >= 18 && _streakDecayFiredFor !== today) {
      emit('streak_decay_warning', {
        streak,
        lastActiveAt,
        hoursIdle: Math.round(hoursIdle * 10) / 10,
      });
      _streakDecayFiredFor = today;
    }
  }

  return {
    load,
    inRecovery: recovery,
    momentum: flame,
  };
}

/** Reset memoized state — useful for tests or manual invalidation. */
export function _resetForTests() {
  _lastLoad = 0;
  _lastInRecovery = false;
  _lastMomentumTier = 'idle';
  _streakDecayFiredFor = null;
}

// ─────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────

function isoDate(d) {
  // Local-time YYYY-MM-DD to match the legacy `todayStr()` helper.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function circadianFactor(hour) {
  if (hour >= 10 && hour <= 14) return 1.2;
  if (hour >= 20) return 0.6;
  return 1.0;
}

function isExamSoon(task, now) {
  if (!task?.date) return false;
  const isExamLike =
    task.type === 'exam' ||
    task.type === 'test' ||
    task.type === 'quiz' ||
    /\b(exam|midterm|final)\b/i.test(task.name || '');
  if (!isExamLike) return false;
  const days = daysUntil(task.date, now);
  return days >= 0 && days <= 7;
}

function daysUntil(dateStr, now) {
  if (!dateStr) return Infinity;
  const d = new Date(`${dateStr}T00:00:00`);
  const startOfToday = new Date(now.toDateString());
  return Math.round((d - startOfToday) / 86_400_000);
}

function slotFit(task, minutes) {
  const est = Number(task.estTime || 0);
  return Math.abs(minutes - est);
}

function priorityWeight(p) {
  if (p === 'high') return 3;
  if (p === 'med') return 2;
  return 1;
}
