/**
 * FluxOpsHealth — ops readiness checks for admins/owners.
 * Flag: enable_ops_health_panel (default off).
 */
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function enabled() {
    try {
      return !!window.FluxFeatureFlags?.isEnabled('enable_ops_health_panel', false);
    } catch (_) {
      return false;
    }
  }

  function isAdminOrOwner() {
    try {
      const r = window.FluxRole?.current || (typeof getMyRole === 'function' ? getMyRole() : '');
      return r === 'admin' || r === 'owner';
    } catch (_) {
      return false;
    }
  }

  async function checkSupabase() {
    if (window.__fluxSupabaseReachable === false) {
      return { id: 'supabase', label: 'Supabase API', status: 'fail', detail: 'Unreachable at last check' };
    }
    const sb = typeof getSB === 'function' ? getSB() : null;
    if (!sb) return { id: 'supabase', label: 'Supabase API', status: 'fail', detail: 'Client not initialized' };
    try {
      const { error } = await sb.from('flux_feature_flags').select('key').limit(1);
      if (error && String(error.message).toLowerCase().includes('fetch')) {
        return { id: 'supabase', label: 'Supabase API', status: 'fail', detail: 'Network error' };
      }
      return { id: 'supabase', label: 'Supabase API', status: 'ok', detail: 'Connected' };
    } catch (e) {
      const msg = String(e.message || e).toLowerCase();
      if (msg.includes('fetch') || msg.includes('network')) {
        return { id: 'supabase', label: 'Supabase API', status: 'fail', detail: 'Offline' };
      }
      return { id: 'supabase', label: 'Supabase API', status: 'warn', detail: 'Partial' };
    }
  }

  function checkAuth() {
    const u = window.currentUser;
    if (!u?.id) {
      return { id: 'auth', label: 'Auth session', status: 'fail', detail: 'Not signed in' };
    }
    return { id: 'auth', label: 'Auth session', status: 'ok', detail: `User ${String(u.id).slice(0, 8)}…` };
  }

  function checkFlags() {
    try {
      const keys = window.FluxFeatureFlags?.all?.();
      if (!keys || !Object.keys(keys).length) {
        return { id: 'flags', label: 'Feature flags', status: 'warn', detail: 'Not loaded yet' };
      }
      const suite = window.FluxFeatureFlags?.isEnabled('enable_staff_productivity_suite', false);
      return {
        id: 'flags',
        label: 'Feature flags',
        status: 'ok',
        detail: suite ? 'Loaded · staff suite on' : 'Loaded',
      };
    } catch (_) {
      return { id: 'flags', label: 'Feature flags', status: 'warn', detail: 'Unavailable' };
    }
  }

  function checkErrors() {
    const ring = window.FluxErrorReporter?.ring?.() || [];
    if (!ring.length) {
      return { id: 'errors', label: 'Client error ring', status: 'ok', detail: 'No recent errors' };
    }
    return {
      id: 'errors',
      label: 'Client error ring',
      status: 'warn',
      detail: `${ring.length} recent (local only)`,
    };
  }

  function checkOffline() {
    if (!window.FluxOfflineSync?.enabled?.()) {
      return { id: 'offline', label: 'Offline sync', status: 'ok', detail: 'Flag off (expected)' };
    }
    const box = window.FluxOfflineSync.getOutbox?.() || [];
    const conflicts = window.FluxOfflineSync.getConflicts?.() || [];
    if (conflicts.length) {
      return {
        id: 'offline',
        label: 'Offline sync',
        status: 'warn',
        detail: `${conflicts.length} conflict${conflicts.length === 1 ? '' : 's'}`,
      };
    }
    if (box.length) {
      return {
        id: 'offline',
        label: 'Offline sync',
        status: 'warn',
        detail: `${box.length} pending write${box.length === 1 ? '' : 's'}`,
      };
    }
    return { id: 'offline', label: 'Offline sync', status: 'ok', detail: 'Outbox clear' };
  }

  async function checkStaffTables() {
    const sb = typeof getSB === 'function' ? getSB() : null;
    if (!sb) return null;
    const tables = [
      'staff_student_accommodations',
      'staff_counselor_private_notes',
      'student_counselor_checkins',
      'counselor_referrals',
    ];
    let missing = 0;
    for (const t of tables) {
      const { error } = await sb.from(t).select('id').limit(1);
      if (!error) continue;
      const msg = String(error.message || '').toLowerCase();
      const code = String(error.code || '');
      if (code === '42P01' || msg.includes('does not exist') || msg.includes('schema cache')) {
        missing += 1;
      }
    }
    if (missing) {
      return {
        id: 'staff_sql',
        label: 'Staff productivity tables',
        status: 'fail',
        detail: `${missing} table(s) missing — run migrations`,
      };
    }
    return {
      id: 'staff_sql',
      label: 'Staff productivity tables',
      status: 'ok',
      detail: 'Schema present',
    };
  }

  async function checkRlsSnapshot() {
    const sb = typeof getSB === 'function' ? getSB() : null;
    if (!sb) return null;
    try {
      const { data, error } = await sb.rpc('flux_rls_health_snapshot');
      if (error) {
        return { id: 'rls', label: 'RLS health snapshot', status: 'warn', detail: error.message };
      }
      if (!data?.ok) {
        return { id: 'rls', label: 'RLS health snapshot', status: 'warn', detail: data?.error || 'Forbidden' };
      }
      const legacy = !!(data.legacy_roles_select_educators || data.legacy_classes_teacher_all);
      const policyCount = Array.isArray(data.policies) ? data.policies.length : 0;
      return {
        id: 'rls',
        label: 'RLS health snapshot',
        status: legacy ? 'warn' : 'ok',
        detail: legacy
          ? 'Legacy policies detected'
          : `${policyCount} policies on core tables`,
      };
    } catch (e) {
      return { id: 'rls', label: 'RLS health snapshot', status: 'warn', detail: String(e.message || e) };
    }
  }

  async function runChecks() {
    const checks = [checkSupabase(), checkAuth(), checkFlags(), checkErrors(), checkOffline()];
    const resolved = await Promise.all(checks);
    if (isAdminOrOwner()) {
      const staff = await checkStaffTables();
      if (staff) resolved.push(staff);
      const rls = await checkRlsSnapshot();
      if (rls) resolved.push(rls);
    }
    return resolved;
  }

  function rowHtml(c) {
    return `<div class="flux-health-row flux-health-row--${esc(c.status)}">
      <span class="flux-health-dot" aria-hidden="true"></span>
      <div class="flux-health-body">
        <div class="flux-health-label">${esc(c.label)}</div>
        <div class="flux-health-detail">${esc(c.detail)}</div>
      </div>
    </div>`;
  }

  async function renderHealthPanel(mount) {
    if (!enabled()) {
      mount.innerHTML = '<p class="flux-widget-planned">Enable enable_ops_health_panel.</p>';
      return;
    }
    if (!isAdminOrOwner()) {
      mount.innerHTML = '<p class="flux-widget-planned">Admin or owner only.</p>';
      return;
    }

    mount.innerHTML = `
      <p class="flux-widget-hint">Readiness checks — refresh after deploys or migrations.</p>
      <button type="button" class="btn-sec" id="fluxHealthRefresh" style="width:100%;font-size:.72rem;margin-bottom:8px">↻ Run checks</button>
      <div class="flux-health-list" aria-live="polite">Running…</div>`;

    const list = mount.querySelector('.flux-health-list');

    async function paint() {
      list.innerHTML = '<p class="flux-widget-hint">Running checks…</p>';
      const rows = await runChecks();
      const fails = rows.filter((r) => r.status === 'fail').length;
      const warns = rows.filter((r) => r.status === 'warn').length;
      const summary =
        fails > 0
          ? `<p class="flux-health-summary flux-health-summary--fail">${fails} issue${fails === 1 ? '' : 's'} need attention</p>`
          : warns > 0
            ? `<p class="flux-health-summary flux-health-summary--warn">${warns} warning${warns === 1 ? '' : 's'}</p>`
            : `<p class="flux-health-summary flux-health-summary--ok">All checks passed</p>`;
      list.innerHTML = summary + rows.map(rowHtml).join('');
    }

    mount.querySelector('#fluxHealthRefresh')?.addEventListener('click', paint);
    paint();
  }

  window.FluxOpsHealth = {
    enabled,
    runChecks,
    renderHealthPanel,
  };
})();
