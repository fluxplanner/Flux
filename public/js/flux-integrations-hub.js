/* ════════════════════════════════════════════════════════════════════════════
 * FluxIntegrationsHub — Akiflow-style "Which tools do you want to connect?"
 * brand-tile gallery, layered over the FluxConnectors registry.
 *
 * Two render modes:
 *   • Picker  — multi-select grid used inside onboarding (ob-step-6).
 *               Selections persist to localStorage 'flux_selected_integrations'.
 *   • Hub     — full-screen modal (Settings / anywhere via open()). Clicking a
 *               tile connects through FluxConnectors when a real flow exists;
 *               otherwise toggles a "Requested" wishlist entry
 *               ('flux_integration_wishlist') so we know what to wire next.
 *
 * Public API on window.FluxIntegrationsHub:
 *   .open()                      show the hub modal
 *   .close()
 *   .renderPickerInto(el)        mount the onboarding multi-select grid
 *   .getSelected()               picker selections (array of tile ids)
 *   .TILES                       tile registry (id, label, connectorId, svg)
 * ──────────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  if (window.FluxIntegrationsHub) return;

  const SEL_KEY = 'flux_selected_integrations';
  const WISH_KEY = 'flux_integration_wishlist';

  function loadArr(key) {
    try { const v = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(v) ? v : []; } catch (_) { return []; }
  }
  function saveArr(key, arr) { try { localStorage.setItem(key, JSON.stringify(arr)); } catch (_) {} }

  /* ── Brand marks (compact inline SVG, 24-unit viewBoxes unless noted) ── */
  const GOOGLE_G = '<svg viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>';

  const TILES = [
    { id: 'gsuite', label: 'G Suite', connectorId: 'google', svg: GOOGLE_G },
    { id: 'calendar', label: 'Calendar', connectorId: 'google', svg: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="17" rx="2.5" fill="#fff" stroke="#4285F4" stroke-width="1.6"/><path d="M3 9h18" stroke="#4285F4" stroke-width="1.6"/><path d="M8 2.5v4M16 2.5v4" stroke="#EA4335" stroke-width="2" stroke-linecap="round"/><text x="12" y="17.5" font-family="Arial,sans-serif" font-size="8" font-weight="700" fill="#4285F4" text-anchor="middle">31</text></svg>' },
    { id: 'slack', label: 'Slack', connectorId: 'slack', svg: '<svg viewBox="0 0 24 24"><path d="M9.04 15.16a1.92 1.92 0 1 1-1.92-1.92h1.92zM10 15.16a1.92 1.92 0 0 1 3.84 0v4.8a1.92 1.92 0 1 1-3.84 0z" fill="#E01E5A"/><path d="M8.88 9.04a1.92 1.92 0 1 1 1.92-1.92v1.92zM8.88 10a1.92 1.92 0 0 1 0 3.84h-4.8a1.92 1.92 0 1 1 0-3.84z" fill="#36C5F0"/><path d="M14.96 8.88a1.92 1.92 0 1 1 1.92 1.92h-1.92zM14 8.88a1.92 1.92 0 0 1-3.84 0v-4.8a1.92 1.92 0 1 1 3.84 0z" fill="#2EB67D"/><path d="M15.12 14.96a1.92 1.92 0 1 1-1.92 1.92v-1.92zM15.12 14a1.92 1.92 0 0 1 0-3.84h4.8a1.92 1.92 0 1 1 0 3.84z" fill="#ECB22E"/></svg>' },
    { id: 'teams', label: 'Teams', connectorId: 'teamchat', svg: '<svg viewBox="0 0 24 24"><circle cx="17" cy="7.5" r="2.4" fill="#7B83EB"/><circle cx="10.5" cy="6.5" r="3.1" fill="#5059C9"/><rect x="2" y="9" width="12" height="10" rx="1.6" fill="#4B53BC"/><path d="M14 10h6.4a.8.8 0 0 1 .8.8v4.4a4 4 0 0 1-4 4H14z" fill="#7B83EB"/><text x="8" y="16.4" font-family="Arial,sans-serif" font-size="7.5" font-weight="700" fill="#fff" text-anchor="middle">T</text></svg>' },
    { id: 'asana', label: 'Asana', connectorId: 'asana', svg: '<svg viewBox="0 0 24 24"><circle cx="12" cy="7.6" r="4.2" fill="#F9756C"/><circle cx="6" cy="16.4" r="4.2" fill="#F9756C"/><circle cx="18" cy="16.4" r="4.2" fill="#F9756C"/></svg>' },
    { id: 'outlook', label: 'Outlook', connectorId: 'microsoft', svg: '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="13" height="18" rx="1.5" fill="#1490DF"/><path d="M9 8h13v8H9z" fill="#28A8EA"/><rect x="1" y="6" width="12" height="12" rx="1.5" fill="#0078D4"/><circle cx="7" cy="12" r="3.4" fill="none" stroke="#fff" stroke-width="1.8"/></svg>' },
    { id: 'jira', label: 'Jira', connectorId: 'jira', svg: '<svg viewBox="0 0 24 24"><path d="M12 2 6.5 7.5a2.6 2.6 0 0 0 0 3.7l5.5 5.5 5.5-5.5a2.6 2.6 0 0 0 0-3.7z" fill="#2684FF"/><path d="M12 8.5 8.9 11.6a2.6 2.6 0 0 0 0 3.7L12 18.4l3.1-3.1a2.6 2.6 0 0 0 0-3.7z" fill="#0052CC"/><path d="m12 15-1.7 1.7a2.6 2.6 0 0 0 0 3.6L12 22l1.7-1.7a2.6 2.6 0 0 0 0-3.6z" fill="#2684FF"/></svg>' },
    { id: 'clickup', label: 'ClickUp', connectorId: 'clickup', svg: '<svg viewBox="0 0 24 24"><defs><linearGradient id="fihCu" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8930FD"/><stop offset="1" stop-color="#49CCF9"/></linearGradient><linearGradient id="fihCu2" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FF02F0"/><stop offset="1" stop-color="#FFC800"/></linearGradient></defs><path d="m4 16 3.2-2.5c1.7 2.2 3.2 3.2 4.8 3.2s3.1-1 4.8-3.2L20 16c-2.4 3.1-5 4.7-8 4.7S6.4 19.1 4 16z" fill="url(#fihCu)"/><path d="m12 3 6.5 5.6-2.6 3L12 8.2l-3.9 3.4-2.6-3z" fill="url(#fihCu2)"/></svg>' },
    { id: 'github', label: 'GitHub', connectorId: 'github', svg: '<svg viewBox="0 0 24 24"><path fill="#181717" d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.16 1.18a11 11 0 0 1 5.75 0c2.2-1.49 3.16-1.18 3.16-1.18.62 1.59.23 2.76.11 3.05.73.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.38-5.26 5.66.41.36.78 1.06.78 2.14 0 1.55-.01 2.79-.01 3.17 0 .31.21.67.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z"/></svg>' },
    { id: 'linear', label: 'Linear', connectorId: 'linear', svg: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#5E6AD2"/><g stroke="#fff" stroke-width="1.7" stroke-linecap="round"><path d="M5 13.5 10.5 19"/><path d="M5 9.5 14.5 19"/><path d="M6.8 6.3 17.7 17.2"/><path d="M10 4.8 19.2 14"/></g></svg>' },
    { id: 'calendly', label: 'Calendly', connectorId: 'calendly', svg: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#fff" stroke="#006BFF" stroke-width="1.4"/><path d="M16.2 14.6a5 5 0 1 1 0-5.2" fill="none" stroke="#006BFF" stroke-width="2.4" stroke-linecap="round"/></svg>' },
    { id: 'todoist', label: 'Todoist', connectorId: 'todoist', svg: '<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="5" fill="#E44332"/><g fill="#fff"><path d="m4.5 8.6 5-2.9c.4-.2.7-.2 1 0l1.6.9-6.3 3.7-1.3-.8c-.4-.2-.4-.7 0-.9z"/><path d="m4.5 12.1 8.2-4.8 2.6 1.5-9.5 5.5-1.3-.8c-.4-.2-.4-1.2 0-1.4z" opacity=".95"/><path d="m4.5 15.6 11.4-6.7 2.6 1.5L5.8 18l-1.3-.8c-.4-.2-.4-1.4 0-1.6z" opacity=".9"/></g></svg>' },
    { id: 'trello', label: 'Trello', connectorId: 'trello', svg: '<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="5" fill="#0079BF"/><rect x="4.5" y="4.5" width="6.2" height="13" rx="1.4" fill="#fff"/><rect x="13.3" y="4.5" width="6.2" height="8" rx="1.4" fill="#fff"/></svg>' },
    { id: 'notion', label: 'Notion', connectorId: 'notion', svg: '<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="5" fill="#fff" stroke="#0f0f10" stroke-width="1.2"/><path fill="#0f0f10" d="M8.2 6.6 6 6.78v.36l.74.36c.16.07.22.18.22.45v8.04l-1 .12v.42l2.66-.16v-.4l-.86.06V9.04l5.78 7.86 1.74-.1V7.4c0-.27.06-.4.28-.45l.62-.16V6.4l-2.7.18v.4l.9-.05v6.42L8.2 6.6z"/></svg>' },
    { id: 'zapier', label: 'Zapier', connectorId: 'zapier', svg: '<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="5" fill="#FF4F00"/><path fill="#fff" d="M13.9 12c0 .58-.1 1.13-.3 1.64-.51.2-1.06.31-1.6.31s-1.09-.1-1.6-.3c-.2-.52-.3-1.07-.3-1.65s.1-1.13.3-1.64c.51-.2 1.06-.31 1.6-.31s1.09.1 1.6.3c.2.52.3 1.07.3 1.65zm5.6-1.25h-4.44l3.14-3.14a7.6 7.6 0 0 0-1.77-1.77L13.3 8.98V4.54a7.7 7.7 0 0 0-2.5 0v4.44L7.66 5.84A7.6 7.6 0 0 0 5.9 7.6l3.14 3.14H4.6a7.7 7.7 0 0 0 0 2.5h4.44L5.9 16.38c.5.68 1.1 1.28 1.77 1.77l3.14-3.14v4.44a7.7 7.7 0 0 0 2.5 0v-4.44l3.14 3.14a7.6 7.6 0 0 0 1.77-1.77l-3.14-3.14h4.44a7.7 7.7 0 0 0 0-2.5z"/></svg>' },
    { id: 'ifttt', label: 'IFTTT', connectorId: 'ifttt', svg: '<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="5" fill="#0f0f10"/><text x="12" y="14.8" font-family="Arial,sans-serif" font-size="6.2" font-weight="900" fill="#fff" text-anchor="middle" letter-spacing=".4">IFTTT</text></svg>' },
  ];

  const FC = () => window.FluxConnectors || null;

  function tileStatus(tile) {
    const fc = FC();
    if (!fc) return 'off';
    try { return fc.status(tile.connectorId) || 'off'; } catch (_) { return 'off'; }
  }

  function statusChip(tile) {
    const st = tileStatus(tile);
    if (st === 'connected') return '<span class="fih-chip fih-chip-on">Connected</span>';
    if (loadArr(WISH_KEY).includes(tile.id)) return '<span class="fih-chip fih-chip-req">Requested</span>';
    if (st === 'coming_soon') return '<span class="fih-chip">Coming soon</span>';
    return '';
  }

  function tileHTML(tile, mode) {
    const selected = mode === 'picker' && loadArr(SEL_KEY).includes(tile.id);
    return `
      <button type="button" class="fih-tile${selected ? ' selected' : ''}" data-fih-id="${tile.id}" aria-pressed="${selected}">
        <span class="fih-check" aria-hidden="true">✓</span>
        <span class="fih-logo" aria-hidden="true">${tile.svg}</span>
        <span class="fih-label">${tile.label}</span>
        ${mode === 'hub' ? statusChip(tile) : ''}
      </button>`;
  }

  function gridHTML(mode) {
    return `<div class="fih-grid" data-fih-mode="${mode}">${TILES.map((t) => tileHTML(t, mode)).join('')}</div>`;
  }

  /* ── Picker mode (onboarding) ── */
  function renderPickerInto(el) {
    if (!el) return;
    el.innerHTML = gridHTML('picker');
    el.addEventListener('click', (e) => {
      const btn = e.target.closest('.fih-tile');
      if (!btn) return;
      btn.classList.toggle('selected');
      btn.setAttribute('aria-pressed', btn.classList.contains('selected') ? 'true' : 'false');
      const sel = Array.from(el.querySelectorAll('.fih-tile.selected')).map((b) => b.dataset.fihId);
      saveArr(SEL_KEY, sel);
    });
  }

  const getSelected = () => loadArr(SEL_KEY);

  /* ── Hub mode (modal) ── */
  let overlay = null;

  function handleHubClick(tileId) {
    const tile = TILES.find((t) => t.id === tileId);
    if (!tile) return;
    const fc = FC();
    const st = tileStatus(tile);
    const spec = fc && fc.get(tile.connectorId);
    if (st === 'connected') {
      if (typeof window.showToast === 'function') window.showToast(`${tile.label} is connected. Manage it in Settings → Connectors.`, 'info');
      return;
    }
    if (spec && st !== 'coming_soon' && fc) {
      Promise.resolve(fc.connect(tile.connectorId)).then(() => refreshHub()).catch(() => refreshHub());
      return;
    }
    // Coming soon → toggle wishlist so the roadmap reflects real demand.
    const wish = loadArr(WISH_KEY);
    const i = wish.indexOf(tileId);
    if (i >= 0) wish.splice(i, 1); else wish.push(tileId);
    saveArr(WISH_KEY, wish);
    if (typeof window.showToast === 'function' && i < 0) window.showToast(`${tile.label} noted — it moves up the roadmap.`, 'info');
    refreshHub();
  }

  function refreshHub() {
    const body = overlay && overlay.querySelector('.fih-body');
    if (body) body.innerHTML = gridHTML('hub');
  }

  function open() {
    close();
    overlay = document.createElement('div');
    overlay.className = 'fih-overlay';
    overlay.innerHTML = `
      <div class="fih-modal" role="dialog" aria-modal="true" aria-label="Integrations">
        <button type="button" class="fih-close" aria-label="Close">✕</button>
        <h2 class="fih-title">Which <em>tools</em> do you want to connect?</h2>
        <p class="fih-sub">Google works today — the rest connect through feeds, the email task inbox, or are being wired now.</p>
        <div class="fih-body">${gridHTML('hub')}</div>
      </div>`;
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.closest('.fih-close')) { close(); return; }
      const btn = e.target.closest('.fih-tile');
      if (btn) handleHubClick(btn.dataset.fihId);
    });
    document.addEventListener('keydown', escClose);
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay && overlay.classList.add('visible'));
  }
  function escClose(e) { if (e.key === 'Escape') close(); }
  function close() {
    document.removeEventListener('keydown', escClose);
    if (overlay) { overlay.remove(); overlay = null; }
  }

  /* ── Settings entry point — button on the existing Connectors card ── */
  let tries = 0;
  const injector = setInterval(() => {
    tries += 1;
    const card = document.getElementById('fluxConnectorsCard');
    if (card && !card.querySelector('.fih-open-btn')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn fih-open-btn';
      btn.textContent = '✦ Browse integrations gallery';
      btn.addEventListener('click', open);
      card.insertBefore(btn, card.firstChild ? card.firstChild.nextSibling : null);
      clearInterval(injector);
    }
    if (tries > 40) clearInterval(injector);
  }, 1500);

  window.FluxIntegrationsHub = { open, close, renderPickerInto, getSelected, TILES };
})();
