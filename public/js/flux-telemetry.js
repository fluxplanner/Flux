/**
 * Flux product telemetry — privacy-reviewed event catalog + payload normalization.
 * Persisted events (when enable_event_bus) go to flux_product_events via flux-event-bus.js.
 * Human spec: docs/TELEMETRY_SCHEMA.md
 */
(function () {
  'use strict';

  const SCHEMA_VERSION = 1;

  const FORBIDDEN_KEYS =
    /^(password|token|body|email|provider_token|access_token|refresh_token|name|title|note|notes|description|message|content|student_note|display_name|full_name|user_metadata)$/i;

  const MAX_STRING = 128;

  /** @type {Record<string, { persist: boolean, category: string, description: string, normalize?: (raw: unknown) => Record<string, unknown> }>} */
  const CATALOG = {
    sign_in: {
      persist: true,
      category: 'platform',
      description: 'Session started with event bus enabled',
      normalize(raw) {
        const via =
          raw && typeof raw === 'object' && raw.via ? String(raw.via).slice(0, 32) : 'session';
        return { via, schema_version: SCHEMA_VERSION };
      },
    },
    task_completed: {
      persist: true,
      category: 'student',
      description: 'User completed a planner task (IDs and aggregates only)',
      normalize(raw) {
        const t = raw && typeof raw === 'object' ? raw : {};
        const out = {
          schema_version: SCHEMA_VERSION,
          task_id: t.id != null ? Number(t.id) : null,
          subject: trunc(t.subject || t.sub || '', 64) || null,
          priority: trunc(t.priority || t.pri || '', 16) || null,
          est_mins: t.est != null ? Number(t.est) : t.mins != null ? Number(t.mins) : null,
        };
        return out;
      },
    },
    session_ended: {
      persist: true,
      category: 'student',
      description: 'Focus / pomodoro session finished',
      normalize(raw) {
        const p = raw && typeof raw === 'object' ? raw : {};
        return {
          schema_version: SCHEMA_VERSION,
          mins: Number(p.mins) || 0,
          date: trunc(p.date || '', 10),
          hour: p.hour != null ? Number(p.hour) : null,
          subject: trunc(p.subject || '', 64) || null,
        };
      },
    },
    momentum_update: {
      persist: true,
      category: 'student',
      description: 'Momentum streak counter changed (numeric only)',
      normalize(raw) {
        const n = typeof raw === 'number' ? raw : raw && typeof raw === 'object' ? raw.count : 0;
        return {
          schema_version: SCHEMA_VERSION,
          count: Math.max(0, Math.min(99, Number(n) || 0)),
        };
      },
    },
    school_joined: {
      persist: true,
      category: 'school',
      description: 'User joined a school via code or fallback',
      normalize(raw) {
        const p = raw && typeof raw === 'object' ? raw : {};
        return {
          schema_version: SCHEMA_VERSION,
          school: trunc(p.school || '', MAX_STRING) || null,
          short_name: trunc(p.short_name || '', 32) || null,
        };
      },
    },
    class_joined: {
      persist: true,
      category: 'school',
      description: 'Student joined a class by share code',
      normalize(raw) {
        const p = raw && typeof raw === 'object' ? raw : {};
        return {
          schema_version: SCHEMA_VERSION,
          class_code: trunc(p.class_code || '', 12).toUpperCase() || null,
          class_id: trunc(p.class_id || '', 36) || null,
        };
      },
    },
    role_mode_changed: {
      persist: true,
      category: 'educator',
      description: 'Educator toggled work vs personal mode',
      normalize(raw) {
        const p = raw && typeof raw === 'object' ? raw : {};
        const mode = p.mode === 'personal' ? 'personal' : 'work';
        const role = trunc(p.role || '', 24) || null;
        return { schema_version: SCHEMA_VERSION, mode, role };
      },
    },
    srs_reviews_scheduled: {
      persist: true,
      category: 'student',
      description: 'SRS v2 created review tasks after parent completion',
      normalize(raw) {
        const p = raw && typeof raw === 'object' ? raw : {};
        const intervals = Array.isArray(p.intervals)
          ? p.intervals.map((n) => Number(n)).filter((n) => Number.isFinite(n)).slice(0, 6)
          : [];
        return {
          schema_version: SCHEMA_VERSION,
          parent_id: p.parent_id != null ? Number(p.parent_id) : null,
          count: Math.max(0, Math.min(6, Number(p.count) || intervals.length || 0)),
          intervals,
          subject: trunc(p.subject || '', 64) || null,
        };
      },
    },
    srs_review_completed: {
      persist: true,
      category: 'student',
      description: 'User completed an SRS review task',
      normalize(raw) {
        const p = raw && typeof raw === 'object' ? raw : {};
        return {
          schema_version: SCHEMA_VERSION,
          parent_id: p.parent_id != null ? Number(p.parent_id) : null,
          stage: p.stage != null ? Math.max(1, Math.min(6, Number(p.stage) || 1)) : null,
          interval_days: p.interval_days != null ? Number(p.interval_days) : null,
          subject: trunc(p.subject || '', 64) || null,
        };
      },
    },
    predict_insight_shown: {
      persist: true,
      category: 'intelligence',
      description: 'Predictive insight panel or gap-fill rendered (aggregates only)',
      normalize(raw) {
        const p = raw && typeof raw === 'object' ? raw : {};
        return {
          schema_version: SCHEMA_VERSION,
          kind: trunc(p.kind || '', 24) || null,
          at_risk_count:
            p.at_risk_count != null ? Math.max(0, Math.min(20, Number(p.at_risk_count) || 0)) : null,
          overload_level: trunc(p.overload_level || '', 16) || null,
          slot_count: p.slot_count != null ? Math.max(0, Math.min(10, Number(p.slot_count) || 0)) : null,
          cognitive_score:
            p.cognitive_score != null ? Math.max(0, Math.min(100, Number(p.cognitive_score) || 0)) : null,
        };
      },
    },
    ai_agent_routed: {
      persist: true,
      category: 'platform',
      description: 'Multi-agent orchestration picked a specialist (ids only)',
      normalize(raw) {
        const p = raw && typeof raw === 'object' ? raw : {};
        return {
          schema_version: SCHEMA_VERSION,
          agent_id: trunc(p.agent_id || '', 64) || null,
          secondary: trunc(p.secondary || '', 64) || null,
          intent: trunc(p.intent || '', 64) || null,
        };
      },
    },
    memory_reset: {
      persist: true,
      category: 'platform',
      description: 'User cleared one or more AI memory layers',
      normalize(raw) {
        const p = raw && typeof raw === 'object' ? raw : {};
        const layers = Array.isArray(p.layers) ? p.layers.map((x) => trunc(x, 32)).slice(0, 4) : [];
        return { schema_version: SCHEMA_VERSION, layers, count: layers.length };
      },
    },
    client_error: {
      persist: true,
      category: 'platform',
      description: 'JS error or unhandled rejection (scrubbed message + file basename only)',
      normalize(raw) {
        const p = raw && typeof raw === 'object' ? raw : {};
        return {
          schema_version: SCHEMA_VERSION,
          kind: trunc(p.kind || 'error', 32),
          message: trunc(p.message || '', 240),
          source: trunc(p.source || '', 96),
          line: p.line != null ? Number(p.line) : null,
          col: p.col != null ? Number(p.col) : null,
        };
      },
    },
  };

  /** FluxBus events documented but not persisted (client-only handlers). */
  const BUS_ONLY = {
    task_completed: 'Also drives UI; persisted copy is normalized',
    momentum_update: 'Also drives UI; persisted copy is normalized',
  };

  function trunc(s, max) {
    return String(s || '')
      .trim()
      .slice(0, max);
  }

  function stripForbidden(obj) {
    const out = {};
    Object.keys(obj || {}).forEach((k) => {
      if (FORBIDDEN_KEYS.test(k)) return;
      const v = obj[k];
      if (v === undefined || v === null) return;
      if (typeof v === 'string') out[k] = trunc(v, MAX_STRING);
      else if (typeof v === 'number' || typeof v === 'boolean') out[k] = v;
    });
    return out;
  }

  function persistAllowlist() {
    return new Set(
      Object.keys(CATALOG).filter((k) => CATALOG[k] && CATALOG[k].persist),
    );
  }

  function isPersisted(eventName) {
    const def = CATALOG[String(eventName || '')];
    return !!(def && def.persist);
  }

  /**
   * @returns {{ event_name: string, payload: object } | null}
   */
  function normalize(eventName, rawPayload) {
    const name = String(eventName || '').trim();
    const def = CATALOG[name];
    if (!def || !def.persist) return null;
    let payload = {};
    try {
      payload = typeof def.normalize === 'function' ? def.normalize(rawPayload) : {};
    } catch (_) {
      payload = {};
    }
    payload = stripForbidden(payload);
    try {
      if (JSON.stringify(payload).length > 6000) {
        payload = { schema_version: SCHEMA_VERSION, _truncated: true };
      }
    } catch (_) {
      payload = { schema_version: SCHEMA_VERSION };
    }
    return { event_name: name, payload };
  }

  function list() {
    return Object.keys(CATALOG).map((name) => ({
      name,
      persist: !!CATALOG[name].persist,
      category: CATALOG[name].category,
      description: CATALOG[name].description,
    }));
  }

  function audit() {
    console.table(list());
    console.log('[FluxTelemetry] schema_version', SCHEMA_VERSION, 'persist', [...persistAllowlist()]);
    return list();
  }

  window.FluxTelemetry = {
    SCHEMA_VERSION,
    CATALOG,
    BUS_ONLY,
    FORBIDDEN_KEYS,
    persistAllowlist,
    isPersisted,
    normalize,
    stripForbidden,
    list,
    audit,
  };
})();
