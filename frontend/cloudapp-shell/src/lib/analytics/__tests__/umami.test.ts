import {
  createBeforeSendHandler,
  installBeforeSendHandler,
  normalizeTrackedUrl,
  parseDomainList,
  sanitizePayload,
  trackEvent,
  trackPageview,
  UMAMI_BEFORE_SEND_HANDLER,
} from '../umami';

describe('umami analytics helper', () => {
  afterEach(() => {
    delete (window as typeof window & { umami?: unknown })[UMAMI_BEFORE_SEND_HANDLER];
    delete (window as typeof window & { umami?: unknown }).umami;
    jest.restoreAllMocks();
  });

  it('normalizes tracked URLs by stripping search params and hashes', () => {
    expect(normalizeTrackedUrl('/login?next=/admin#ignored')).toBe('/login');
  });

  it('parses the configured domain list', () => {
    expect(parseDomainList(' localhost, 127.0.0.1 ,example.com ')).toEqual([
      'localhost',
      '127.0.0.1',
      'example.com',
    ]);
  });

  it('blocks identify payloads and sanitizes event data', () => {
    expect(
      sanitizePayload('identify', {
        data: { email: 'hidden@example.com' },
      })
    ).toBe(false);

    expect(
      sanitizePayload('event', {
        url: 'http://localhost:5001/shop?coupon=test#confirm',
        referrer: 'https://example.com/landing?email=user@example.com#cta',
        data: {
          section: 'checkout',
          email: 'hidden@example.com',
          nested: {
            username: 'cloudadmin',
            keep: true,
          },
        },
      })
    ).toEqual({
      url: '/shop',
      referrer: 'https://example.com/landing',
      data: {
        section: 'checkout',
        nested: {
          keep: true,
        },
      },
    });
  });

  it('installs and removes the before-send handler on window', () => {
    const cleanup = installBeforeSendHandler();
    const target = window as typeof window & {
      [UMAMI_BEFORE_SEND_HANDLER]?: ReturnType<typeof createBeforeSendHandler>;
    };

    expect(typeof target[UMAMI_BEFORE_SEND_HANDLER]).toBe('function');
    expect(
      target[UMAMI_BEFORE_SEND_HANDLER]?.('event', {
        url: '/notes?draft=1',
        data: { password: 'secret', keep: 'yes' },
      })
    ).toEqual({
      url: '/notes',
      data: { keep: 'yes' },
    });

    cleanup();

    expect(target[UMAMI_BEFORE_SEND_HANDLER]).toBeUndefined();
  });

  it('tracks pageviews with sanitized URLs and current document title', () => {
    const track = jest.fn();
    (window as typeof window & { umami?: { track: typeof track } }).umami = { track };
    document.title = 'CloudApp Dashboard';

    trackPageview('/?view=admin#overview');

    expect(track).toHaveBeenCalledTimes(1);
    const beforeSend = track.mock.calls[0][0] as (payload: { url?: string }) => unknown;

    expect(beforeSend({ url: '/stale?token=abc' })).toEqual({
      title: 'CloudApp Dashboard',
      url: '/',
    });
  });

  it('tracks events with sanitized custom payloads and no-ops when unavailable', () => {
    const track = jest.fn();
    (window as typeof window & { umami?: { track: typeof track } }).umami = { track };

    trackEvent('auth_login_success', {
      source: 'login_form',
      email: 'hidden@example.com',
      nested: {
        token: 'abc',
        keep: 'value',
      },
    });

    expect(track).toHaveBeenCalledWith('auth_login_success', {
      source: 'login_form',
      nested: {
        keep: 'value',
      },
    });

    delete (window as typeof window & { umami?: unknown }).umami;
    expect(() => trackEvent('auth_logout')).not.toThrow();
  });
});
