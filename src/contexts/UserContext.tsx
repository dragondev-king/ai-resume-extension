import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase, UserRole } from '../lib/supabase';
import IUser from '../types/user';
import { useAuth } from './AuthContext';

interface UserContextType {
  user: IUser | null;
  role: UserRole;
  userLoading: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<IUser | null>(null);
  const [userLoading, setUserLoading] = useState(false);
  const { session } = useAuth();

  const getUser = useCallback(async (userID: string) => {
    setUserLoading(true);
    const { data, error } = await supabase.rpc('get_user_by_id', { p_user_id: userID });
    if (error) {
      console.error('Error fetching user:', error);
      setUser(null);
    } else {
      setUser(data?.[0] ?? null);
    }
    setUserLoading(false);
  }, []);

  useEffect(() => {
    if (session?.user.id) {
      getUser(session.user.id);
    } else {
      setUser(null);
    }
  }, [getUser, session?.user.id]);

  return (
    <UserContext.Provider value={{ user, role: user?.role || 'bidder', userLoading }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used inside UserProvider');
  }
  return context;
};

export default UserProvider;
