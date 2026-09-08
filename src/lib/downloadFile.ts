function sanitizeDownloadFileName(fileName: string): string {
  const trimmed = fileName.replace(/\\/g, '/').split('/').pop()?.trim() || 'resume';
  const safe = trimmed.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/\s+/g, ' ');
  return safe || 'resume';
}

export async function downloadBlobOverwrite(blob: Blob, fileName: string): Promise<void> {
  const filename = sanitizeDownloadFileName(fileName);
  const url = URL.createObjectURL(blob);

  try {
    const downloadId = await chrome.downloads.download({
      url,
      filename,
      conflictAction: 'overwrite',
      saveAs: false,
    });

    await waitForDownload(downloadId);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function waitForDownload(downloadId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onChanged = (delta: chrome.downloads.DownloadDelta) => {
      if (delta.id !== downloadId) return;
      if (delta.state?.current === 'complete') {
        chrome.downloads.onChanged.removeListener(onChanged);
        resolve();
        return;
      }
      if (delta.state?.current === 'interrupted') {
        chrome.downloads.onChanged.removeListener(onChanged);
        reject(new Error('Download was interrupted'));
      }
    };

    chrome.downloads.onChanged.addListener(onChanged);

    void chrome.downloads.search({ id: downloadId }).then((items) => {
      const state = items[0]?.state;
      if (state === 'complete') {
        chrome.downloads.onChanged.removeListener(onChanged);
        resolve();
      } else if (state === 'interrupted') {
        chrome.downloads.onChanged.removeListener(onChanged);
        reject(new Error('Download was interrupted'));
      }
    });
  });
}
