/**
 * Teacher assignment intel — friction score + scaffold decomposition.
 * Flag: enable_teacher_assign_intel (default off).
 */
(function () {
  'use strict';

  const TIERS = ['none', 'warning', 'aged', 'severe'];

  const _byId = new Map();

  function enabled() {
    try {
      return !!window.FluxFeatureFlags?.isEnabled('enable_teacher_assign_intel', false);
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

  function escapeAttr(s) {
    return esc(s).replace(/"/g, '&quot;');
  }

  function tierFromScore(score) {
    const s = Number(score) || 0;
    if (s >= 55) return 'severe';
    if (s >= 32) return 'aged';
    if (s >= 10) return 'warning';
    return 'none';
  }

  function tierLabel(tier) {
    if (tier === 'severe') return 'High friction';
    if (tier === 'aged') return 'Heavy lift';
    if (tier === 'warning') return 'Moderate';
    return 'Light';
  }

  function daysUntilDue(dueDate) {
    if (!dueDate) return 99;
    const ts =
      typeof window.todayStr === 'function'
        ? window.todayStr()
        : new Date().toISOString().slice(0, 10);
    const a = new Date(`${dueDate}T12:00:00`);
    const b = new Date(`${ts}T12:00:00`);
    return Math.round((a - b) / 86400000);
  }

  /**
   * Predict how demanding this assignment is for students (design-time, not live task data).
   */
  function computeFriction(assignment) {
    const a = assignment || {};
    let score = 0;

    const type = String(a.type || 'homework').toLowerCase();
    if (type === 'project' || type === 'essay') score += 18;
    else if (type === 'lab' || type === 'test') score += 14;
    else if (type === 'quiz') score += 8;

    const est = Number(a.estimated_minutes) || 30;
    if (est >= 120) score += 22;
    else if (est >= 90) score += 14;
    else if (est >= 60) score += 8;

    if (a.priority === 'high') score += 8;
    if (Number(a.points_possible) >= 100) score += 5;

    const desc = String(a.description || '');
    if (desc.length > 800) score += 10;
    else if (desc.length > 400) score += 5;

    const dueIn = daysUntilDue(a.due_date);
    if (dueIn >= 0 && dueIn <= 2) score += 12;
    else if (dueIn >= 0 && dueIn <= 5) score += 6;

    if (Array.isArray(a.scaffold_steps) && a.scaffold_steps.length >= 4) score -= 6;

    score = Math.max(0, Math.min(100, Math.round(score)));
    const tier = tierFromScore(score);
    return { frictionScore: score, frictionTier: tier, label: tierLabel(tier) };
  }

  function buildScaffold(assignment) {
    const a = assignment || {};
    const est = Math.max(15, Number(a.estimated_minutes) || 30);
    const type = String(a.type || 'homework').toLowerCase();
    const steps = [];

    if (type === 'essay' || type === 'project') {
      steps.push({ order: 1, label: 'Read prompt & mark requirements', est_minutes: 15 });
      steps.push({ order: 2, label: 'Gather sources / materials', est_minutes: Math.round(est * 0.25) });
      steps.push({ order: 3, label: 'Outline structure', est_minutes: Math.round(est * 0.2) });
      steps.push({ order: 4, label: 'Draft main work', est_minutes: Math.round(est * 0.35) });
      steps.push({ order: 5, label: 'Revise & polish', est_minutes: Math.round(est * 0.15) });
    } else if (type === 'lab') {
      steps.push({ order: 1, label: 'Review procedure & safety notes', est_minutes: 10 });
      steps.push({ order: 2, label: 'Set up & pre-lab', est_minutes: Math.round(est * 0.2) });
      steps.push({ order: 3, label: 'Run experiment / collect data', est_minutes: Math.round(est * 0.45) });
      steps.push({ order: 4, label: 'Write lab report', est_minutes: Math.round(est * 0.25) });
    } else if (type === 'test' || type === 'quiz') {
      steps.push({ order: 1, label: 'Review notes & key topics', est_minutes: Math.round(est * 0.5) });
      steps.push({ order: 2, label: 'Practice problems / flashcards', est_minutes: Math.round(est * 0.35) });
      steps.push({ order: 3, label: 'Light review & rest', est_minutes: Math.round(est * 0.15) });
    } else {
      steps.push({ order: 1, label: 'Skim instructions & materials', est_minutes: 10 });
      steps.push({ order: 2, label: 'Complete core work', est_minutes: Math.max(15, est - 15) });
      steps.push({ order: 3, label: 'Check work & submit', est_minutes: 10 });
    }

    return steps.map((s, i) => ({ ...s, order: i + 1 }));
  }

  function analyze(assignment) {
    const friction = computeFriction(assignment);
    const scaffoldSteps = buildScaffold(assignment);
    return {
      frictionScore: friction.frictionScore,
      frictionTier: friction.frictionTier,
      frictionLabel: friction.label,
      scaffoldSteps,
      intelComputedAt: new Date().toISOString(),
    };
  }

  function payloadFields(assignment) {
    if (!enabled()) return {};
    const intel = analyze(assignment);
    return {
      friction_score: intel.frictionScore,
      friction_tier: intel.frictionTier,
      scaffold_steps: intel.scaffoldSteps,
      intel_computed_at: intel.intelComputedAt,
    };
  }

  function resolveIntel(assignment) {
    if (!assignment) return null;
    if (
      assignment.friction_score != null &&
      assignment.friction_tier &&
      Array.isArray(assignment.scaffold_steps)
    ) {
      return {
        frictionScore: Number(assignment.friction_score),
        frictionTier: assignment.friction_tier,
        frictionLabel: tierLabel(assignment.friction_tier),
        scaffoldSteps: assignment.scaffold_steps,
      };
    }
    if (!enabled()) return null;
    return analyze(assignment);
  }

  function badgeHtml(assignment) {
    const intel = resolveIntel(assignment);
    if (!enabled() || !intel || intel.frictionTier === 'none') return '';
    return `<span class="flux-tassign-friction flux-tassign-friction--${esc(intel.frictionTier)}" title="Predicted student friction ${intel.frictionScore}/100">${esc(intel.frictionLabel)} · ${intel.frictionScore}</span>`;
  }

  function scaffoldButtonHtml(assignmentId, stepCount) {
    if (!enabled() || !stepCount) return '';
    return `<button type="button" class="flux-tassign-scaffold-btn" data-asg-intel="${esc(assignmentId)}" title="View suggested steps">Steps (${stepCount})</button>`;
  }

  function remember(assignment) {
    if (assignment && assignment.id) _byId.set(assignment.id, assignment);
  }

  function showScaffoldModal(assignment) {
    const intel = resolveIntel(assignment);
    if (!intel || !intel.scaffoldSteps?.length) return;
    document.getElementById('fluxTassignIntelModal')?.remove();
    const panel = document.createElement('div');
    panel.id = 'fluxTassignIntelModal';
    panel.className = 'flux-tassign-intel-overlay';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.innerHTML = `
      <div class="flux-tassign-intel-card">
        <div class="flux-tassign-intel-head">
          <h3 class="flux-tassign-intel-title">${esc(assignment.title || 'Assignment')}</h3>
          <button type="button" class="flux-tassign-intel-close" data-close>✕</button>
        </div>
        <p class="flux-tassign-intel-sub">Suggested decomposition for students · ${esc(intel.frictionLabel)} (${intel.frictionScore}/100 friction)</p>
        <ol class="flux-tassign-scaffold-list">
          ${intel.scaffoldSteps
            .map(
              (s) =>
                `<li><span class="flux-tassign-step-label">${esc(s.label)}</span>${s.est_minutes ? `<span class="flux-tassign-step-est">~${s.est_minutes}m</span>` : ''}</li>`,
            )
            .join('')}
        </ol>
        <p class="flux-tassign-intel-foot">Read-only scaffold — does not change student tasks automatically.</p>
      </div>`;
    document.body.appendChild(panel);
    panel.addEventListener('click', (e) => {
      if (e.target === panel || e.target.closest('[data-close]')) panel.remove();
    });
  }

  function wireAssignmentRows(host) {
    if (!host || !enabled()) return;
    host.querySelectorAll('[data-asg-intel]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = btn.getAttribute('data-asg-intel');
        const assignment = _byId.get(id);
        if (assignment) showScaffoldModal(assignment);
      });
    });
  }

  async function persistIntel(sb, assignmentId, assignment) {
    if (!enabled() || !sb || !assignmentId) return;
    const fields = payloadFields(assignment);
    if (!Object.keys(fields).length) return;
    try {
      await sb.from('teacher_assignments').update(fields).eq('id', assignmentId);
    } catch (e) {
      console.warn('[FluxTeacherAssignIntel] persist failed', e);
    }
  }

  window.FluxTeacherAssignIntel = {
    TIERS,
    enabled,
    analyze,
    computeFriction,
    buildScaffold,
    payloadFields,
    resolveIntel,
    badgeHtml,
    scaffoldButtonHtml,
    remember,
    showScaffoldModal,
    wireAssignmentRows,
    persistIntel,
  };
})();
