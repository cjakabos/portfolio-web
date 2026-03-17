type UmamiApi = {
  track: (name?: string, data?: Record<string, unknown>) => void;
};

export const trackEvent = (name: string, data?: Record<string, unknown>) => {
  if (typeof window === 'undefined') {
    return;
  }

  const umami = (window as typeof window & { umami?: UmamiApi }).umami;
  if (!umami) {
    return;
  }

  if (data && Object.keys(data).length > 0) {
    umami.track(name, data);
    return;
  }

  umami.track(name);
};
