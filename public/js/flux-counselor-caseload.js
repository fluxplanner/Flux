/**
 * Counselor caseload health dashboard — consent-gated engagement signals (non-diagnostic).
 * Flag: enable_counselor_caseload (default off).
 */
(function () {
  'use strict';

  const BANDS = ['stable', 'watch', 'priority'];

  function enabled() {
    try {
      return !!window.FluxFeatureFlags?.isEnabled('enable_counselor_caseload', false);
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

  function bandLabel(band) {
    if (band === 'priority') return 'Priority outreach';
    if (band === 'watch') return 'Watch';
    return 'Stable';
  }

  function computeEngagementBand(studentId, appointments) {
    const mine = (appointments || []).filter((a) => a.student_id === studentId);
    const today = new Date();
    let lastDate = null;
    let noShows = 0;
    let pending = 0;
    mine.forEach((a) => {
      const st = String(a.status || '').toLowerCase();
      if (st === 'no_show') noShows += 1;
      if (st === 'pending' || st === 'confirmed') pending += 1;
      if (a.date) {
        const d = new Date(`${a.date}T12:00:00`);
        if (!lastDate || d > lastDate) lastDate = d;
      }
    });
    const daysSince = lastDate
      ? Math.round((today - lastDate) / 86400000)
      : 999;
    if (noShows >= 2 || (pending === 0 && daysSince > 60)) return 'priority';
    if (noShows >= 1 || pending > 0 || daysSince > 35) return 'watch';
    return 'stable';
  }

  async function loadCaseload(sb, counselorDbId) {
    if (!sb || !counselorDbId) {
      return { total: 0, consented: [], awaitingConsent: 0, students: [] };
    }
    const { data: links } = await sb
      .from('student_counselors')
      .select('student_id, insights_consent, consent_tier, consented_at')
      .eq('counselor_id', counselorDbId);
    const rows = links || [];
    const studentIds = rows.map((r) => r.student_id).filter(Boolean);
    if (!studentIds.length) {
      return { total: 0, consented: [], awaitingConsent: 0, students: [] };
    }

    const since = new Date();
    since.setDate(since.getDate() - 120);
    const sinceStr = since.toISOString().slice(0, 10);

    let appointments = [];
    let names = {};
    try {
      const { data: appts } = await sb
        .from('counselor_appointments')
        .select('student_id, status, date')
        .eq('counselor_id', counselorDbId)
        .gte('date', sinceStr);
      appointments = appts || [];
    } catch (_) {}

    try {
      const { data: roles } = await sb
        .from('user_roles')
        .select('user_id, display_name')
        .in('user_id', studentIds);
      (roles || []).forEach((r) => {
        names[r.user_id] = r.display_name || '';
      });
    } catch (_) {}

    const students = rows.map((link) => {
      const tier = String(link.consent_tier || 'none');
      const consented =
        !!link.insights_consent && tier !== 'none';
      const wellnessTimeline =
        consented &&
        tier === 'wellness' &&
        !!window.FluxCounselorWellnessTimeline?.enabled?.();
      const band = consented ? computeEngagementBand(link.student_id, appointments) : null;
      const lastAppt = (appointments || [])
        .filter((a) => a.student_id === link.student_id && a.date)
        .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
      return {
        studentId: link.student_id,
        displayName:
          names[link.student_id] ||
          `Student ${String(link.student_id).slice(0, 6)}`,
        consented,
        consentTier: tier,
        wellnessTimeline,
        band,
        lastApptDate: lastAppt?.date || null,
        pendingAppt: (appointments || []).some(
          (a) =>
            a.student_id === link.student_id &&
            ['pending', 'confirmed'].includes(String(a.status || '').toLowerCase()),
        ),
      };
    });

    const consented = students.filter((s) => s.consented);
    return {
      total: students.length,
      consented,
      awaitingConsent: students.length - consented.length,
      students,
    };
  }

  function renderSection(caseload) {
    if (!enabled() || !caseload) return '';
    const priority = caseload.consented.filter((s) => s.band === 'priority').length;
    const watch = caseload.consented.filter((s) => s.band === 'watch').length;
    const stable = caseload.consented.filter((s) => s.band === 'stable').length;

    const cards =
      caseload.consented.length === 0
        ? '<p style="font-size:.8rem;color:var(--muted2);margin:0">No students have opted in to share basic engagement signals yet.</p>'
        : `<div class="flux-caseload-grid">${caseload.consented
            .sort((a, b) => {
              const order = { priority: 0, watch: 1, stable: 2 };
              return (order[a.band] || 9) - (order[b.band] || 9);
            })
            .map(
              (s) => `
          <button type="button" class="flux-caseload-card flux-caseload-card--${esc(s.band)}" data-caseload-stu="${esc(s.studentId)}" title="Open message thread">
            <div class="flux-caseload-card-name">${esc(s.displayName)}</div>
            <div class="flux-caseload-card-band">${esc(bandLabel(s.band))}</div>
            ${window.FluxCounselorConsent?.cardBadgeHtml?.(s.consentTier) || ''}
            <div class="flux-caseload-card-meta">${
              s.lastApptDate
                ? `Last appt ${esc(new Date(s.lastApptDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))}`
                : 'No recent appointments'
            }${s.pendingAppt ? ' · Upcoming scheduled' : ''}</div>
            ${window.FluxCounselorWellnessTimeline?.timelineButtonHtml?.(s.studentId, s.wellnessTimeline) || ''}
          </button>`,
            )
            .join('')}</div>`;

    return `
      <section class="flux-caseload-section" aria-label="Caseload health">
        <div class="flux-caseload-head">
          <h3>Caseload health</h3>
          <span class="flux-caseload-hint">Engagement signals only · not a diagnosis</span>
        </div>
        <div class="flux-caseload-stats">
          <div class="flux-caseload-stat"><div class="flux-caseload-stat-n">${caseload.total}</div><div class="flux-caseload-stat-l">Assigned</div></div>
          <div class="flux-caseload-stat"><div class="flux-caseload-stat-n">${caseload.consented.length}</div><div class="flux-caseload-stat-l">Consented</div></div>
          <div class="flux-caseload-stat"><div class="flux-caseload-stat-n">${priority}</div><div class="flux-caseload-stat-l">Priority</div></div>
          <div class="flux-caseload-stat"><div class="flux-caseload-stat-n">${watch}</div><div class="flux-caseload-stat-l">Watch</div></div>
          <div class="flux-caseload-stat"><div class="flux-caseload-stat-n">${stable}</div><div class="flux-caseload-stat-l">Stable</div></div>
        </div>
        ${cards}
        ${
          caseload.awaitingConsent > 0
            ? `<p class="flux-caseload-awaiting">${caseload.awaitingConsent} student${caseload.awaitingConsent === 1 ? '' : 's'} assigned — insights appear after they opt in (Profile → My counselor).</p>`
            : ''
        }
        <p class="flux-caseload-disclaimer">Bands use appointment patterns only. Wellness timeline (mood, load, momentum) requires student wellness-tier consent.</p>
      </section>`;
  }

  function consentCheckboxHtml(basicChecked, wellnessChecked, counselorName, consentedAt) {
    if (window.FluxCounselorConsent?.enabled?.() && window.FluxCounselorConsent.renderStudentPanel) {
      const tier = wellnessChecked ? 'wellness' : basicChecked ? 'basic' : 'none';
      return FluxCounselorConsent.renderStudentPanel(tier, counselorName, consentedAt);
    }
    if (!enabled()) return '';
    const basic = !!basicChecked;
    const wellness = !!wellnessChecked;
    let html = `<div class="flux-caseload-consent-box">
      <label>
        <input type="checkbox" id="fluxCounselorInsightsConsent" ${basic ? 'checked' : ''} />
        <span>Share <strong>basic engagement signals</strong> with my counselor (appointment patterns — not grades, tasks, or mood). I can turn this off anytime.</span>
      </label>
    </div>`;
    if (window.FluxCounselorWellnessTimeline?.wellnessConsentCheckboxHtml) {
      html += FluxCounselorWellnessTimeline.wellnessConsentCheckboxHtml(wellness, basic);
    }
    return html;
  }

  async function saveStudentConsent(sb, studentId, counselorId, optedIn) {
    const tier = optedIn ? 'basic' : 'none';
    if (window.FluxCounselorWellnessTimeline?.saveConsentTier) {
      return FluxCounselorWellnessTimeline.saveConsentTier(sb, studentId, counselorId, tier);
    }
    if (!sb || !studentId || !counselorId) return { ok: false };
    const { error } = await sb
      .from('student_counselors')
      .update({
        insights_consent: !!optedIn,
        consent_tier: tier,
        consented_at: optedIn ? new Date().toISOString() : null,
      })
      .eq('student_id', studentId)
      .eq('counselor_id', counselorId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  function wireCounselorSection(host, sb) {
    if (!host) return;
    host.querySelectorAll('[data-caseload-timeline]').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const id = btn.getAttribute('data-caseload-timeline');
        const card = btn.closest('[data-caseload-stu]');
        const name =
          card?.querySelector('.flux-caseload-card-name')?.textContent?.trim() ||
          'Student';
        if (
          id &&
          sb &&
          window.FluxCounselorWellnessTimeline?.openForStudent
        ) {
          FluxCounselorWellnessTimeline.openForStudent(sb, id, name);
        }
      });
    });
    host.querySelectorAll('[data-caseload-stu]').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        if (ev.target.closest('[data-caseload-timeline]')) return;
        const id = btn.getAttribute('data-caseload-stu');
        if (id && typeof window.FluxMessaging !== 'undefined' && FluxMessaging.openThreadById) {
          FluxMessaging.openThreadById(id);
        }
      });
    });
  }

  function wireStudentConsent(host, sb, studentId, counselorId) {
    if (!host || !sb) return;
    if (window.FluxCounselorConsent?.enabled?.() && window.FluxCounselorConsent.wireStudentPanel) {
      FluxCounselorConsent.wireStudentPanel(host, sb, studentId, counselorId);
      return;
    }
    if (window.FluxCounselorWellnessTimeline?.wireWellnessConsent) {
      FluxCounselorWellnessTimeline.wireWellnessConsent(
        host,
        sb,
        studentId,
        counselorId,
      );
      return;
    }
    const cb = host.querySelector('#fluxCounselorInsightsConsent');
    if (!cb) return;
    cb.addEventListener('change', async () => {
      const res = await saveStudentConsent(sb, studentId, counselorId, cb.checked);
      if (res.ok && typeof window.showToast === 'function') {
        window.showToast(
          cb.checked ? 'Basic insights sharing enabled' : 'Insights sharing turned off',
          'success',
          2200,
        );
      } else if (!res.ok && typeof window.showToast === 'function') {
        window.showToast(res.error || 'Could not update consent', 'error');
      }
    });
  }

  function install() {
    return enabled();
  }

  window.FluxCounselorCaseload = {
    BANDS,
    enabled,
    loadCaseload,
    renderSection,
    consentCheckboxHtml,
    saveStudentConsent,
    wireCounselorSection,
    wireStudentConsent,
    install,
  };
})();
