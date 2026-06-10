/**
 * background.js — service worker for the Flux universal extension.
 *
 * Responsibilities:
 *   • Wire the action button to open the side rail (or popup fallback).
 *   • Register context menus ("Add to Flux", "Summarize", etc.).
 *   • Handle the `fx` omnibox keyword for quick-capture.
 *   • Bridge AI proxy calls + auth between content scripts, side rail, and the web app.
 *   • Capture visible tab (for screenshots / vision).
 *
 * All chrome.* / browser.* calls go through browser-shim.js so the same code
 * runs on Chrome, Edge, Brave, Arc, Firefox, and Safari.
 */
import {
  ext,
  sidebar,
  contextMenus,
  tabs,
  runtime,
  notifications,
  sessionStorage as sessx,
  localStorage as lsx,
} from './lib/browser-shim.js';
import { getConfig, callAI, callAIStream } from './lib/api.js';

/* ───────── Lifecycle ───────── */

ext.runtime.onInstalled.addListener(() => {
  registerContextMenus();
  // Open the side rail when the action is clicked on Chrome/Edge.
  try {
    if (ext.sidePanel && ext.sidePanel.setPanelBehavior) {
      ext.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    }
  } catch (_) {}
});

/* ───────── Action button → open side rail ───────── */

ext.action.onClicked?.addListener(async (tab) => {
  try {
    await sidebar.open({ tabId: tab.id });
  } catch (e) {
    console.warn('[Flux ext] sidebar open failed', e);
  }
});

/* ───────── Context menus ───────── */

function registerContextMenus() {
  try { ext.contextMenus?.removeAll?.(); } catch (_) {}

  contextMenus.create({
    id: 'flux-add-task',
    title: 'Add to Flux',
    contexts: ['page', 'selection', 'link'],
  });
  contextMenus.create({
    id: 'flux-summarize',
    title: 'Summarize with Flux',
    contexts: ['page', 'selection'],
  });
  contextMenus.create({
    id: 'flux-flashcards',
    title: 'Make flashcards',
    contexts: ['selection'],
  });
  contextMenus.create({
    id: 'flux-cite',
    title: 'Cite this',
    contexts: ['page', 'selection', 'link'],
  });
}

contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab || !tab.id) return;
  const cmd = info.menuItemId;
  const selectionText = info.selectionText || '';
  switch (cmd) {
    case 'flux-add-task':
      await openSidebarWith({ action: 'addTask', text: selectionText || tab.title || tab.url, url: tab.url });
      break;
    case 'flux-summarize':
      await openSidebarWith({ action: 'summarize', text: selectionText, url: tab.url, tabId: tab.id });
      break;
    case 'flux-flashcards':
      await openSidebarWith({ action: 'flashcards', text: selectionText, url: tab.url });
      break;
    case 'flux-cite':
      await openSidebarWith({ action: 'cite', text: selectionText || tab.title, url: tab.url });
      break;
  }
});

async function openSidebarWith(payload) {
  try {
    await sessx.set('flux_sidebar_intent', payload, 300);
    const t = await tabs.active();
    await sidebar.open({ tabId: t?.id });
  } catch (e) {
    console.warn('[Flux ext] context-menu open failed', e);
  }
}

/* ───────── Omnibox: `fx <query>` quick capture ───────── */

if (ext.omnibox && ext.omnibox.onInputEntered) {
  ext.omnibox.setDefaultSuggestion?.({
    description: 'Add to Flux: <match><url>%s</url></match>',
  });
  ext.omnibox.onInputEntered.addListener(async (text) => {
    if (!text || !text.trim()) return;
    // Quick-capture: treat as a task title; open the side rail so it lands there.
    await openSidebarWith({ action: 'omniboxQuickAdd', text: text.trim() });
  });
}

/* ───────── Message router ───────── */

runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type) return;
  switch (msg.type) {
    case 'FLUX_CALL_AI':
      callAI(msg.payload || {})
        .then((r) => sendResponse({ ok: true, ...r }))
        .catch((e) => sendResponse({ ok: false, error: e.message }));
      return true; // async
    case 'FLUX_GET_CONFIG':
      getConfig({ refresh: !!msg.refresh })
        .then((c) => sendResponse({ ok: true, config: c }))
        .catch((e) => sendResponse({ ok: false, error: e.message }));
      return true;
    case 'FLUX_CAPTURE_TAB':
      tabs.captureVisible()
        .then((d) => sendResponse({ ok: true, dataUrl: d }))
        .catch((e) => sendResponse({ ok: false, error: e.message }));
      return true;
    case 'FLUX_GET_INTENT':
      sessx.get('flux_sidebar_intent')
        .then((intent) => {
          if (intent) sessx.remove('flux_sidebar_intent');
          sendResponse({ ok: true, intent });
        })
        .catch((e) => sendResponse({ ok: false, error: e.message }));
      return true;
    case 'FLUX_GET_PAGE_SNAPSHOT':
      // Fresh, on-demand snapshot of a tab. Never depends on the content
      // script being loaded — falls back to scripting.executeScript, which
      // works on tabs that were already open before the extension installed.
      getPageSnapshot(msg.tabId)
        .then((snapshot) => sendResponse({ ok: true, snapshot }))
        .catch((e) => sendResponse({ ok: false, error: e.message }));
      return true;
  }
});

/* ───────── On-demand page snapshot ───────── */

async function getPageSnapshot(tabId) {
  let tab = null;
  try {
    tab = tabId ? await ext.tabs.get(tabId) : await tabs.active();
  } catch (_) {
    tab = await tabs.active();
  }
  if (!tab || !tab.id) throw new Error('No active tab');
  const url = tab.url || '';
  const base = {
    tabId: tab.id,
    url,
    title: tab.title || '',
    favIconUrl: tab.favIconUrl || '',
  };
  // Browser-internal pages can't be read.
  if (!/^https?:/i.test(url)) {
    return { ...base, restricted: true, text: '', selection: '' };
  }
  // 1. Content script (has the smarter per-site extractors).
  try {
    const r = await tabs.sendMessage(tab.id, { type: 'FLUX_GET_PAGE_TEXT' });
    if (r && r.text) {
      let selection = '';
      try {
        const s = await tabs.sendMessage(tab.id, { type: 'FLUX_GET_SELECTION' });
        selection = (s && s.text) || '';
      } catch (_) {}
      return { ...base, text: r.text, selection, via: 'content-script' };
    }
  } catch (_) { /* not injected in this tab — fall through */ }
  // 2. Inject an extractor directly.
  if (ext.scripting && ext.scripting.executeScript) {
    const results = await ext.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const sel = String(window.getSelection ? window.getSelection() : '').trim();
        const main = document.querySelector('article, main, [role="main"]') || document.body;
        const text = (main && main.innerText ? main.innerText : '')
          .replace(/[ \t]+/g, ' ')
          .replace(/\n{3,}/g, '\n\n')
          .trim()
          .slice(0, 12000);
        return { text, selection: sel.slice(0, 4000), title: document.title || '' };
      },
    });
    const r = results && results[0] && results[0].result;
    if (r) return { ...base, title: r.title || base.title, text: r.text || '', selection: r.selection || '', via: 'scripting' };
  }
  return { ...base, text: '', selection: '', via: 'none' };
}

/* ───────── Streaming AI over a port (sendMessage can't stream) ───────── */

ext.runtime.onConnect.addListener((port) => {
  if (!port || port.name !== 'flux-ai-stream') return;
  port.onMessage.addListener(async (msg) => {
    if (!msg || msg.type !== 'FLUX_STREAM_AI') return;
    try {
      const { text } = await callAIStream(msg.payload || {}, (delta) => {
        try { port.postMessage({ type: 'delta', delta }); } catch (_) {}
      });
      try { port.postMessage({ type: 'done', text }); } catch (_) {}
    } catch (e) {
      try { port.postMessage({ type: 'error', error: e.message }); } catch (_) {}
    }
  });
});

/* ───────── External messaging from the web app (shared auth) ───────── */

runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type) return;
  if (msg.type === 'FLUX_WEB_AUTH_SYNC' && msg.token) {
    lsx.set('flux_auth_token', msg.token)
      .then(() => sendResponse({ ok: true }))
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }
  if (msg.type === 'FLUX_WEB_LOGOUT') {
    lsx.remove('flux_auth_token')
      .then(() => sendResponse({ ok: true }))
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }
});
