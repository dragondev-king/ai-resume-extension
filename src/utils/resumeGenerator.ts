import type { ProfileWithDetailsRPC } from '../lib/supabase';
import { apiUrl } from '../lib/api';

export interface GeneratedResume {
  summary: string;
  experience: {
    position: string;
    company: string;
    start_date: string;
    end_date: string;
    descriptions: string[];
    address?: string;
  }[];
  skills: string[];
  jobTitle?: string;
  companyName?: string;
}

export type AIProvider = 'openai' | 'claude';

export const generateResume = async (
  profile: ProfileWithDetailsRPC,
  jobDescription: string,
  provider: AIProvider = 'openai'
): Promise<GeneratedResume> => {
  const response = await fetch(apiUrl('/api/generate-resume'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile, jobDescription, provider }),
  });

  if (!response.ok) {
    let message = 'Failed to generate resume';
    try {
      const errorData = await response.json();
      message = errorData.error || errorData.details || message;
    } catch {
      message = `${message} (${response.status})`;
    }
    throw new Error(message);
  }

  const data = await response.json();
  return parseAIResponse(profile, data.aiResponse);
};

const parseAIResponse = (
  originalProfile: ProfileWithDetailsRPC,
  aiResponse: string | Record<string, unknown>
): GeneratedResume => {
  const parsed =
    typeof aiResponse === 'string' ? parseJsonResponse(aiResponse) : aiResponse;

  return {
    summary: (parsed.summary as string) || originalProfile.summary || '',
    experience:
      (parsed.experience as GeneratedResume['experience']) ||
      originalProfile.experience.map((exp) => ({
        position: exp.position,
        company: exp.company,
        start_date: exp.start_date,
        end_date: exp.end_date,
        descriptions: exp.description ? [exp.description] : [],
        address: exp.address,
      })),
    skills: (parsed.skills as string[]) || originalProfile.skills,
    jobTitle: (parsed.jobTitle as string) || '',
    companyName: (parsed.companyName as string) || '',
  };
};

const parseJsonResponse = (aiResponse: string): Record<string, unknown> => {
  let jsonString = aiResponse.trim();

  if (jsonString.startsWith('```json')) {
    jsonString = jsonString.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (jsonString.startsWith('```')) {
    jsonString = jsonString.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }

  if (!jsonString.startsWith('{')) {
    const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonString = jsonMatch[0];
    } else {
      throw new Error('No JSON found in response');
    }
  }

  jsonString = jsonString.replace(/,(\s*[}\]])/g, '$1');
  return JSON.parse(jsonString);
};
