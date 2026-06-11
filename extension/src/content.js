/**
 * content.js — runs on every page.
 *
 * Purely reactive: answers requests from the background/sidebar for page text
 * and selection (the smarter per-site extractors live in page-context.js).
 * No periodic broadcasting — the sidebar pulls a fresh snapshot on demand via
 * FLUX_GET_PAGE_SNAPSHOT, so there's nothing to push and no orphaned-runtime
 * "Receiving end does not exist" noise after the extension reloads.
 */
import { ext } from './lib/browser-shim.js';
import { extractContext } from './lib/page-context.js';

// Auth handoff from the planner page (app.js fluxExtAuthBroadcast): relay the
// session to the background, which verifies the sender origin, stores it, and
// closes this tab when it was opened just for sign-in (?ext_auth=1).
window.addEventListener('message', (e) => {
  if (e.source !== window || e.origin !== location.origin) return;
  const d = e.data;
  if (!d || typeof d.type !== 'string') return;
  try {
    if (d.type === 'FLUX_EXT_AUTH_TOKEN' && d.session) {
      const p = ext.runtime.sendMessage({ type: 'FLUX_AUTH_FROM_WEB', session: d.session, closeTab: !!d.closeTab });
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } else if (d.type === 'FLUX_EXT_LOGOUT') {
      const p = ext.runtime.sendMessage({ type: 'FLUX_LOGOUT_FROM_WEB' });
      if (p && typeof p.catch === 'function') p.catch(() => {});
    }
  } catch (_) { /* extension reloaded — old script is orphaned */ }
});

ext.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type) return;
  if (msg.type === 'FLUX_GET_PAGE_TEXT') {
    let text = '';
    try {
      const ctx = extractContext();
      window.__fluxExtContext = ctx;
      text = ctx.text || ctx.body || ctx.description ||
        (Array.isArray(ctx.questions) ? ctx.questions.map((q) => q.text).join('\n') : '');
    } catch (_) {}
    if (!text) text = (document.body.innerText || '').slice(0, 8000);
    sendResponse({ ok: true, text: String(text).slice(0, 12000) });
    return;
  }
  if (msg.type === 'FLUX_GET_SELECTION') {
    const sel = String(window.getSelection?.() || '').trim();
    sendResponse({ ok: true, text: sel });
    return;
  }
  if (msg.type === 'FLUX_HIGHLIGHT') {
    try {
      const range = window.getSelection().getRangeAt(0);
      const span = document.createElement('mark');
      span.style.cssText = 'background:#facc15;color:#111';
      range.surroundContents(span);
      sendResponse({ ok: true });
    } catch (e) {
      sendResponse({ ok: false, error: e.message });
    }
    return;
  }
});
