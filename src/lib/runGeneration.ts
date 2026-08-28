import { extractTabText } from './pageText';
import { getGenerationState, setGenerationState } from './generationStore';
import { generateResume, type AIProvider } from '../utils/resumeGenerator';
import type { ProfileWithDetailsRPC } from './supabase';
import {
  canApplyToCompany,
  duplicateApplicationMessage,
  shouldCheckDuplicateApplications,
} from './duplicateCheck';
import { supabase } from './supabase';

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
    blockedCompany: null,
    duplicateChecked: false,
  });

  await chrome.runtime.sendMessage({
    type: 'START_GENERATION',
    payload,
  });
}

async function applyDuplicateCheck(
  tabId: number,
  profile: ProfileWithDetailsRPC,
  companyName: string | undefined,
  page: { text: string; url: string; title: string }
): Promise<boolean> {
  if (!shouldCheckDuplicateApplications(profile)) {
    await setGenerationState(tabId, { duplicateChecked: true, blockedCompany: null });
    return true;
  }

  const company = companyName?.trim();
  if (!company) {
    await setGenerationState(tabId, { duplicateChecked: true, blockedCompany: null });
    return true;
  }

  const canApply = await canApplyToCompany(profile.id, company);
  if (!canApply) {
    await setGenerationState(tabId, {
      status: 'blocked',
      generatedResume: null,
      coverLetter: null,
      questions: [],
      jobDescription: page.text,
      jobDescriptionLink: page.url,
      pageTitle: page.title,
      blockedCompany: company,
      duplicateChecked: true,
      error: duplicateApplicationMessage(company),
    });
    return false;
  }

  await setGenerationState(tabId, { duplicateChecked: true, blockedCompany: null });
  return true;
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
        blockedCompany: null,
        duplicateChecked: false,
      });
    }

    await setGenerationState(tabId, {
      status: 'generating',
      profileId: profile.id,
      provider: payload.provider,
      error: null,
      blockedCompany: null,
      duplicateChecked: false,
    });

    const page = await extractTabText(tabId);
    const generated = await generateResume(profile, page.text, payload.provider);

    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session) {
      const allowed = await applyDuplicateCheck(tabId, profile, generated.companyName, page);
      if (!allowed) return;
    }

    await setGenerationState(tabId, {
      status: 'ready',
      generatedResume: generated,
      jobDescription: page.text,
      jobDescriptionLink: page.url,
      pageTitle: page.title,
      error: null,
      duplicateChecked: Boolean(sessionData.session),
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
