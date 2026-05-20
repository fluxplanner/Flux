/**
 * Task friction & aging v2 — integrated task card badges + reschedule tracking.
 * Flag: enable_task_friction (default off). Legacy friction CSS/classes when off.
 */
(function () {
  'use strict';

  function enabled() {
    try {
      return !!window.FluxFeatureFlags?.isEnabled('enable_task_friction', false);
    } catch (_) {
      return false;
    }
  }

  function todayStr() {
    if (typeof window.todayStr === 'function') return window.todayStr();
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function daysOverdue(dateStr) {
    if (!dateStr) return 0;
    const ts = todayStr();
    if (dateStr >= ts) return 0;
    const a = new Date(`${dateStr}T12:00:00`);
    const b = new Date(`${ts}T12:00:00`);
    return Math.max(0, Math.round((b - a) / 86400000));
  }

  function daysSinceCreated(createdAt) {
    if (!createdAt) return 0;
    const c = new Date(Number(createdAt));
    if (Number.isNaN(c.getTime())) return 0;
    return Math.max(0, Math.round((Date.now() - c.getTime()) / 86400000));
  }

  function tierRank(tier) {
    if (tier === 'severe') return 3;
    if (tier === 'aged') return 2;
    if (tier === 'warning') return 1;
    return 0;
  }

  function maxTier(a, b) {
    return tierRank(a) >= tierRank(b) ? a : b;
  }

  /**
   * @returns {{ tier: string, score: number, rescheduled: number, overdueDays: number, staleDays: number, shouldOfferSplit: boolean, label: string, title: string }}
   */
  function analyze(task) {
    if (!task || task.done) {
      return {
        tier: 'none',
        score: 0,
        rescheduled: 0,
        overdueDays: 0,
        staleDays: 0,
        shouldOfferSplit: false,
        label: '',
        title: '',
      };
    }

    const rescheduled = Number(task.rescheduled) || 0;
    const overdueDays = daysOverdue(task.date);
    const staleDays = daysSinceCreated(task.createdAt);
    const score = Math.min(
      100,
      rescheduled * 14 + overdueDays * 10 + Math.max(0, staleDays - 5) * 2,
    );

    let tier = 'none';
    if (score >= 55 || rescheduled >= 5) tier = 'severe';
    else if (score >= 32 || rescheduled >= 3) tier = 'aged';
    else if (score >= 10 || rescheduled >= 1) tier = 'warning';

    if (window.FluxBehavior && typeof window.FluxBehavior.frictionTier === 'function') {
      tier = maxTier(tier, window.FluxBehavior.frictionTier(task));
    }

    let label = '';
    if (tier !== 'none') {
      if (rescheduled >= 2) label = `${rescheduled}× slipped`;
      else if (overdueDays >= 1) label = `${overdueDays}d overdue`;
      else if (staleDays >= 10) label = `${staleDays}d aging`;
      else label = 'Friction';
    }

    const title = [
      rescheduled ? `Rescheduled ${rescheduled}×` : '',
      overdueDays ? `${overdueDays} day(s) overdue` : '',
      staleDays ? `Open ${staleDays} day(s)` : '',
    ]
      .filter(Boolean)
      .join(' · ');

    return {
      tier,
      score,
      rescheduled,
      overdueDays,
      staleDays,
      shouldOfferSplit:
        (window.FluxBehavior && window.FluxBehavior.shouldOfferSplit
          ? window.FluxBehavior.shouldOfferSplit(task)
          : rescheduled >= 3) && !task.frictionHandled,
      label,
      title,
    };
  }

  function cardMeta(task) {
    const m = analyze(task);
    if (m.tier === 'none') {
      return { tier: 'none', className: '', badgeHtml: '', dataAttrs: '' };
    }
    const cls = ` friction-${m.tier}`;
    const badge = `<span class="flux-friction-badge flux-friction-${m.tier}" title="${escapeAttr(
      m.title || m.label,
    )}">${escapeHtml(m.label)}</span>`;
    return {
      tier: m.tier,
      className: cls,
      badgeHtml: badge,
      dataAttrs: ` data-friction-tier="${m.tier}" data-friction-score="${m.score}"`,
    };
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, '&quot;');
  }

  function recordDateChange(task, oldDate, newDate) {
    if (!task || oldDate === newDate) return false;
    const o = oldDate == null ? '' : String(oldDate);
    const n = newDate == null ? '' : String(newDate);
    if (o === n) return false;
    task.rescheduled = (Number(task.rescheduled) || 0) + 1;
    task.lastRescheduledAt = Date.now();
    return true;
  }

  async function checkIntervention(task) {
    if (!task || task.done) return;
    const m = analyze(task);
    if (m.tier !== 'aged' && m.tier !== 'severe') return;
    if (!m.shouldOfferSplit) return;
    task.frictionHandled = true;
    try {
      if (typeof save === 'function') save('tasks', typeof tasks !== 'undefined' ? tasks : []);
    } catch (_) {}
    if (typeof showToast === 'function') {
      showToast(`"${String(task.name || 'Task').slice(0, 28)}" keeps slipping — breaking it down…`, 'warning');
    }
    if (typeof breakItDown === 'function') {
      await breakItDown(task.id);
    }
  }

  window.FluxFriction = {
    enabled,
    analyze,
    cardMeta,
    recordDateChange,
    checkIntervention,
    daysOverdue,
    daysSinceCreated,
  };
})();
