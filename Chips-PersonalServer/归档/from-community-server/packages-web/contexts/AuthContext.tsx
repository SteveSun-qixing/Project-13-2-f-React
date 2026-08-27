import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, type UserProfile } from '../api/auth';
import { setAccessToken } from '../api/client';

interface AuthContextValue {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<UserProfile>;
  register: (username: string, password: string) => Promise<UserProfile>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<UserProfile>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const tryRestore = async () => {
      try {
        const res = await fetch('/api/v1/auth/refresh', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });

        if (res.status === 204) {
          setUser(null);
          return;
        }

        if (res.ok) {
          const data = await res.json();
          const token = data.data?.accessToken as string;
          setAccessToken(token);
          const profile = await authApi.getMe();
          setUser(profile);
        }
      } catch {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    void tryRestore();
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const { user: profile } = await authApi.login(username, password);
    setUser(profile);
    return profile;
  }, []);

  const register = useCallback(async (username: string, password: string) => {
    const { user: profile } = await authApi.register(username, password);
    setUser(profile);
    return profile;
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => undefined);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const profile = await authApi.getMe();
    setUser(profile);
    return profile;
  }, []);

  const value: AuthContextValue = {
    user,
    isLoading,
    isAuthenticated: user !== null,
    login,
    register,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
