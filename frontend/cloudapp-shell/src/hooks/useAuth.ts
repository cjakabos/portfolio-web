import {
  CLOUDAPP_AUTH_STATE_CHANGED_EVENT,
  notifyCloudAppAuthStateChanged,
  useCloudAppSession,
} from '@portfolio/auth';

export { CLOUDAPP_AUTH_STATE_CHANGED_EVENT, notifyCloudAppAuthStateChanged };

export const useAuth = () =>
  useCloudAppSession({
    apiUrl: process.env.NEXT_PUBLIC_API_URL,
  });
