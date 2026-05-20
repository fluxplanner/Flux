/**
 * Flux event processors — local queue + optional server job drain (P7-EVENT-BUS).
 * Requires migration 20260525400000_event_bus_processors.sql
 * Flag: enable_event_bus_processors (default off).
 * Install after FluxEventBus so persist + processors both see FluxBus.emit.
 */
(function () {
  'use strict';

  const LS_AUDIT = 'flux_processor_audit_v1';
  const LS_SESSION_STATS = 'flux_processor_session_stats_v1';
  const AUDIT_MAX = 40;
  const LOCAL_QUEUE_MAX = 32;
  const DRAIN_MS = 45000;
  const SERVER_ENQUEUE = new Set(['task_completed', 'session_ended', 'momentum_update']);

  let _installed = false;
  let _origEmit = null;
  let _localQueue = [];
  let _draining = false;
  let _inProcessor = false;
  let _drainTimer = null;
  let _stats = { handled: 0, failed: 0, enqueued: 0, server_drained: 0 };

  /** @type {Map<string, { id: string, fn: Function, priority: number }[]>} */
  const _registry = new Map();

  function enabled() {
    try {
      return !!window.FluxFeatureFlags?.isEnabled('enable_event_bus_processors', false);
    } catch (_) {
      return false;
    }
  }

  function load(k, def) {
    if (typeof window.load === 'function') return window.load(k, def);
    try {
      const raw = localStorage.getItem(k);
      return raw ? JSON.parse(raw) : def;
    } catch (_) {
      return def;
    }
  }

  function save(k, v) {
    if (typeof window.save === 'function') window.save(k, v);
    else {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch (_) {}
    }
  }

  function normalize(eventName, payload) {
    if (window.FluxTelemetry && typeof FluxTelemetry.normalize === 'function') {
      const n = FluxTelemetry.normalize(eventName, payload);
      if (n) return { event_name: n.event_name, payload: n.payload };
    }
    return { event_name: String(eventName || ''), payload: payload && typeof payload === 'object' ? payload : {} };
  }

  function registerProcessor(eventName, handler, opts) {
    const name = String(eventName || '').trim();
    if (!name || typeof handler !== 'function') return false;
    const id = (opts && opts.id) || 'proc_' + name + '_' + (_registry.get(name)?.length || 0);
    const priority = opts && opts.priority != null ? Number(opts.priority) : 50;
    const list = _registry.get(name) || [];
    const existing = list.findIndex((x) => x.id === id);
    const entry = { id, fn: handler, priority };
    if (existing >= 0) list[existing] = entry;
    else list.push(entry);
    list.sort((a, b) => a.priority - b.priority);
    _registry.set(name, list);
    return true;
  }

  function unregisterProcessor(eventName, processorId) {
    const list = _registry.get(eventName);
    if (!list) return;
    _registry.set(
      eventName,
      list.filter((x) => x.id !== processorId)
    );
  }

  function scheduleLocal(eventName, payload) {
    if (!enabled() || _inProcessor) return;
    if (_localQueue.length >= LOCAL_QUEUE_MAX) _localQueue.shift();
    _localQueue.push({ event_name: eventName, payload, at: Date.now() });
    if (!_draining) {
      _draining = true;
      const run = () => {
        drainLocal()
          .catch(() => {})
          .finally(() => {
            _draining = false;
          });
      };
      if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 120 });
      else setTimeout(run, 0);
    }
  }

  async function runHandlers(eventName, payload, ctx) {
    const list = _registry.get(eventName) || [];
    const globalList = _registry.get('*') || [];
    const merged = globalList.concat(list);
    for (let i = 0; i < merged.length; i++) {
      try {
        await merged[i].fn(payload, ctx);
      } catch (e) {
        _stats.failed += 1;
        console.warn('[FluxEventProcessors]', merged[i].id, e);
      }
    }
    _stats.handled += 1;
  }

  async function drainLocal() {
    while (_localQueue.length && enabled()) {
      const job = _localQueue.shift();
      if (!job) break;
      _inProcessor = true;
      try {
        await runHandlers(job.event_name, job.payload, {
          source: 'local',
          at: job.at,
          event_name: job.event_name,
        });
      } finally {
        _inProcessor = false;
      }
    }
  }

  async function enqueueServerJobs(jobs) {
    if (!jobs.length) return { ok: true, skipped: true };
    const sb = typeof window.getSB === 'function' ? window.getSB() : null;
    const u = typeof currentUser !== 'undefined' ? currentUser : window.currentUser;
    if (!sb || !u?.id) return { ok: false, error: 'no_session' };
    try {
      const { data, error } = await sb.rpc('flux_enqueue_processor_jobs', { p_jobs: jobs });
      if (error) throw error;
      _stats.enqueued += (data && data.accepted) || jobs.length;
      return data || { ok: true };
    } catch (e) {
      console.warn('[FluxEventProcessors] enqueue', e);
      return { ok: false, error: String(e.message || e) };
    }
  }

  async function drainServerQueue() {
    if (!enabled()) return { ok: true, skipped: true };
    const sb = typeof window.getSB === 'function' ? window.getSB() : null;
    const u = typeof currentUser !== 'undefined' ? currentUser : window.currentUser;
    if (!sb || !u?.id) return { ok: false, error: 'no_session' };
    try {
      const { data, error } = await sb.rpc('flux_claim_processor_jobs', { p_limit: 5 });
      if (error) throw error;
      const jobs = (data && data.jobs) || [];
      if (!jobs.length) return { ok: true, drained: 0 };
      for (let i = 0; i < jobs.length; i++) {
        const j = jobs[i];
        let ok = true;
        let errMsg = null;
        _inProcessor = true;
        try {
          await runHandlers(j.event_name, j.payload, {
            source: 'server',
            event_name: j.event_name,
            job_id: j.id,
            processor_id: j.processor_id,
          });
        } catch (e) {
          ok = false;
          errMsg = String(e.message || e);
        } finally {
          _inProcessor = false;
        }
        await sb.rpc('flux_complete_processor_job', {
          p_job_id: j.id,
          p_ok: ok,
          p_error: errMsg,
        });
        if (ok) _stats.server_drained += 1;
      }
      return { ok: true, drained: jobs.length };
    } catch (e) {
      console.warn('[FluxEventProcessors] server drain', e);
      return { ok: false, error: String(e.message || e) };
    }
  }

  function registerBuiltins() {
    registerProcessor(
      '*',
      function auditRing(payload, ctx) {
        const ring = load(LS_AUDIT, []);
        const arr = Array.isArray(ring) ? ring : [];
        arr.push({
          event_name: ctx && ctx.event_name ? ctx.event_name : 'unknown',
          source: (ctx && ctx.source) || 'local',
          at: Date.now(),
        });
        save(LS_AUDIT, arr.slice(-AUDIT_MAX));
      },
      { id: 'audit_ring', priority: 1 }
    );

    registerProcessor(
      'session_ended',
      function sessionRollup(payload) {
        const stats = load(LS_SESSION_STATS, { sessions: 0, total_mins: 0 });
        const s = stats && typeof stats === 'object' ? stats : { sessions: 0, total_mins: 0 };
        s.sessions = (Number(s.sessions) || 0) + 1;
        s.total_mins = (Number(s.total_mins) || 0) + (Number(payload && payload.mins) || 0);
        s.last_date = payload && payload.date ? String(payload.date).slice(0, 10) : null;
        save(LS_SESSION_STATS, s);
      },
      { id: 'session_rollup', priority: 10 }
    );

    registerProcessor(
      'task_completed',
      function momentumHint() {
        if (window.FluxBus && typeof FluxBus.emit === 'function') {
          FluxBus.emit('processor_momentum_hint', { via: 'task_completed' });
        }
      },
      { id: 'momentum_hint', priority: 20 }
    );

    registerProcessor(
      '*',
      async function serverRelay(payload, ctx) {
        if (!ctx || !ctx.event_name || !SERVER_ENQUEUE.has(ctx.event_name)) return;
        await enqueueServerJobs([
          {
            event_name: ctx.event_name,
            payload: payload || {},
            processor_id: 'server_relay',
          },
        ]);
      },
      { id: 'server_relay', priority: 90 }
    );
  }

  function startServerDrainLoop() {
    stopServerDrainLoop();
    if (!enabled()) return;
    _drainTimer = setInterval(() => {
      drainServerQueue().catch(() => {});
    }, DRAIN_MS);
    setTimeout(() => drainServerQueue().catch(() => {}), 3000);
  }

  function stopServerDrainLoop() {
    if (_drainTimer) {
      clearInterval(_drainTimer);
      _drainTimer = null;
    }
  }

  function install() {
    if (_installed || !window.FluxBus || typeof FluxBus.emit !== 'function') return false;
    registerBuiltins();
    _origEmit = FluxBus.emit.bind(FluxBus);
    FluxBus.emit = function (eventName, payload) {
      _origEmit(eventName, payload);
      if (!enabled() || _inProcessor) return;
      const norm = normalize(eventName, payload);
      if (!norm.event_name) return;
      scheduleLocal(norm.event_name, norm.payload);
    };
    FluxBus.runProcessors = drainLocal;
    FluxBus.drainProcessorJobs = drainServerQueue;
    FluxBus.processorStats = () => Object.assign({}, _stats);
    _installed = true;
    startServerDrainLoop();
    return true;
  }

  function uninstall() {
    stopServerDrainLoop();
    if (!_installed || !_origEmit) return;
    FluxBus.emit = _origEmit;
    delete FluxBus.runProcessors;
    delete FluxBus.drainProcessorJobs;
    delete FluxBus.processorStats;
    _installed = false;
    _origEmit = null;
    _localQueue = [];
  }

  function getAuditRing() {
    const ring = load(LS_AUDIT, []);
    return Array.isArray(ring) ? ring.slice() : [];
  }

  function getSessionStats() {
    const s = load(LS_SESSION_STATS, null);
    return s && typeof s === 'object' ? Object.assign({}, s) : { sessions: 0, total_mins: 0 };
  }

  window.FluxEventProcessors = {
    enabled,
    install,
    uninstall,
    registerProcessor,
    unregisterProcessor,
    drainLocal,
    drainServerQueue,
    enqueueServerJobs,
    getAuditRing,
    getSessionStats,
    stats: () => Object.assign({}, _stats),
  };
})();
