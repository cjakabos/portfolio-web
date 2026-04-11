import { createCloudAppBrowserClient, resolveCloudAppApiUrl } from '@portfolio/api-clients';
import { createCloudAppSessionClient, loginCloudAppUser, logoutCloudAppUser } from '@portfolio/auth';

export const getCloudAppApiUrl = () => resolveCloudAppApiUrl(process.env.NEXT_PUBLIC_API_URL);

export const getCloudAppBrowserClient = () =>
  createCloudAppBrowserClient({
    baseUrl: getCloudAppApiUrl(),
  });

export const getCloudAppSessionClient = () =>
  createCloudAppSessionClient({
    apiUrl: getCloudAppApiUrl(),
  });

export { loginCloudAppUser, logoutCloudAppUser };
