/* ════════════════════════════════════════════════════════════════════════════
 * FluxAIProviders UI — Settings card for managing BYOK AI provider keys.
 *
 * Renders into Settings → Appearance pane (no existing AI-specific pane) so it
 * appears alongside the locale picker. Each provider row shows:
 *   - icon + name + status pill (Connected | Add key | Error)
 *   - "where to get a key" link
 *   - input to paste the key (type=password, no autocomplete)
 *   - test button that hits the provider with a tiny prompt
 *   - default-route radio so user can pick "which AI does Flux use first"
 *
 * Self-contained. Mounts on settings-panel entry; idempotent.
 * ──────────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  const CARD_ID = 'fluxAIProvidersCard';

  function fp() { return window.FluxAIProviders; }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function toast(msg, tone) {
    if (typeof window.showToast === 'function') { try { window.showToast(msg, tone || 'info'); return; } catch {} }
  }

  function statusPill(providerId) {
    const provs = fp();
    const has = provs.getKey(providerId);
    if (!has) return '<span class="flux-aip-pill" data-tone="off">Add key</span>';
    return '<span class="flux-aip-pill" data-tone="ok">Key saved</span>';
  }

  function render() {
    const provs = fp();
    if (!provs) return;
    const pane = document.getElementById('spane-appearance') || document.getElementById('settings');
    if (!pane) return;
    let card = document.getElementById(CARD_ID);
    const exists = !!card;
    if (!card) {
      card = document.createElement('div');
      card.className = 'card flux-aip-card';
      card.id = CARD_ID;
      pane.insertBefore(card, pane.firstChild);
    }
    const route = provs.getDefaultRoute();
    const configured = provs.listConfigured();
    card.innerHTML = `
      <h3 style="margin-top:0">AI providers <span class="flux-aip-badge">${esc(configured.length)} connected</span></h3>
      <p style="font-size:.78rem;color:var(--muted2);margin:0 0 14px;line-height:1.55">
        Add your own API keys to let Flux AI call Claude, GPT, Gemini, Groq, Mistral, or DeepSeek directly.
        Keys are stored only on this device — never sent to Flux servers.
        Once any key is set, type <code>/ask &lt;model&gt; &lt;question&gt;</code> in the AI panel to route a single question to that provider.
      </p>
      <div class="flux-aip-list">
        ${provs.providers.map((p) => {
          const key = provs.getKey(p.id);
          const isRoute = route && route.provider === p.id;
          return `
            <div class="flux-aip-row" data-prov="${esc(p.id)}">
              <div class="flux-aip-row-head">
                <span class="flux-aip-icon" aria-hidden="true">${p.logoSvg || esc(p.icon)}</span>
                <div class="flux-aip-row-title">
                  <strong>${esc(p.name)}</strong>
                  <a class="flux-aip-link" href="${esc(p.site)}" target="_blank" rel="noopener noreferrer">Get key →</a>
                </div>
                ${statusPill(p.id)}
              </div>
              <div class="flux-aip-row-form">
                <input type="password" class="flux-aip-key" autocomplete="off" spellcheck="false"
                  placeholder="${esc(p.keyHint || 'Paste API key')}"
                  value="${key ? '••••••••••••••••' : ''}"
                  data-real="${key ? '1' : '0'}">
                <button type="button" class="flux-aip-save">${key ? 'Update' : 'Save'}</button>
                ${key ? '<button type="button" class="flux-aip-clear" title="Remove key">✕</button>' : ''}
                ${key ? '<button type="button" class="flux-aip-test">Test</button>' : ''}
              </div>
              ${key ? `
                <div class="flux-aip-row-models">
                  <label>Default model</label>
                  <select class="flux-aip-model">
                    ${p.models.map((m) =>
                      `<option value="${esc(m.id)}" ${isRoute && route.model === m.id ? 'selected' : ''}>${esc(m.label)}</option>`
                    ).join('')}
                  </select>
                  <label class="flux-aip-default">
                    <input type="checkbox" class="flux-aip-route" ${isRoute ? 'checked' : ''}>
                    <span>Use as default for /ask</span>
                  </label>
                </div>
              ` : ''}
              <div class="flux-aip-msg" hidden></div>
            </div>`;
        }).join('')}
      </div>
    `;
    wire(card);
  }

  function wire(card) {
    const provs = fp();
    card.querySelectorAll('.flux-aip-row').forEach((row) => {
      const pid = row.dataset.prov;
      const input = row.querySelector('.flux-aip-key');
      const msg = row.querySelector('.flux-aip-msg');
      const showMsg = (text, tone) => {
        if (!msg) return;
        msg.hidden = false;
        msg.textContent = text;
        msg.dataset.tone = tone || 'info';
        setTimeout(() => { msg.hidden = true; }, 4000);
      };
      // If the user starts typing in a masked field, clear the mask
      input?.addEventListener('focus', () => {
        if (input.dataset.real === '1') { input.value = ''; input.dataset.real = '0'; }
      });
      row.querySelector('.flux-aip-save')?.addEventListener('click', () => {
        const v = (input?.value || '').trim();
        if (!v) { showMsg('Paste a key first.', 'warn'); return; }
        if (v.length < 12) { showMsg('That key looks too short — double-check the paste.', 'warn'); return; }
        provs.setKey(pid, v);
        toast(provs.byId[pid].name + ' key saved', 'success');
        render(); // re-render so status pill updates
      });
      row.querySelector('.flux-aip-clear')?.addEventListener('click', () => {
        provs.clearKey(pid);
        toast(provs.byId[pid].name + ' key removed', 'info');
        render();
      });
      row.querySelector('.flux-aip-test')?.addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        const orig = btn.textContent;
        btn.disabled = true; btn.textContent = 'Testing…';
        const modelSel = row.querySelector('.flux-aip-model');
        const model = modelSel ? modelSel.value : undefined;
        const res = await provs.call({
          provider: pid,
          model,
          user: 'Reply with exactly the single word: OK',
          temperature: 0,
          timeoutMs: 12000,
        });
        btn.disabled = false; btn.textContent = orig;
        if (res.ok) showMsg('Reply: ' + (res.text || '').slice(0, 80), 'ok');
        else showMsg(res.error || 'Test failed', 'err');
      });
      const modelSel = row.querySelector('.flux-aip-model');
      const routeCb = row.querySelector('.flux-aip-route');
      modelSel?.addEventListener('change', () => {
        // Only persist if this provider is the default; otherwise just preview.
        if (routeCb && routeCb.checked) provs.setDefaultRoute(pid, modelSel.value);
      });
      routeCb?.addEventListener('change', () => {
        if (routeCb.checked) {
          provs.setDefaultRoute(pid, modelSel ? modelSel.value : undefined);
          toast(provs.byId[pid].name + ' is now the default for /ask', 'success');
          render(); // re-render so other rows' radios update
        }
      });
    });
  }

  function maybeRender() {
    // Render when the Settings → Appearance pane is mounted/visible.
    if (document.getElementById('spane-appearance') || document.getElementById('settings')) render();
  }

  document.addEventListener('flux-nav', (e) => {
    if (e?.detail?.panel === 'settings') setTimeout(maybeRender, 60);
  });
  // Also try on initial settings tab clicks (handled by other code)
  document.addEventListener('click', (e) => {
    const t = e.target;
    if (!t || !t.closest) return;
    if (t.closest('[data-settings-tab="appearance"], [data-spane="appearance"], [onclick*="settings"]')) {
      setTimeout(maybeRender, 80);
    }
  });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', maybeRender, { once: true });
  } else {
    maybeRender();
  }

  /* ── Clickable AI composer hint chips ──────────────────────────────────
     The chips under the AI input (/plan, /optimize, /fix, /ask) were purely
     decorative. Make them prefill the AI input + focus it, so the whole skill
     system — including the new /ask — is discoverable by tapping. Delegated
     so it survives panel re-renders, and scoped to [data-ai-chip] only. */
  function prefillFromChip(chipText) {
    const input = document.getElementById('aiInput');
    if (!input) return;
    input.value = chipText;
    input.focus();
    // Put cursor at the end so the user types their prompt right after the slash.
    try { input.setSelectionRange(input.value.length, input.value.length); } catch (_) {}
    // Some composers auto-grow on input — fire the event so height updates.
    try { input.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) {}
  }
  document.addEventListener('click', (e) => {
    const chip = e.target && e.target.closest ? e.target.closest('[data-ai-chip]') : null;
    if (chip) prefillFromChip(chip.getAttribute('data-ai-chip') || '');
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const chip = e.target && e.target.closest ? e.target.closest('[data-ai-chip]') : null;
    if (chip) { e.preventDefault(); prefillFromChip(chip.getAttribute('data-ai-chip') || ''); }
  });

  // Expose for debugging / hooks
  window.FluxAIProvidersUI = { render, maybeRender, prefillFromChip };
})();
