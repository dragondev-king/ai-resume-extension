import React from 'react';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import UserProvider from '../contexts/UserContext';
import { ProfilesProvider } from '../contexts/ProfilesContext';
import LoginForm from './LoginForm';

const AuthedTree: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[280px] p-6">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  return (
    <UserProvider>
      <ProfilesProvider>{children}</ProfilesProvider>
    </UserProvider>
  );
};

export const AppProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <AuthProvider>
      <AuthedTree>{children}</AuthedTree>
      <Toaster position="top-center" toastOptions={{ duration: 2500 }} />
    </AuthProvider>
  );
};
