import { supabase } from './supabase';

export function shouldCheckDuplicateApplications(profile: {
  check_duplicate_applications?: boolean;
}): boolean {
  return profile.check_duplicate_applications !== false;
}

export type DuplicateCheckResult = {
  canApply: boolean;
  existingApplicationId: string | null;
};

function parseCanApplyToCompany(data: unknown): DuplicateCheckResult {
  if (typeof data === 'string' && data) {
    return { canApply: false, existingApplicationId: data };
  }
  if (Array.isArray(data)) {
    return parseCanApplyToCompany(data[0]);
  }
  if (data === false) {
    return { canApply: false, existingApplicationId: null };
  }
  return { canApply: true, existingApplicationId: null };
}

/** Existing application id means the profile cannot apply; null means it can. */
export async function checkDuplicateApplication(
  profileId: string,
  companyName: string
): Promise<DuplicateCheckResult> {
  const name = companyName.trim();
  if (!name) return { canApply: true, existingApplicationId: null };

  const { data, error } = await supabase.rpc('can_apply_to_company', {
    p_profile_id: profileId,
    p_company_name: name,
  });

  if (error) {
    console.error('can_apply_to_company', error);
    throw new Error('Error checking application eligibility');
  }

  return parseCanApplyToCompany(data);
}

export function duplicateApplicationMessage(companyName: string): string {
  return `This profile already has an active application to ${companyName}. You cannot submit multiple applications to the same company.`;
}
