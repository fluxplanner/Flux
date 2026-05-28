/**
 * Flux visual premium — cursor-linked ambient (disabled site-wide).
 * Kept as a no-op shim so flux-pro settings and flux:cursor-spotlight listeners stay safe.
 */
(function () {
  'use strict';

  function purge() {
    document.body.dataset.fluxCursor = 'off';
    document.getElementById('fluxCursorAmbient')?.remove();
    document.getElementById('cursorSpotlight')?.remove();
    document.querySelectorAll('.flux-cursor-halo').forEach((el) => {
      try {
        el.remove();
      } catch (_) {}
    });
  }

  window.FluxCursorSpotlight = window.FluxCursorSpotlight || {};
  window.FluxCursorSpotlight.ensure = purge;
  document.addEventListener('flux:cursor-spotlight', purge);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', purge, { once: true });
  } else {
    purge();
  }
})();
