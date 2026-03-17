import { useCallback, useEffect, useState } from 'react';
import { createCloudAppApiClient, resolveCloudAppApiUrl } from '@portfolio/api-clients';
import { ContractApiError } from '@portfolio/contracts';

export { ContractApiError } from '@portfolio/contracts';

export const CLOUDAPP_AUTH_STATE_CHANGED_EVENT = 'cloudapp-auth-state-changed';
export const CLOUDAPP_CSRF_COOKIE_NAME = 'XSRF-TOKEN';
export const CLOUDAPP_CSRF_HEADER_NAME = 'X-XSRF-TOKEN';

export type CloudAppAuthResponse = {
  username?: string;
  roles?: string[];
  message?: string;
  success?: boolean;
};

type CloudAppCsrfResponse = {
  token?: string;
  headerName?: string;
};

export type CloudAppAuthSnapshot = {
  username: string;
  roles: string[];
};

export type UseCloudAppSessionOptions = {
  apiUrl?: string;
  adminOnly?: boolean;
  fetchImpl?: typeof fetch;
};

const normalizeUsername = (username: unknown) =>
  typeof username === 'string' ? username.trim() : '';

export const normalizeCloudAppRoles = (roles: unknown): string[] =>
  Array.isArray(roles)
    ? roles
      .filter((role): role is string => typeof role === 'string')
      .map((role) => role.trim())
      .filter(Boolean)
    : [];

export const isCloudAppAdmin = (roles: Iterable<string> = []) => {
  const normalized = Array.from(roles).map((role) => role.trim().toUpperCase());
  return normalized.includes('ROLE_ADMIN') || normalized.includes('ADMIN');
};

export const formatCloudAppRoleLabel = (roles: string[] = [], isAdmin = isCloudAppAdmin(roles)) => {
  if (roles.length === 0) return isAdmin ? 'Administrator' : 'User';
  return roles
    .map((role) => role.replace(/^ROLE_/, '').toLowerCase())
    .map((role) => role.charAt(0).toUpperCase() + role.slice(1))
    .join(', ');
};

const readCookie = (name: string) => {
  if (typeof document === 'undefined') return '';

  const cookiePrefix = `${name}=`;
  const match = document.cookie
    .split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(cookiePrefix));

  if (!match) return '';

  try {
    return decodeURIComponent(match.slice(cookiePrefix.length));
  } catch {
    return match.slice(cookiePrefix.length);
  }
};

const getClient = (options: UseCloudAppSessionOptions = {}) =>
  createCloudAppApiClient({
    baseUrl: resolveCloudAppApiUrl(options.apiUrl),
    fetchImpl: options.fetchImpl,
  });

const toSnapshot = (response: CloudAppAuthResponse | undefined): CloudAppAuthSnapshot => ({
  username: normalizeUsername(response?.username),
  roles: normalizeCloudAppRoles(response?.roles),
});

export const getCloudAppCsrfTokenFromCookie = () => readCookie(CLOUDAPP_CSRF_COOKIE_NAME);

export const notifyCloudAppAuthStateChanged = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(CLOUDAPP_AUTH_STATE_CHANGED_EVENT));
};

export const getCloudAppAuthSnapshot = async (
  options: UseCloudAppSessionOptions = {},
): Promise<CloudAppAuthSnapshot> => {
  const client = getClient(options);
  const operationId = options.adminOnly ? 'adminAuthCheck' : 'authCheck';
  const response = await client.request<CloudAppAuthResponse>(operationId);
  return toSnapshot(response);
};

export const ensureCloudAppCsrfToken = async (options: UseCloudAppSessionOptions = {}) => {
  const existingToken = getCloudAppCsrfTokenFromCookie();
  if (existingToken) {
    return existingToken;
  }

  const client = getClient(options);
  const response = await client.request<CloudAppCsrfResponse>('getCsrfToken');
  const responseToken = normalizeUsername(response?.token);
  if (responseToken) {
    return responseToken;
  }

  return getCloudAppCsrfTokenFromCookie();
};

export const getCloudAppCsrfHeaders = async (options: UseCloudAppSessionOptions = {}) => {
  const token = await ensureCloudAppCsrfToken(options);
  if (!token) {
    return {};
  }

  return {
    [CLOUDAPP_CSRF_HEADER_NAME]: token,
  };
};

export const loginCloudAppUser = async ({
  username,
  password,
  ...options
}: UseCloudAppSessionOptions & { username: string; password: string }) => {
  const client = getClient(options);
  await client.request('authenticateUser', {
    body: {
      username: username.trim().toLowerCase(),
      password,
    },
  });
  return getCloudAppAuthSnapshot(options);
};

export const logoutCloudAppUser = async (options: UseCloudAppSessionOptions = {}) => {
  const client = getClient(options);
  const headers = await getCloudAppCsrfHeaders(options);
  await client.request('logoutUser', { headers });
};

export const useCloudAppSession = (options: UseCloudAppSessionOptions = {}) => {
  const [username, setUsername] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  const refreshAuthState = useCallback(async () => {
    setIsChecking(true);
    try {
      const snapshot = await getCloudAppAuthSnapshot(options);
      setUsername(snapshot.username);
      setRoles(snapshot.roles);
      setIsReady(Boolean(snapshot.username));
    } catch (error) {
      const status = error instanceof ContractApiError ? error.statusCode : undefined;
      if (status != 401 && status != 403) {
        console.error('CloudApp auth check failed', error);
      }
      setUsername('');
      setRoles([]);
      setIsReady(false);
    } finally {
      setIsInitialized(true);
      setIsChecking(false);
    }
  }, [options.adminOnly, options.apiUrl, options.fetchImpl]);

  useEffect(() => {
    void refreshAuthState();
  }, [refreshAuthState]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleAuthChanged = () => {
      void refreshAuthState();
    };

    window.addEventListener(CLOUDAPP_AUTH_STATE_CHANGED_EVENT, handleAuthChanged);
    return () => window.removeEventListener(CLOUDAPP_AUTH_STATE_CHANGED_EVENT, handleAuthChanged);
  }, [refreshAuthState]);

  return {
    username,
    roles,
    isAdmin: isCloudAppAdmin(roles),
    isReady,
    isInitialized,
    isChecking,
    refreshAuthState,
  };
};
