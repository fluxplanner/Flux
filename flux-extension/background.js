// flux-extension/background.js — context relay, side panel ports, Arc popup, AI proxy relay, capture

const AI_PROXY_URL = 'https://lfigdijuqmbensebnevo.supabase.co/functions/v1/ai-proxy';
const SB_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmaWdkaWp1cW1iZW5zZWJuZXZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNjEzMDgsImV4cCI6MjA4ODkzNzMwOH0.qG1d9DLKrs0qqLgAp-6UGdaU7xWvlg2sWq-oD-y2kVo';

/** Side panel has no sender.tab — track focused tab for context relay. */
let lastFocusedTabId = null;

function updateLastFocusedFromWindow(winId) {
  if (winId == null) return;
  chrome.tabs.query({ active: true, windowId: winId }, (tabs) => {
    if (tabs[0]?.id != null) lastFocusedTabId = tabs[0].id;
  });
}

chrome.tabs.onActivated.addListener(({ tabId }) => {
  lastFocusedTabId = tabId;
});

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (tab.active && tab.windowId != null) lastFocusedTabId = tabId;
});

chrome.windows.onFocusChanged.addListener((winId) => {
  if (winId === chrome.windows.WINDOW_ID_NONE) return;
  updateLastFocusedFromWindow(winId);
});

chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
  if (tabs[0]?.id != null) lastFocusedTabId = tabs[0].id;
});

try {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
} catch (_) {}

const sidebarPorts = new Set();

function broadcastToSidebars(msg) {
  for (const port of sidebarPorts) {
    try {
      port.postMessage(msg);
    } catch (_) {}
  }
}

async function pushContextToPorts(context) {
  if (!context) return;
  await chrome.storage.session.set({
    lastPageContext: context,
    lastContextAt: Date.now(),
    lastContextTabId: lastFocusedTabId,
  });
  broadcastToSidebars({ type: 'PAGE_CONTEXT_UPDATE', context });
}

async function pullContextFromTab(tabId) {
  if (tabId == null) return null;
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: 'GET_PAGE_CONTEXT' });
    return response?.context || null;
  } catch (_) {
    return null;
  }
}

/**
 * Vision-loop screenshot: capture viewport as base64 JPEG for multimodal AI.
 * Kept in session storage only (cleared when browser exits).
 */
async function captureViewport(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    const windowId = tab.windowId;
    const dataUrl = await chrome.tabs.captureVisibleTab(windowId, {
      format: 'jpeg',
      quality: 72,
    });
    const base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, '');
    await chrome.storage.session.set({
      lastScreenshot: base64,
      lastScreenshotAt: Date.now(),
      lastScreenshotTabId: tabId,
    });
    return base64;
  } catch (e) {
    console.warn('[Flux Vision] Screenshot failed:', e?.message || e);
    return null;
  }
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'flux-sidebar') return;
  sidebarPorts.add(port);
  port.onDisconnect.addListener(() => sidebarPorts.delete(port));

  (async () => {
    const { lastPageContext } = await chrome.storage.session.get('lastPageContext');
    if (lastPageContext) {
      try {
        port.postMessage({ type: 'PAGE_CONTEXT_UPDATE', context: lastPageContext });
      } catch (_) {}
    }
    const tid = lastFocusedTabId;
    if (tid != null) {
      const fresh = await pullContextFromTab(tid);
      if (fresh) await pushContextToPorts(fresh);
    }
  })();
});

chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  if (msg?.type === 'PAGE_CONTEXT_UPDATE' && msg.context) {
    const tabId = sender.tab?.id;
    if (tabId != null) lastFocusedTabId = tabId;
    (async () => {
      await pushContextToPorts(msg.context);
    })();
    respond({ ok: true });
    return true;
  }

  if (msg?.type === 'SELECTED_TEXT') {
    broadcastToSidebars({
      type: 'SELECTED_TEXT',
      text: msg.text,
      url: msg.url,
    });
    return false;
  }

  if (msg?.type === 'DETECT_ARC') {
    chrome.storage.local.set({ isArcBrowser: !!msg.isArc });
    respond({ ok: true });
    return true;
  }

  if (msg?.type === 'OPEN_ARC_POPUP') {
    (async () => {
      try {
        const { arcPopupWindowId } = await chrome.storage.session.get('arcPopupWindowId');
        if (arcPopupWindowId) {
          try {
            await chrome.windows.get(arcPopupWindowId);
            await chrome.windows.update(arcPopupWindowId, { focused: true });
            respond({ ok: true, reused: true });
            return;
          } catch (_) {
            await chrome.storage.session.remove('arcPopupWindowId');
          }
        }
        const win = await chrome.windows.create({
          url: chrome.runtime.getURL('sidebar.html'),
          type: 'popup',
          width: 400,
          height: 720,
        });
        await chrome.storage.session.set({ arcPopupWindowId: win.id });
        respond({ ok: true });
      } catch (e) {
        respond({ ok: false, error: String(e?.message || e) });
      }
    })();
    return true;
  }

  if (msg?.type === 'CAPTURE_VISIBLE_TAB') {
    (async () => {
      try {
        let tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (!tabs?.length) tabs = await chrome.tabs.query({ active: true, currentWindow: true });
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

  if (msg?.type === 'CAPTURE_SCREENSHOT') {
    (async () => {
      try {
        let tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (!tabs?.length) tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const tab = tabs[0];
        if (!tab?.id) {
          respond({ screenshot: null });
          return;
        }
        const screenshot = await captureViewport(tab.id);
        respond({ screenshot });
      } catch (e) {
        respond({ screenshot: null, error: String(e?.message || e) });
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

function ensureContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'flux-ask',
      title: 'Ask Flux about this',
      contexts: ['selection'],
    });
    chrome.contextMenus.create({
      id: 'flux-solve',
      title: 'Solve this with Flux',
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
  const payload = {
    type: 'CONTEXT_MENU_ACTION',
    menuId: info.menuItemId,
    selectionText: info.selectionText,
    linkUrl: info.linkUrl,
  };
  chrome.storage.local.get('isArcBrowser', ({ isArcBrowser }) => {
    if (!isArcBrowser) {
      try {
        chrome.sidePanel.open({ tabId: tab.id });
      } catch (_) {}
    }
    setTimeout(() => broadcastToSidebars(payload), isArcBrowser ? 200 : 400);
  });
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  await new Promise((r) => setTimeout(r, 400));
  const ctx = await pullContextFromTab(tabId);
  if (ctx) await pushContextToPorts(ctx);
  else {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab?.url && /^https?:/.test(tab.url)) {
        await pushContextToPorts({
          url: tab.url,
          title: tab.title,
          domain: new URL(tab.url).hostname,
          pageType: 'webpage',
          visibleText: '',
          timestamp: new Date().toISOString(),
        });
      }
    } catch (_) {}
  }
});

chrome.webNavigation.onCompleted.addListener(async (details) => {
  if (details.frameId !== 0) return;
  if (details.tabId !== lastFocusedTabId) return;
  await new Promise((r) => setTimeout(r, 900));
  const ctx = await pullContextFromTab(details.tabId);
  if (ctx) await pushContextToPorts(ctx);
});

chrome.windows.onRemoved.addListener(async (windowId) => {
  const { arcPopupWindowId } = await chrome.storage.session.get('arcPopupWindowId');
  if (arcPopupWindowId === windowId) {
    await chrome.storage.session.remove('arcPopupWindowId');
  }
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
