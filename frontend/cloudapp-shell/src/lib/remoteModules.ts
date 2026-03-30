export type ShowcaseProfile = 'portfolio' | 'extended';

export type RemoteModuleKey =
  | 'openmaps'
  | 'chatllm'
  | 'jira'
  | 'mlops'
  | 'petstore';

type EnvMap = Record<string, string | undefined>;

export interface RemoteModuleDefinition {
  key: RemoteModuleKey;
  label: string;
  publicUrlEnv: string;
  statusUrlEnv: string;
  enabledEnv: string;
  defaultPublicUrl: string;
  defaultStatusUrl: string;
  healthPath: string;
  showWhileChecking: boolean;
  profile: ShowcaseProfile;
}

export interface RemoteModuleStatus {
  key: RemoteModuleKey;
  label: string;
  enabled: boolean;
  available: boolean | null;
  publicUrl: string;
  statusUrl: string;
  healthUrl: string;
  profile: ShowcaseProfile;
  showWhileChecking: boolean;
}

export type RemoteModuleStatusMap = Record<RemoteModuleKey, RemoteModuleStatus>;

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off']);

const DEFAULT_PUBLIC_URLS: Record<RemoteModuleKey, string> = {
  openmaps: 'http://localhost:5002',
  jira: 'http://localhost:5003',
  chatllm: 'http://localhost:5333',
  mlops: 'http://localhost:5005',
  petstore: 'http://localhost:5006',
};

const DEFAULT_STATUS_URLS: Record<RemoteModuleKey, string> = {
  openmaps: 'http://next-openmaps:5002',
  jira: 'http://next-jira:5003',
  chatllm: 'http://next-chatllm:5333',
  mlops: 'http://next-mlops:5005',
  petstore: 'http://next-petstore:5006',
};

export const remoteModuleDefinitions: Record<RemoteModuleKey, RemoteModuleDefinition> = {
  openmaps: {
    key: 'openmaps',
    label: 'OpenMaps',
    publicUrlEnv: 'NEXT_PUBLIC_REMOTE_OPENMAPS_URL',
    statusUrlEnv: 'REMOTE_STATUS_OPENMAPS_URL',
    enabledEnv: 'NEXT_PUBLIC_ENABLE_OPENMAPS',
    defaultPublicUrl: DEFAULT_PUBLIC_URLS.openmaps,
    defaultStatusUrl: DEFAULT_STATUS_URLS.openmaps,
    healthPath: '/_next/static/chunks/remoteEntry.js',
    showWhileChecking: true,
    profile: 'portfolio',
  },
  jira: {
    key: 'jira',
    label: 'Jira',
    publicUrlEnv: 'NEXT_PUBLIC_REMOTE_JIRA_URL',
    statusUrlEnv: 'REMOTE_STATUS_JIRA_URL',
    enabledEnv: 'NEXT_PUBLIC_ENABLE_JIRA',
    defaultPublicUrl: DEFAULT_PUBLIC_URLS.jira,
    defaultStatusUrl: DEFAULT_STATUS_URLS.jira,
    healthPath: '/_next/static/chunks/remoteEntry.js',
    showWhileChecking: false,
    profile: 'extended',
  },
  chatllm: {
    key: 'chatllm',
    label: 'ChatLLM',
    publicUrlEnv: 'NEXT_PUBLIC_REMOTE_CHATLLM_URL',
    statusUrlEnv: 'REMOTE_STATUS_CHATLLM_URL',
    enabledEnv: 'NEXT_PUBLIC_ENABLE_CHATLLM',
    defaultPublicUrl: DEFAULT_PUBLIC_URLS.chatllm,
    defaultStatusUrl: DEFAULT_STATUS_URLS.chatllm,
    healthPath: '/_next/static/chunks/remoteEntry.js',
    showWhileChecking: false,
    profile: 'extended',
  },
  mlops: {
    key: 'mlops',
    label: 'MLOps',
    publicUrlEnv: 'NEXT_PUBLIC_REMOTE_MLOPS_URL',
    statusUrlEnv: 'REMOTE_STATUS_MLOPS_URL',
    enabledEnv: 'NEXT_PUBLIC_ENABLE_MLOPS',
    defaultPublicUrl: DEFAULT_PUBLIC_URLS.mlops,
    defaultStatusUrl: DEFAULT_STATUS_URLS.mlops,
    healthPath: '/_next/static/chunks/remoteEntry.js',
    showWhileChecking: false,
    profile: 'extended',
  },
  petstore: {
    key: 'petstore',
    label: 'PetStore',
    publicUrlEnv: 'NEXT_PUBLIC_REMOTE_PETSTORE_URL',
    statusUrlEnv: 'REMOTE_STATUS_PETSTORE_URL',
    enabledEnv: 'NEXT_PUBLIC_ENABLE_PETSTORE',
    defaultPublicUrl: DEFAULT_PUBLIC_URLS.petstore,
    defaultStatusUrl: DEFAULT_STATUS_URLS.petstore,
    healthPath: '/_next/static/chunks/remoteEntry.js',
    showWhileChecking: false,
    profile: 'extended',
  },
};

const parseBooleanEnv = (value: string | undefined, defaultValue: boolean) => {
  if (!value) {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) {
    return true;
  }
  if (FALSE_VALUES.has(normalized)) {
    return false;
  }
  return defaultValue;
};

const getEnvValue = (env: EnvMap, key: string) => env[key];

const normalizeBaseUrl = (value: string | undefined, fallback: string) => {
  const normalized = (value || fallback).trim();
  return normalized.replace(/\/+$/, '');
};

export const getRemoteModuleDefinition = (key: RemoteModuleKey) => remoteModuleDefinitions[key];

export const isRemoteModuleEnabled = (key: RemoteModuleKey, env: EnvMap = process.env) => {
  const definition = getRemoteModuleDefinition(key);
  const defaultEnabled = definition.profile === 'portfolio';
  return parseBooleanEnv(getEnvValue(env, definition.enabledEnv), defaultEnabled);
};

export const getRemoteModulePublicUrl = (key: RemoteModuleKey, env: EnvMap = process.env) => {
  const definition = getRemoteModuleDefinition(key);
  return normalizeBaseUrl(getEnvValue(env, definition.publicUrlEnv), definition.defaultPublicUrl);
};

export const getRemoteModuleStatusUrl = (key: RemoteModuleKey, env: EnvMap = process.env) => {
  const definition = getRemoteModuleDefinition(key);
  const fallback = getRemoteModulePublicUrl(key, env);
  return normalizeBaseUrl(
    getEnvValue(env, definition.statusUrlEnv),
    definition.defaultStatusUrl || fallback,
  );
};

export const getRemoteModuleHealthUrl = (key: RemoteModuleKey, env: EnvMap = process.env) => {
  const definition = getRemoteModuleDefinition(key);
  return `${getRemoteModuleStatusUrl(key, env)}${definition.healthPath}`;
};

export const getEnabledRemoteModuleKeys = (env: EnvMap = process.env) =>
  (Object.keys(remoteModuleDefinitions) as RemoteModuleKey[]).filter((key) =>
    isRemoteModuleEnabled(key, env),
  );

export const buildInitialRemoteModuleStatus = (
  env: EnvMap = process.env,
): RemoteModuleStatusMap => {
  const entries = (Object.keys(remoteModuleDefinitions) as RemoteModuleKey[]).map((key) => {
    const definition = getRemoteModuleDefinition(key);
    const enabled = isRemoteModuleEnabled(key, env);
    const available = enabled ? (definition.showWhileChecking ? true : null) : null;

    return [
      key,
      {
        key,
        label: definition.label,
        enabled,
        available,
        publicUrl: getRemoteModulePublicUrl(key, env),
        statusUrl: getRemoteModuleStatusUrl(key, env),
        healthUrl: getRemoteModuleHealthUrl(key, env),
        profile: definition.profile,
        showWhileChecking: definition.showWhileChecking,
      },
    ] as const;
  });

  return Object.fromEntries(entries) as RemoteModuleStatusMap;
};
