import { GENERATION_STORAGE_PREFIX } from '../lib/generationTypes';
import { runQueuedGeneration, type StartGenerationPayload } from '../lib/runGeneration';
import { removeGenerationState } from '../lib/generationStore';
import { disableGlobalSidePanel, disableTabSidePanel } from '../lib/sidePanel';

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
  void disableGlobalSidePanel();
  void pruneOrphanedGenerationState();
});

chrome.runtime.onStartup.addListener(() => {
  void disableGlobalSidePanel();
  void pruneOrphanedGenerationState();
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void removeGenerationState(tabId);
});

chrome.runtime.onConnect.addListener((port) => {
  if (!port.name.startsWith('sidePanel:')) return;
  const tabId = Number(port.name.slice('sidePanel:'.length));
  if (!Number.isFinite(tabId)) return;

  port.onDisconnect.addListener(() => {
    void (async () => {
      const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (active?.id === tabId) {
        await disableTabSidePanel(tabId);
      }
    })();
  });
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
