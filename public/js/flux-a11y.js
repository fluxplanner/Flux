/**
 * P7-A11Y — accessibility suite: reduced motion, personal calm, ADHD-friendly layout.
 * Flag: enable_a11y_suite (default off). Works with existing flux_reduce_motion / font scale / high contrast.
 */
(function () {
  'use strict';

  const LS_CALM = 'flux_personal_calm_mode';
  const LS_ADHD = 'flux_adhd_focus_mode';
  const LS_REDUCE = 'flux_reduce_motion';
  const LS_CONTRAST = 'flux_high_contrast';

  function enabled() {
    try {
      return !!window.FluxFeatureFlags?.isEnabled('enable_a11y_suite', false);
    } catch (_) {
      return false;
    }
  }

  function load(k, def) {
    if (typeof window.load === 'function') return window.load(k, def);
    try {
      const raw = localStorage.getItem(k);
      return raw != null ? JSON.parse(raw) : def;
    } catch (_) {
      return def;
    }
  }

  function save(k, v) {
    if (typeof window.save === 'function') window.save(k, v);
    else {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch (_) {}
    }
  }

  function prefs() {
    return {
      reduceMotion: !!load(LS_REDUCE, false),
      calm: !!load(LS_CALM, false),
      adhd: !!load(LS_ADHD, false),
      highContrast: !!load(LS_CONTRAST, false),
    };
  }

  function applyReduceMotion() {
    if (typeof window.applyReduceMotion === 'function') {
      window.applyReduceMotion();
      return;
    }
    const user = !!load(LS_REDUCE, false);
    const sys =
      typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.documentElement.classList.toggle('flux-reduce-motion', user || sys);
    const el = document.getElementById('reduceMotionToggle');
    if (el) el.classList.toggle('on', user);
  }

  function applyHighContrast() {
    if (typeof window.applyHighContrast === 'function') {
      window.applyHighContrast();
    }
    const on = !!load(LS_CONTRAST, false);
    document.body.classList.toggle('high-contrast', on);
    document.documentElement.classList.toggle('flux-high-contrast', on);
    const btn = document.getElementById('highContrastBtn');
    if (btn) {
      btn.textContent = on ? 'High Contrast: ON' : 'High Contrast: OFF';
      btn.style.background = on ? 'rgba(var(--accent-rgb),.15)' : '';
    }
  }

  function applyCalm() {
    const on = enabled() && !!load(LS_CALM, false);
    document.documentElement.classList.toggle('flux-personal-calm', on);
    const el = document.getElementById('fluxCalmModeToggle');
    if (el) el.classList.toggle('on', on);
  }

  function applyAdhd() {
    const on = enabled() && !!load(LS_ADHD, false);
    document.documentElement.classList.toggle('flux-adhd-focus', on);
    const el = document.getElementById('fluxAdhdFocusToggle');
    if (el) el.classList.toggle('on', on);
  }

  function applyAll() {
    applyReduceMotion();
    if (typeof window.applyFontScale === 'function') window.applyFontScale();
    applyHighContrast();
    applyCalm();
    applyAdhd();
    syncSettingsUi();
  }

  function syncSettingsUi() {
    const mount = document.getElementById('fluxA11ySuiteMount');
    if (!mount || !enabled()) return;
    const p = prefs();
    mount.querySelectorAll('[data-a11y-pref]').forEach((row) => {
      const key = row.getAttribute('data-a11y-pref');
      const toggle = row.querySelector('.toggle');
      if (!toggle) return;
      if (key === 'calm') toggle.classList.toggle('on', p.calm);
      if (key === 'adhd') toggle.classList.toggle('on', p.adhd);
    });
  }

  function toggleCalm() {
    if (!enabled()) return;
    save(LS_CALM, !load(LS_CALM, false));
    applyCalm();
    toast(load(LS_CALM, false) ? 'Calm mode on' : 'Calm mode off');
  }

  function toggleAdhd() {
    if (!enabled()) return;
    save(LS_ADHD, !load(LS_ADHD, false));
    applyAdhd();
    toast(load(LS_ADHD, false) ? 'Focus layout on' : 'Focus layout off');
  }

  function toast(msg) {
    if (typeof window.showToast === 'function') window.showToast(msg, 'info');
  }

  function renderSettingsMount() {
    const host = document.getElementById('fluxA11ySuiteMount');
    const card = document.getElementById('fluxA11ySuiteCard');
    if (!host) return;
    if (!enabled()) {
      if (card) card.style.display = 'none';
      return;
    }
    if (card) card.style.display = '';
    host.innerHTML = `
      <div class="srow" style="border:none" data-a11y-pref="calm">
        <div>
          <div class="slabel">Personal calm mode</div>
          <div class="ssub">Softer colors, hides mesh and cursor effects — separate from school emergency calm.</div>
        </div>
        <button type="button" class="toggle" id="fluxCalmModeToggle" aria-label="Personal calm mode"></button>
      </div>
      <div class="srow" style="border:none;margin-top:4px" data-a11y-pref="adhd">
        <div>
          <div class="slabel">ADHD-friendly focus</div>
          <div class="ssub">Simpler dashboard, larger tap targets, stronger focus rings, fewer decorative widgets.</div>
        </div>
        <button type="button" class="toggle" id="fluxAdhdFocusToggle" aria-label="ADHD-friendly focus"></button>
      </div>`;

    document.getElementById('fluxCalmModeToggle')?.addEventListener('click', toggleCalm);
    document.getElementById('fluxAdhdFocusToggle')?.addEventListener('click', toggleAdhd);
    syncSettingsUi();
  }

  function install() {
    applyAll();
    renderSettingsMount();
    if (!window._fluxA11yMediaHook) {
      window._fluxA11yMediaHook = true;
      try {
        const mq = matchMedia('(prefers-reduced-motion: reduce)');
        const fn = () => applyReduceMotion();
        if (mq.addEventListener) mq.addEventListener('change', fn);
        else if (mq.addListener) mq.addListener(fn);
      } catch (_) {}
    }
    return true;
  }

  /* ── B6: focus trap + focus-return-to-invoker ──
   * Unflagged: WCAG keyboard support is core behavior, not an experiment
   * (enable_a11y_suite gates the preference UI above, not this). */
  const FOCUSABLE =
    'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])';
  const _traps = new Map(); // container -> { onKey, invoker }

  function trapFocus(container) {
    if (!container || _traps.has(container)) return () => {};
    const invoker = document.activeElement;
    const onKey = (e) => {
      if (e.key !== 'Tab') return;
      const items = Array.from(container.querySelectorAll(FOCUSABLE)).filter(
        (el) => el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement
      );
      if (!items.length) return;
      // Fully manual cycling: the browser's natural sequence can step outside
      // a mid-document overlay, so we always intercept and move within items.
      e.preventDefault();
      const idx = items.indexOf(document.activeElement);
      const next = e.shiftKey
        ? (idx <= 0 ? items[items.length - 1] : items[idx - 1])
        : (idx === -1 || idx === items.length - 1 ? items[0] : items[idx + 1]);
      try { next.focus(); } catch (_) {}
    };
    container.addEventListener('keydown', onKey);
    _traps.set(container, { onKey, invoker });
    return () => releaseFocus(container);
  }

  function releaseFocus(container) {
    const t = container && _traps.get(container);
    if (!t) return;
    container.removeEventListener('keydown', t.onKey);
    _traps.delete(container);
    try {
      if (t.invoker && document.contains(t.invoker) && typeof t.invoker.focus === 'function') t.invoker.focus();
    } catch (_) {}
  }

  window.FluxA11y = {
    enabled,
    install,
    applyAll,
    applyCalm,
    applyAdhd,
    toggleCalm,
    toggleAdhd,
    prefs,
    renderSettingsMount,
    trapFocus,
    releaseFocus,
  };
})();
