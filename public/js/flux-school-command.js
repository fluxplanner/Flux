/**
 * School command center — admin aggregate metrics (no student-level PII).
 * Flag: enable_school_command (default off).
 */
(function () {
  'use strict';

  function enabled() {
    try {
      return !!window.FluxFeatureFlags?.isEnabled('enable_school_command', false);
    } catch (_) {
      return false;
    }
  }

  function esc(s) {
    if (typeof window.esc === 'function') return window.esc(s);
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  async function loadMetrics(sb) {
    if (!sb) return { ok: false, error: 'offline' };
    try {
      const { data, error } = await sb.rpc('flux_school_command_metrics');
      if (error) throw error;
      if (data && data.ok === false) {
        return { ok: false, error: data.error || 'forbidden' };
      }
      return { ok: true, ...(data || {}) };
    } catch (e) {
      return { ok: false, error: e.message || String(e) };
    }
  }

  function card(value, label, alert) {
    return `<div class="flux-school-command-card${alert ? ' flux-school-command-card--alert' : ''}">
      <div class="flux-school-command-n">${esc(value)}</div>
      <div class="flux-school-command-l">${esc(label)}</div>
    </div>`;
  }

  function renderGroup(title, cardsHtml) {
    return `<div class="flux-school-command-group">
      <div class="flux-school-command-group-title">${esc(title)}</div>
      <div class="flux-school-command-grid">${cardsHtml}</div>
    </div>`;
  }

  function renderSection(metrics) {
    if (!enabled()) return '';
    if (!metrics?.ok) {
      return `<section class="flux-school-command" aria-label="School command center">
        <div class="flux-school-command-head"><h3>Command center</h3></div>
        <p class="flux-school-command-err">Could not load school metrics${metrics?.error ? `: ${esc(metrics.error)}` : ''}.</p>
      </section>`;
    }

    const r = metrics.roles || {};
    const community = renderGroup(
      'Community',
      [
        card(num(r.student), 'Students', false),
        card(num(r.teacher), 'Teachers', false),
        card(num(r.counselor), 'Counselors', false),
        card(num(r.staff), 'Staff & admin', false),
      ].join(''),
    );

    const teaching = renderGroup(
      'Teaching ops',
      [
        card(num(metrics.active_classes), 'Active classes', false),
        card(num(metrics.assignments), 'Assignments', false),
        card(num(metrics.submissions_pending), 'Submissions to review', num(metrics.submissions_pending) > 0),
        card(num(metrics.joins_pending), 'Join requests', num(metrics.joins_pending) > 0),
        card(num(metrics.recovery_proposed), 'Recovery proposed', num(metrics.recovery_proposed) > 0),
      ].join(''),
    );

    const counseling = renderGroup(
      'Counseling ops',
      [
        card(num(metrics.counselor_links), 'Counselor assignments', false),
        card(num(metrics.consent_basic), 'Basic consent', false),
        card(num(metrics.consent_wellness), 'Wellness consent', false),
        card(num(metrics.appts_today), 'Appts today', false),
        card(num(metrics.appts_pending), 'Pending appts', num(metrics.appts_pending) > 0),
        card(num(metrics.wellness_snapshots_7d), 'Wellness check-ins (7d)', false),
      ].join(''),
    );

    const adminOps = renderGroup(
      'Admin queue',
      [card(num(metrics.meeting_requests_pending), 'Meeting requests', num(metrics.meeting_requests_pending) > 0)].join(''),
    );

    const ts = metrics.generated_at
      ? new Date(metrics.generated_at).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })
      : 'just now';

    return `
      <section class="flux-school-command" aria-label="School command center">
        <div class="flux-school-command-head">
          <h3>Command center</h3>
          <span class="flux-school-command-hint">School-wide aggregates · updated ${esc(ts)}</span>
        </div>
        ${community}
        ${teaching}
        ${counseling}
        ${adminOps}
        <p class="flux-school-command-foot">Counts only — no grades or individual student wellness data on this board.</p>
      </section>`;
  }

  function install() {
    return enabled();
  }

  window.FluxSchoolCommand = {
    enabled,
    loadMetrics,
    renderSection,
    install,
  };
})();
