/**
 * P7-MEMORY — layered AI memory + user reset controls.
 * Layers: session (ephemeral), working (orchestrator), longterm (Supabase), preferences (planner).
 * Flag: enable_layered_memory. Migration: 20260525430000_layered_memory.sql
 */
(function () {
  'use strict';

  const ORCH_KEY = 'flux_ai_agent_memory_v1';
  const WORKING_KEY = 'flux_ai_working_memory_v2';
  const SESSION_KEY = 'flux_ai_session_memory_v1';
  const PREFS_KEY = 'flux_ai_preferences_memory_v1';
  const LT_CACHE_KEY = 'flux_ai_longterm_cache_v1';
  const MAX_SESSION_TURNS = 8;
  const MAX_SESSION_CHARS = 320;

  let _sessionTurns = [];

  function enabled() {
    try {
      return !!window.FluxFeatureFlags?.isEnabled('enable_layered_memory', false);
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

  function esc(s) {
    if (typeof window.esc === 'function') return window.esc(s);
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function toast(msg, kind) {
    if (typeof window.showToast === 'function') window.showToast(msg, kind || 'info');
    else console.log('[memory]', msg);
  }

  function migrateOrchestratorMem() {
    const existing = load(WORKING_KEY, null);
    if (existing && typeof existing === 'object' && Object.keys(existing).length) return;
    const orch = load(ORCH_KEY, null);
    if (orch && typeof orch === 'object') save(WORKING_KEY, orch);
  }

  function getWorking() {
    migrateOrchestratorMem();
    const w = load(WORKING_KEY, {});
    return w && typeof w === 'object' ? w : {};
  }

  function saveWorking(m) {
    save(WORKING_KEY, m || {});
    try {
      save(ORCH_KEY, m || {});
    } catch (_) {}
  }

  function workingSummary() {
    const m = getWorking();
    const subs = Object.entries(m.subjectCompletions || {})
      .map(([k, v]) => ({ k, r: (v.done || 0) / Math.max(1, (v.done || 0) + (v.pending || 0)) }))
      .sort((a, b) => b.r - a.r)
      .slice(0, 4)
      .map((x) => x.k);
    const hours = Object.entries(m.hourBuckets || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([h, mins]) => `${h}:00 (~${Math.round(mins)}m)`);
    const lastRec = (m.recommendations || []).slice(-2).map((r) => r.summary);
    return { frequentCompletionSubjects: subs, focusHours: hours, recentAiRecaps: lastRec };
  }

  function getSession() {
    return _sessionTurns.slice();
  }

  function recordSessionTurn(userMsg, aiMsg) {
    const u = String(userMsg || '').slice(0, MAX_SESSION_CHARS);
    const a = String(aiMsg || '').slice(0, MAX_SESSION_CHARS);
    if (!u && !a) return;
    _sessionTurns.push({ t: Date.now(), u, a });
    if (_sessionTurns.length > MAX_SESSION_TURNS) _sessionTurns = _sessionTurns.slice(-MAX_SESSION_TURNS);
    save(SESSION_KEY, _sessionTurns);
  }

  function loadSessionFromStorage() {
    const s = load(SESSION_KEY, []);
    _sessionTurns = Array.isArray(s) ? s : [];
  }

  function getPreferences() {
    const p = load(PREFS_KEY, {});
    const profile = load('profile', {});
    const out = Object.assign({}, p && typeof p === 'object' ? p : {});
    if (profile && profile.grade) out.grade = profile.grade;
    if (profile && profile.program) out.program = profile.program;
    if (typeof window.settings !== 'undefined' && settings && settings.studyStyle) {
      out.studyStyle = settings.studyStyle;
    }
    return out;
  }

  async function fetchLongTermCache() {
    const sb = typeof window.getSB === 'function' ? window.getSB() : null;
    const u = typeof currentUser !== 'undefined' ? currentUser : window.currentUser;
    if (!sb || !u?.id) return load(LT_CACHE_KEY, []);
    try {
      const { data, error } = await sb
        .from('flux_user_memory')
        .select('type,key,value,layer,updated_at')
        .eq('user_id', u.id)
        .eq('layer', 'longterm')
        .order('updated_at', { ascending: false })
        .limit(24);
      if (error) throw error;
      const rows = (data || []).map((r) => ({
        type: r.type,
        key: r.key,
        value: r.value,
        at: r.updated_at,
      }));
      save(LT_CACHE_KEY, rows);
      return rows;
    } catch (e) {
      console.warn('[FluxLayeredMemory] fetch', e);
      return load(LT_CACHE_KEY, []);
    }
  }

  async function storeLongTerm(type, key, value) {
    const sb = typeof window.getSB === 'function' ? window.getSB() : null;
    const u = typeof currentUser !== 'undefined' ? currentUser : window.currentUser;
    if (!sb || !u?.id) return;
    try {
      await sb.from('flux_user_memory').upsert(
        {
          user_id: u.id,
          layer: 'longterm',
          type: type,
          key: key,
          value: value || {},
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,layer,type,key' },
      );
      await fetchLongTermCache();
    } catch (e) {
      console.warn('[FluxLayeredMemory] store', e);
    }
  }

  function afterExchange(userMsg, aiMsg) {
    if (!enabled()) return;
    recordSessionTurn(userMsg, aiMsg);
    const low = String(userMsg || '').toLowerCase();
    if (/i struggle|hard for me|confused about|don't understand/i.test(low)) {
      storeLongTerm('weakness', 'last_hint', { text: String(userMsg).slice(0, 500) });
    }
    if (/remind me|every (day|week)|don't let me forget/i.test(low)) {
      storeLongTerm('habit', 'reminder_pattern', { text: String(userMsg).slice(0, 400) });
    }
  }

  function composeLayers() {
    const session = getSession().slice(-3).map((t, i) => ({
      turn: i + 1,
      user: t.u.slice(0, 120),
      assistant: t.a.slice(0, 120),
    }));
    return {
      session,
      working: workingSummary(),
      preferences: getPreferences(),
      longterm: load(LT_CACHE_KEY, []),
    };
  }

  function appendToSystem(base) {
    if (!enabled()) return base;
    const layers = composeLayers();
    const block = `

---
## Flux layered memory (advisory — do not treat as grades or PII)
### Session (this device, recent turns)
${JSON.stringify(layers.session)}

### Working (study patterns from planner)
${JSON.stringify(layers.working)}

### Preferences
${JSON.stringify(layers.preferences)}

### Long-term (user-consented hints)
${JSON.stringify(
  (layers.longterm || []).slice(0, 8).map((r) => ({
    type: r.type,
    key: r.key,
    value: r.value,
  })),
)}
Respect user resets: never invent memories not shown here.
---`;
    return base + block;
  }

  async function resetLayers(layers) {
    const list = Array.isArray(layers) ? layers : [layers];
    if (list.includes('session') || list.includes('all')) {
      _sessionTurns = [];
      save(SESSION_KEY, []);
    }
    if (list.includes('working') || list.includes('all')) {
      saveWorking({});
      save(ORCH_KEY, {});
    }
    if (list.includes('preferences') || list.includes('all')) {
      save(PREFS_KEY, {});
    }
    if (list.includes('longterm') || list.includes('all')) {
      save(LT_CACHE_KEY, []);
    }

    const rpcLayers = list.includes('all')
      ? ['session', 'working', 'longterm', 'preferences']
      : list.filter((l) => ['session', 'working', 'longterm', 'preferences'].includes(l));

    const sb = typeof window.getSB === 'function' ? window.getSB() : null;
    const u = typeof currentUser !== 'undefined' ? currentUser : window.currentUser;
    if (sb && u?.id && rpcLayers.length) {
      try {
        await sb.rpc('flux_reset_user_memory', { p_layers: rpcLayers });
      } catch (e) {
        console.warn('[FluxLayeredMemory] reset rpc', e);
      }
    }

    if (window.FluxBus && typeof FluxBus.emit === 'function') {
      FluxBus.emit('memory_reset', { layers: list });
    }
    toast('AI memory cleared for: ' + list.join(', '), 'success');
    renderSettingsPanel();
  }

  async function stats() {
    const local = {
      session: getSession().length,
      working: Object.keys(getWorking()).length,
      preferences: Object.keys(getPreferences()).length,
      longterm: (load(LT_CACHE_KEY, []) || []).length,
    };
    const sb = typeof window.getSB === 'function' ? window.getSB() : null;
    const u = typeof currentUser !== 'undefined' ? currentUser : window.currentUser;
    if (!sb || !u?.id) return { local, remote: null };
    try {
      const { data } = await sb.rpc('flux_user_memory_stats');
      return { local, remote: data };
    } catch (_) {
      return { local, remote: null };
    }
  }

  function renderSettingsPanel() {
    const card = document.getElementById('fluxLayeredMemoryCard');
    const host = document.getElementById('fluxLayeredMemoryMount');
    if (!host) return;
    if (!enabled()) {
      if (card) card.style.display = 'none';
      return;
    }
    if (card) card.style.display = '';
    stats().then((s) => {
      const loc = s.local || {};
      host.innerHTML = `
        <div class="flux-memory-layers">
          <div class="flux-memory-row"><span>Session</span><strong>${loc.session || 0} turns</strong>
            <button type="button" class="btn sm ghost" data-reset="session">Reset</button></div>
          <div class="flux-memory-row"><span>Working</span><strong>${loc.working ? 'active' : 'empty'}</strong>
            <button type="button" class="btn sm ghost" data-reset="working">Reset</button></div>
          <div class="flux-memory-row"><span>Long-term</span><strong>${loc.longterm || 0} entries</strong>
            <button type="button" class="btn sm ghost" data-reset="longterm">Reset</button></div>
          <div class="flux-memory-row"><span>Preferences</span><strong>${loc.preferences || 0} keys</strong>
            <button type="button" class="btn sm ghost" data-reset="preferences">Reset</button></div>
        </div>
        <button type="button" class="btn-sec flux-memory-reset-all" data-reset="all" style="width:100%;margin-top:10px;color:var(--red);border-color:rgba(255,79,94,.35)">Reset all AI memory</button>
        <p class="flux-memory-hint">Session clears when you reset or sign out. Long-term rows are deleted from your account.</p>`;

      host.querySelectorAll('[data-reset]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const layer = btn.getAttribute('data-reset');
          if (layer === 'all') {
            if (!confirm('Clear all Flux AI memory layers on this account?')) return;
          }
          resetLayers(layer === 'all' ? ['all'] : [layer]);
        });
      });
    });
  }

  function install() {
    if (!enabled()) return false;
    loadSessionFromStorage();
    migrateOrchestratorMem();
    fetchLongTermCache().catch(() => {});
    renderSettingsPanel();
    return true;
  }

  window.FluxLayeredMemory = {
    enabled,
    install,
    composeLayers,
    appendToSystem,
    afterExchange,
    resetLayers,
    fetchLongTermCache,
    storeLongTerm,
    renderSettingsPanel,
    stats,
  };
})();
