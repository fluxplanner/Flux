/**
 * Flux feature flags — server-resolved overrides + local experiments.
 * Requires migration 20260524120000_feature_flags_foundation.sql
 */
(function () {
  'use strict';

  const CACHE_MS =
    (window.FluxStorageKeys && FluxStorageKeys.PLATFORM && FluxStorageKeys.PLATFORM.featureFlagsCacheMs) ||
    5 * 60 * 1000;

  let _flags = null;
  let _fetchedAt = 0;

  function cacheKey() {
    const u = typeof currentUser !== 'undefined' ? currentUser : window.currentUser;
    if (window.FluxStorageKeys && typeof FluxStorageKeys.featureFlagsCacheKey === 'function') {
      return FluxStorageKeys.featureFlagsCacheKey(u && u.id);
    }
    const base = 'flux_feature_flags_cache_v1';
    return u && u.id ? `${base}_${u.id}` : base;
  }

  function authUserId() {
    const u = typeof currentUser !== 'undefined' ? currentUser : window.currentUser;
    return u && u.id ? String(u.id) : '';
  }

  function defaults() {
    return {
      enable_momentum_v2: false,
      enable_cognitive_ui: false,
      enable_teacher_ai: false,
      enable_live_class_mode: false,
      enable_school_command: false,
      enable_school_emergency_broadcast: false,
      enable_parent_portal: false,
      enable_staff_google_hub: true, // CORE: hardcoded ON (Phase 37.1 PR-B)
      enable_classroom_sync: false,
      enable_event_bus: false,
      enable_event_bus_processors: false,
      enable_ai_orchestration: false,
      enable_offline_sync: false,
      enable_sync_conflict_ui: false,
      enable_storage_repair: false,
      enable_syllabus_conflict_check: true, // IAE PR-C: global default
      enable_layered_memory: false,
      enable_a11y_suite: false,
      enable_e2e_harness: false,
      enable_client_error_reporting: false,
      enable_task_friction: false,
      enable_shutdown_v2: false,
      enable_ghost_draft_v2: false,
      enable_neuro_dashboard: false,
      enable_srs_v2: false,
      enable_predict_v2: false,
      enable_teacher_class_momentum: false,
      enable_teacher_assign_intel: false,
      enable_teacher_roster_v2: false,
      enable_teacher_copilot: false,
      enable_assignment_recovery: false,
      enable_teacher_wellness: false,
      enable_counselor_caseload: false,
      enable_counselor_wellness_timeline: false,
      enable_counselor_risk_queue: false,
      enable_counselor_consent_flows: false,
      enable_counselor_copilot: false,
      enable_district_rollup: false,
      enable_school_ops: false,
      enable_gcal_2way: false,
      enable_drive_import: false,
      enable_docs_ghost_sync: false,
      enable_gmail_educator_import: false,
      enable_site_enhancements_pack: true, // CORE: hardcoded ON (Phase 37.1 PR-B)
      enable_staff_productivity_suite: true, // IAE PR-C: global default (was school override)
      enable_classroom_tools: true, // IAE PR-C: global default
      enable_caseload_engine: true, // IAE PR-C: global default
      enable_personal_hub: true, // IAE PR-C: global default
      enable_staff_dash_board: true, // Educator personal widget board (mini cal, week, photos)
      enable_staff_command_v2: true, // IAE PR-C: global default
      enable_locale_foundation: true, // IAE PR-C: global default
      enable_ops_health_panel: false,
      enable_dashboard_widget_picker: true, // CORE: hardcoded ON (Phase 37.1 PR-B)
      enable_deep_links: false,
      enable_sync_queue_ui: false,
      enable_voice_task_capture: false,
      enable_gcal_busy_overlay: false,
      enable_recurring_exceptions: false,
      enable_subject_theme_packs: false,
      enable_cmd_palette_v2: false,
      enable_global_search_v2: false,
      enable_smart_lists: false,
      enable_bulk_filter: false,
      enable_focus_intent: false,
      enable_habit_heatmap: false,
      enable_pomodoro_subject_presets: false,
      enable_meeting_mode: false,
      enable_mood_velocity: false,
      enable_screenshot_snip: false,
      enable_event_buffer: false,
      enable_travel_time: false,
      enable_ambient_weather: false,
      enable_energy_scheduling: false,
      enable_rest_day_plan: false,
      enable_geofence_reminders: false,
      enable_exam_prep_plan: false,
      enable_syllabus_week_scaffold: false,
      enable_task_template_marketplace: false,
      enable_focus_score: false,
      enable_email_task_inbox: false,
      enable_automation_hooks: false,
      enable_ical_subscribe: false,
      enable_ics_timetable_import: false,
      enable_sport_practice_pack: false,
      enable_cs_snippet_library: false,
      enable_unit_converter_favorites: false,
      enable_periodic_srs_quiz: false,
      enable_flashcard_generator: false,
      enable_srs_deck_mode: false,
      enable_latex_live_preview: false,
      enable_equation_ocr_latex: false,
      enable_wiki_backlinks: false,
      enable_notion_obsidian_export: false,
      enable_mind_map_tasks: false,
      enable_handwriting_to_text: false,
      enable_citation_helper: false,
      enable_calc_history: false,
      enable_cowork: true, // Live shared checklist + presence for any task (Co-work rooms)
      enable_office_hours: true, // Staff publish weekly drop-in hours; students view on School page
    };
  }

  function store() {
    return window.FluxStorage || null;
  }

  function fromCache() {
    try {
      const uid = authUserId();
      if (!uid) return null;
      const fs = store();
      const raw = fs && typeof fs.load === 'function' ? fs.load(cacheKey(), null) : null;
      if (!raw || typeof raw !== 'object') return null;
      if (raw.userId && String(raw.userId) !== uid) return null;
      if (!raw.fetchedAt || Date.now() - raw.fetchedAt > CACHE_MS) return null;
      return raw.flags && typeof raw.flags === 'object' ? raw.flags : null;
    } catch (_) {
      return null;
    }
  }

  function saveCache(flags) {
    try {
      const uid = authUserId();
      const fs = store();
      if (!uid || !fs || typeof fs.save !== 'function') return;
      fs.save(cacheKey(), { userId: uid, fetchedAt: Date.now(), flags });
    } catch (_) {}
  }

  function experimentOverrides() {
    const ex = window.FLUX_EXPERIMENTS || {};
    const o = {};
    Object.keys(ex).forEach((k) => {
      if (k.startsWith('enable_') && typeof ex[k] === 'boolean') o[k] = ex[k];
    });
    return o;
  }

  async function load(opts) {
    const force = !!(opts && opts.force);
    if (!force && _flags && Date.now() - _fetchedAt < CACHE_MS) return _flags;

    const cached = !force ? fromCache() : null;
    if (cached) {
      _flags = { ...defaults(), ...cached, ...experimentOverrides() };
      _fetchedAt = Date.now();
      return _flags;
    }

    let merged = { ...defaults() };
    const sb = typeof window.getSB === 'function' ? window.getSB() : null;
    const u = typeof currentUser !== 'undefined' ? currentUser : window.currentUser;

    if (sb && u?.id) {
      try {
        const { data, error } = await sb.rpc('flux_resolve_feature_flags');
        if (!error && data && typeof data === 'object') {
          merged = { ...merged, ...data };
        }
      } catch (e) {
        console.warn('[FluxFeatureFlags] load', e);
      }
    }

    merged = { ...merged, ...experimentOverrides() };
    _flags = merged;
    _fetchedAt = Date.now();
    saveCache(merged);
    window.FLUX_FEATURE_FLAGS = merged;
    return merged;
  }

  function isEnabled(key, fallback) {
    const k = String(key || '');
    if (_flags && Object.prototype.hasOwnProperty.call(_flags, k)) return !!_flags[k];
    if (typeof fallback === 'boolean') return fallback;
    const d = defaults();
    return !!d[k];
  }

  function all() {
    return _flags ? { ..._flags } : { ...defaults() };
  }

  function clear() {
    _flags = null;
    _fetchedAt = 0;
    try {
      const fs = store();
      if (fs && typeof fs.save === 'function') fs.save(cacheKey(), null);
    } catch (_) {}
  }

  window.FluxFeatureFlags = {
    defaults,
    load,
    isEnabled,
    all,
    clear,
  };
})();
