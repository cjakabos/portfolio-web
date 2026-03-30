import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  buildInitialRemoteModuleStatus,
  getEnabledRemoteModuleKeys,
  type RemoteModuleKey,
  type RemoteModuleStatus,
  type RemoteModuleStatusMap,
} from '../lib/remoteModules';

type RemoteStatusApiResponse = {
  remotes?: Partial<
    Record<
      RemoteModuleKey,
      Partial<
        Pick<
          RemoteModuleStatus,
          'enabled' | 'available' | 'publicUrl' | 'statusUrl' | 'healthUrl'
        >
      >
    >
  >;
};

interface RemoteModulesContextValue {
  remoteStatus: RemoteModuleStatusMap;
  hasLoaded: boolean;
  isRefreshing: boolean;
  refresh: () => Promise<void>;
}

const defaultContextValue: RemoteModulesContextValue = {
  remoteStatus: buildInitialRemoteModuleStatus(),
  hasLoaded: false,
  isRefreshing: false,
  refresh: async () => undefined,
};

const RemoteModulesContext = createContext<RemoteModulesContextValue>(defaultContextValue);

const mergeRemoteStatus = (
  currentStatus: RemoteModuleStatusMap,
  response: RemoteStatusApiResponse,
): RemoteModuleStatusMap => {
  if (!response.remotes) {
    return currentStatus;
  }

  const nextStatus = { ...currentStatus };

  for (const key of Object.keys(nextStatus) as RemoteModuleKey[]) {
    const remoteResponse = response.remotes[key];
    if (!remoteResponse) {
      continue;
    }

    nextStatus[key] = {
      ...nextStatus[key],
      enabled: remoteResponse.enabled ?? nextStatus[key].enabled,
      available:
        remoteResponse.available !== undefined
          ? remoteResponse.available
          : nextStatus[key].available,
      publicUrl: remoteResponse.publicUrl ?? nextStatus[key].publicUrl,
      statusUrl: remoteResponse.statusUrl ?? nextStatus[key].statusUrl,
      healthUrl: remoteResponse.healthUrl ?? nextStatus[key].healthUrl,
    };
  }

  return nextStatus;
};

export function RemoteModulesProvider({ children }: { children: React.ReactNode }) {
  const [remoteStatus, setRemoteStatus] = useState<RemoteModuleStatusMap>(() =>
    buildInitialRemoteModuleStatus(),
  );
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    if (getEnabledRemoteModuleKeys().length === 0) {
      setHasLoaded(true);
      return;
    }

    setIsRefreshing(true);
    try {
      const response = await fetch('/api/remotes/status', {
        cache: 'no-store',
        credentials: 'same-origin',
      });

      if (!response.ok) {
        throw new Error(`Unexpected remote status response: ${response.status}`);
      }

      const payload = (await response.json()) as RemoteStatusApiResponse;
      setRemoteStatus((currentStatus) => mergeRemoteStatus(currentStatus, payload));
    } catch (error) {
      console.warn('Unable to refresh remote module status.', error);
    } finally {
      setHasLoaded(true);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      remoteStatus,
      hasLoaded,
      isRefreshing,
      refresh,
    }),
    [hasLoaded, isRefreshing, refresh, remoteStatus],
  );

  return (
    <RemoteModulesContext.Provider value={value}>
      {children}
    </RemoteModulesContext.Provider>
  );
}

export const useRemoteModules = () => useContext(RemoteModulesContext);
