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
import { getConfig, callAI } from './lib/api.js';

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
    case 'FLUX_PAGE_CONTEXT':
      // Content script broadcasts page context — cache it so the sidebar can fetch.
      sessx.set('flux_page_context_' + (sender.tab?.id || 0), msg.context, 600)
        .then(() => sendResponse({ ok: true }))
        .catch(() => sendResponse({ ok: false }));
      return true;
    case 'FLUX_GET_TAB_CONTEXT':
      // Sidebar asks for the cached context of a tab (falls back to a live ask).
      (async () => {
        let context = await sessx.get('flux_page_context_' + (msg.tabId || 0)).catch(() => null);
        if (!context && msg.tabId) {
          try {
            const r = await tabs.sendMessage(msg.tabId, { type: 'FLUX_GET_PAGE_TEXT' });
            if (r && r.text) context = { type: 'generic', url: '', text: r.text };
          } catch (_) {}
        }
        sendResponse({ ok: !!context, context: context || null });
      })();
      return true;
  }
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
