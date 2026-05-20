/**
 * Flux · shared UI modals (staff pilot welcome, etc.)
 */
(function () {
  'use strict';

  const PILOT_ROLES = new Set(['teacher', 'counselor', 'admin']);

  function esc(s) {
    if (typeof window.esc === 'function') return window.esc(s);
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function roleLabel(role) {
    if (role === 'counselor') return 'counselor';
    if (role === 'admin') return 'school admin';
    return 'teacher';
  }

  function storageKey(userId) {
    return `flux_staff_beta_seen_${userId}`;
  }

  function showStaffBetaIfNeeded(role) {
    const r = String(role || '').toLowerCase();
    if (!PILOT_ROLES.has(r)) return;

    const u = window.currentUser;
    if (!u?.id) return;

    const key = storageKey(u.id);
    try {
      if (localStorage.getItem(fluxNamespacedKey ? fluxNamespacedKey(key) : key)) return;
    } catch (_) {
      return;
    }

    if (document.getElementById('staff-beta-modal')) return;

    const html = `
    <div id="staff-beta-modal" class="modal-overlay flux-modal-anim active" role="dialog" aria-modal="true" aria-labelledby="staff-beta-title">
      <div class="modal-card" style="max-width:520px;margin:16px">
        <h2 id="staff-beta-title" class="flux-color-title" style="margin:0 0 10px;font-size:1.25rem">Welcome to the Flux Staff Beta</h2>
        <p style="margin:0 0 14px;color:var(--muted2);font-size:.9rem;line-height:1.5">
          We built a dedicated workspace for your role as a <strong>${esc(roleLabel(r))}</strong> at International Academy East.
        </p>
        <div style="background:var(--card2);border:1px solid var(--border);padding:14px;border-radius:var(--r-lg);margin:0 0 14px">
          <p style="margin:0 0 8px;font-size:.88rem"><strong>Work mode</strong> — professional dashboard (tickets, Google Workspace, caseloads, school ops).</p>
          <p style="margin:0;font-size:.88rem"><strong>Personal mode</strong> — see the student planner experience (tasks, LMS, study tools).</p>
        </div>
        <p style="margin:0;color:var(--muted2);font-size:.82rem;line-height:1.45">
          Pro-tip: press <strong>Ctrl+K</strong> (Mac: <strong>Cmd+K</strong>) anywhere to toggle Work ↔ Personal.
        </p>
        <button type="button" id="btn-close-beta-modal" class="btn-primary" style="width:100%;margin-top:16px;padding:12px">Let's go</button>
      </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', html);

    const close = () => {
      try {
        const nk = typeof fluxNamespacedKey === 'function' ? fluxNamespacedKey(key) : key;
        localStorage.setItem(nk, '1');
      } catch (_) {}
      document.getElementById('staff-beta-modal')?.remove();
    };

    document.getElementById('btn-close-beta-modal')?.addEventListener('click', close);
    document.getElementById('staff-beta-modal')?.addEventListener('click', (e) => {
      if (e.target?.id === 'staff-beta-modal') close();
    });
    document.addEventListener(
      'keydown',
      function onEsc(ev) {
        if (ev.key !== 'Escape' || !document.getElementById('staff-beta-modal')) return;
        close();
        document.removeEventListener('keydown', onEsc);
      },
      { once: true },
    );
  }

  window.FluxWelcomeModal = {
    showStaffBetaIfNeeded,
    showStaffBeta: showStaffBetaIfNeeded,
  };
})();
