import type { GeneratedResume } from '../utils/resumeGenerator';
import type { AIProvider } from '../utils/resumeGenerator';

export type GenerationStatus = 'idle' | 'pending' | 'generating' | 'ready' | 'error';

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
  tabId: number | null;
  jobDescription: string;
  jobDescriptionLink: string;
  pageTitle: string;
  generatedResume: GeneratedResume | null;
  coverLetter: CoverLetterState | null;
  questions: ApplicationQuestion[];
  error: string | null;
  updatedAt: number;
}

export const DEFAULT_GENERATION_STATE: GenerationState = {
  status: 'idle',
  profileId: null,
  provider: 'openai',
  tabId: null,
  jobDescription: '',
  jobDescriptionLink: '',
  pageTitle: '',
  generatedResume: null,
  coverLetter: null,
  questions: [],
  error: null,
  updatedAt: 0,
};

export const GENERATION_STORAGE_KEY = 'generationState';
export const SELECTED_PROFILE_KEY = 'selectedProfileId';
export const SELECTED_PROVIDER_KEY = 'selectedProvider';
