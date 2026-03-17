type UmamiPayload = {
  url?: string;
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

const getUmami = (): UmamiApi | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  return (window as typeof window & { umami?: UmamiApi }).umami ?? null;
};

export const normalizeTrackedUrl = (url: string): string => {
  if (typeof window === 'undefined') {
    return url;
  }

  const parsedUrl = new URL(url, window.location.origin);
  parsedUrl.search = '';
  parsedUrl.hash = '';

  return `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}` || '/';
};

export const trackPageview = (url?: string) => {
  const umami = getUmami();
  if (!umami) {
    return;
  }

  const trackedUrl = normalizeTrackedUrl(url ?? window.location.href);
  umami.track((payload) => ({
    ...payload,
    title: document.title,
    url: trackedUrl,
  }));
};

export const trackEvent = (name: string, data?: Record<string, unknown>) => {
  const umami = getUmami();
  if (!umami) {
    return;
  }

  if (data && Object.keys(data).length > 0) {
    umami.track(name, data);
    return;
  }

  umami.track(name);
};
