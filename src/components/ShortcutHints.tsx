import React, { useEffect, useState } from 'react';
import { prettyShortcut } from '../lib/commands';

const ShortcutHints: React.FC = () => {
  const [popupShortcut, setPopupShortcut] = useState('');

  useEffect(() => {
    chrome.commands.getAll().then((commands) => {
      const popup = commands.find((command) => command.name === '_execute_action');
      setPopupShortcut(prettyShortcut(popup?.shortcut));
    });
  }, []);

  return (
    <p className="text-[11px] leading-4 text-gray-400 text-center">
      {popupShortcut ? (
        <>
          <kbd className="font-sans text-gray-500">{popupShortcut}</kbd> opens this popup
        </>
      ) : (
        'Set a shortcut to open this popup'
      )}
      {' · '}
      <button
        type="button"
        onClick={() => void chrome.tabs.create({ url: 'chrome://extensions/shortcuts' })}
        className="text-gray-500 underline decoration-gray-300 hover:text-gray-700"
      >
        Change
      </button>
    </p>
  );
};

export default ShortcutHints;
