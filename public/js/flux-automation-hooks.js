/**
 * P20.1 — Automation URL hooks for Shortcuts / external apps.
 * Flag: enable_automation_hooks (default off).
 */
(function () {
  'use strict';

  const FLAG = 'enable_automation_hooks';
  const CARD_ID = 'fluxAutomationHooksCard';

  const HOOKS = [
    { key: 'task', qs: 'quick=task', labelKey: 'auto.hook_task', descKey: 'auto.hook_task_desc' },
    { key: 'focus', qs: 'quick=focus', labelKey: 'auto.hook_focus', descKey: 'auto.hook_focus_desc' },
    { key: 'timer', qs: 'quick=timer', labelKey: 'auto.hook_timer', descKey: 'auto.hook_timer_desc' },
    { key: 'mood', qs: 'quick=mood', labelKey: 'auto.hook_mood', descKey: 'auto.hook_mood_desc' },
    { key: 'note', qs: 'quick=note', labelKey: 'auto.hook_note', descKey: 'auto.hook_note_desc' },
    { key: 'calendar', qs: 'panel=calendar', labelKey: 'auto.hook_cal', descKey: 'auto.hook_cal_desc' },
    { key: 'dashboard', qs: 'panel=dashboard', labelKey: 'auto.hook_dash', descKey: 'auto.hook_dash_desc' },
  ];

  function enabled() {
    try {
      return !!window.FluxFeatureFlags?.isEnabled(FLAG, false);
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

  function T(key, vars) {
    if (typeof window.fluxT === 'function') return window.fluxT(key, vars);
    return key;
  }

  function toast(msg, kind) {
    if (typeof window.showToast === 'function') window.showToast(msg, kind || 'info');
  }

  function baseUrl() {
    return location.origin + location.pathname;
  }

  function hookUrl(qs) {
    return `${baseUrl()}?${qs}`;
  }

  function copyText(text) {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(
        () => toast(T('auto.copied'), 'success'),
        () => toast(text, 'info'),
      );
      return;
    }
    toast(text, 'info');
  }

  function navTo(tab) {
    if (typeof window.nav !== 'function') return;
    const btn = document.querySelector(`[data-tab="${tab}"]`);
    window.nav(tab, btn);
  }

  function resolveFromUrl(u) {
    const q = (u.searchParams.get('quick') || '').trim().toLowerCase();
    const panel = (u.searchParams.get('panel') || '').trim().toLowerCase();
    const text = (u.searchParams.get('text') || u.searchParams.get('title') || '').trim();

    if (panel && ['calendar', 'timer', 'dashboard', 'mood', 'notes', 'ai', 'toolbox'].includes(panel)) {
      navTo(panel === 'notes' ? 'notes' : panel);
      return true;
    }

    if (q === 'focus') {
      navTo('timer');
      setTimeout(() => {
        if (typeof window.startTimer === 'function') window.startTimer();
        else if (typeof window.openQuickAdd === 'function') window.openQuickAdd();
      }, 450);
      return true;
    }

    if (q === 'timer') {
      navTo('timer');
      return true;
    }

    if (q === 'mood') {
      navTo('mood');
      return true;
    }

    if (q === 'note') {
      navTo('notes');
      return true;
    }

    if (q === 'task' || q === 'add') {
      navTo('dashboard');
      setTimeout(() => {
        if (text && typeof window.openQuickAddWithText === 'function') {
          window.openQuickAddWithText(text);
        } else if (typeof window.openQuickAdd === 'function') {
          window.openQuickAdd();
        }
      }, 400);
      return true;
    }

    return false;
  }

  function wrapDeepLinkHandler() {
    const orig = window.handleDeepLinkParams;
    if (typeof orig !== 'function' || orig._fluxAutoWrapped) return;
    window.handleDeepLinkParams = function () {
      if (enabled()) {
        try {
          const u = new URL(location.href);
          if (resolveFromUrl(u)) {
            u.search = '';
            history.replaceState({}, '', u.pathname + u.hash);
            return;
          }
        } catch (_) {}
      }
      return orig.apply(this, arguments);
    };
    window.handleDeepLinkParams._fluxAutoWrapped = true;
  }

  function renderCard() {
    if (!enabled()) return;
    const card = document.getElementById(CARD_ID);
    if (!card) return;

    const hooksHtml = HOOKS.map((h) => {
      const url = hookUrl(h.qs);
      return `<div>
  <div class="flux-auto-label">${esc(T(h.labelKey))}</div>
  <div class="flux-auto-sub">${esc(T(h.descKey))}</div>
  <div class="flux-auto-hook">
    <code>${esc(url)}</code>
    <button type="button" class="btn-sec" data-auto-copy="${esc(url)}">${esc(T('auto.copy'))}</button>
  </div>
</div>`;
    }).join('');

    card.innerHTML = `<h3>${esc(T('auto.title'))}</h3>
<p class="flux-auto-lede">${esc(T('auto.lede'))}</p>
${hooksHtml}
<p class="flux-auto-lede" style="margin-top:10px">${esc(T('auto.hint'))}</p>`;

    card.querySelectorAll('[data-auto-copy]').forEach((btn) => {
      btn.addEventListener('click', () => copyText(btn.getAttribute('data-auto-copy')));
    });
  }

  function ensureCard() {
    if (!enabled()) {
      document.getElementById(CARD_ID)?.remove();
      return;
    }
    const pane = document.getElementById('spane-data');
    if (!pane) return;
    let card = document.getElementById(CARD_ID);
    if (!card) {
      card = document.createElement('div');
      card.id = CARD_ID;
      card.className = 'card flux-auto-card';
      const inbox = document.getElementById('fluxEmailTaskInboxCard');
      if (inbox) inbox.insertAdjacentElement('afterend', card);
      else {
        const feedback = pane.querySelector('.card');
        if (feedback) feedback.insertAdjacentElement('afterend', card);
        else pane.prepend(card);
      }
    }
    renderCard();
  }

  function getPaletteCommands(q) {
    if (!enabled()) return [];
    const needle = (q || '').toLowerCase();
    const label = T('auto.palette');
    const keys = 'automation shortcut url hook quick focus';
    if (
      needle &&
      !label.toLowerCase().includes(needle) &&
      !keys.split(' ').some((k) => needle.includes(k))
    ) {
      return [];
    }
    return [
      {
        icon: '🔗',
        label,
        cat: 'Navigation',
        action: () => {
          if (typeof window.closeCommandPalette === 'function') window.closeCommandPalette();
          if (typeof window.nav === 'function') window.nav('settings');
          if (typeof window.switchStab === 'function') {
            const btn = document.querySelector('.stab[onclick*="data"]');
            window.switchStab('data', btn);
          }
          setTimeout(() => ensureCard(), 200);
        },
      },
    ];
  }

  function install() {
    if (!enabled()) {
      document.getElementById(CARD_ID)?.remove();
      return false;
    }
    wrapDeepLinkHandler();
    ensureCard();
    const origNav = window.nav;
    if (typeof origNav === 'function' && !origNav._fluxAutoNavWrapped) {
      window.nav = function (tab) {
        const r = origNav.apply(this, arguments);
        if (tab === 'settings') setTimeout(() => ensureCard(), 80);
        return r;
      };
      window.nav._fluxAutoNavWrapped = true;
    }
    const origSwitch = window.switchStab;
    if (typeof origSwitch === 'function' && !origSwitch._fluxAutoSwitchWrapped) {
      window.switchStab = function (tab) {
        const r = origSwitch.apply(this, arguments);
        if (tab === 'data') setTimeout(() => ensureCard(), 60);
        return r;
      };
      window.switchStab._fluxAutoSwitchWrapped = true;
    }
    return true;
  }

  window.FluxAutomationHooks = {
    FLAG,
    enabled,
    hookUrl,
    resolveFromUrl,
    renderCard,
    ensureCard,
    getPaletteCommands,
    install,
  };
})();
