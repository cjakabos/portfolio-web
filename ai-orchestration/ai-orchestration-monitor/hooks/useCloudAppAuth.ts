import { useCallback, useEffect, useState } from 'react';
import { ApiError, orchestrationClient } from '../services/orchestrationClient';

const TOKEN_STORAGE_KEY = 'AI_MONITOR_CLOUDAPP_TOKEN';
const USERNAME_STORAGE_KEY = 'AI_MONITOR_CLOUDAPP_USERNAME';
const BEARER_PREFIX = 'Bearer ';

const decodeBase64Url = (value: string) => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  if (typeof atob !== 'function') return '';
  return atob(padded);
};

const isTokenExpired = (storedToken: string | null): boolean => {
  if (!storedToken) return true;

  const rawToken = storedToken.startsWith(BEARER_PREFIX)
    ? storedToken.slice(BEARER_PREFIX.length)
    : storedToken;

  const parts = rawToken.split('.');
  if (parts.length < 2) return true;

  try {
    const payload = JSON.parse(decodeBase64Url(parts[1]));
    if (typeof payload?.exp !== 'number') return true;
    return Date.now() >= payload.exp * 1000;
  } catch {
    return true;
  }
};

type LoginValues = {
  username: string;
  password: string;
};

type AuthSnapshot = {
  isAuthenticated: boolean;
  username: string;
  roles: string[];
  reason?: 'missing' | 'expired' | 'invalid' | 'not_admin';
};

const extractRolesFromToken = (storedToken: string | null): string[] => {
  if (!storedToken) return [];

  const rawToken = storedToken.startsWith(BEARER_PREFIX)
    ? storedToken.slice(BEARER_PREFIX.length)
    : storedToken;

  const parts = rawToken.split('.');
  if (parts.length < 2) return [];

  try {
    const payload = JSON.parse(decodeBase64Url(parts[1]));
    if (!Array.isArray(payload?.roles)) return [];
    return payload.roles.filter((role: unknown): role is string => typeof role === 'string');
  } catch {
    return [];
  }
};

const readAuthSnapshot = (): AuthSnapshot => {
  if (typeof window === 'undefined') {
    return { isAuthenticated: false, username: '', roles: [], reason: 'missing' };
  }

  const token = window.localStorage.getItem(TOKEN_STORAGE_KEY);
  const username = window.localStorage.getItem(USERNAME_STORAGE_KEY)?.trim() || '';

  if (!token || !username) {
    orchestrationClient.clearCloudAppAuth();
    return { isAuthenticated: false, username: '', roles: [], reason: 'missing' };
  }

  if (isTokenExpired(token)) {
    orchestrationClient.clearCloudAppAuth();
    return { isAuthenticated: false, username: '', roles: [], reason: 'expired' };
  }

  const roles = extractRolesFromToken(token);
  if (!roles.length) {
    orchestrationClient.clearCloudAppAuth();
    return { isAuthenticated: false, username: '', roles: [], reason: 'invalid' };
  }

  if (!roles.includes('ROLE_ADMIN')) {
    orchestrationClient.clearCloudAppAuth();
    return { isAuthenticated: false, username: '', roles: [], reason: 'not_admin' };
  }

  return { isAuthenticated: true, username, roles };
};

export function useCloudAppAuth() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const syncFromStorage = useCallback(() => {
    const next = readAuthSnapshot();
    setIsAuthenticated(next.isAuthenticated);
    setUsername(next.username);
    setRoles(next.roles);
    if (!next.isAuthenticated && next.reason === 'not_admin') {
      setError('Only CloudApp admins can sign in to AI Orchestration Monitor.');
    }
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    syncFromStorage();

    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key === TOKEN_STORAGE_KEY || event.key === USERNAME_STORAGE_KEY) {
        syncFromStorage();
      }
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [syncFromStorage]);

  const login = useCallback(async ({ username, password }: LoginValues) => {
    setIsLoggingIn(true);
    setError(null);

    try {
      const authResponse = await orchestrationClient.loginUser(username, password);
      const nextRoles = extractRolesFromToken(authResponse.token);

      if (!nextRoles.includes('ROLE_ADMIN')) {
        orchestrationClient.clearCloudAppAuth();
        setIsAuthenticated(false);
        setUsername('');
        setRoles([]);
        setError('Only CloudApp admins can sign in to AI Orchestration Monitor.');
        throw new Error('ADMIN_REQUIRED');
      }

      setIsAuthenticated(true);
      setUsername(username);
      setRoles(nextRoles);
    } catch (err) {
      if (err instanceof ApiError && (err.statusCode === 401 || err.statusCode === 403)) {
        setError('Invalid username or password.');
      } else if (err instanceof Error && err.message === 'ADMIN_REQUIRED') {
        // Keep the admin-only message set above.
      } else {
        setError('Login failed. Please try again.');
      }
      throw err;
    } finally {
      setIsLoggingIn(false);
    }
  }, []);

  const logout = useCallback(() => {
    orchestrationClient.clearCloudAppAuth();
    setIsAuthenticated(false);
    setUsername('');
    setRoles([]);
    setError(null);
  }, []);

  return {
    isInitialized,
    isAuthenticated,
    username,
    roles,
    isAdmin: roles.includes('ROLE_ADMIN'),
    isLoggingIn,
    error,
    login,
    logout,
    clearError: () => setError(null),
  };
}
