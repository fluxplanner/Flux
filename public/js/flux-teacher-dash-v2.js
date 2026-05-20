/**
 * Teacher dashboard v2 — class momentum overview cards (aggregates only, no PII).
 * Flag: enable_teacher_class_momentum (default off).
 */
(function () {
  'use strict';

  const ZONES = ['idle', 'warm', 'flow', 'fire'];

  let _aggByClass = new Map();

  function enabled() {
    try {
      return !!window.FluxFeatureFlags?.isEnabled('enable_teacher_class_momentum', false);
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

  function zoneFromScore(score) {
    const s = Number(score) || 0;
    if (s >= 80) return 'fire';
    if (s >= 60) return 'flow';
    if (s >= 35) return 'warm';
    return 'idle';
  }

  function zoneLabel(zone) {
    if (zone === 'fire') return 'High momentum';
    if (zone === 'flow') return 'On track';
    if (zone === 'warm') return 'Building';
    return 'Needs attention';
  }

  async function loadAggregates(sb, teacherId, classesRows) {
    const out = new Map();
    if (!sb || !teacherId || !classesRows?.length) return out;

    const enrollByCode = {};
    try {
      const { data: roster } = await sb
        .from('teacher_students')
        .select('class_code')
        .eq('teacher_id', teacherId);
      (roster || []).forEach((r) => {
        const code = String(r.class_code || '').trim();
        if (!code) return;
        enrollByCode[code] = (enrollByCode[code] || 0) + 1;
      });
    } catch (_) {}

    const assignmentIds = [];
    const classByAssignment = {};
    classesRows.forEach((cls) => {
      const cid = cls.id;
      const enrolled = enrollByCode[String(cls.class_code || '').trim()] || 0;
      const assignments = (cls.teacher_assignments || []).filter((a) => a && a.visible !== false);
      out.set(cid, {
        classId: cid,
        className: cls.class_name || 'Class',
        classCode: cls.class_code || '',
        enrolled,
        assignmentCount: assignments.length,
        submissions: 0,
        pendingReview: 0,
        graded: 0,
        recentSubmissions: 0,
        completionPct: 0,
        momentumScore: 0,
        zone: 'idle',
      });
      assignments.forEach((a) => {
        assignmentIds.push(a.id);
        classByAssignment[a.id] = cid;
      });
    });

    if (!assignmentIds.length) {
      out.forEach((agg) => finalizeAgg(agg));
      _aggByClass = out;
      return out;
    }

    const weekAgo = Date.now() - 7 * 86400000;
    try {
      const { data: comps } = await sb
        .from('student_completions')
        .select('assignment_id, status, submitted_at, teacher_assignments(class_id)')
        .in('assignment_id', assignmentIds);
      (comps || []).forEach((row) => {
        const cid =
          row.teacher_assignments?.class_id || classByAssignment[row.assignment_id];
        if (!cid || !out.has(cid)) return;
        const agg = out.get(cid);
        agg.submissions += 1;
        const st = String(row.status || '').toLowerCase();
        if (st === 'submitted') agg.pendingReview += 1;
        if (st === 'graded' || st === 'complete' || st === 'completed') agg.graded += 1;
        if (row.submitted_at && new Date(row.submitted_at).getTime() >= weekAgo) {
          agg.recentSubmissions += 1;
        }
      });
    } catch (e) {
      console.warn('[FluxTeacherDashV2] completions aggregate failed', e);
    }

    out.forEach((agg) => finalizeAgg(agg));
    _aggByClass = out;
    return out;
  }

  function finalizeAgg(agg) {
    const slots = Math.max(1, agg.enrolled * Math.max(1, agg.assignmentCount));
    const done = agg.graded + agg.pendingReview;
    agg.completionPct = Math.min(100, Math.round((done / slots) * 100));
    const reviewPenalty =
      agg.submissions > 0 ? Math.min(25, (agg.pendingReview / agg.submissions) * 25) : 0;
    const recentBoost =
      agg.enrolled > 0
        ? Math.min(30, Math.round((agg.recentSubmissions / agg.enrolled) * 30))
        : 0;
    agg.momentumScore = Math.max(
      0,
      Math.min(100, Math.round(agg.completionPct * 0.55 + recentBoost - reviewPenalty)),
    );
    agg.zone = zoneFromScore(agg.momentumScore);
  }

  function getAggregate(classId) {
    return _aggByClass.get(classId) || null;
  }

  function formatClassMeta(classId) {
    const agg = getAggregate(classId);
    if (!agg || !enabled()) return '';
    return ` · ${agg.momentumScore} momentum · ${agg.completionPct}% on track`;
  }

  function renderCard(agg) {
    const onTrack =
      agg.enrolled > 0
        ? Math.max(0, Math.min(100, agg.completionPct))
        : agg.completionPct;
    return `
      <button type="button" class="flux-tdash-mom-card flux-tdash-mom-card--${esc(agg.zone)}" data-class-id="${esc(agg.classId)}" title="${esc(zoneLabel(agg.zone))}">
        <div class="flux-tdash-mom-score" aria-hidden="true">${agg.momentumScore}</div>
        <div class="flux-tdash-mom-name">${esc(agg.className)}</div>
        <div class="flux-tdash-mom-zone">${esc(zoneLabel(agg.zone))}</div>
        <div class="flux-tdash-mom-meta">
          ${agg.enrolled} enrolled · ${onTrack}% on track
          ${agg.pendingReview > 0 ? ` · ${agg.pendingReview} to review` : ''}
        </div>
      </button>`;
  }

  async function renderMomentumSection(sb, teacherId, classesRows) {
    if (!enabled() || !classesRows?.length) return '';
    const aggregates = await loadAggregates(sb, teacherId, classesRows);
    const list = [...aggregates.values()].sort(
      (a, b) => b.momentumScore - a.momentumScore,
    );
    if (!list.length) return '';

    return `
      <section class="flux-tdash-momentum" aria-label="Class momentum overview">
        <div class="teacher-section-head">
          <h3>Class momentum</h3>
          <span class="flux-tdash-mom-hint">Aggregates only — no student names</span>
        </div>
        <div class="flux-tdash-momentum-grid">
          ${list.map((agg) => renderCard(agg)).join('')}
        </div>
      </section>`;
  }

  function wireMomentumCards(host) {
    if (!host) return;
    host.querySelectorAll('.flux-tdash-mom-card[data-class-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-class-id');
        if (id && typeof openTeacherClassView === 'function') openTeacherClassView(id);
      });
    });
  }

  window.FluxTeacherDashV2 = {
    enabled,
    ZONES,
    loadAggregates,
    getAggregate,
    formatClassMeta,
    renderMomentumSection,
    wireMomentumCards,
    zoneFromScore,
  };
})();
