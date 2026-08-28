import { createClient } from '@supabase/supabase-js';
import { chromeStorageAdapter } from './chromeStorage';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: chromeStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export type UserRole = 'bidder' | 'manager' | 'admin';

export interface User {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  title?: string;
  email: string;
  phone: string;
  location: string;
  linkedin?: string;
  portfolio?: string;
  summary?: string;
  experience: Experience[];
  education: Education[];
  skills: string[];
  resume_filename_format?: string;
  check_duplicate_applications?: boolean;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface JobApplication {
  id: string;
  profile_id: string;
  bidder_id: string;
  job_title: string;
  company_name?: string;
  job_description: string;
  job_description_link?: string;
  resume_file_name?: string;
  generated_summary?: string;
  generated_experience?: Experience[];
  generated_skills?: string[];
  status: 'active' | 'rejected' | 'withdrawn';
  rejected_at?: string;
  withdrawn_at?: string;
  created_at: string;
  metadata?: Record<string, unknown>;
}

export interface Experience {
  id?: string;
  company: string;
  position: string;
  start_date: string;
  end_date: string;
  current?: boolean;
  description?: string;
  descriptions?: string[];
  achievements?: string[];
  address?: string;
}

export interface Education {
  id?: string;
  school: string;
  degree: string;
  field: string;
  start_date: string;
  end_date: string;
  current?: boolean;
  gpa?: string;
}

export interface ProfileWithDetailsRPC {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  title?: string;
  email: string;
  phone: string;
  location: string;
  linkedin?: string;
  portfolio?: string;
  summary?: string;
  experience: Experience[];
  education: Education[];
  skills: string[];
  resume_filename_format?: string;
  check_duplicate_applications?: boolean;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  owner_id: string;
  owner_email: string;
  owner_first_name?: string;
  owner_last_name?: string;
  owner_role: UserRole;
  assigned_bidders: Array<{
    id: string;
    email: string;
    first_name?: string;
    last_name?: string;
  }>;
}
