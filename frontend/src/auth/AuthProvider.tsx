import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { clearAuthToken, fetchProfile, login as apiLogin, setAuthToken } from '../api/client';
import type { RoleDefinition, UserProfile } from '../api/types';
import { DEFAULT_PERSONAS } from '../settings/types';
import { AuthContext } from './context';
import type { AuthContextValue } from './types';

const AUTH_STORAGE_KEY = 'doculens.auth';

interface StoredAuthPayload {
  token: string;
  personas?: string[];
  roles?: Record<string, RoleDefinition>;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [personas, setPersonas] = useState<string[]>(DEFAULT_PERSONAS);
  const [roles, setRoles] = useState<Record<string, RoleDefinition>>({});
  const navigate = useNavigate();

  const persistAuth = useCallback((payload: StoredAuthPayload | null) => {
    if (!payload) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } else {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload));
    }
  }, []);

  const performLogout = useCallback(
    (redirect = true) => {
      setUser(null);
      clearAuthToken();
      persistAuth(null);
      setPersonas(DEFAULT_PERSONAS);
      setRoles({});
      if (redirect) {
        navigate('/login', { replace: true });
      }
    },
    [navigate, persistAuth],
  );

  useEffect(() => {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      setIsLoading(false);
      return;
    }
    try {
      const parsed = JSON.parse(raw) as StoredAuthPayload;
      if (parsed.token) {
        setAuthToken(parsed.token);
        if (parsed.personas?.length) {
          setPersonas(parsed.personas);
        }
        if (parsed.roles) {
          setRoles(parsed.roles);
        }
        void fetchProfile()
          .then((profile) => {
            setUser(profile);
          })
          .catch(() => {
            setUser(null);
            clearAuthToken();
            persistAuth(null);
            setPersonas(DEFAULT_PERSONAS);
            setRoles({});
          })
          .finally(() => setIsLoading(false));
        return;
      }
    } catch {
      // ignore parse errors; treat as logged out
    }
    setIsLoading(false);
  }, [persistAuth]);

  const handleLogin = useCallback(
    async (email: string, password: string) => {
      const response = await apiLogin({ email, password });
      setUser(response.user);
      setAuthToken(response.access_token);
      if (response.personas?.length) {
        setPersonas(response.personas);
      }
      if (response.roles) {
        setRoles(response.roles);
      }
      persistAuth({
        token: response.access_token,
        personas: response.personas,
        roles: response.roles,
      });
      return response;
    },
    [persistAuth],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      personas,
      roles,
      login: handleLogin,
      logout: () => performLogout(true),
    }),
    [user, isLoading, personas, roles, handleLogin, performLogout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
