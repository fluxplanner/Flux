/* ════════════════════════════════════════════════════════════════════════════
 * Flux Modern UI toggle — applies html.flux-modern (see flux-modern-ui.css).
 * On by default; persists to localStorage 'flux_modern_ui' ('on' | 'off').
 * Adds a switch to Settings → Appearance when that pane exists.
 * ──────────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  if (window.FluxModernUI) return;

  const KEY = 'flux_modern_ui';
  const isOn = () => { try { return localStorage.getItem(KEY) !== 'off'; } catch (_) { return true; } };

  function apply() {
    document.documentElement.classList.toggle('flux-modern', isOn());
  }
  function set(on) {
    try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch (_) {}
    apply();
  }
  const toggle = () => set(!isOn());

  apply();

  /* Settings → Appearance switch */
  let tries = 0;
  const injector = setInterval(() => {
    tries += 1;
    const pane = document.getElementById('spane-appearance');
    if (pane && !document.getElementById('fluxModernUiToggle')) {
      const row = document.createElement('div');
      row.className = 'card';
      row.id = 'fluxModernUiToggle';
      row.style.cssText = 'display:flex;align-items:center;gap:12px;padding:14px 16px;margin-top:12px';
      row.innerHTML = '<div style="flex:1"><div style="font-weight:700;font-size:.9rem">Modern UI</div>'
        + '<div style="font-size:.75rem;color:var(--muted2)">Calmer Akiflow-style surfaces, buttons and focus rings. Turn off for the classic glass look.</div></div>'
        + '<button type="button" class="btn-sec" id="fluxModernUiBtn" style="min-width:64px"></button>';
      pane.appendChild(row);
      const btn = row.querySelector('#fluxModernUiBtn');
      const paint = () => { btn.textContent = isOn() ? 'On' : 'Off'; };
      btn.addEventListener('click', () => { toggle(); paint(); });
      paint();
      clearInterval(injector);
    }
    if (tries > 40) clearInterval(injector);
  }, 1500);

  window.FluxModernUI = { isOn, set, toggle };
})();
