import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { MockContractApiError, authPackageMock } = vi.hoisted(() => {
  class HoistedMockContractApiError extends Error {
    statusCode: number;

    constructor(message: string, statusCode: number) {
      super(message);
      this.name = 'ContractApiError';
      this.statusCode = statusCode;
    }
  }

  return {
    MockContractApiError: HoistedMockContractApiError,
    authPackageMock: {
      getCloudAppAuthSnapshot: vi.fn(),
      isCloudAppAdmin: vi.fn((roles: Iterable<string>) => Array.from(roles).includes('ROLE_ADMIN')),
      loginCloudAppUser: vi.fn(),
      logoutCloudAppUser: vi.fn(),
      normalizeCloudAppRoles: vi.fn((roles: unknown) => Array.isArray(roles) ? roles : []),
    },
  };
});

vi.mock('@portfolio/auth', () => ({
  ContractApiError: MockContractApiError,
  getCloudAppAuthSnapshot: authPackageMock.getCloudAppAuthSnapshot,
  isCloudAppAdmin: authPackageMock.isCloudAppAdmin,
  loginCloudAppUser: authPackageMock.loginCloudAppUser,
  logoutCloudAppUser: authPackageMock.logoutCloudAppUser,
  normalizeCloudAppRoles: authPackageMock.normalizeCloudAppRoles,
}));

import { useCloudAppAuth } from '../hooks/useCloudAppAuth';

describe('useCloudAppAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hydrates an authenticated admin session on mount', async () => {
    authPackageMock.getCloudAppAuthSnapshot.mockResolvedValue({
      username: 'admin-user',
      roles: ['ROLE_ADMIN', 'ROLE_USER'],
    });

    const { result } = renderHook(() => useCloudAppAuth());

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });

    expect(authPackageMock.getCloudAppAuthSnapshot).toHaveBeenCalledTimes(1);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.username).toBe('admin-user');
    expect(result.current.roles).toEqual(['ROLE_ADMIN', 'ROLE_USER']);
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('surfaces the admin-only message when the session check is forbidden', async () => {
    authPackageMock.getCloudAppAuthSnapshot.mockRejectedValue(
      new MockContractApiError('Forbidden', 403)
    );

    const { result } = renderHook(() => useCloudAppAuth());

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.roles).toEqual([]);
    expect(result.current.error).toBe('Only CloudApp admins can sign in to AI Orchestration Monitor.');
  });
});
