import { useEffect, useState } from 'react';

export function useActiveTabId(): number | null {
  const [tabId, setTabId] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;

    const applyActiveTab = async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (mounted && typeof tab?.id === 'number') setTabId(tab.id);
    };

    void applyActiveTab();

    const onActivated = (info: chrome.tabs.TabActiveInfo) => {
      chrome.windows.getCurrent().then((win) => {
        if (!mounted) return;
        if (info.windowId === win.id) setTabId(info.tabId);
      });
    };

    chrome.tabs.onActivated.addListener(onActivated);
    return () => {
      mounted = false;
      chrome.tabs.onActivated.removeListener(onActivated);
    };
  }, []);

  return tabId;
}
