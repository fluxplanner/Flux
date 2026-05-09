document.getElementById('openSide')?.addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) await chrome.sidePanel.open({ tabId: tab.id });
  } catch (_) {}
  window.close();
});
