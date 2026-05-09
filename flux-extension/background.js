// flux-extension/background.js — side panel, menus, auth from Flux site, AI relay (bypasses page CORS)

const AI_PROXY_URL = 'https://lfigdijuqmbensebnevo.supabase.co/functions/v1/ai-proxy';
/** Public anon key — same as main Flux app (required by Supabase Edge gateway). */
const SB_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmaWdkaWp1cW1iZW5zZWJuZXZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNjEzMDgsImV4cCI6MjA4ODkzNzMwOH0.qG1d9DLKrs0qqLgAp-6UGdaU7xWvlg2sWq-oD-y2kVo';

try {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
} catch (_) {}

function ensureContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'flux-ask',
      title: 'Ask Flux about this',
      contexts: ['selection'],
    });
    chrome.contextMenus.create({
      id: 'flux-add-task',
      title: 'Add to Flux as task',
      contexts: ['selection', 'link'],
    });
  });
}

chrome.runtime.onInstalled.addListener(ensureContextMenus);
ensureContextMenus();

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id) return;
  try {
    chrome.sidePanel.open({ tabId: tab.id });
  } catch (_) {}
  setTimeout(() => {
    try {
      chrome.tabs.sendMessage(tab.id, {
        type: 'CONTEXT_MENU_ACTION',
        menuId: info.menuItemId,
        selectionText: info.selectionText,
        linkUrl: info.linkUrl,
      });
    } catch (_) {}
  }, 400);
});

/** Visible tab pixels (works while the side panel is open — captures the active page, not the panel). */
chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
  if (msg?.type === 'CAPTURE_VISIBLE_TAB') {
    (async () => {
      try {
        let tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (!tabs?.length) {
          tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        }
        if (tabs[0]?.id == null) {
          respond({ ok: false, error: 'No active tab' });
          return;
        }
        const dataUrl = await chrome.tabs.captureVisibleTab(undefined, { format: 'png' });
        respond({ ok: true, dataUrl });
      } catch (e) {
        respond({ ok: false, error: String(e?.message || e) });
      }
    })();
    return true;
  }

  if (msg?.type === 'AI_PROXY_CALL') {
    const { system, messages, token, imageBase64, mimeType } = msg.payload || {};
    const authBearer = (token && String(token).trim()) || SB_ANON;
    (async () => {
      try {
        const jsonBody = {
          system,
          messages,
          ...(imageBase64
            ? { imageBase64: String(imageBase64), mimeType: mimeType || 'image/jpeg' }
            : {}),
        };
        const res = await fetch(AI_PROXY_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${authBearer}`,
            apikey: SB_ANON,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(jsonBody),
        });
        const text = await res.text();
        respond({ ok: res.ok, status: res.status, body: text });
      } catch (e) {
        respond({ ok: false, status: 0, body: String(e?.message || e) });
      }
    })();
    return true;
  }
  return false;
});

chrome.runtime.onMessageExternal.addListener((msg, _sender, respond) => {
  if (msg?.type === 'SET_AUTH_TOKEN') {
    chrome.storage.local.set(
      {
        fluxAuthToken: msg.token,
        fluxUserId: msg.userId || '',
      },
      () => {
        const err = chrome.runtime.lastError;
        if (err) {
          respond({ ok: false, error: err.message });
          return;
        }
        respond({ ok: true });
      },
    );
    return true;
  }
  respond({ ok: false });
  return false;
});
