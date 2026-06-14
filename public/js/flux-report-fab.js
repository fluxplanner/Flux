/**
 * flux-report-fab.js — always-accessible "Report" button.
 *
 * Quick feedback was buried in Settings → Data & info. This adds a small
 * floating button (bottom-left) that opens the existing feedback modal
 * (openFluxFeedbackModal), which already routes to the owner cloud inbox via
 * the user-feedback Edge Function. Hidden on the login screen and lifted above
 * the mobile bottom-nav. Self-contained IIFE.
 */
(function () {
  'use strict';

  var BTN_ID = 'fluxReportFab';

  function loggedOutOrSplash() {
    var login = document.getElementById('loginScreen');
    if (login && getComputedStyle(login).display !== 'none' && !login.classList.contains('hidden')) return true;
    var splash = document.getElementById('splash');
    if (splash && getComputedStyle(splash).display !== 'none') return true;
    return false;
  }

  function build() {
    if (document.getElementById(BTN_ID)) return;
    var b = document.createElement('button');
    b.id = BTN_ID;
    b.type = 'button';
    b.className = 'flux-report-fab';
    b.title = 'Report a problem or send feedback';
    b.setAttribute('aria-label', 'Report a problem or send feedback');
    b.innerHTML =
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>' +
      '<span class="flux-report-fab__label">Report</span>';
    b.addEventListener('click', function () {
      if (typeof window.openFluxFeedbackModal === 'function') window.openFluxFeedbackModal();
      else if (typeof window.showToast === 'function') window.showToast('Open Settings → Data & info → Send feedback', 'info');
    });
    document.body.appendChild(b);
  }

  function sync() {
    var b = document.getElementById(BTN_ID);
    if (!b) return;
    b.style.display = loggedOutOrSplash() ? 'none' : '';
  }

  function boot() {
    build();
    sync();
    // Re-evaluate visibility when the app shell shows/hides (login → app).
    if (window.MutationObserver) {
      var login = document.getElementById('loginScreen');
      if (login) {
        try { new MutationObserver(sync).observe(login, { attributes: true, attributeFilter: ['style', 'class'] }); } catch (e) {}
      }
    }
    document.addEventListener('flux-auth-changed', sync);
    setInterval(sync, 4000); // cheap safety net for state changes we don't observe
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.FluxReportFab = { sync: sync };
})();
