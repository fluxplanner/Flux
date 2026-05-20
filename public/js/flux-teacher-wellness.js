/**
 * Teacher wellness — aggregate burnout signals (opt-in, no student PII).
 * Flag: enable_teacher_wellness (default off).
 */
(function () {
  'use strict';

  const OPT_IN_KEY = 'flux_teacher_wellness_opt_in_v1';

  function enabled() {
    try {
      return !!window.FluxFeatureFlags?.isEnabled('enable_teacher_wellness', false);
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

  function isOptedIn() {
    try {
      const fs = window.FluxStorage;
      if (fs && typeof fs.load === 'function') return !!fs.load(OPT_IN_KEY, false);
      if (typeof load === 'function') return !!load(OPT_IN_KEY, false);
    } catch (_) {}
    return false;
  }

  function setOptedIn(on) {
    try {
      const fs = window.FluxStorage;
      if (fs && typeof fs.save === 'function') fs.save(OPT_IN_KEY, !!on);
      else if (typeof save === 'function') save(OPT_IN_KEY, !!on);
    } catch (_) {}
  }

  function computeBurnout(m) {
    const metrics = m || {};
    let score = 0;
    const signals = [];

    const review = Number(metrics.pendingReview) || 0;
    const dueSoon = Number(metrics.dueSoonCount) || 0;
    const joins = Number(metrics.pendingJoins) || 0;
    const recovery = Number(metrics.pendingRecovery) || 0;
    const msgs = Number(metrics.unreadMessages) || 0;
    const classes = Number(metrics.classCount) || 0;
    const assignments = Number(metrics.totalAssignments) || 0;

    if (review >= 15) {
      score += 28;
      signals.push(`${review} submissions waiting for review`);
    } else if (review >= 8) {
      score += 16;
      signals.push(`${review} submissions in review queue`);
    } else if (review >= 3) {
      score += 8;
    }

    if (dueSoon >= 8) {
      score += 22;
      signals.push(`${dueSoon} assignments due within 3 days`);
    } else if (dueSoon >= 4) {
      score += 12;
      signals.push(`${dueSoon} assignments due soon`);
    }

    if (joins + recovery >= 5) {
      score += 18;
      signals.push(`${joins + recovery} admin items in join/recovery queues`);
    } else if (joins + recovery >= 2) {
      score += 10;
    }

    if (msgs >= 8) {
      score += 12;
      signals.push(`${msgs} unread messages`);
    } else if (msgs >= 4) {
      score += 6;
    }

    if (classes >= 6 && assignments >= 20) {
      score += 10;
      signals.push('High class + assignment load');
    }

    score = Math.max(0, Math.min(100, Math.round(score)));

    let tier = 'low';
    if (score >= 55) tier = 'elevated';
    else if (score >= 30) tier = 'moderate';

    let tip = 'Workload looks manageable. Keep one boundary today (e.g. stop grading by a set time).';
    if (tier === 'moderate') {
      tip =
        'Consider batching grading, deferring non-urgent messages, and protecting one recovery block this week.';
    }
    if (tier === 'elevated') {
      tip =
        'Elevated load detected from class aggregates only. Prioritize review backlog, postpone optional tasks, and ask for coverage if available.';
    }

    if (!signals.length) signals.push('No major workload spikes in aggregate metrics');

    return { score, tier, signals, tip };
  }

  function optInHtml() {
    return `<div class="flux-twellness-optin">
      <div class="flux-twellness-optin-text">
        <strong>Teacher wellness (optional)</strong> — See aggregate burnout signals from your dashboard workload (classes, reviews, due dates). No student names or grades.
      </div>
      <button type="button" class="teacher-action-btn primary" data-twellness-optin>Enable wellness insights</button>
    </div>`;
  }

  function cardHtml(result) {
    const tierLabel =
      result.tier === 'elevated' ? 'Elevated load' : result.tier === 'moderate' ? 'Moderate load' : 'Balanced';
    return `<section class="flux-twellness-card flux-twellness-card--${esc(result.tier)}" aria-label="Teacher wellness">
      <div class="flux-twellness-head">
        <div>
          <h3 class="flux-twellness-title">Wellness pulse</h3>
          <span class="flux-twellness-badge">${esc(tierLabel)}</span>
        </div>
        <div class="flux-twellness-score">${result.score}</div>
      </div>
      <p style="margin:0 0 8px;font-size:.7rem;color:var(--muted2)">Aggregate workload index (0–100) — not a medical assessment</p>
      <ul class="flux-twellness-signals">${result.signals.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
      <p class="flux-twellness-tip">${esc(result.tip)}</p>
      <div class="flux-twellness-foot">
        <span>Based on your dashboard counts only</span>
        <button type="button" data-twellness-optout>Turn off wellness</button>
      </div>
    </section>`;
  }

  function renderDashboardSection(metrics) {
    if (!enabled()) return '';
    if (!isOptedIn()) return optInHtml();
    return cardHtml(computeBurnout(metrics));
  }

  function wire(host) {
    if (!host || !enabled()) return;
    host.querySelector('[data-twellness-optin]')?.addEventListener('click', () => {
      setOptedIn(true);
      try {
        if (typeof window.renderTeacherDashboard === 'function') window.renderTeacherDashboard();
      } catch (_) {}
    });
    host.querySelector('[data-twellness-optout]')?.addEventListener('click', () => {
      setOptedIn(false);
      try {
        if (typeof window.renderTeacherDashboard === 'function') window.renderTeacherDashboard();
      } catch (_) {}
    });
  }

  function install() {
    return enabled();
  }

  window.FluxTeacherWellness = {
    OPT_IN_KEY,
    enabled,
    isOptedIn,
    setOptedIn,
    computeBurnout,
    renderDashboardSection,
    wire,
    install,
  };
})();
