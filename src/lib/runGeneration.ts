import { extractTabText } from './pageText';
import { getGenerationState, setGenerationState } from './generationStore';
import { generateResume, type AIProvider, type ResumeApiVersion } from '../utils/resumeGenerator';
import type { ProfileWithDetailsRPC } from './supabase';
import {
  checkDuplicateApplication,
  duplicateApplicationMessage,
  shouldCheckDuplicateApplications,
} from './duplicateCheck';
import { isNonRemoteRole, nonRemoteRoleMessage, NonRemoteRoleError } from '../utils/remoteRole';
import { supabase } from './supabase';

const inFlightTabs = new Set<number>();

export type StartGenerationPayload = {
  tabId: number;
  profile: ProfileWithDetailsRPC;
  provider: AIProvider;
  resumeApiVersion: ResumeApiVersion;
  pageTitle?: string;
  pageUrl?: string;
};

export async function queueGeneration(payload: StartGenerationPayload): Promise<void> {
  await setGenerationState(payload.tabId, {
    status: 'pending',
    profileId: payload.profile.id,
    provider: payload.provider,
    resumeApiVersion: payload.resumeApiVersion,
    tabId: payload.tabId,
    jobDescriptionLink: payload.pageUrl || '',
    pageTitle: payload.pageTitle || '',
    generatedResume: null,
    coverLetter: null,
    questions: [],
    error: null,
    blockedCompany: null,
    blockedApplicationId: null,
    blockedReason: null,
    duplicateChecked: false,
    savedApplicationId: null,
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
    await setGenerationState(tabId, {
      duplicateChecked: true,
      blockedCompany: null,
      blockedApplicationId: null,
      blockedReason: null,
    });
    return true;
  }

  const company = companyName?.trim();
  if (!company) {
    await setGenerationState(tabId, {
      duplicateChecked: true,
      blockedCompany: null,
      blockedApplicationId: null,
      blockedReason: null,
    });
    return true;
  }

  const { canApply, existingApplicationId } = await checkDuplicateApplication(profile.id, company);
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
      blockedApplicationId: existingApplicationId,
      blockedReason: 'duplicate',
      duplicateChecked: true,
      error: duplicateApplicationMessage(company),
    });
    return false;
  }

  await setGenerationState(tabId, {
    duplicateChecked: true,
    blockedCompany: null,
    blockedApplicationId: null,
    blockedReason: null,
  });
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
        resumeApiVersion: payload.resumeApiVersion,
        jobDescriptionLink: payload.pageUrl || existing.jobDescriptionLink,
        pageTitle: payload.pageTitle || existing.pageTitle,
        generatedResume: null,
        coverLetter: null,
        questions: [],
        error: null,
        blockedCompany: null,
        blockedApplicationId: null,
        blockedReason: null,
        duplicateChecked: false,
        savedApplicationId: null,
      });
    }

    await setGenerationState(tabId, {
      status: 'generating',
      profileId: profile.id,
      provider: payload.provider,
      resumeApiVersion: payload.resumeApiVersion,
      error: null,
      blockedCompany: null,
      blockedApplicationId: null,
      blockedReason: null,
      duplicateChecked: false,
    });

    const page = await extractTabText(tabId);
    const pageContent = `${page.title}\n${page.text}`;
    if (isNonRemoteRole(pageContent)) {
      await setGenerationState(tabId, {
        status: 'blocked',
        generatedResume: null,
        coverLetter: null,
        questions: [],
        jobDescription: page.text,
        jobDescriptionLink: page.url,
        pageTitle: page.title,
        blockedCompany: null,
        blockedApplicationId: null,
        blockedReason: 'non-remote',
        error: nonRemoteRoleMessage(pageContent),
      });
      return;
    }

    const generated = await generateResume(profile, page.text, payload.provider, payload.resumeApiVersion);

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
      savedApplicationId: null,
    });
  } catch (err) {
    if (err instanceof NonRemoteRoleError) {
      await setGenerationState(tabId, {
        status: 'blocked',
        generatedResume: null,
        coverLetter: null,
        questions: [],
        blockedCompany: null,
        blockedApplicationId: null,
        blockedReason: 'non-remote',
        error: err.message,
      });
      return;
    }
    await setGenerationState(tabId, {
      status: 'error',
      error: err instanceof Error ? err.message : 'Failed to generate resume',
    });
  } finally {
    inFlightTabs.delete(tabId);
  }
}
