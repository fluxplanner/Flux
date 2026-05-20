/**
 * District multi-school rollup — aggregate metrics per school (no student PII).
 * Flag: enable_district_rollup (default off).
 */
(function () {
  'use strict';

  function enabled() {
    try {
      return !!window.FluxFeatureFlags?.isEnabled('enable_district_rollup', false);
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

  async function loadRollup(sb, districtSlug) {
    if (!sb) return { ok: false, error: 'offline' };
    try {
      const args = districtSlug ? { p_district_slug: districtSlug } : {};
      const { data, error } = await sb.rpc('flux_district_rollup_metrics', args);
      if (error) throw error;
      if (data && data.ok === false) {
        return { ok: false, error: data.error || 'forbidden' };
      }
      return { ok: true, ...(data || {}) };
    } catch (e) {
      return { ok: false, error: e.message || String(e) };
    }
  }

  function renderSection(rollup) {
    if (!enabled()) return '';
    if (!rollup?.ok) {
      return `<section class="flux-district-rollup" aria-label="District rollup">
        <div class="flux-district-rollup-head"><h3>District rollup</h3></div>
        <p class="flux-district-rollup-err">Could not load district metrics${rollup?.error ? `: ${esc(rollup.error)}` : ''}.</p>
      </section>`;
    }

    const district = rollup.district || {};
    const totals = rollup.totals || {};
    const schools = Array.isArray(rollup.schools) ? rollup.schools : [];

    const totalsHtml = `
      <div class="flux-district-totals">
        <div class="flux-district-total"><div class="flux-district-total-n">${num(totals.school_count)}</div><div class="flux-district-total-l">Schools</div></div>
        <div class="flux-district-total"><div class="flux-district-total-n">${num(totals.students)}</div><div class="flux-district-total-l">Students</div></div>
        <div class="flux-district-total"><div class="flux-district-total-n">${num(totals.teachers)}</div><div class="flux-district-total-l">Teachers</div></div>
        <div class="flux-district-total"><div class="flux-district-total-n">${num(totals.counselors)}</div><div class="flux-district-total-l">Counselors</div></div>
        <div class="flux-district-total"><div class="flux-district-total-n">${num(totals.active_classes)}</div><div class="flux-district-total-l">Active classes</div></div>
      </div>`;

    const rows =
      schools.length === 0
        ? '<tr><td colspan="6">No schools in this district yet.</td></tr>'
        : schools
            .map(
              (s) => `<tr>
          <td><strong>${esc(s.name || s.slug)}</strong></td>
          <td>${num(s.students)}</td>
          <td>${num(s.teachers)}</td>
          <td>${num(s.counselors)}</td>
          <td>${num(s.staff)}</td>
          <td>${num(s.active_classes)}</td>
        </tr>`,
            )
            .join('');

    const ts = rollup.generated_at
      ? new Date(rollup.generated_at).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })
      : 'just now';

    return `
      <section class="flux-district-rollup" aria-label="District rollup">
        <div class="flux-district-rollup-head">
          <h3>District rollup — ${esc(district.name || district.slug || 'District')}</h3>
          <span class="flux-district-rollup-hint">Aggregates · ${esc(ts)}</span>
        </div>
        ${totalsHtml}
        <div class="flux-district-table-wrap">
          <table class="flux-district-table">
            <thead>
              <tr>
                <th>School</th>
                <th>Students</th>
                <th>Teachers</th>
                <th>Counselors</th>
                <th>Staff</th>
                <th>Classes</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <p class="flux-district-rollup-foot">District admins see all schools in their district. School-level command center remains on this dashboard.</p>
      </section>`;
  }

  function install() {
    return enabled();
  }

  window.FluxDistrictRollup = {
    enabled,
    loadRollup,
    renderSection,
    install,
  };
})();
