/**
 * content.js — runs on every page.
 *
 * On idle, extract a structured page context (PII-scrubbed) and broadcast it
 * to the background SW. The sidebar can then fetch it via FLUX_GET_CONTEXT.
 *
 * Also exposes window.__fluxExtContext for in-page debugging.
 */
import { ext } from './lib/browser-shim.js';
import { extractContext } from './lib/page-context.js';

function broadcast() {
  try {
    const context = extractContext();
    window.__fluxExtContext = context;
    ext.runtime.sendMessage({ type: 'FLUX_PAGE_CONTEXT', context });
  } catch (e) {
    console.warn('[Flux ext] context extract failed', e);
  }
}

let debounce = null;
function scheduleBroadcast() {
  if (debounce) clearTimeout(debounce);
  debounce = setTimeout(broadcast, 800);
}

// Initial + on visibility change + on heavy DOM mutations
broadcast();

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) scheduleBroadcast();
});

const obs = new MutationObserver(() => scheduleBroadcast());
try {
  obs.observe(document.body, { childList: true, subtree: true, characterData: false });
} catch (_) {}

// Listen for action requests from background (skill execution on page)
ext.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type) return;
  if (msg.type === 'FLUX_GET_PAGE_TEXT') {
    sendResponse({ ok: true, text: (document.body.innerText || '').slice(0, 8000) });
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
