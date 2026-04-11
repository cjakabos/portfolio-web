import {
  CloudappApiClient,
  type CloudappClientConfig,
  PetstoreApiClient,
  type PetstoreClientConfig,
  VehiclesApiClient,
  type VehiclesClientConfig,
} from '@portfolio/contracts';

export const DEFAULT_GATEWAY_URL = 'http://localhost:80';
export const DEFAULT_CLOUDAPP_API_URL = `${DEFAULT_GATEWAY_URL}/cloudapp`;
export const DEFAULT_PETSTORE_API_URL = `${DEFAULT_GATEWAY_URL}/petstore`;
export const DEFAULT_VEHICLES_API_URL = `${DEFAULT_GATEWAY_URL}/vehicles`;

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const resolveRelativeBaseUrl = (value: string) => {
  if (!value.startsWith('/')) {
    return value;
  }

  const runtimeOrigin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : DEFAULT_GATEWAY_URL;

  return new URL(value, runtimeOrigin.endsWith('/') ? runtimeOrigin : `${runtimeOrigin}/`).toString();
};

const resolveBaseUrl = (value: string | undefined, fallback: string) => {
  const next = value?.trim();
  return next ? trimTrailingSlash(resolveRelativeBaseUrl(next)) : fallback;
};

type CloudAppClientOptions = Omit<CloudappClientConfig, 'baseUrl'> & { baseUrl?: string };
type PetstoreClientOptions = Omit<PetstoreClientConfig, 'baseUrl'> & { baseUrl?: string };
type VehiclesClientOptions = Omit<VehiclesClientConfig, 'baseUrl'> & { baseUrl?: string };

export const resolveCloudAppApiUrl = (value?: string) => resolveBaseUrl(value, DEFAULT_CLOUDAPP_API_URL);
export const resolvePetstoreApiUrl = (value?: string) => resolveBaseUrl(value, DEFAULT_PETSTORE_API_URL);
export const resolveVehiclesApiUrl = (value?: string) => resolveBaseUrl(value, DEFAULT_VEHICLES_API_URL);

export const createCloudAppApiClient = (config: CloudAppClientOptions = {}) =>
  new CloudappApiClient({
    ...config,
    baseUrl: resolveCloudAppApiUrl(config.baseUrl),
    defaultCredentials: config.defaultCredentials ?? 'include',
  });

export const createPetstoreApiClient = (config: PetstoreClientOptions = {}) =>
  new PetstoreApiClient({
    ...config,
    baseUrl: resolvePetstoreApiUrl(config.baseUrl),
    defaultCredentials: config.defaultCredentials ?? 'include',
  });

export const createVehiclesApiClient = (config: VehiclesClientOptions = {}) =>
  new VehiclesApiClient({
    ...config,
    baseUrl: resolveVehiclesApiUrl(config.baseUrl),
    defaultCredentials: config.defaultCredentials ?? 'include',
  });
