import type { ProfileWithDetailsRPC } from '../lib/supabase';
import { apiUrl } from '../lib/api';
import type { AIProvider } from './resumeGenerator';

export const generateCoverLetter = async (
  profile: ProfileWithDetailsRPC,
  jobDescription: string,
  resumeContent: unknown,
  provider: AIProvider = 'openai'
) => {
  const response = await fetch(apiUrl('/api/generate-cover-letter'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile, jobDescription, resumeContent, provider }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to generate cover letter');
  }

  const data = await response.json();
  return {
    content: data.content as string,
    jobTitle: data.jobTitle as string | undefined,
    companyName: data.companyName as string | undefined,
  };
};

export const generateAnswer = async (
  profile: ProfileWithDetailsRPC,
  question: string,
  jobDescription: string,
  resumeContent: unknown,
  provider: AIProvider = 'openai'
) => {
  const response = await fetch(apiUrl('/api/generate-answer'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile, question, jobDescription, resumeContent, provider }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to generate answer');
  }

  const data = await response.json();
  return {
    content: data.content as string,
    question: data.question as string,
  };
};
