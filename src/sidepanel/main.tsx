import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { Loader2 } from 'lucide-react';
import { AppProviders } from '../components/AppProviders';
import GenerateView from '../components/GenerateView';
import ResumeEditor from '../components/ResumeEditor';
import { useProfiles } from '../contexts/ProfilesContext';
import { useGenerationState } from '../lib/useGenerationState';
import { runQueuedGeneration } from '../lib/runGeneration';
import '../index.css';

function SidePanelContent() {
  const generation = useGenerationState();
  const { profiles, loading } = useProfiles();
  const startedFor = useRef<number | null>(null);

  useEffect(() => {
    if (generation.status !== 'pending' || loading) return;
    const profile = profiles.find((p) => p.id === generation.profileId);
    if (!profile) return;
    if (startedFor.current === generation.updatedAt) return;
    startedFor.current = generation.updatedAt;
    void runQueuedGeneration(profile);
  }, [generation.status, generation.profileId, generation.updatedAt, loading, profiles]);

  if (generation.status === 'pending' || generation.status === 'generating') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600 mb-3" />
        <h2 className="text-base font-semibold text-gray-900">Generating resume</h2>
        <p className="text-sm text-gray-500 mt-2 max-w-xs">
          Reading this job page and tailoring the selected profile. This can take a minute.
        </p>
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

  if (generation.status === 'ready' && generation.generatedResume) {
    return (
      <div className="p-4">
        <ResumeEditor />
      </div>
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
