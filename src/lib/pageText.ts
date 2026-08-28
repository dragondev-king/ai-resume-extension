const MAX_PAGE_TEXT = 80_000;

export type PageText = {
  text: string;
  url: string;
  title: string;
};

function isRestrictedUrl(url?: string): boolean {
  if (!url) return true;
  return (
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('edge://') ||
    url.startsWith('about:') ||
    url.startsWith('devtools://')
  );
}

export async function extractTabText(tabId: number): Promise<PageText> {
  const tab = await chrome.tabs.get(tabId);
  if (isRestrictedUrl(tab.url)) {
    throw new Error('Open a job application page first. This browser page cannot be read.');
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => ({
      text: document.body?.innerText?.trim() ?? '',
      url: location.href,
      title: document.title,
    }),
  });

  const result = results[0]?.result;
  if (!result?.text) {
    throw new Error('Could not read text from this page.');
  }

  return {
    text: result.text.slice(0, MAX_PAGE_TEXT),
    url: result.url,
    title: result.title,
  };
}
