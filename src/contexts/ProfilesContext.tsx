import React, { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { ProfileWithDetailsRPC } from '../lib/supabase';
import { supabase } from '../lib/supabase';
import { useUser } from './UserContext';

interface ProfilesContextType {
  profiles: ProfileWithDetailsRPC[];
  loading: boolean;
  error: string | null;
  refreshProfiles: () => Promise<void>;
}

const ProfilesContext = createContext<ProfilesContextType | undefined>(undefined);

export const ProfilesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, role } = useUser();
  const [profiles, setProfiles] = useState<ProfileWithDetailsRPC[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfiles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (!user?.id || !role) {
        setProfiles([]);
        return;
      }

      const { data, error: rpcError } = await supabase.rpc('get_profiles_with_details', {
        p_user_id: user.id,
        p_user_role: role,
      });

      if (rpcError) {
        setError(rpcError.message);
        setProfiles([]);
        return;
      }

      setProfiles(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profiles');
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }, [user, role]);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  return (
    <ProfilesContext.Provider value={{ profiles, loading, error, refreshProfiles: loadProfiles }}>
      {children}
    </ProfilesContext.Provider>
  );
};

export const useProfiles = (): ProfilesContextType => {
  const context = useContext(ProfilesContext);
  if (!context) {
    throw new Error('useProfiles must be used within a ProfilesProvider');
  }
  return context;
};
