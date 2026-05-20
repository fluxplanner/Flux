/**
 * School emergency + calm mode broadcast — live UI state for all users.
 * Flag: enable_school_emergency_broadcast (default off).
 */
(function () {
  'use strict';

  const SLUG = 'default';
  const DISMISS_KEY = 'flux_school_broadcast_dismissed_mode';

  let _state = { mode: 'normal', message: '' };

  function enabled() {
    try {
      return !!window.FluxFeatureFlags?.isEnabled(
        'enable_school_emergency_broadcast',
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

  function loadDismissedMode() {
    try {
      if (typeof load === 'function') return load(DISMISS_KEY, '');
    } catch (_) {}
    return '';
  }

  function saveDismissedMode(mode) {
    try {
      if (typeof save === 'function') save(DISMISS_KEY, mode || '');
    } catch (_) {}
  }

  async function fetchState(sb) {
    if (!sb) return { mode: 'normal', message: '' };
    try {
      const { data, error } = await sb
        .from('flux_school_broadcast')
        .select('mode, message, updated_at')
        .eq('school_slug', SLUG)
        .maybeSingle();
      if (error) throw error;
      return {
        mode: data?.mode || 'normal',
        message: data?.message || '',
        updatedAt: data?.updated_at || null,
      };
    } catch (e) {
      console.warn('[FluxSchoolEmergency] fetch', e);
      return { mode: 'normal', message: '' };
    }
  }

  function removeBanner() {
    document.getElementById('fluxSchoolBroadcastBanner')?.remove();
  }

  function showBanner(mode, message) {
    if (mode === 'normal' || !message) return;
    if (loadDismissedMode() === mode) return;
    removeBanner();
    const bar = document.createElement('div');
    bar.id = 'fluxSchoolBroadcastBanner';
    const isEmergency = mode === 'emergency';
    bar.className = `flux-school-broadcast-banner flux-school-broadcast-banner--${esc(mode)}`;
    bar.innerHTML = `
      <span class="flux-school-broadcast-banner-icon">${isEmergency ? '🚨' : '🧘'}</span>
      <div class="flux-school-broadcast-banner-body">
        <strong class="flux-school-broadcast-banner-title">${isEmergency ? 'Emergency broadcast' : 'Calm mode'}</strong>
        <div class="flux-school-broadcast-banner-msg">${esc(message)}</div>
      </div>
      <button type="button" class="flux-school-broadcast-banner-dismiss">Dismiss</button>`;
    document.body.prepend(bar);
    bar.querySelector('.flux-school-broadcast-banner-dismiss')?.addEventListener('click', () => {
      saveDismissedMode(mode);
      bar.remove();
    });
  }

  function applyState(state) {
    _state = state || { mode: 'normal', message: '' };
    const mode = _state.mode || 'normal';
    document.body.removeAttribute('data-school-broadcast');
    removeBanner();
    if (mode === 'normal') return;
    document.body.setAttribute('data-school-broadcast', mode);
    showBanner(mode, _state.message || (mode === 'calm' ? 'School is in calm mode — reduced visual intensity.' : 'Emergency alert'));
  }

  async function refresh() {
    if (!enabled()) return;
    const sb = typeof window.getSB === 'function' ? window.getSB() : null;
    if (!sb) return;
    const state = await fetchState(sb);
    applyState(state);
    return state;
  }

  async function setBroadcast(sb, mode, message) {
    if (!sb || !window.currentUser) return { ok: false };
    const m = String(mode || 'normal');
    if (!['normal', 'calm', 'emergency'].includes(m)) return { ok: false };
    const { error } = await sb
      .from('flux_school_broadcast')
      .upsert({
        school_slug: SLUG,
        mode: m,
        message: message ? String(message).slice(0, 2000) : null,
        updated_by: window.currentUser.id,
        updated_at: new Date().toISOString(),
      });
    if (error) return { ok: false, error: error.message };

    if (m === 'emergency' && message) {
      try {
        await sb.from('school_announcements').insert({
          posted_by: window.currentUser.id,
          title: '🚨 EMERGENCY ALERT',
          body: String(message).slice(0, 4000),
          priority: 'emergency',
          target_roles: ['student', 'teacher', 'counselor', 'staff', 'admin'],
          pinned: true,
        });
      } catch (_) {}
    }

    saveDismissedMode('');
    const state = { mode: m, message: message || '' };
    applyState(state);
    return { ok: true, state };
  }

  function openBroadcastModal() {
    if (document.getElementById('fluxSchoolBroadcastModal')) return;
    const wrap = document.createElement('div');
    wrap.id = 'fluxSchoolBroadcastModal';
    wrap.className = 'edu-modal flux-seb-modal';
    wrap.innerHTML = `
      <div class="edu-modal-backdrop"></div>
      <div class="edu-modal-panel">
        <button type="button" class="edu-modal-close" aria-label="Close" style="position:absolute;top:14px;right:14px">✕</button>
        <h3 style="margin:0 0 8px;font-size:1rem;font-weight:800">School broadcast</h3>
        <p style="font-size:.72rem;color:var(--muted2);margin:0 0 14px;line-height:1.4">Emergency alerts and calm mode apply to everyone currently using Flux at your school.</p>
        <div class="flux-seb-modes">
          <button type="button" class="flux-seb-mode-btn flux-seb-mode-btn--danger" data-seb-pick="emergency">🚨 Emergency</button>
          <button type="button" class="flux-seb-mode-btn" data-seb-pick="calm">🧘 Calm mode</button>
          <button type="button" class="flux-seb-mode-btn" data-seb-pick="normal">✓ End broadcast</button>
        </div>
        <label style="font-size:.7rem;font-weight:700;color:var(--muted2)">Message (optional for calm mode)</label>
        <textarea id="fluxSebMessage" rows="4" style="width:100%;margin-top:6px;padding:10px;border-radius:10px;border:1px solid var(--border2);background:var(--card2);color:var(--text);box-sizing:border-box" placeholder="What should the school know?"></textarea>
        <button type="button" id="fluxSebSend" style="width:100%;margin-top:14px;padding:12px;border:none;border-radius:12px;background:var(--accent);color:#0a0d18;font-weight:800;cursor:pointer">Apply broadcast</button>
      </div>`;
    document.body.appendChild(wrap);
    let pick = 'emergency';
    const setPick = (m) => {
      pick = m;
      wrap.querySelectorAll('[data-seb-pick]').forEach((b) => {
        b.classList.toggle('is-active', b.getAttribute('data-seb-pick') === m);
      });
    };
    setPick('emergency');
    wrap.querySelectorAll('[data-seb-pick]').forEach((b) => {
      b.addEventListener('click', () => setPick(b.getAttribute('data-seb-pick')));
    });
    const close = () => wrap.remove();
    wrap.querySelector('.edu-modal-backdrop')?.addEventListener('click', close);
    wrap.querySelector('.edu-modal-close')?.addEventListener('click', close);
    wrap.querySelector('#fluxSebSend')?.addEventListener('click', async () => {
      const msg = wrap.querySelector('#fluxSebMessage')?.value?.trim() || '';
      if ((pick === 'emergency' || pick === 'calm') && !msg && pick === 'emergency') {
        if (typeof window.showToast === 'function') {
          window.showToast('Enter a message for emergency broadcast', 'error');
        }
        return;
      }
      const sb = typeof window.getSB === 'function' ? window.getSB() : null;
      const res = await setBroadcast(sb, pick, msg || (pick === 'calm' ? 'Calm mode is active — take a breath, reduce noise, and focus on essentials.' : ''));
      if (res.ok) {
        close();
        if (typeof window.showToast === 'function') {
          window.showToast(
            pick === 'normal' ? 'Broadcast ended' : pick === 'calm' ? 'Calm mode broadcast' : 'Emergency sent',
            'success',
          );
        }
        try {
          if (typeof window.renderAdminDashboard === 'function') renderAdminDashboard();
        } catch (_) {}
      } else if (typeof window.showToast === 'function') {
        window.showToast(res.error || 'Could not update broadcast', 'error');
      }
    });
  }

  function openEmergencyAlertModal() {
    if (enabled()) {
      openBroadcastModal();
      return true;
    }
    return false;
  }

  function install() {
    return enabled();
  }

  window.FluxSchoolEmergency = {
    enabled,
    fetchState,
    applyState,
    refresh,
    setBroadcast,
    openBroadcastModal,
    openEmergencyAlertModal,
    install,
  };
})();
