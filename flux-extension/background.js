// flux-extension/background.js

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

chrome.runtime.onMessageExternal.addListener((msg, _sender, respond) => {
  if (msg?.type === 'SET_AUTH_TOKEN') {
    chrome.storage.local.set({
      fluxAuthToken: msg.token,
      fluxUserId: msg.userId || '',
    });
    respond({ ok: true });
    return;
  }
  respond({ ok: false });
});
