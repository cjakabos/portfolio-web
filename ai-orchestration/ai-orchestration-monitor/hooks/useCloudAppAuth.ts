import { useCallback, useEffect, useState } from 'react';
import { ApiError, orchestrationClient } from '../services/orchestrationClient';

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
      const session = await orchestrationClient.getCloudAppAdminSession();
      applySnapshot({
        isAuthenticated: Boolean(session.username),
        username: session.username || '',
        roles: Array.isArray(session.roles) ? session.roles : [],
      });
      setError(null);
    } catch (err) {
      clearAuth();
      if (err instanceof ApiError && err.statusCode === 403) {
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
      const authResponse = await orchestrationClient.loginUser(username, password);
      const nextRoles = Array.isArray(authResponse.roles) ? authResponse.roles : [];

      if (!nextRoles.includes('ROLE_ADMIN')) {
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
      if (err instanceof ApiError && (err.statusCode === 401 || err.statusCode === 403)) {
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
      await orchestrationClient.logoutUser();
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
    isAdmin: roles.includes('ROLE_ADMIN'),
    isLoggingIn,
    error,
    login,
    logout,
    clearError: () => setError(null),
  };
}
