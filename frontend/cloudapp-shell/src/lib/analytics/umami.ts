type UmamiPayload = {
  url?: string;
  referrer?: string;
  title?: string;
  name?: string;
  data?: Record<string, unknown>;
  [key: string]: unknown;
};

type UmamiTrackInput =
  | string
  | Record<string, unknown>
  | ((payload: UmamiPayload) => UmamiPayload | false);

type UmamiApi = {
  track: (input?: UmamiTrackInput, data?: Record<string, unknown>) => void;
};

export const UMAMI_BEFORE_SEND_HANDLER = 'cloudAppUmamiBeforeSend';

const SENSITIVE_FIELD_PATTERN = /(email|token|secret|password|authorization|cookie|session|jwt|bearer|username|user_name)/i;

const getUmami = (): UmamiApi | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  return (window as typeof window & { umami?: UmamiApi }).umami ?? null;
};

const stripQueryAndHash = (
  url: string,
  { keepOrigin }: { keepOrigin: boolean }
): string => {
  const fallbackOrigin = typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
  const parsedUrl = new URL(url, fallbackOrigin);
  parsedUrl.search = '';
  parsedUrl.hash = '';

  if (keepOrigin) {
    return `${parsedUrl.origin}${parsedUrl.pathname}`;
  }

  return parsedUrl.pathname || '/';
};

export const normalizeTrackedUrl = (url: string): string => {
  return stripQueryAndHash(url, { keepOrigin: false });
};

export const normalizeReferrerUrl = (url: string): string => {
  return stripQueryAndHash(url, { keepOrigin: true });
};

export const parseDomainList = (value?: string): string[] => {
  return (value || '')
    .split(',')
    .map((domain) => domain.trim())
    .filter(Boolean);
};

const sanitizeValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => sanitizeValue(entry))
      .filter((entry) => entry !== undefined);
  }

  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>(
      (accumulator, [key, entry]) => {
        if (SENSITIVE_FIELD_PATTERN.test(key)) {
          return accumulator;
        }

        const sanitizedEntry = sanitizeValue(entry);
        if (sanitizedEntry !== undefined) {
          accumulator[key] = sanitizedEntry;
        }
        return accumulator;
      },
      {}
    );
  }

  return value;
};

export const sanitizePayload = (type: string, payload: UmamiPayload): UmamiPayload | false => {
  if (type === 'identify') {
    return false;
  }

  const sanitizedPayload: UmamiPayload = { ...payload };

  if (typeof sanitizedPayload.url === 'string') {
    sanitizedPayload.url = normalizeTrackedUrl(sanitizedPayload.url);
  }

  if (typeof sanitizedPayload.referrer === 'string') {
    sanitizedPayload.referrer = normalizeReferrerUrl(sanitizedPayload.referrer);
  }

  if (sanitizedPayload.data && typeof sanitizedPayload.data === 'object') {
    sanitizedPayload.data = sanitizeValue(sanitizedPayload.data) as Record<string, unknown>;
  }

  return sanitizedPayload;
};

export const createBeforeSendHandler = () => {
  return (type: string, payload: UmamiPayload) => sanitizePayload(type, payload);
};

export const installBeforeSendHandler = () => {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const target = window as typeof window & {
    [UMAMI_BEFORE_SEND_HANDLER]?: ReturnType<typeof createBeforeSendHandler>;
  };

  target[UMAMI_BEFORE_SEND_HANDLER] = createBeforeSendHandler();

  return () => {
    delete target[UMAMI_BEFORE_SEND_HANDLER];
  };
};

export const trackPageview = (url?: string) => {
  const umami = getUmami();
  if (!umami) {
    return;
  }

  const trackedUrl = normalizeTrackedUrl(url ?? window.location.href);
  umami.track((payload) =>
    sanitizePayload('pageview', {
      ...payload,
      title: document.title,
      url: trackedUrl,
    }) || false
  );
};

export const trackEvent = (name: string, data?: Record<string, unknown>) => {
  const umami = getUmami();
  if (!umami) {
    return;
  }

  if (data && Object.keys(data).length > 0) {
    umami.track(name, sanitizeValue(data) as Record<string, unknown>);
    return;
  }

  umami.track(name);
};
