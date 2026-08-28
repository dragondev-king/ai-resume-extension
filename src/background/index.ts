chrome.runtime.onInstalled.addListener(() => {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'OPEN_SIDEPANEL') {
    const tabId = message.tabId ?? sender.tab?.id;
    if (typeof tabId === 'number') {
      chrome.sidePanel.open({ tabId }).then(() => sendResponse({ ok: true })).catch((error) => {
        sendResponse({ ok: false, error: String(error) });
      });
      return true;
    }
  }
  return false;
});
