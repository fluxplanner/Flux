/* ════════════════════════════════════════════════════════════════════════════
 * FluxLoginSplit — login hero styling hook (additive layer).
 *
 * Sets the `flux-login-split` class on <html>, which flux-login-split.css uses
 * to restyle the auth card, Google button, submit button and input fields.
 *
 * History: this module also injected a "Your AI profile" hero card (removed
 * July 2026, read as gimmicky) and "Continue with Microsoft" / "Continue with
 * Apple" buttons (removed on owner request — Flux signs in with Google or
 * email only). Only the styling hook remains.
 * ──────────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  function boot() {
    document.documentElement.classList.add('flux-login-split');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
