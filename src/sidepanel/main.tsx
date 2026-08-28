import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { Loader2 } from 'lucide-react';
import { AppProviders } from '../components/AppProviders';
import GenerateView from '../components/GenerateView';
import ResumeEditor from '../components/ResumeEditor';
import { useGenerationState } from '../lib/useGenerationState';
import { useProfiles } from '../contexts/ProfilesContext';
import { setGenerationState } from '../lib/generationStore';
import {
  canApplyToCompany,
  duplicateApplicationMessage,
  shouldCheckDuplicateApplications,
} from '../lib/duplicateCheck';
import '../index.css';

function useSidePanelPort() {
  useEffect(() => {
    let port: chrome.runtime.Port | undefined;
    let cancelled = false;

    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (cancelled || typeof tab?.id !== 'number') return;
      port = chrome.runtime.connect({ name: `sidePanel:${tab.id}` });
    });

    return () => {
      cancelled = true;
      port?.disconnect();
    };
  }, []);
}

function DuplicateCheckGate({ children }: { children: React.ReactNode }) {
  const generation = useGenerationState();
  const { profiles, loading } = useProfiles();
  const checking = useRef(false);

  useEffect(() => {
    if (generation.status !== 'ready' || generation.duplicateChecked || loading) return;
    if (generation.tabId == null || !generation.generatedResume) return;

    const profile = profiles.find((item) => item.id === generation.profileId);
    if (!profile) return;
    if (!shouldCheckDuplicateApplications(profile)) {
      void setGenerationState(generation.tabId, { duplicateChecked: true });
      return;
    }

    const company = generation.generatedResume.companyName?.trim();
    if (!company) {
      void setGenerationState(generation.tabId, { duplicateChecked: true });
      return;
    }

    if (checking.current) return;
    checking.current = true;

    canApplyToCompany(profile.id, company)
      .then((canApply) => {
        if (!generation.tabId) return;
        if (!canApply) {
          return setGenerationState(generation.tabId, {
            status: 'blocked',
            generatedResume: null,
            coverLetter: null,
            questions: [],
            blockedCompany: company,
            duplicateChecked: true,
            error: duplicateApplicationMessage(company),
          });
        }
        return setGenerationState(generation.tabId, { duplicateChecked: true, blockedCompany: null });
      })
      .catch((err) => {
        if (!generation.tabId) return;
        return setGenerationState(generation.tabId, {
          status: 'error',
          error: err instanceof Error ? err.message : 'Error checking application eligibility',
        });
      })
      .finally(() => {
        checking.current = false;
      });
  }, [generation, loading, profiles]);

  if (generation.status === 'ready' && !generation.duplicateChecked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] p-6 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600 mb-3" />
        <p className="text-sm text-gray-500">Checking for an existing application to this company…</p>
      </div>
    );
  }

  return <>{children}</>;
}

function SidePanelContent() {
  useSidePanelPort();
  const generation = useGenerationState();

  if (generation.status === 'pending' || generation.status === 'generating') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600 mb-3" />
        <h2 className="text-base font-semibold text-gray-900">Generating resume</h2>
        {generation.pageTitle ? (
          <p className="text-sm text-gray-700 mt-2 max-w-xs truncate">{generation.pageTitle}</p>
        ) : null}
        <p className="text-sm text-gray-500 mt-2 max-w-xs">
          Reading this job page and tailoring the selected profile. This can take a minute. You can
          switch to another tab and generate a second resume while this one runs.
        </p>
      </div>
    );
  }

  if (generation.status === 'blocked') {
    return (
      <div className="p-5 space-y-4">
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          {generation.error ||
            `This profile already has an active application to ${generation.blockedCompany || 'this company'}. You cannot submit multiple applications to the same company.`}
        </div>
        <GenerateView compact={false} />
      </div>
    );
  }

  if (generation.status === 'error') {
    return (
      <div className="p-5 space-y-4">
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {generation.error || 'Something went wrong.'}
        </div>
        <GenerateView compact={false} />
      </div>
    );
  }

  if (generation.status === 'ready' && generation.generatedResume && generation.tabId != null) {
    return (
      <DuplicateCheckGate>
        {generation.duplicateChecked ? (
          <div className="p-4">
            <ResumeEditor key={generation.tabId} />
          </div>
        ) : null}
      </DuplicateCheckGate>
    );
  }

  return <GenerateView compact={false} />;
}

function SidePanelApp() {
  return (
    <div className="sidepanel-shell bg-white">
      <AppProviders>
        <SidePanelContent />
      </AppProviders>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SidePanelApp />
  </React.StrictMode>
);
