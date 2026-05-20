/**
 * Counselor outreach queue — non-diagnostic engagement signals (consent-gated).
 * Flag: enable_counselor_risk_queue (default off).
 */
(function () {
  'use strict';

  const DISMISS_KEY = 'flux_counselor_alerts_dismissed_v1';
  const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 };
  const SNAPSHOT_DAYS = 14;

  const SIGNAL_LABELS = {
    engagement_priority: 'Priority outreach',
    engagement_watch: 'Engagement watch',
    momentum_drop: 'Momentum dip',
    momentum_low: 'Low momentum',
    mood_low: 'Low mood pattern',
    stress_high: 'Elevated stress',
    load_high: 'High workload signal',
  };

  function enabled() {
    try {
      return !!window.FluxFeatureFlags?.isEnabled('enable_counselor_risk_queue', false);
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

  function counselorUserId() {
    try {
      return window.currentUser?.id || null;
    } catch (_) {
      return null;
    }
  }

  function dismissStoreKey() {
    const uid = counselorUserId();
    return uid ? `${DISMISS_KEY}_${uid}` : DISMISS_KEY;
  }

  function loadDismissed() {
    try {
      const fs = window.FluxStorage;
      if (fs && typeof fs.load === 'function') {
        return fs.load(dismissStoreKey(), []) || [];
      }
      if (typeof load === 'function') return load(dismissStoreKey(), []) || [];
    } catch (_) {}
    return [];
  }

  function saveDismissed(ids) {
    try {
      const fs = window.FluxStorage;
      if (fs && typeof fs.save === 'function') fs.save(dismissStoreKey(), ids);
      else if (typeof save === 'function') save(dismissStoreKey(), ids);
    } catch (_) {}
  }

  function itemKey(studentId, signalId) {
    return `${studentId}:${signalId}`;
  }

  function buildAlertsForStudent(student, snapshots) {
    const out = [];
    if (!student?.consented) return out;

    const band = student.band || 'stable';
    if (band === 'priority') {
      out.push({
        id: 'engagement_priority',
        severity: 'high',
        detail:
          'Limited recent appointment engagement — consider a check-in (not a clinical assessment).',
      });
    } else if (band === 'watch') {
      out.push({
        id: 'engagement_watch',
        severity: 'medium',
        detail: 'Appointment pattern suggests follow-up may help.',
      });
    }

    if (student.consentTier !== 'wellness' || !snapshots?.length) return out;

    const recent = snapshots.slice(-5);
    if (recent.length >= 3) {
      const older = Number(recent[recent.length - 3].momentum_score);
      const latest = Number(recent[recent.length - 1].momentum_score);
      if (
        !Number.isNaN(older) &&
        !Number.isNaN(latest) &&
        older - latest >= 20
      ) {
        out.push({
          id: 'momentum_drop',
          severity: 'medium',
          detail: `Momentum summary fell from ${older} to ${latest} over recent check-ins.`,
        });
      }
    }

    const last3 = recent.slice(-3);
    const lowMood = last3.filter((s) => Number(s.mood) <= 2).length;
    if (lowMood >= 2) {
      out.push({
        id: 'mood_low',
        severity: 'high',
        detail: 'Multiple recent check-ins report low mood (1–2/5).',
      });
    }

    const highStress = last3.filter((s) => Number(s.stress) >= 8).length;
    if (highStress >= 2) {
      out.push({
        id: 'stress_high',
        severity: 'medium',
        detail: 'Stress rated 8+ on multiple recent check-ins.',
      });
    }

    const latest = recent[recent.length - 1];
    if (latest && Number(latest.load_score) >= 80) {
      out.push({
        id: 'load_high',
        severity: 'medium',
        detail: `Latest workload signal is elevated (${latest.load_score}/100).`,
      });
    }
    if (latest && Number(latest.momentum_score) <= 25) {
      out.push({
        id: 'momentum_low',
        severity: 'high',
        detail: `Latest momentum summary is low (${latest.momentum_score}/100).`,
      });
    }

    return out;
  }

  async function loadSnapshotsByStudent(sb, studentIds) {
    const map = {};
    if (!sb || !studentIds?.length) return map;
    const since = new Date();
    since.setDate(since.getDate() - SNAPSHOT_DAYS);
    const sinceStr = since.toISOString().slice(0, 10);
    try {
      const { data } = await sb
        .from('student_wellness_snapshots')
        .select(
          'student_id,snapshot_date,mood,stress,load_score,momentum_score',
        )
        .in('student_id', studentIds)
        .gte('snapshot_date', sinceStr)
        .order('snapshot_date', { ascending: true });
      (data || []).forEach((row) => {
        const id = row.student_id;
        if (!map[id]) map[id] = [];
        map[id].push(row);
      });
    } catch (_) {}
    return map;
  }

  async function loadQueue(sb, counselorDbId, caseload) {
    if (!enabled()) return { items: [], dismissedCount: 0 };
    const students = caseload?.consented || [];
    const wellnessIds = students
      .filter((s) => s.consentTier === 'wellness')
      .map((s) => s.studentId);
    const snapshotsByStudent = await loadSnapshotsByStudent(sb, wellnessIds);

    const dismissed = new Set(loadDismissed());
    const items = [];

    students.forEach((student) => {
      const snaps = snapshotsByStudent[student.studentId] || [];
      const alerts = buildAlertsForStudent(student, snaps);
      alerts.forEach((alert) => {
        const key = itemKey(student.studentId, alert.id);
        if (dismissed.has(key)) return;
        items.push({
          key,
          studentId: student.studentId,
          displayName: student.displayName,
          wellnessTier: student.consentTier === 'wellness',
          signalId: alert.id,
          signalLabel: SIGNAL_LABELS[alert.id] || alert.id,
          severity: alert.severity || 'medium',
          detail: alert.detail,
        });
      });
    });

    items.sort(
      (a, b) =>
        (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9),
    );

    return {
      items,
      dismissedCount: dismissed.size,
      counselorDbId,
    };
  }

  function renderSection(queue) {
    if (!enabled()) return '';
    const items = queue?.items || [];

    const rows =
      items.length === 0
        ? '<p class="flux-risk-queue-empty">No active outreach signals. Students with consent appear here when engagement or wellness summaries suggest follow-up.</p>'
        : `<div class="flux-risk-queue-list">${items
            .map(
              (it) => `
          <article class="flux-risk-queue-row flux-risk-queue-row--${esc(it.severity)}" data-risk-key="${esc(it.key)}">
            <div>
              <div class="flux-risk-queue-row-title">${esc(it.displayName)}</div>
              <div class="flux-risk-queue-row-signal">${esc(it.signalLabel)}</div>
              <p class="flux-risk-queue-row-detail">${esc(it.detail)}</p>
            </div>
            <div class="flux-risk-queue-actions">
              <button type="button" class="primary" data-risk-msg="${esc(it.studentId)}">Message</button>
              ${
                it.wellnessTier
                  ? `<button type="button" data-risk-timeline="${esc(it.studentId)}" data-risk-name="${esc(it.displayName)}">Timeline</button>`
                  : ''
              }
              <button type="button" data-risk-dismiss="${esc(it.key)}">Dismiss</button>
            </div>
          </article>`,
            )
            .join('')}</div>`;

    return `
      <section class="flux-risk-queue-section" aria-label="Outreach queue">
        <div class="flux-risk-queue-head">
          <h3>Outreach queue</h3>
          <span class="flux-risk-queue-hint">${items.length} signal${items.length === 1 ? '' : 's'} · engagement only</span>
        </div>
        ${rows}
        <p class="flux-risk-queue-disclaimer">Signals are not diagnoses. Use professional judgment; escalate per school policy when needed.</p>
      </section>`;
  }

  function dismissAlert(key) {
    if (!key) return;
    const set = new Set(loadDismissed());
    set.add(key);
    saveDismissed([...set]);
  }

  function wire(host, sb, onDismiss) {
    if (!host) return;
    host.querySelectorAll('[data-risk-msg]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-risk-msg');
        if (id && window.FluxMessaging?.openThreadById) {
          FluxMessaging.openThreadById(id);
        }
      });
    });
    host.querySelectorAll('[data-risk-timeline]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-risk-timeline');
        const name = btn.getAttribute('data-risk-name') || 'Student';
        if (id && sb && window.FluxCounselorWellnessTimeline?.openForStudent) {
          FluxCounselorWellnessTimeline.openForStudent(sb, id, name);
        }
      });
    });
    host.querySelectorAll('[data-risk-dismiss]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-risk-dismiss');
        dismissAlert(key);
        const row = btn.closest('[data-risk-key]');
        if (row) row.remove();
        if (typeof onDismiss === 'function') onDismiss();
        else if (typeof window.renderCounselorDashboard === 'function') {
          renderCounselorDashboard();
        }
      });
    });
  }

  function install() {
    return enabled();
  }

  window.FluxCounselorRiskQueue = {
    enabled,
    loadQueue,
    renderSection,
    buildAlertsForStudent,
    dismissAlert,
    wire,
    install,
  };
})();
