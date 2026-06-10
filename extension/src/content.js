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
