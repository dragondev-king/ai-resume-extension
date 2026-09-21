import React from 'react';
import { Building2 } from 'lucide-react';
import { NON_REMOTE_ROLE_MESSAGE, type NonRemoteMatch } from '../utils/remoteRole';

type NonRemoteRoleNoticeProps = {
  message?: string | null;
  matches?: NonRemoteMatch[] | null;
  ignoreChecked?: boolean;
  onIgnoreChange?: (checked: boolean) => void;
};

function highlightSnippet(snippet: string, matchedText: string) {
  const index = snippet.toLowerCase().indexOf(matchedText.toLowerCase());
  if (index === -1) return snippet;
  return (
    <>
      {snippet.slice(0, index)}
      <strong className="font-semibold">{snippet.slice(index, index + matchedText.length)}</strong>
      {snippet.slice(index + matchedText.length)}
    </>
  );
}

const NonRemoteRoleNotice: React.FC<NonRemoteRoleNoticeProps> = ({
  message,
  matches,
  ignoreChecked = false,
  onIgnoreChange,
}) => {
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 space-y-2">
      <div className="flex items-start gap-2">
        <Building2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-800" />
        <div className="min-w-0">
          <p className="font-medium">Not a remote role</p>
          <p className="mt-1">{message || NON_REMOTE_ROLE_MESSAGE}</p>
        </div>
      </div>
      {matches && matches.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-amber-900">Matched text on this page</p>
          <ul className="space-y-1">
            {matches.map((match, index) => (
              <li
                key={`${match.snippet}-${index}`}
                className="rounded bg-white/70 px-2 py-1.5 text-xs leading-snug text-amber-950"
              >
                {highlightSnippet(match.snippet, match.matchedText)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {onIgnoreChange ? (
        <label className="flex items-start gap-2 cursor-pointer text-sm text-amber-950">
          <input
            type="checkbox"
            checked={ignoreChecked}
            onChange={(event) => onIgnoreChange(event.target.checked)}
            className="mt-0.5 rounded border-amber-400 text-primary-600 focus:ring-primary-500"
          />
          <span>Ignore</span>
        </label>
      ) : null}
    </div>
  );
};

export default NonRemoteRoleNotice;
