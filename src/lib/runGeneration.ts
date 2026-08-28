import { supabase } from './supabase';
import { extractTabText } from './pageText';
import { getGenerationState, setGenerationState } from './generationStore';
import { generateResume, type AIProvider } from '../utils/resumeGenerator';
import type { ProfileWithDetailsRPC } from './supabase';

const inFlightTabs = new Set<number>();

export type StartGenerationPayload = {
  tabId: number;
  profile: ProfileWithDetailsRPC;
  provider: AIProvider;
  pageTitle?: string;
  pageUrl?: string;
};

export async function queueGeneration(payload: StartGenerationPayload): Promise<void> {
  await setGenerationState(payload.tabId, {
    status: 'pending',
    profileId: payload.profile.id,
    provider: payload.provider,
    tabId: payload.tabId,
    jobDescriptionLink: payload.pageUrl || '',
    pageTitle: payload.pageTitle || '',
    generatedResume: null,
    coverLetter: null,
    questions: [],
    error: null,
  });

  await chrome.runtime.sendMessage({
    type: 'START_GENERATION',
    payload,
  });
}

export async function runQueuedGeneration(payload: StartGenerationPayload): Promise<void> {
  const { tabId, profile } = payload;
  if (inFlightTabs.has(tabId)) return;
  inFlightTabs.add(tabId);

  try {
    const existing = await getGenerationState(tabId);
    if (existing.status !== 'pending' && existing.status !== 'generating') {
      await setGenerationState(tabId, {
        status: 'pending',
        profileId: profile.id,
        provider: payload.provider,
        jobDescriptionLink: payload.pageUrl || existing.jobDescriptionLink,
        pageTitle: payload.pageTitle || existing.pageTitle,
        generatedResume: null,
        coverLetter: null,
        questions: [],
        error: null,
      });
    }

    await setGenerationState(tabId, {
      status: 'generating',
      profileId: profile.id,
      provider: payload.provider,
      error: null,
    });

    const page = await extractTabText(tabId);
    const generated = await generateResume(profile, page.text, payload.provider);

    if (generated.companyName && profile.check_duplicate_applications !== false) {
      const { data: canApply, error: checkError } = await supabase.rpc('can_apply_to_company', {
        p_profile_id: profile.id,
        p_company_name: generated.companyName,
      });

      if (checkError) {
        throw new Error('Error checking application eligibility');
      }

      if (!canApply) {
        await setGenerationState(tabId, {
          status: 'error',
          jobDescription: page.text,
          jobDescriptionLink: page.url,
          pageTitle: page.title,
          error: `This profile already has an active application to ${generated.companyName}.`,
        });
        return;
      }
    }

    await setGenerationState(tabId, {
      status: 'ready',
      generatedResume: generated,
      jobDescription: page.text,
      jobDescriptionLink: page.url,
      pageTitle: page.title,
      error: null,
    });
  } catch (err) {
    await setGenerationState(tabId, {
      status: 'error',
      error: err instanceof Error ? err.message : 'Failed to generate resume',
    });
  } finally {
    inFlightTabs.delete(tabId);
  }
}
