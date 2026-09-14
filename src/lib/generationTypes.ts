import type { GeneratedResume } from '../utils/resumeGenerator';
import type { AIProvider, ResumeApiVersion } from '../utils/resumeGenerator';

export type GenerationStatus = 'idle' | 'pending' | 'generating' | 'ready' | 'blocked' | 'error';

export interface CoverLetterState {
  content: string;
  jobTitle?: string;
  companyName?: string;
}

export interface ApplicationQuestion {
  id: string;
  question: string;
  answer?: string;
}

export interface GenerationState {
  status: GenerationStatus;
  profileId: string | null;
  provider: AIProvider;
  resumeApiVersion: ResumeApiVersion;
  tabId: number | null;
  jobDescription: string;
  jobDescriptionLink: string;
  pageTitle: string;
  generatedResume: GeneratedResume | null;
  coverLetter: CoverLetterState | null;
  questions: ApplicationQuestion[];
  error: string | null;
  blockedCompany: string | null;
  duplicateChecked: boolean;
  savedApplicationId: string | null;
  updatedAt: number;
}

export const DEFAULT_GENERATION_STATE: GenerationState = {
  status: 'idle',
  profileId: null,
  provider: 'openai',
  resumeApiVersion: 'v2',
  tabId: null,
  jobDescription: '',
  jobDescriptionLink: '',
  pageTitle: '',
  generatedResume: null,
  coverLetter: null,
  questions: [],
  error: null,
  blockedCompany: null,
  duplicateChecked: false,
  savedApplicationId: null,
  updatedAt: 0,
};

export const GENERATION_STORAGE_PREFIX = 'generationState:';
export const SELECTED_PROFILE_KEY = 'selectedProfileId';
export const SELECTED_PROVIDER_KEY = 'selectedProvider';
export const SELECTED_API_VERSION_KEY = 'selectedResumeApiVersion';

export function generationStorageKey(tabId: number): string {
  return `${GENERATION_STORAGE_PREFIX}${tabId}`;
}
