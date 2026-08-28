/** Suggested default. Chrome may leave it blank if another extension already claimed the combo. */
export const SUGGESTED_SHORTCUTS = {
  openPopup: {
    default: 'Alt+Shift+O',
    mac: 'Alt+Shift+O',
  },
} as const;

export function prettyShortcut(shortcut?: string): string {
  if (!shortcut) return '';
  return shortcut
    .replace(/Command/g, '⌘')
    .replace(/MacCtrl/g, '⌃')
    .replace(/Ctrl/g, 'Ctrl')
    .replace(/Alt/g, 'Alt')
    .replace(/Shift/g, 'Shift')
    .replace(/Comma/g, ',')
    .replace(/Period/g, '.');
}
