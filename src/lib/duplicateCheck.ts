import { supabase } from './supabase';

export function shouldCheckDuplicateApplications(profile: {
  check_duplicate_applications?: boolean;
}): boolean {
  return profile.check_duplicate_applications !== false;
}

export async function canApplyToCompany(profileId: string, companyName: string): Promise<boolean> {
  const name = companyName.trim();
  if (!name) return true;

  const { data, error } = await supabase.rpc('can_apply_to_company', {
    p_profile_id: profileId,
    p_company_name: name,
  });

  if (error) {
    console.error('can_apply_to_company', error);
    throw new Error('Error checking application eligibility');
  }

  if (Array.isArray(data)) return Boolean(data[0]);
  return Boolean(data);
}

export function duplicateApplicationMessage(companyName: string): string {
  return `This profile already has an active application to ${companyName}. You cannot submit multiple applications to the same company.`;
}
