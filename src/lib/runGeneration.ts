import { supabase } from './supabase';
import { extractTabText } from './pageText';
import { getGenerationState, setGenerationState } from './generationStore';
import { generateResume, type AIProvider } from '../utils/resumeGenerator';
import type { ProfileWithDetailsRPC } from './supabase';

export async function queueGeneration(options: {
  profileId: string;
  provider: AIProvider;
  tabId: number;
  pageTitle?: string;
  pageUrl?: string;
}): Promise<void> {
  await setGenerationState({
    status: 'pending',
    profileId: options.profileId,
    provider: options.provider,
    tabId: options.tabId,
    jobDescriptionLink: options.pageUrl || '',
    pageTitle: options.pageTitle || '',
    generatedResume: null,
    coverLetter: null,
    questions: [],
    error: null,
  });
}

let generationInFlight = false;

export async function runQueuedGeneration(profile: ProfileWithDetailsRPC): Promise<void> {
  if (generationInFlight) return;
  const state = await getGenerationState();
  if (state.status !== 'pending') return;
  if (!state.tabId) {
    await setGenerationState({ status: 'error', error: 'No tab available to read.' });
    return;
  }
  generationInFlight = true;

  await setGenerationState({ status: 'generating', error: null });

  try {
    const page = await extractTabText(state.tabId);

    const generated = await generateResume(profile, page.text, state.provider);

    if (generated.companyName && profile.check_duplicate_applications !== false) {
      const { data: canApply, error: checkError } = await supabase.rpc('can_apply_to_company', {
        p_profile_id: profile.id,
        p_company_name: generated.companyName,
      });

      if (checkError) {
        throw new Error('Error checking application eligibility');
      }

      if (!canApply) {
        await setGenerationState({
          status: 'error',
          jobDescription: page.text,
          jobDescriptionLink: page.url,
          pageTitle: page.title,
          error: `This profile already has an active application to ${generated.companyName}.`,
        });
        return;
      }
    }

    await setGenerationState({
      status: 'ready',
      generatedResume: generated,
      jobDescription: page.text,
      jobDescriptionLink: page.url,
      pageTitle: page.title,
      error: null,
    });
  } catch (err) {
    await setGenerationState({
      status: 'error',
      error: err instanceof Error ? err.message : 'Failed to generate resume',
    });
  } finally {
    generationInFlight = false;
  }
}
