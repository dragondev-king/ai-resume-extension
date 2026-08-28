import React, { useEffect, useState } from 'react';
import { Loader2, LogOut, Sparkles, PanelRightOpen } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { useUser } from '../contexts/UserContext';
import { useProfiles } from '../contexts/ProfilesContext';
import { useGenerationState } from '../lib/useGenerationState';
import { queueGeneration } from '../lib/runGeneration';
import { openTabSidePanel } from '../lib/sidePanel';
import { API_BASE_URL } from '../lib/api';
import { SELECTED_PROFILE_KEY, SELECTED_PROVIDER_KEY } from '../lib/generationTypes';
import type { AIProvider } from '../utils/resumeGenerator';

type GenerateViewProps = {
  compact?: boolean;
};

const GenerateView: React.FC<GenerateViewProps> = ({ compact = true }) => {
  const { signOut } = useAuth();
  const { user, role } = useUser();
  const { profiles, loading: profilesLoading } = useProfiles();
  const generation = useGenerationState();
  const [selectedProfile, setSelectedProfile] = useState('');
  const [aiProvider, setAiProvider] = useState<AIProvider>('openai');
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    chrome.storage.local.get([SELECTED_PROFILE_KEY, SELECTED_PROVIDER_KEY]).then((stored) => {
      if (typeof stored[SELECTED_PROFILE_KEY] === 'string') {
        setSelectedProfile(stored[SELECTED_PROFILE_KEY]);
      }
      if (stored[SELECTED_PROVIDER_KEY] === 'openai' || stored[SELECTED_PROVIDER_KEY] === 'claude') {
        setAiProvider(stored[SELECTED_PROVIDER_KEY]);
      }
    });
  }, []);

  useEffect(() => {
    if (profiles.length === 1 && !selectedProfile) {
      setSelectedProfile(profiles[0].id);
    }
    if (selectedProfile && profiles.length > 0 && !profiles.some((p) => p.id === selectedProfile)) {
      setSelectedProfile(profiles[0]?.id ?? '');
    }
  }, [profiles, selectedProfile]);

  const openSidePanel = async (tabId: number) => {
    await openTabSidePanel(tabId);
  };

  const handleGenerate = async () => {
    if (!API_BASE_URL) {
      toast.error('Set VITE_API_BASE_URL to your deployed web app, then rebuild.');
      return;
    }
    if (!selectedProfile) {
      toast.error('Please select a profile');
      return;
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      toast.error('No active tab found');
      return;
    }

    const profile = profiles.find((p) => p.id === selectedProfile);
    if (!profile) {
      toast.error('Selected profile not found');
      return;
    }

    setStarting(true);
    try {
      await chrome.storage.local.set({
        [SELECTED_PROFILE_KEY]: selectedProfile,
        [SELECTED_PROVIDER_KEY]: aiProvider,
      });
      await openSidePanel(tab.id);
      await queueGeneration({
        profile,
        provider: aiProvider,
        tabId: tab.id,
        pageTitle: tab.title,
        pageUrl: tab.url,
      });
      if (compact) {
        window.close();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not start generation');
    } finally {
      setStarting(false);
    }
  };

  const handleOpenPanel = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      toast.error('No active tab found');
      return;
    }
    try {
      await openSidePanel(tab.id);
      if (compact) window.close();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not open the panel');
    }
  };

  const busy = starting || generation.status === 'pending' || generation.status === 'generating';
  const showReopenPanel =
    compact &&
    (generation.status === 'pending' ||
      generation.status === 'generating' ||
      generation.status === 'ready' ||
      generation.status === 'blocked' ||
      generation.status === 'error');
  const reopenLabel =
    generation.status === 'pending' || generation.status === 'generating'
      ? 'View progress'
      : generation.status === 'ready'
        ? 'Open generated resume'
        : 'Open panel';

  return (
    <div className={compact ? 'p-4 space-y-4' : 'p-5 space-y-5'}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold text-gray-900">AI Resume Generator</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {user?.first_name ? `Hi ${user.first_name}` : user?.email}
          </p>
        </div>
        <button
          type="button"
          onClick={() => signOut()}
          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign out
        </button>
      </div>

      <p className="text-sm text-gray-600">
        We&apos;ll read this job page and tailor a resume for the selected profile.
      </p>

      {!API_BASE_URL && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-2">
          Missing <code>VITE_API_BASE_URL</code>. Point it at the web app origin and rebuild.
        </p>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Profile</label>
        {profilesLoading ? (
          <div className="h-9 rounded-md bg-gray-100 animate-pulse" />
        ) : profiles.length === 0 ? (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
            {role === 'bidder'
              ? 'No profiles assigned. Contact your manager.'
              : 'No profiles found. Create one in the web app.'}
          </p>
        ) : (
          <select
            value={selectedProfile}
            onChange={(e) => setSelectedProfile(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="">Select a profile</option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.first_name} {profile.last_name}
                {profile.title ? ` · ${profile.title}` : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">AI Provider</label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="radio"
              name="aiProvider"
              checked={aiProvider === 'openai'}
              onChange={() => setAiProvider('openai')}
              className="text-primary-600"
            />
            OpenAI
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="radio"
              name="aiProvider"
              checked={aiProvider === 'claude'}
              onChange={() => setAiProvider('claude')}
              className="text-primary-600"
            />
            Claude
          </label>
        </div>
      </div>

      {showReopenPanel && (
        <button
          type="button"
          onClick={handleOpenPanel}
          className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-primary-200 bg-primary-50 px-4 py-2.5 text-sm font-medium text-primary-700 hover:bg-primary-100"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <PanelRightOpen className="w-4 h-4" />}
          {reopenLabel}
        </button>
      )}

      <button
        type="button"
        onClick={handleGenerate}
        disabled={busy || !selectedProfile || profiles.length === 0}
        className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
      >
        {busy ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Generating…
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            Generate
          </>
        )}
      </button>

      {generation.status === 'blocked' && generation.blockedCompany && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          This profile already has an active application to {generation.blockedCompany}. You cannot
          submit multiple applications to the same company.
        </div>
      )}
    </div>
  );
};

export default GenerateView;
