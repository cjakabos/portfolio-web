import { describe, expect, it, vi } from 'vitest';
import { getCloudAppAuthSnapshot, loginCloudAppUser } from '@portfolio/auth';

const okJson = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'content-type': 'application/json',
    },
  });

describe('CloudApp session client routing', () => {
  it('keeps the cloudapp base path for admin auth checks', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      okJson({
        username: 'integrationadmin',
        roles: ['ROLE_ADMIN'],
      })
    );

    await getCloudAppAuthSnapshot({
      apiUrl: 'http://monitor.local/cloudapp',
      adminOnly: true,
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('http://monitor.local/cloudapp/user/admin/auth-check');
  });

  it('keeps the cloudapp base path through login and refresh', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(okJson({ success: true }))
      .mockResolvedValueOnce(
        okJson({
          username: 'integrationadmin',
          roles: ['ROLE_ADMIN'],
        })
      );

    await loginCloudAppUser({
      username: 'integrationadmin',
      password: 'SecureE2EPass123',
      apiUrl: 'http://monitor.local/cloudapp',
      adminOnly: true,
      fetchImpl,
    });

    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      'http://monitor.local/cloudapp/user/user-login',
      'http://monitor.local/cloudapp/user/admin/auth-check',
    ]);
    expect(fetchImpl.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      })
    );
  });

  it('resolves root-relative cloudapp paths against the current origin', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      okJson({
        username: 'integrationadmin',
        roles: ['ROLE_ADMIN'],
      })
    );

    await getCloudAppAuthSnapshot({
      apiUrl: '/cloudapp',
      adminOnly: true,
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(`${window.location.origin}/cloudapp/user/admin/auth-check`);
  });

  it('binds the default browser fetch implementation to the global context', async () => {
    const originalFetch = globalThis.fetch;
    const defaultFetchMock = vi.fn(function(this: typeof globalThis, _input: RequestInfo | URL, _init?: RequestInit) {
      if (this !== globalThis) {
        throw new TypeError('Illegal invocation');
      }

      return Promise.resolve(
        okJson({
          username: 'integrationadmin',
          roles: ['ROLE_ADMIN'],
        })
      );
    });
    const defaultFetch = defaultFetchMock as typeof fetch;

    globalThis.fetch = defaultFetch;

    try {
      await getCloudAppAuthSnapshot({
        apiUrl: `${window.location.origin}/cloudapp`,
        adminOnly: true,
      });
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(defaultFetchMock).toHaveBeenCalledTimes(1);
    expect(defaultFetchMock.mock.calls[0]?.[0]).toBe(`${window.location.origin}/cloudapp/user/admin/auth-check`);
  });
});
