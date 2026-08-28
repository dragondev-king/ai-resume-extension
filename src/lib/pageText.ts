const MAX_PAGE_TEXT = 80_000;
const MIN_FRAME_CHARS = 40;

export type PageText = {
  text: string;
  url: string;
  title: string;
};

type FrameText = {
  text: string;
  url: string;
  title: string;
  iframeCount: number;
};

const JOB_HOST_HINTS = [
  'icims.com',
  'greenhouse.io',
  'myworkdayjobs.com',
  'workday.com',
  'wd1.myworkday',
  'wd5.myworkday',
  'taleo.net',
  'smartrecruiters.com',
  'jobvite.com',
  'eightfold.ai',
  'successfactors.com',
  'ultipro.com',
  'paylocity.com',
  'breezy.hr',
  'ashbyhq.com',
  'lever.co',
  'boards.greenhouse',
  'jobs.jobvite',
  'apply.workable.com',
  'workable.com',
  'recruitee.com',
  'adp.com',
  'oraclecloud.com',
  'csod.com',
  'brassring.com',
  'silkroad.com',
  'paycomonline.net',
  'jobappnetwork.com',
];

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

function isJobBoardUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return JOB_HOST_HINTS.some((hint) => lower.includes(hint));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Runs in every frame (main page + iframes). Keep this self-contained:
 * Chrome serializes it into the page and cannot close over extension modules.
 */
function collectFrameText(): FrameText {
  const chunks: string[] = [];

  const push = (value: string | null | undefined) => {
    const text = (value || '').replace(/\u00a0/g, ' ').replace(/[ \t]+\n/g, '\n').trim();
    if (text) chunks.push(text);
  };

  push(document.body?.innerText);
  if (!document.body?.innerText) {
    push(document.documentElement?.innerText);
  }

  const visitShadow = (root: Document | ShadowRoot) => {
    const nodes = root.querySelectorAll('*');
    for (let i = 0; i < nodes.length; i++) {
      const el = nodes[i];
      if (!el.shadowRoot) continue;
      push(el.shadowRoot.textContent);
      visitShadow(el.shadowRoot);
    }
  };
  visitShadow(document);

  const unique: string[] = [];
  for (const chunk of chunks) {
    if (!unique.some((existing) => existing.includes(chunk))) {
      unique.push(chunk);
    }
  }

  return {
    text: unique.join('\n\n').replace(/\n{3,}/g, '\n\n').trim(),
    url: location.href,
    title: document.title,
    iframeCount: document.querySelectorAll('iframe').length,
  };
}

function mergeFrameResults(
  results: chrome.scripting.InjectionResult<FrameText | null>[],
  tabUrl: string,
  tabTitle: string
): PageText {
  const frames = results
    .map((entry) => ({
      frameId: entry.frameId,
      ...(entry.result || { text: '', url: '', title: '', iframeCount: 0 }),
    }))
    .filter((frame) => frame.text.replace(/\s+/g, ' ').trim().length >= MIN_FRAME_CHARS);

  frames.sort((a, b) => {
    const aJob = isJobBoardUrl(a.url) ? 1 : 0;
    const bJob = isJobBoardUrl(b.url) ? 1 : 0;
    if (aJob !== bJob) return bJob - aJob;

    const aNested = a.frameId === 0 ? 0 : 1;
    const bNested = b.frameId === 0 ? 0 : 1;
    if (aNested !== bNested) return bNested - aNested;

    return b.text.length - a.text.length;
  });

  const seen = new Set<string>();
  const parts: string[] = [];
  for (const frame of frames) {
    const normalized = frame.text.replace(/\s+/g, ' ').slice(0, 500);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    const label = frame.frameId === 0 ? 'Page' : 'Embedded job content';
    parts.push(`${label} (${frame.url})\n${frame.text}`);
  }

  const text = parts.join('\n\n----\n\n').trim();
  const title =
    frames.find((frame) => isJobBoardUrl(frame.url) && frame.title)?.title ||
    frames.find((frame) => frame.frameId !== 0 && frame.title)?.title ||
    tabTitle;

  return {
    text: text.slice(0, MAX_PAGE_TEXT),
    url: tabUrl,
    title,
  };
}

async function scrapeAllFrames(tabId: number) {
  return chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    func: collectFrameText,
  });
}

export async function extractTabText(tabId: number): Promise<PageText> {
  const tab = await chrome.tabs.get(tabId);
  if (isRestrictedUrl(tab.url)) {
    throw new Error('Open a job application page first. This browser page cannot be read.');
  }

  let results = await scrapeAllFrames(tabId);
  let merged = mergeFrameResults(results, tab.url || '', tab.title || '');

  const main = results.find((entry) => entry.frameId === 0)?.result;
  const nestedWithText = results.filter(
    (entry) => entry.frameId !== 0 && (entry.result?.text?.length || 0) >= MIN_FRAME_CHARS
  );
  const likelyJobIframeStillEmpty =
    (main?.iframeCount || 0) > 0 &&
    nestedWithText.length === 0 &&
    !results.some((entry) => entry.result && isJobBoardUrl(entry.result.url));

  if (likelyJobIframeStillEmpty) {
    await delay(1000);
    results = await scrapeAllFrames(tabId);
    merged = mergeFrameResults(results, tab.url || '', tab.title || '');
  }

  if (!merged.text) {
    throw new Error('Could not read text from this page.');
  }

  return merged;
}
