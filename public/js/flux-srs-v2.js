/**
 * Spaced repetition v2 — deduped scheduling, card badges, telemetry.
 * Flag: enable_srs_v2 (default off). Falls back to legacy generateSRSReviews in app.js.
 */
(function () {
  'use strict';

  const INTERVALS_DAYS = [1, 7, 30];
  const STORE_KEY = 'flux_srs_v2_stats_v1';

  let _wired = false;
  let _prevAfterRender = null;

  function enabled() {
    try {
      return !!window.FluxFeatureFlags?.isEnabled('enable_srs_v2', false);
    } catch (_) {
      return false;
    }
  }

  function todayStr() {
    if (typeof window.todayStr === 'function') return window.todayStr();
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function taskList() {
    return typeof tasks !== 'undefined' && Array.isArray(tasks) ? tasks : [];
  }

  function findTask(id) {
    return taskList().find((t) => t && t.id === id) || null;
  }

  function persistTasks() {
    try {
      if (typeof save === 'function') save('tasks', taskList());
    } catch (_) {}
    try {
      if (typeof syncKey === 'function') syncKey('tasks', taskList());
    } catch (_) {}
  }

  function daysUntil(dateStr) {
    if (!dateStr) return 99;
    const ts = todayStr();
    const a = new Date(`${dateStr}T12:00:00`);
    const b = new Date(`${ts}T12:00:00`);
    return Math.round((a - b) / 86400000);
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

  function scheduledIntervals(parentId) {
    const pid = Number(parentId);
    return new Set(
      taskList()
        .filter((t) => t && t.srsReview && Number(t.srsParentId) === pid)
        .map((t) => Number(t.srsIntervalDays))
        .filter((n) => Number.isFinite(n)),
    );
  }

  function baseScheduleDate(parent) {
    if (parent.completedAt) {
      try {
        return new Date(parent.completedAt).toISOString().slice(0, 10);
      } catch (_) {}
    }
    return todayStr();
  }

  function bumpStats(field, n) {
    try {
      const fs = window.FluxStorage;
      let stats = { scheduled: 0, completed: 0 };
      if (fs && typeof fs.load === 'function') stats = fs.load(STORE_KEY, stats) || stats;
      else if (typeof load === 'function') stats = load(STORE_KEY, stats) || stats;
      stats[field] = (Number(stats[field]) || 0) + (n || 1);
      stats.updatedAt = new Date().toISOString();
      if (fs && typeof fs.save === 'function') fs.save(STORE_KEY, stats);
      else if (typeof save === 'function') save(STORE_KEY, stats);
    } catch (_) {}
  }

  function emitTelemetry(eventName, payload) {
    try {
      if (typeof FluxBus !== 'undefined' && FluxBus.emit) {
        FluxBus.emit(eventName, payload);
      }
    } catch (_) {}
  }

  function scheduleReviews(parentTask) {
    if (!enabled() || !parentTask || !parentTask.srsEnabled) return 0;
    if (parentTask.srsReviewsScheduled) {
      const existing = scheduledIntervals(parentTask.id);
      if (existing.size >= INTERVALS_DAYS.length) return 0;
    }

    const baseStr = baseScheduleDate(parentTask);
    const base = new Date(`${baseStr}T12:00:00`);
    const taken = scheduledIntervals(parentTask.id);
    const created = [];

    INTERVALS_DAYS.forEach((days, idx) => {
      if (taken.has(days)) return;
      const d = new Date(base);
      d.setDate(d.getDate() + days);
      const review = {
        id: Date.now() + Math.random(),
        name: `🔄 Review: ${String(parentTask.name || 'Task').slice(0, 80)}`,
        subject: parentTask.subject || '',
        priority: 'low',
        type: 'study',
        date: d.toISOString().slice(0, 10),
        estTime: Math.max(5, Math.round((parentTask.estTime || 30) * 0.5)),
        difficulty: Math.max(1, (parentTask.difficulty || 3) - 1),
        notes: '',
        done: false,
        rescheduled: 0,
        createdAt: Date.now(),
        srsReview: true,
        srsParentId: parentTask.id,
        srsIntervalDays: days,
        srsStage: idx + 1,
        cogLoadWeight: 0.5,
      };
      if (typeof calcUrgency === 'function') review.urgencyScore = calcUrgency(review);
      taskList().push(review);
      created.push(review);
    });

    if (!created.length) return 0;

    const parent = findTask(parentTask.id);
    if (parent) {
      parent.srsReviewsScheduled = true;
      parent.srsScheduledAt = new Date().toISOString();
      if (!parent.srsReviewChildIds) parent.srsReviewChildIds = [];
      created.forEach((r) => parent.srsReviewChildIds.push(r.id));
    }

    persistTasks();
    bumpStats('scheduled', created.length);

    emitTelemetry('srs_reviews_scheduled', {
      parent_id: parentTask.id,
      count: created.length,
      intervals: created.map((r) => r.srsIntervalDays),
      subject: parentTask.subject || null,
    });

    if (typeof showToast === 'function') {
      showToast(
        `🔄 ${created.length} spaced review${created.length > 1 ? 's' : ''} scheduled (${created.map((r) => r.srsIntervalDays + 'd').join(', ')})`,
        'success',
      );
    }

    try {
      if (typeof renderTasks === 'function') renderTasks();
      else if (typeof renderStats === 'function') renderStats();
    } catch (_) {}
    refreshDueChip();

    return created.length;
  }

  function onReviewCompleted(reviewTask) {
    if (!enabled() || !reviewTask || !reviewTask.srsReview) return;
    emitTelemetry('srs_review_completed', {
      parent_id: reviewTask.srsParentId,
      stage: reviewTask.srsStage,
      interval_days: reviewTask.srsIntervalDays,
      subject: reviewTask.subject || null,
    });
    bumpStats('completed', 1);
    refreshDueChip();
  }

  function reviewsDue() {
    const ts = todayStr();
    return taskList().filter((t) => t && t.srsReview && !t.done && t.date && t.date <= ts);
  }

  function cardMeta(task) {
    if (!enabled() || !task) {
      return { className: '', badgeHtml: '', dataAttrs: '' };
    }

    if (task.srsReview && !task.done) {
      const du = daysUntil(task.date);
      let label = 'SRS review';
      let tier = 'upcoming';
      if (du < 0) {
        label = `Review overdue ${Math.abs(du)}d`;
        tier = 'overdue';
      } else if (du === 0) {
        label = 'Review today';
        tier = 'today';
      } else if (du <= 3) {
        label = `Review in ${du}d`;
        tier = 'soon';
      } else {
        label = `Review +${du}d`;
      }
      const cls = ` srs-review flux-srs-review--${tier}`;
      const badge = `<span class="flux-srs-badge flux-srs-badge--${tier}" title="Spaced repetition review">🔄 ${escapeHtml(label)}</span>`;
      return {
        className: cls,
        badgeHtml: badge,
        dataAttrs: ` data-srs-review="1" data-srs-stage="${task.srsStage || ''}"`,
      };
    }

    if (task.srsEnabled && !task.done && !task.srsReviewsScheduled) {
      const badge =
        '<span class="flux-srs-badge flux-srs-badge--pending" title="Reviews schedule when you complete this task">🔄 SRS on</span>';
      return { className: '', badgeHtml: badge, dataAttrs: ' data-srs-enabled="1"' };
    }

    return { className: '', badgeHtml: '', dataAttrs: '' };
  }

  function ensureDueChip() {
    let chip = document.getElementById('fluxSrsDueChip');
    if (chip) return chip;
    const host =
      document.querySelector('.dash-v2-work-head') || document.getElementById('dashHero');
    if (!host) return null;
    chip = document.createElement('button');
    chip.type = 'button';
    chip.id = 'fluxSrsDueChip';
    chip.className = 'flux-srs-due-chip';
    chip.hidden = true;
    chip.title = 'Jump to spaced reviews due today';
    chip.addEventListener('click', (e) => {
      e.preventDefault();
      try {
        if (typeof nav === 'function') nav('dashboard');
        if (typeof setFilter === 'function') {
          const btn = document.querySelector('.dash-filters button[onclick*="today"]');
          setFilter('today', btn || null);
        }
      } catch (_) {}
      const first = document.querySelector('.task-item.srs-review, .task-item.flux-srs-review--today');
      if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    host.appendChild(chip);
    return chip;
  }

  function refreshDueChip() {
    if (!enabled()) {
      const chip = document.getElementById('fluxSrsDueChip');
      if (chip) chip.hidden = true;
      return;
    }
    const due = reviewsDue();
    const chip = ensureDueChip();
    if (!chip) return;
    if (!due.length) {
      chip.hidden = true;
      return;
    }
    chip.hidden = false;
    chip.textContent = `🔄 ${due.length} review${due.length > 1 ? 's' : ''} due`;
  }

  function wireBus() {
    if (_wired || typeof FluxBus === 'undefined' || !FluxBus.on) return;
    _wired = true;
    FluxBus.on('task_completed', (t) => {
      if (!enabled() || !t) return;
      if (t.srsReview && t.srsParentId) onReviewCompleted(t);
    });
  }

  function hookRenderTasks() {
    if (_prevAfterRender) return;
    _prevAfterRender = window.fluxAfterRenderTasks;
    window.fluxAfterRenderTasks = function () {
      try {
        if (typeof _prevAfterRender === 'function') _prevAfterRender();
      } catch (_) {}
      refreshDueChip();
    };
  }

  function install() {
    if (!enabled()) return false;
    wireBus();
    hookRenderTasks();
    refreshDueChip();
    return true;
  }

  window.FluxSrsV2 = {
    enabled,
    INTERVALS_DAYS,
    scheduleReviews,
    onReviewCompleted,
    cardMeta,
    reviewsDue,
    refreshDueChip,
    install,
    STORE_KEY,
  };
})();
