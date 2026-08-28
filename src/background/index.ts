import { GENERATION_STORAGE_PREFIX } from '../lib/generationTypes';
import { runQueuedGeneration, type StartGenerationPayload } from '../lib/runGeneration';
import { removeGenerationState } from '../lib/generationStore';

async function pruneOrphanedGenerationState(): Promise<void> {
  const tabs = await chrome.tabs.query({});
  const liveIds = new Set(tabs.map((tab) => tab.id).filter((id): id is number => typeof id === 'number'));
  const all = await chrome.storage.local.get(null);
  const staleKeys = Object.keys(all).filter((key) => {
    if (!key.startsWith(GENERATION_STORAGE_PREFIX)) return false;
    const tabId = Number(key.slice(GENERATION_STORAGE_PREFIX.length));
    return !liveIds.has(tabId);
  });
  if (staleKeys.length > 0) {
    await chrome.storage.local.remove(staleKeys);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
  void pruneOrphanedGenerationState();
});

chrome.runtime.onStartup.addListener(() => {
  void pruneOrphanedGenerationState();
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void removeGenerationState(tabId);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'OPEN_SIDEPANEL') {
    const tabId = message.tabId ?? sender.tab?.id;
    if (typeof tabId === 'number') {
      chrome.sidePanel
        .open({ tabId })
        .then(() => sendResponse({ ok: true }))
        .catch((error) => sendResponse({ ok: false, error: String(error) }));
      return true;
    }
  }

  if (message?.type === 'START_GENERATION') {
    const payload = message.payload as StartGenerationPayload | undefined;
    if (payload?.tabId && payload.profile) {
      void runQueuedGeneration(payload);
      sendResponse({ ok: true });
    } else {
      sendResponse({ ok: false, error: 'Missing generation payload' });
    }
    return false;
  }

  return false;
});
