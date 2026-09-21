import React from 'react';
import { ExternalLink } from 'lucide-react';
import { applicationDetailsUrl } from '../lib/api';
import { duplicateApplicationMessage } from '../lib/duplicateCheck';

type ExistingApplicationNoticeProps = {
  companyName?: string | null;
  applicationId?: string | null;
  message?: string | null;
};

const ExistingApplicationNotice: React.FC<ExistingApplicationNoticeProps> = ({
  companyName,
  applicationId,
  message,
}) => {
  const url = applicationId ? applicationDetailsUrl(applicationId) : null;
  const text =
    message ||
    duplicateApplicationMessage(companyName || 'this company');

  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 space-y-2">
      <p>{text}</p>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 font-medium text-amber-900 underline underline-offset-2 hover:text-amber-700"
        >
          View existing application
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      ) : null}
    </div>
  );
};

export default ExistingApplicationNotice;
