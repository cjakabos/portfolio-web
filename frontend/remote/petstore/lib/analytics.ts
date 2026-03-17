type AnalyticsPayload = Record<string, unknown>;

type UmamiApi = {
  track: (name: string, data?: AnalyticsPayload) => void;
};

const getUmami = (): UmamiApi | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  return (window as typeof window & { umami?: UmamiApi }).umami ?? null;
};

export const trackPetStoreEvent = (name: string, data?: AnalyticsPayload) => {
  const umami = getUmami();
  if (!umami) {
    return;
  }

  umami.track(name, data);
};
