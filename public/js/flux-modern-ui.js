/* ════════════════════════════════════════════════════════════════════════════
 * Flux Modern UI — always on (July 2026: toggle removed from Settings).
 * Applies html.flux-modern, which gates flux-modern-ui.css.
 * window.FluxModernUI is kept as a no-op API so old callers can't break.
 * ──────────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  if (window.FluxModernUI) return;

  // Drop the legacy preference so users who once switched it off
  // come back to the modern look now that the toggle is gone.
  try { localStorage.removeItem('flux_modern_ui'); } catch (_) {}

  document.documentElement.classList.add('flux-modern');

  window.FluxModernUI = {
    isOn: function () { return true; },
    set: function () {},
    toggle: function () {},
  };
})();
