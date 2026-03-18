import { useCallback, useEffect, useState } from 'react';
import {
  ContractApiError,
  getCloudAppAuthSnapshot,
  isCloudAppAdmin,
  loginCloudAppUser,
  logoutCloudAppUser,
  normalizeCloudAppRoles,
} from '@portfolio/auth';

type LoginValues = {
  username: string;
  password: string;
};

type AuthSnapshot = {
  isAuthenticated: boolean;
  username: string;
  roles: string[];
};

const EMPTY_AUTH_SNAPSHOT: AuthSnapshot = {
  isAuthenticated: false,
  username: '',
  roles: [],
};

const CLOUDAPP_API_URL = `${((typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL)
  || 'http://localhost:80').replace(/\/+$/, '')}${import.meta.env?.VITE_CLOUDAPP_PUBLIC_PATH || '/cloudapp'}`;

export function useCloudAppAuth() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applySnapshot = useCallback((snapshot: AuthSnapshot) => {
    setIsAuthenticated(snapshot.isAuthenticated);
    setUsername(snapshot.username);
    setRoles(snapshot.roles);
  }, []);

  const clearAuth = useCallback(() => {
    applySnapshot(EMPTY_AUTH_SNAPSHOT);
  }, [applySnapshot]);

  const refreshSession = useCallback(async () => {
    try {
      const session = await getCloudAppAuthSnapshot({
        adminOnly: true,
        apiUrl: CLOUDAPP_API_URL,
      });
      applySnapshot({
        isAuthenticated: Boolean(session.username),
        username: session.username || '',
        roles: normalizeCloudAppRoles(session.roles),
      });
      setError(null);
    } catch (err) {
      clearAuth();
      if (err instanceof ContractApiError && err.statusCode === 403) {
        setError('Only CloudApp admins can sign in to AI Orchestration Monitor.');
      } else {
        setError(null);
      }
    } finally {
      setIsInitialized(true);
    }
  }, [applySnapshot, clearAuth]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const login = useCallback(async ({ username, password }: LoginValues) => {
    setIsLoggingIn(true);
    setError(null);

    try {
      const authResponse = await loginCloudAppUser({
        username,
        password,
        adminOnly: true,
        apiUrl: CLOUDAPP_API_URL,
      });
      const nextRoles = normalizeCloudAppRoles(authResponse.roles);

      if (!isCloudAppAdmin(nextRoles)) {
        clearAuth();
        setError('Only CloudApp admins can sign in to AI Orchestration Monitor.');
        throw new Error('ADMIN_REQUIRED');
      }

      applySnapshot({
        isAuthenticated: true,
        username: authResponse.username || username,
        roles: nextRoles,
      });
    } catch (err) {
      clearAuth();
      if (err instanceof ContractApiError && (err.statusCode === 401 || err.statusCode === 403)) {
        setError(err.statusCode === 403
          ? 'Only CloudApp admins can sign in to AI Orchestration Monitor.'
          : 'Invalid username or password.');
      } else if (err instanceof Error && err.message === 'ADMIN_REQUIRED') {
        // Keep the admin-only message set above.
      } else {
        setError('Login failed. Please try again.');
      }
      throw err;
    } finally {
      setIsLoggingIn(false);
    }
  }, [applySnapshot, clearAuth]);

  const logout = useCallback(async () => {
    try {
      await logoutCloudAppUser({ apiUrl: CLOUDAPP_API_URL });
    } finally {
      clearAuth();
      setError(null);
    }
  }, [clearAuth]);

  return {
    isInitialized,
    isAuthenticated,
    username,
    roles,
    isAdmin: isCloudAppAdmin(roles),
    isLoggingIn,
    error,
    login,
    logout,
    clearError: () => setError(null),
  };
}
