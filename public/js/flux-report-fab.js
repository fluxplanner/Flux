/**
 * flux-report-fab.js — always-accessible "Report" button.
 *
 * Quick feedback was buried in Settings → Data & info, so this puts it one
 * click away. It opens the existing feedback modal (openFluxFeedbackModal),
 * which routes to the owner cloud inbox via the user-feedback Edge Function.
 * Hidden on the login screen. Self-contained IIFE.
 *
 * It used to be `position: fixed` at bottom-left, and that is a trap on this
 * layout: a fixed button parked over a scrolling list permanently blackholes
 * the clicks for whichever row lands in its band — the row looks normal and
 * its checkbox just does nothing. It covered the sign-in line first, then the
 * task list after being nudged clear of the sidebar. There is no free corner
 * on desktop, so it now docks into the sidebar footer instead: in normal flow
 * it cannot overlap anything. Falls back to floating only if the footer is
 * missing.
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
    // Above the user card, so the card stays the last thing in the footer.
    var footer = document.querySelector('.sidebar-footer');
    if (footer) {
      b.classList.add('flux-report-fab--docked');
      footer.insertBefore(b, footer.firstChild);
    } else {
      document.body.appendChild(b);
    }
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
