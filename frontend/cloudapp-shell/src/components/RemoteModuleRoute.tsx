import React from 'react';
import { LoaderCircle } from 'lucide-react';
import { useRemoteModules } from '../context/RemoteModulesContext';
import {
  getRemoteModuleDefinition,
  type RemoteModuleKey,
} from '../lib/remoteModules';
import RemoteErrorBoundary from './RemoteErrorBoundary';
import RemoteModuleUnavailable from './RemoteModuleUnavailable';

interface RemoteModuleRouteProps {
  remoteKey: RemoteModuleKey;
  children: React.ReactNode;
}

const RemoteModuleRoute: React.FC<RemoteModuleRouteProps> = ({ remoteKey, children }) => {
  const { remoteStatus, hasLoaded, refresh } = useRemoteModules();
  const moduleDefinition = getRemoteModuleDefinition(remoteKey);
  const status = remoteStatus[remoteKey];

  if (!status.enabled) {
    return (
      <RemoteModuleUnavailable
        title={`${moduleDefinition.label} Is Opt-In`}
        description={`${moduleDefinition.label} is not part of the default portfolio path. Start the ${moduleDefinition.profile} showcase profile to include it.`}
        hint={`Expected public URL: ${status.publicUrl}`}
      />
    );
  }

  if (status.available === false) {
    return (
      <RemoteModuleUnavailable
        title={`${moduleDefinition.label} Is Not Reachable`}
        description={`${moduleDefinition.label} is enabled, but its remote is not running or has not finished booting yet.`}
        hint={`Expected public URL: ${status.publicUrl}`}
        onRetry={refresh}
      />
    );
  }

  if (!hasLoaded && status.available === null) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-5 py-3 text-sm text-gray-600 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
          <LoaderCircle size={18} className="animate-spin" />
          Checking {moduleDefinition.label} availability...
        </div>
      </div>
    );
  }

  return (
    <RemoteErrorBoundary remoteName={moduleDefinition.label} remoteUrl={status.publicUrl}>
      {children}
    </RemoteErrorBoundary>
  );
};

export default RemoteModuleRoute;
