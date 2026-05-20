/**
 * Counselor insights — student visibility tiers + consent audit.
 * Flag: enable_counselor_consent_flows (default off).
 */
(function () {
  'use strict';

  const TIERS = [
    {
      id: 'none',
      title: 'Private',
      description: 'Your counselor can message you and book appointments only.',
      includes: ['No engagement or wellness summaries'],
    },
    {
      id: 'basic',
      title: 'Engagement',
      description: 'Share appointment patterns so your counselor can prioritize outreach.',
      includes: [
        'Engagement band on caseload dashboard',
        'Appointment-based outreach signals',
      ],
    },
    {
      id: 'wellness',
      title: 'Wellness summaries',
      description: 'Includes engagement plus daily mood, stress, workload, and momentum summaries.',
      includes: [
        'Everything in Engagement',
        'Wellness timeline (no task titles or grades)',
        'Wellness-based outreach signals',
      ],
    },
  ];

  function enabled() {
    try {
      return !!window.FluxFeatureFlags?.isEnabled(
        'enable_counselor_consent_flows',
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

  function tierLabel(tier) {
    const t = TIERS.find((x) => x.id === tier);
    return t ? t.title : 'Private';
  }

  function normalizeTier(tier) {
    const t = String(tier || 'none');
    return ['none', 'basic', 'wellness'].includes(t) ? t : 'none';
  }

  async function fetchCurrentLink(sb, studentId, counselorId) {
    if (!sb || !studentId) return null;
    try {
      let q = sb
        .from('student_counselors')
        .select('counselor_id, insights_consent, consent_tier, consented_at')
        .eq('student_id', studentId);
      if (counselorId) q = q.eq('counselor_id', counselorId);
      const { data } = await q.maybeSingle();
      return data;
    } catch (_) {
      return null;
    }
  }

  async function saveTier(sb, studentId, counselorId, newTier, opts) {
    if (!sb || !studentId || !counselorId) return { ok: false };
    const tier = normalizeTier(newTier);
    const link = await fetchCurrentLink(sb, studentId, counselorId);
    const previousTier = normalizeTier(link?.consent_tier);
    if (previousTier === tier) return { ok: true, unchanged: true, tier };

    const on = tier !== 'none';
    const { error } = await sb
      .from('student_counselors')
      .update({
        insights_consent: on,
        consent_tier: tier,
        consented_at: on ? new Date().toISOString() : null,
      })
      .eq('student_id', studentId)
      .eq('counselor_id', counselorId);
    if (error) return { ok: false, error: error.message };

    try {
      const uid =
        opts?.changedBy ||
        (typeof window.currentUser !== 'undefined' && window.currentUser?.id) ||
        studentId;
      await sb.from('counselor_consent_audit').insert({
        student_id: studentId,
        counselor_id: counselorId,
        previous_tier: previousTier,
        new_tier: tier,
        changed_by: uid,
      });
    } catch (e) {
      console.warn('[Flux consent] audit insert failed', e);
    }

    if (
      tier === 'wellness' &&
      window.FluxCounselorWellnessTimeline?.maybeCaptureSnapshot
    ) {
      try {
        await FluxCounselorWellnessTimeline.maybeCaptureSnapshot(sb, studentId);
      } catch (_) {}
    }

    return { ok: true, tier, previousTier };
  }

  function renderStudentPanel(currentTier, counselorName, consentedAt) {
    if (!enabled()) return '';
    const active = normalizeTier(currentTier);
    const cName = counselorName ? esc(counselorName) : 'your counselor';
    const tiersHtml = TIERS.map(
      (t) => `
      <button type="button" class="flux-consent-tier${active === t.id ? ' is-active' : ''}" data-consent-tier="${esc(t.id)}" aria-pressed="${active === t.id}">
        <div class="flux-consent-tier-head">
          <span class="flux-consent-tier-title">${esc(t.title)}</span>
          <span class="flux-consent-tier-radio" aria-hidden="true"></span>
        </div>
        <p class="flux-consent-tier-desc">${esc(t.description)}</p>
        <ul class="flux-consent-tier-includes">${t.includes.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
      </button>`,
    ).join('');

    const statusLine = consentedAt
      ? `Last updated ${esc(new Date(consentedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }))}`
      : 'No sharing enabled yet';

    return `
      <div class="flux-consent-panel" id="fluxConsentPanel">
        <h4>What ${cName} can see</h4>
        <p class="flux-consent-intro">Choose a visibility tier. You can change this anytime. Flux never shares grades, assignment titles, or class rosters with counselors.</p>
        <div class="flux-consent-tiers">${tiersHtml}</div>
        <button type="button" class="flux-consent-revoke" data-consent-revoke>Stop all sharing</button>
        <p class="flux-consent-status" id="fluxConsentStatus">${statusLine} · Current: <strong>${esc(tierLabel(active))}</strong></p>
      </div>`;
  }

  function tierBadgeHtml(tier) {
    if (!enabled()) return '';
    const t = normalizeTier(tier);
    return `<span class="flux-consent-badge flux-consent-badge--${esc(t)}">${esc(tierLabel(t))}</span>`;
  }

  function cardBadgeHtml(tier) {
    if (!enabled() || normalizeTier(tier) === 'none') return '';
    return `<span class="flux-consent-card-badge">${esc(tierLabel(tier))} tier</span>`;
  }

  function renderCounselorSummary(caseload) {
    if (!enabled() || !caseload?.students?.length) return '';
    const rows = caseload.students
      .map(
        (s) => `
      <tr>
        <td>${esc(s.displayName)}</td>
        <td>${tierBadgeHtml(s.consentTier || 'none')}</td>
        <td style="font-size:.68rem;color:var(--muted2)">${s.consented ? 'Opted in' : 'Awaiting consent'}</td>
      </tr>`,
      )
      .join('');

    return `
      <section class="flux-consent-summary" aria-label="Student consent tiers">
        <h3>Visibility & consent</h3>
        <table class="flux-consent-summary-table">
          <thead><tr><th>Student</th><th>Tier</th><th>Status</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </section>`;
  }

  function confirmWellnessUpgrade() {
    return window.confirm(
      'Share wellness summaries with your counselor?\n\nThis includes daily mood, stress, workload, and momentum summaries — not assignment titles or grades. You can turn this off anytime.',
    );
  }

  function wireStudentPanel(host, sb, studentId, counselorId) {
    if (!host || !sb || !enabled()) return;
    const panel = host.querySelector('#fluxConsentPanel');
    if (!panel) return;

    const applyTier = async (tier) => {
      const t = normalizeTier(tier);
      if (t === 'wellness') {
        const link = await fetchCurrentLink(sb, studentId, counselorId);
        const prev = normalizeTier(link?.consent_tier);
        if (prev !== 'wellness' && !confirmWellnessUpgrade()) return;
      }
      const res = await saveTier(sb, studentId, counselorId, t);
      if (res.ok) {
        panel.querySelectorAll('[data-consent-tier]').forEach((btn) => {
          const on = btn.getAttribute('data-consent-tier') === res.tier;
          btn.classList.toggle('is-active', on);
          btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        const status = host.querySelector('#fluxConsentStatus');
        if (status) {
          status.innerHTML = `Updated just now · Current: <strong>${esc(tierLabel(res.tier))}</strong>`;
        }
        if (typeof window.showToast === 'function') {
          window.showToast(
            res.tier === 'none'
              ? 'All counselor insights sharing turned off'
              : `${tierLabel(res.tier)} tier saved`,
            'success',
            2400,
          );
        }
      } else if (typeof window.showToast === 'function') {
        window.showToast(res.error || 'Could not save consent', 'error');
      }
    };

    panel.querySelectorAll('[data-consent-tier]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tier = btn.getAttribute('data-consent-tier');
        if (tier) applyTier(tier);
      });
    });
    panel.querySelector('[data-consent-revoke]')?.addEventListener('click', () => {
      if (
        window.confirm(
          'Stop sharing all engagement and wellness summaries with your counselor?',
        )
      ) {
        applyTier('none');
      }
    });
  }

  /** Used by legacy checkbox modules when consent flows flag is off. */
  function legacyCheckboxHtml(basicChecked, wellnessChecked) {
    return '';
  }

  function install() {
    return enabled();
  }

  window.FluxCounselorConsent = {
    TIERS,
    enabled,
    tierLabel,
    normalizeTier,
    saveTier,
    fetchCurrentLink,
    renderStudentPanel,
    renderCounselorSummary,
    tierBadgeHtml,
    cardBadgeHtml,
    wireStudentPanel,
    install,
  };
})();
