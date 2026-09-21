import React from 'react';
import { Building2 } from 'lucide-react';
import { NON_REMOTE_ROLE_MESSAGE } from '../utils/remoteRole';

type NonRemoteRoleNoticeProps = {
  message?: string | null;
};

const NonRemoteRoleNotice: React.FC<NonRemoteRoleNoticeProps> = ({ message }) => {
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 space-y-1">
      <div className="flex items-start gap-2">
        <Building2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-800" />
        <div>
          <p className="font-medium">Not a remote role</p>
          <p className="mt-1">{message || NON_REMOTE_ROLE_MESSAGE}</p>
        </div>
      </div>
    </div>
  );
};

export default NonRemoteRoleNotice;
