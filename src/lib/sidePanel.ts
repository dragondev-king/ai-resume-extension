const SIDE_PANEL_PATH = 'src/sidepanel/index.html';

export async function disableGlobalSidePanel(): Promise<void> {
  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
    await chrome.sidePanel.setOptions({ enabled: false });
  } catch (error) {
    console.warn('Failed to disable global side panel', error);
  }
}

export async function enableTabSidePanel(tabId: number): Promise<void> {
  await chrome.sidePanel.setOptions({
    tabId,
    path: SIDE_PANEL_PATH,
    enabled: true,
  });
}

export async function openTabSidePanel(tabId: number): Promise<void> {
  await enableTabSidePanel(tabId);
  await chrome.sidePanel.open({ tabId });
}

export async function disableTabSidePanel(tabId: number): Promise<void> {
  try {
    await chrome.sidePanel.setOptions({
      tabId,
      enabled: false,
    });
  } catch (error) {
    console.warn('Failed to disable side panel for tab', tabId, error);
  }
}
