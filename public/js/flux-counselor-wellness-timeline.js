/**
 * Counselor wellness timeline — mood + load + momentum snapshots (consent tier: wellness).
 * Flag: enable_counselor_wellness_timeline (default off).
 */
(function () {
  'use strict';

  const MOOD_EMOJI = ['', '😞', '😕', '😐', '🙂', '😄'];
  const DAYS_DEFAULT = 21;

  function enabled() {
    try {
      return !!window.FluxFeatureFlags?.isEnabled(
        'enable_counselor_wellness_timeline',
        false,
      );
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

  function todayStr() {
    if (typeof window.todayStr === 'function') return window.todayStr();
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function gatherMomentum() {
    let composite = null;
    let domains = null;
    try {
      if (window.FluxMomentumV2?.enabled?.() && window.FluxMomentumV2.refresh) {
        const s = FluxMomentumV2.refresh();
        if (s) {
          composite = s.composite;
          domains = {
            task: s.task,
            academic: s.academic,
            emotional: s.emotional,
            recovery: s.recovery,
          };
        }
      }
    } catch (_) {}
    if (composite == null) {
      const moods =
        typeof moodHistory !== 'undefined' && Array.isArray(moodHistory)
          ? moodHistory
          : [];
      const last = moods.slice(-1)[0];
      let emotional = 50;
      if (last) {
        const moodN = Math.max(1, Math.min(5, Number(last.mood) || 3));
        const stressN = Math.max(1, Math.min(10, Number(last.stress) || 5));
        emotional = Math.round(((moodN - 1) / 4) * 70 + ((10 - stressN) / 9) * 30);
      }
      let loadScore = 50;
      try {
        if (typeof calcCognitiveLoad === 'function') {
          const r = calcCognitiveLoad();
          if (r && typeof r.score === 'number') loadScore = r.score;
        }
      } catch (_) {}
      composite = Math.round((emotional + (100 - loadScore)) / 2);
      domains = { task: null, academic: null, emotional, recovery: 100 - loadScore };
    }
    return { composite, domains };
  }

  function buildSnapshotPayload() {
    const moods =
      typeof moodHistory !== 'undefined' && Array.isArray(moodHistory)
        ? moodHistory
        : [];
    const last = moods.filter((m) => m && m.date === todayStr()).pop() || moods.slice(-1)[0];
    let loadScore = null;
    try {
      if (typeof calcCognitiveLoad === 'function') {
        const r = calcCognitiveLoad();
        if (r && typeof r.score === 'number') loadScore = Math.round(r.score);
      }
    } catch (_) {}
    const mom = gatherMomentum();
    return {
      snapshot_date: todayStr(),
      mood: last ? Number(last.mood) || null : null,
      stress: last ? Number(last.stress) || null : null,
      sleep_hours: last && last.sleep != null ? Number(last.sleep) : null,
      load_score: loadScore,
      momentum_score: mom.composite,
      momentum_domains: mom.domains,
    };
  }

  async function hasWellnessConsent(sb, studentId) {
    if (!sb || !studentId) return false;
    try {
      const { data } = await sb
        .from('student_counselors')
        .select('insights_consent, consent_tier')
        .eq('student_id', studentId)
        .maybeSingle();
      return (
        !!data?.insights_consent && String(data.consent_tier || '') === 'wellness'
      );
    } catch (_) {
      return false;
    }
  }

  async function maybeCaptureSnapshot(sb, studentId) {
    if (!enabled() || !sb || !studentId) return { ok: false, skipped: true };
    if (!(await hasWellnessConsent(sb, studentId))) return { ok: false, skipped: true };
    const row = { student_id: studentId, ...buildSnapshotPayload() };
    const { error } = await sb.from('student_wellness_snapshots').upsert(row, {
      onConflict: 'student_id,snapshot_date',
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  async function loadTimeline(sb, studentId, days) {
    if (!sb || !studentId) return [];
    const n = Math.max(7, Math.min(60, Number(days) || DAYS_DEFAULT));
    const since = new Date();
    since.setDate(since.getDate() - n);
    const sinceStr = since.toISOString().slice(0, 10);
    try {
      const { data, error } = await sb
        .from('student_wellness_snapshots')
        .select(
          'snapshot_date,mood,stress,sleep_hours,load_score,momentum_score,momentum_domains',
        )
        .eq('student_id', studentId)
        .gte('snapshot_date', sinceStr)
        .order('snapshot_date', { ascending: true });
      if (error) throw error;
      return data || [];
    } catch (_) {
      return [];
    }
  }

  function formatShortDate(iso) {
    return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }

  function renderModalContent(studentName, rows) {
    const name = studentName || 'Student';
    if (!rows.length) {
      return `
        <div class="flux-wtl-head">
          <h3>Wellness timeline</h3>
          <p class="flux-wtl-sub">${esc(name)} — summaries only (mood, load, momentum). Not a clinical record.</p>
        </div>
        <div class="flux-wtl-empty">No snapshots yet. Student needs wellness-tier consent and at least one mood check-in.</div>`;
    }

    const maxMom = Math.max(
      1,
      ...rows.map((r) => Number(r.momentum_score) || 0),
    );
    const chart = rows
      .map((r) => {
        const h = Math.round(((Number(r.momentum_score) || 0) / maxMom) * 56) + 4;
        const d = String(r.snapshot_date || '').slice(5);
        return `<div class="flux-wtl-bar-wrap" title="${esc(r.snapshot_date)} momentum ${esc(r.momentum_score ?? '—')}">
          <div class="flux-wtl-bar" style="height:${h}px"></div>
          <span class="flux-wtl-bar-label">${esc(d)}</span>
        </div>`;
      })
      .join('');

    const list = [...rows]
      .reverse()
      .map((r) => {
        const mood = Number(r.mood);
        const emoji =
          mood >= 1 && mood <= 5 ? MOOD_EMOJI[mood] : '·';
        return `<div class="flux-wtl-row">
          <div class="flux-wtl-date">${esc(formatShortDate(r.snapshot_date))}</div>
          <div class="flux-wtl-metrics">
            <span class="flux-wtl-mood" title="Mood">${emoji}</span>
            <span>Stress <strong>${esc(r.stress != null ? r.stress : '—')}</strong>/10</span>
            <span>Load <strong>${esc(r.load_score != null ? r.load_score : '—')}</strong></span>
            <span>Momentum <strong>${esc(r.momentum_score != null ? r.momentum_score : '—')}</strong></span>
          </div>
        </div>`;
      })
      .join('');

    return `
      <div class="flux-wtl-head">
        <h3>Wellness timeline — ${esc(name)}</h3>
        <p class="flux-wtl-sub">Last ${rows.length} day(s) with shared check-ins. Engagement summaries only — not a diagnosis.</p>
      </div>
      <div class="flux-wtl-chart" aria-hidden="true">${chart}</div>
      <div class="flux-wtl-rows">${list}</div>`;
  }

  function openTimelineModal(studentName, rows) {
    if (document.getElementById('fluxWtlModal')) return;
    const body = renderModalContent(studentName, rows);
    const wrap = document.createElement('div');
    wrap.id = 'fluxWtlModal';
    wrap.className = 'edu-modal flux-wtl-modal';
    wrap.innerHTML = `
      <div class="edu-modal-backdrop"></div>
      <div class="edu-modal-panel">
        <button type="button" class="edu-modal-close" aria-label="Close" style="position:absolute;top:14px;right:14px">✕</button>
        ${body}
      </div>
    </div>`;
    document.body.appendChild(wrap);
    const close = () => wrap.remove();
    wrap.querySelector('.edu-modal-backdrop')?.addEventListener('click', close);
    wrap.querySelector('.edu-modal-close')?.addEventListener('click', close);
  }

  async function openForStudent(sb, studentId, studentName) {
    if (!enabled() || !sb || !studentId) return;
    const rows = await loadTimeline(sb, studentId, DAYS_DEFAULT);
    openTimelineModal(studentName, rows);
  }

  function wellnessConsentCheckboxHtml(checked, basicChecked) {
    if (!enabled()) return '';
    const disabled = !basicChecked ? ' disabled' : '';
    return `<div class="flux-caseload-consent-box">
      <label>
        <input type="checkbox" id="fluxCounselorWellnessConsent" ${checked ? 'checked' : ''}${disabled} />
        <span>Also share a <strong>wellness timeline</strong> (daily mood, stress, workload, and momentum summaries — not task titles or grades).</span>
      </label>
    </div>`;
  }

  function resolveConsentTier(basicOn, wellnessOn) {
    if (wellnessOn) return 'wellness';
    if (basicOn) return 'basic';
    return 'none';
  }

  async function saveConsentTier(sb, studentId, counselorId, tier) {
    if (window.FluxCounselorConsent?.saveTier) {
      return FluxCounselorConsent.saveTier(sb, studentId, counselorId, tier);
    }
    if (!sb || !studentId || !counselorId) return { ok: false };
    const t = String(tier || 'none');
    const on = t !== 'none';
    const { error } = await sb
      .from('student_counselors')
      .update({
        insights_consent: on,
        consent_tier: t,
        consented_at: on ? new Date().toISOString() : null,
      })
      .eq('student_id', studentId)
      .eq('counselor_id', counselorId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  function wireWellnessConsent(host, sb, studentId, counselorId) {
    if (!host || !sb || !enabled()) return;
    const basic = host.querySelector('#fluxCounselorInsightsConsent');
    const wellness = host.querySelector('#fluxCounselorWellnessConsent');
    if (!wellness) return;

    const syncDisabled = () => {
      if (!basic || !wellness) return;
      wellness.disabled = !basic.checked;
      if (!basic.checked) wellness.checked = false;
    };
    if (basic) {
      basic.addEventListener('change', syncDisabled);
      syncDisabled();
    }

    const persist = async () => {
      syncDisabled();
      const tier = resolveConsentTier(
        !!basic?.checked,
        !!wellness?.checked && !wellness.disabled,
      );
      const res = await saveConsentTier(sb, studentId, counselorId, tier);
      if (res.ok && typeof window.showToast === 'function') {
        const msg =
          tier === 'wellness'
            ? 'Wellness timeline sharing enabled'
            : tier === 'basic'
              ? 'Basic insights sharing enabled'
              : 'Counselor insights sharing turned off';
        window.showToast(msg, 'success', 2200);
      } else if (!res.ok && typeof window.showToast === 'function') {
        window.showToast(res.error || 'Could not update consent', 'error');
      }
      if (tier === 'wellness') {
        try {
          await maybeCaptureSnapshot(sb, studentId);
        } catch (_) {}
      }
    };

    wellness.addEventListener('change', persist);
    if (basic) basic.addEventListener('change', persist);
  }

  function timelineButtonHtml(studentId, show) {
    if (!enabled() || !show || !studentId) return '';
    return `<button type="button" class="flux-caseload-timeline-btn" data-caseload-timeline="${esc(studentId)}">View wellness timeline</button>`;
  }

  function install() {
    return enabled();
  }

  window.FluxCounselorWellnessTimeline = {
    enabled,
    maybeCaptureSnapshot,
    loadTimeline,
    openForStudent,
    openTimelineModal,
    wellnessConsentCheckboxHtml,
    resolveConsentTier,
    saveConsentTier,
    wireWellnessConsent,
    timelineButtonHtml,
    install,
  };
})();
