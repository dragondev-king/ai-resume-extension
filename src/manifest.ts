import { defineManifest } from '@crxjs/vite-plugin';
import { SUGGESTED_SHORTCUTS } from './lib/commands';

export default defineManifest({
  manifest_version: 3,
  name: 'AI Resume Generator',
  version: '1.0.0',
  author: {
    email: "dragondev1017@gmail.com",
  },
  description: 'Generate a tailored resume from the current job application page.',
  icons: {
    16: 'icons/icon16.png',
    32: 'icons/icon32.png',
    48: 'icons/icon48.png',
    128: 'icons/icon128.png',
  },
  action: {
    default_popup: 'src/popup/index.html',
    default_title: 'AI Resume Generator',
    default_icon: {
      16: 'icons/icon16.png',
      32: 'icons/icon32.png',
      48: 'icons/icon48.png',
      128: 'icons/icon128.png',
    },
  },
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  permissions: ['storage', 'sidePanel', 'scripting', 'tabs', 'activeTab'],
  host_permissions: ['https://*/*', 'http://*/*'],
  commands: {
    _execute_action: {
      suggested_key: SUGGESTED_SHORTCUTS.openPopup,
      description: 'Open the AI Resume Generator popup',
    },
  },
});
