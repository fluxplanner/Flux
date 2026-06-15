/**
 * flux-eval.js — Flux's prediction eval + per-user calibration loop.
 *
 * This is the honest "gets smarter from your data" mechanism (no model training):
 *   1. RECORD — each day, snapshot the tasks Flux expects you to finish today,
 *      with the confidence it assigned.
 *   2. RESOLVE — once a day is past, check what actually happened (done on time?)
 *      and tally hits/misses → a real, measurable accuracy number.
 *   3. CALIBRATE — adjust this student's daily focus-capacity estimate from their
 *      true on-time completion behaviour, so Flux Intelligence warns earlier for
 *      chronic over-committers and later for people who reliably clear their list.
 *
 * Everything stays in the user's own synced data (save/load) — private by design.
 *
 * window.FluxEval = {
 *   recordDaily(analysis), resolvePast(), accuracy(), capacityMin(), stats()
 * }
 */
(function () {
  'use strict';

  var LOG_KEY = 'flux_pred_log';     // [{date, taskId, due, conf, resolved, hit}]
  var CAL_KEY = 'flux_calibration';  // { capacityMin, updatedAt }
  var DEFAULT_CAPACITY = 180;
  var MIN_CAP = 90, MAX_CAP = 360;
  var MAX_LOG = 400;

  function load_(k, f) { try { return typeof load === 'function' ? load(k, f) : f; } catch (e) { return f; } }
  function save_(k, v) { try { if (typeof save === 'function') save(k, v); } catch (e) {} }
  function tasks() { try { return Array.isArray(window.tasks) ? window.tasks : []; } catch (e) { return []; } }
  function todayISO() { try { return typeof todayStr === 'function' ? todayStr() : new Date().toISOString().slice(0, 10); } catch (e) { return new Date().toISOString().slice(0, 10); } }

  function log() { var l = load_(LOG_KEY, []); return Array.isArray(l) ? l : []; }
  function setLog(l) { save_(LOG_KEY, l.slice(-MAX_LOG)); }

  /* RECORD: snapshot today's "expected to finish" tasks once per day. */
  function recordDaily(analysis) {
    var today = todayISO();
    var l = log();
    if (l.some(function (e) { return e.date === today; })) return; // already recorded today
    var due = tasks().filter(function (t) { return t && !t.done && t.date === today; });
    if (!due.length) return;
    var conf = 0.6;
    due.forEach(function (t) {
      l.push({ date: today, taskId: String(t.id), due: t.date, conf: conf, resolved: false, hit: null });
    });
    setLog(l);
  }

  /* RESOLVE: for predictions whose day is past, check actual outcome. */
  function resolvePast() {
    var today = todayISO();
    var l = log();
    var byId = {};
    tasks().forEach(function (t) { byId[String(t.id)] = t; });
    var changed = false;
    l.forEach(function (e) {
      if (e.resolved || e.date >= today) return;
      var t = byId[e.taskId];
      var hit = false;
      if (t && t.done && t.completedAt) {
        try { hit = new Date(t.completedAt).toISOString().slice(0, 10) <= e.due; } catch (x) { hit = true; }
      } else if (!t) {
        hit = true; // task gone (likely completed + cleared) — treat as done
      }
      e.resolved = true; e.hit = hit; changed = true;
    });
    if (changed) { setLog(l); recalibrate(); }
  }

  function resolvedEntries() { return log().filter(function (e) { return e.resolved && e.hit != null; }); }

  function accuracy() {
    var r = resolvedEntries();
    if (!r.length) return null;
    var hits = r.filter(function (e) { return e.hit; }).length;
    return { pct: Math.round((hits / r.length) * 100), n: r.length };
  }

  /* CALIBRATE: nudge daily capacity from on-time completion behaviour. */
  function recalibrate() {
    var a = accuracy();
    if (!a || a.n < 6) return; // need a little history first
    var cap = capacityMin();
    if (a.pct < 55) cap -= 15;
    else if (a.pct > 85) cap += 15;
    cap = Math.max(MIN_CAP, Math.min(MAX_CAP, cap));
    save_(CAL_KEY, { capacityMin: cap, updatedAt: new Date().toISOString() });
  }

  function capacityMin() {
    var c = load_(CAL_KEY, null);
    return (c && c.capacityMin) || DEFAULT_CAPACITY;
  }

  function stats() {
    var a = accuracy();
    return { accuracy: a, capacityMin: capacityMin(), logged: log().length, resolved: resolvedEntries().length };
  }

  window.FluxEval = {
    recordDaily: recordDaily, resolvePast: resolvePast,
    accuracy: accuracy, capacityMin: capacityMin, stats: stats,
  };

  function boot() { setTimeout(function () { try { resolvePast(); } catch (e) {} }, 1500); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
