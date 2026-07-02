/* ════════════════════════════════════════════════════════════════════════════
 * FluxLoginSplit — Akiflow-style login hero upgrade (additive layer).
 *
 *  • Injects a "Your AI profile" progress card into the login hero's left
 *    column (animated 0→90%, Integrations + Role rows) — the Akiflow signup
 *    left-panel, re-skinned for Flux.
 *  • Adds "Continue with Microsoft" and "Continue with Apple" buttons under
 *    the existing Google button. They go through the same Supabase OAuth path
 *    (providers 'azure' / 'apple'); if the provider isn't enabled on the
 *    project yet, the error is caught and surfaced as a toast instead of a
 *    dead redirect.
 *
 * Depends on app.js globals (getSB, getRedirectURL, showToast) — all guarded.
 * ──────────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  function toast(msg, kind) {
    if (typeof window.showToast === 'function') window.showToast(msg, kind || 'info');
    else alert(msg);
  }

  async function oauth(provider, label) {
    const sb = typeof window.getSB === 'function' ? window.getSB() : null;
    if (!sb) { toast('Auth not available — please refresh.', 'error'); return; }
    try {
      const redirectTo = typeof window.getRedirectURL === 'function' ? window.getRedirectURL() : window.location.origin;
      const { data, error } = await sb.auth.signInWithOAuth({
        provider,
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error) throw error;
      if (!data || !data.url) throw new Error('no auth url');
      const w = window.open(data.url, 'flux' + provider + 'OAuth', 'width=520,height=720,left=80,top=60,scrollbars=yes,resizable=yes');
      if (!w || w.closed == null) { window.location.href = data.url; return; }
      try { w.focus(); } catch (_) {}
    } catch (e) {
      console.warn('[FluxLoginSplit] ' + provider + ' OAuth failed', e);
      toast(label + ' sign-in isn’t enabled on this Flux instance yet — use Google or email for now.', 'error');
    }
  }
  window.signInWithMicrosoft = () => oauth('azure', 'Microsoft');
  window.signInWithApple = () => oauth('apple', 'Apple');

  const MS_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="2" width="9.5" height="9.5" fill="#F25022"/><rect x="12.5" y="2" width="9.5" height="9.5" fill="#7FBA00"/><rect x="2" y="12.5" width="9.5" height="9.5" fill="#00A4EF"/><rect x="12.5" y="12.5" width="9.5" height="9.5" fill="#FFB900"/></svg>';
  const APPLE_SVG = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.05 12.54c-.03-2.89 2.36-4.27 2.47-4.34-1.35-1.97-3.44-2.24-4.18-2.27-1.78-.18-3.47 1.05-4.37 1.05-.9 0-2.29-1.02-3.77-1-1.94.03-3.72 1.13-4.72 2.86-2.01 3.49-.51 8.66 1.45 11.49.96 1.39 2.1 2.94 3.6 2.88 1.44-.06 1.99-.93 3.73-.93s2.23.93 3.76.9c1.55-.03 2.54-1.41 3.49-2.8 1.1-1.61 1.55-3.17 1.58-3.25-.03-.02-3.02-1.16-3.04-4.59zM14.16 4.06c.79-.96 1.33-2.3 1.18-3.63-1.14.05-2.52.76-3.34 1.72-.73.85-1.38 2.21-1.2 3.51 1.27.1 2.57-.65 3.36-1.6z"/></svg>';
  const GOOGLE_SVG = '<svg viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>';

  function injectOAuthButtons() {
    const googleBtn = document.querySelector('#loginScreen .lx-google');
    if (!googleBtn || document.querySelector('.lxs-ms')) return;
    const ms = document.createElement('button');
    ms.type = 'button';
    ms.className = 'lx-google lxs-oauth lxs-ms';
    ms.innerHTML = MS_SVG + ' Continue with Microsoft';
    ms.addEventListener('click', window.signInWithMicrosoft);
    const ap = document.createElement('button');
    ap.type = 'button';
    ap.className = 'lx-google lxs-oauth lxs-apple';
    ap.innerHTML = APPLE_SVG + ' Continue with Apple';
    ap.addEventListener('click', window.signInWithApple);
    googleBtn.after(ms, ap);
  }

  function injectProfileCard() {
    const copy = document.querySelector('#loginScreen .lx-hero-copy');
    if (!copy || document.querySelector('.lxs-profile')) return;
    const card = document.createElement('div');
    card.className = 'lxs-profile';
    card.setAttribute('aria-hidden', 'true');
    card.innerHTML = `
      <div class="lxs-profile-spark">✦</div>
      <div class="lxs-profile-title">Your AI profile</div>
      <div class="lxs-profile-meter">
        <span class="lxs-profile-pct">0%</span>
        <div class="lxs-profile-track"><div class="lxs-profile-fill"></div></div>
      </div>
      <div class="lxs-profile-row"><span class="lxs-profile-ico">🧩</span><span>Integrations</span><span class="lxs-profile-val lxs-profile-g">${GOOGLE_SVG}</span></div>
      <div class="lxs-profile-row"><span class="lxs-profile-ico">👤</span><span>Role</span><span class="lxs-profile-val lxs-profile-pill">Student / Staff / Family</span></div>`;
    const demo = copy.querySelector('.lx-demo');
    (demo || copy.firstElementChild).after(card);

    // Animate the meter 0 → 90% once visible.
    const fill = card.querySelector('.lxs-profile-fill');
    const pct = card.querySelector('.lxs-profile-pct');
    let v = 0;
    const target = 90;
    function tick() {
      v = Math.min(target, v + Math.max(1, (target - v) * 0.06));
      fill.style.width = v + '%';
      pct.textContent = Math.round(v) + '%';
      if (v < target) requestAnimationFrame(tick);
    }
    const io = 'IntersectionObserver' in window
      ? new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); requestAnimationFrame(tick); } })
      : null;
    if (io) io.observe(card); else requestAnimationFrame(tick);
  }

  function boot() {
    injectOAuthButtons();
    injectProfileCard();
    document.documentElement.classList.add('flux-login-split');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
