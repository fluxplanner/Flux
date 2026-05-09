chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});

/** Capture the visible area of the tab that is currently active in the window (not the side panel). */
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'CAPTURE_VISIBLE_TAB') {
    chrome.tabs
      .query({ active: true, lastFocusedWindow: true })
      .then((tabs) => {
        const id = tabs[0]?.id;
        if (id == null) {
          sendResponse({ ok: false, error: 'No active tab' });
          return;
        }
        return chrome.tabs.captureVisibleTab(undefined, { format: 'png' }).then((dataUrl) => {
          sendResponse({ ok: true, dataUrl });
        });
      })
      .catch((e) => {
        sendResponse({ ok: false, error: String(e?.message || e) });
      });
    return true;
  }
  return false;
});
