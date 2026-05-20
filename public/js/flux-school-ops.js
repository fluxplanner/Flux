/**
 * School operations intelligence — overload week prediction (aggregate only).
 * Flag: enable_school_ops (default off).
 */
(function () {
  'use strict';

  function enabled() {
    try {
      return !!window.FluxFeatureFlags?.isEnabled('enable_school_ops', false);
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

  function fmtMins(m) {
    const mins = num(m);
    if (mins >= 60) return `~${(mins / 60).toFixed(1)}h`;
    return `~${mins}m`;
  }

  function fmtDayLabel(iso) {
    if (!iso) return '';
    const d = new Date(`${iso}T12:00:00`);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  async function loadForecast(sb) {
    if (!sb) return { ok: false, error: 'offline' };
    try {
      const { data, error } = await sb.rpc('flux_school_ops_overload_week');
      if (error) throw error;
      if (data && data.ok === false) {
        return { ok: false, error: data.error || 'forbidden' };
      }
      return { ok: true, ...(data || {}) };
    } catch (e) {
      return { ok: false, error: e.message || String(e) };
    }
  }

  function buildSignals(fc) {
    const signals = [];
    const days = Array.isArray(fc.days) ? fc.days : [];
    const peak = fc.peak_day;
    const peakDay = days.find((d) => d.date === peak) || days[0];

    if (fc.week_level === 'high') {
      signals.push({
        severity: 'high',
        icon: '⚠',
        title: 'Overload week predicted',
        detail: `${num(fc.total_assignments)} assignments due · ${fmtMins(fc.total_est_minutes)} estimated load vs ${fmtMins(fc.capacity_est_minutes)} school heuristic capacity.`,
      });
    } else if (fc.week_level === 'elevated') {
      signals.push({
        severity: 'elevated',
        icon: '📈',
        title: 'Busy week ahead',
        detail: 'Assignment due-date density is above typical for active classes. Consider staggering major assessments.',
      });
    }

    if (peakDay && peakDay.level !== 'ok') {
      signals.push({
        severity: peakDay.level === 'high' ? 'high' : 'elevated',
        icon: '📅',
        title: `Peak load: ${fmtDayLabel(peak)}`,
        detail: `${num(peakDay.count)} assignments · ${fmtMins(peakDay.est_minutes)}${num(peakDay.tests) ? ` · ${num(peakDay.tests)} quiz/test` : ''}.`,
      });
    }

    const highLoad = num(fc.wellness?.high_load_count);
    if (highLoad >= 5) {
      signals.push({
        severity: 'elevated',
        icon: '🧠',
        title: 'Elevated wellness load signals',
        detail: `${highLoad} consented wellness snapshots (7d) reported high workload — aggregate only, not individual students.`,
      });
    }

    if (num(fc.submissions_pending) >= 10) {
      signals.push({
        severity: 'elevated',
        icon: '📝',
        title: 'Grading backlog building',
        detail: `${num(fc.submissions_pending)} submissions awaiting review school-wide.`,
      });
    }

    if (!signals.length) {
      signals.push({
        severity: 'ok',
        icon: '✓',
        title: 'Steady week',
        detail: 'No overload patterns detected from due dates and aggregate wellness signals.',
      });
    }

    return signals;
  }

  function renderWeekBars(days, peakDay) {
    const list = Array.isArray(days) ? days : [];
    const maxM = Math.max(1, ...list.map((d) => num(d.est_minutes)));
    return `<div class="flux-school-ops-bars" role="img" aria-label="Assignment load by day">${list
      .map((d) => {
        const h = Math.round(Math.max(12, (num(d.est_minutes) / maxM) * 48));
        const lvl = d.level || 'ok';
        const isPeak = d.date === peakDay;
        return `<div class="flux-school-ops-bar-col flux-school-ops-bar-col--${esc(lvl)}${isPeak ? ' flux-school-ops-bar-col--peak' : ''}" title="${esc(fmtDayLabel(d.date))}: ${num(d.count)} assignments · ${fmtMins(d.est_minutes)}">
          <div class="flux-school-ops-bar" style="height:${h}px"></div>
          <span class="flux-school-ops-bar-lbl">${esc(String(d.date || '').slice(5))}</span>
        </div>`;
      })
      .join('')}</div>`;
  }

  function renderSection(fc, opts) {
    if (!enabled()) return '';
    const compact = !!(opts && opts.compact);

    if (!fc?.ok) {
      return `<section class="flux-school-ops${compact ? ' flux-school-ops--compact' : ''}" aria-label="Operations intelligence">
        <div class="flux-school-ops-head"><h3>Operations intelligence</h3></div>
        <p class="flux-school-ops-err">Could not load overload forecast${fc?.error ? `: ${esc(fc.error)}` : ''}.</p>
      </section>`;
    }

    const days = Array.isArray(fc.days) ? fc.days : [];
    const signals = buildSignals(fc);
    const weekLvl = fc.week_level || 'ok';
    const ts = fc.generated_at
      ? new Date(fc.generated_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
      : 'now';

    const signalHtml = signals
      .map(
        (s) => `<div class="flux-school-ops-signal flux-school-ops-signal--${esc(s.severity)}">
        <span class="flux-school-ops-signal-icon" aria-hidden="true">${esc(s.icon)}</span>
        <div>
          <div class="flux-school-ops-signal-title">${esc(s.title)}</div>
          <div class="flux-school-ops-signal-detail">${esc(s.detail)}</div>
        </div>
      </div>`,
      )
      .join('');

    const statsHtml = compact
      ? ''
      : `<div class="flux-school-ops-stats">
        <div class="flux-school-ops-stat"><div class="flux-school-ops-stat-n">${num(fc.total_assignments)}</div><div class="flux-school-ops-stat-l">Due this week</div></div>
        <div class="flux-school-ops-stat"><div class="flux-school-ops-stat-n">${fmtMins(fc.total_est_minutes)}</div><div class="flux-school-ops-stat-l">Est. load</div></div>
        <div class="flux-school-ops-stat flux-school-ops-stat--${esc(weekLvl)}"><div class="flux-school-ops-stat-n">${esc(String(weekLvl).toUpperCase())}</div><div class="flux-school-ops-stat-l">Week level</div></div>
        <div class="flux-school-ops-stat"><div class="flux-school-ops-stat-n">${num(fc.submissions_pending)}</div><div class="flux-school-ops-stat-l">Submissions pending</div></div>
      </div>`;

    return `<section class="flux-school-ops${compact ? ' flux-school-ops--compact' : ''}" aria-label="Operations intelligence">
      <div class="flux-school-ops-head">
        <h3>Operations intelligence</h3>
        <span class="flux-school-ops-badge flux-school-ops-badge--${esc(weekLvl)}">${esc(weekLvl)} week</span>
        <span class="flux-school-ops-hint">Updated ${esc(ts)} · aggregates only</span>
      </div>
      ${statsHtml}
      <div class="flux-school-ops-signals">${signalHtml}</div>
      ${renderWeekBars(days, fc.peak_day)}
      <p class="flux-school-ops-foot">Heuristic forecast from visible assignment due dates${fc.wellness?.snapshots_7d ? ` · ${num(fc.wellness.snapshots_7d)} wellness snapshots (7d)` : ''}. Not a diagnosis; no individual student rows.</p>
    </section>`;
  }

  function renderOpsPanelHtml(fc) {
    if (!enabled()) return '';
    return renderSection(fc, { compact: false });
  }

  function install() {
    return enabled();
  }

  window.FluxSchoolOps = {
    enabled,
    loadForecast,
    renderSection,
    renderOpsPanelHtml,
    buildSignals,
    install,
  };
})();
