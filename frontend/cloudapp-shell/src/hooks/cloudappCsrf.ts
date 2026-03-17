import {
  CLOUDAPP_CSRF_COOKIE_NAME,
  CLOUDAPP_CSRF_HEADER_NAME,
  ensureCloudAppCsrfToken as ensureSharedCloudAppCsrfToken,
  getCloudAppCsrfHeaders as getSharedCloudAppCsrfHeaders,
  getCloudAppCsrfTokenFromCookie,
} from '@portfolio/auth';

export {
  CLOUDAPP_CSRF_COOKIE_NAME,
  CLOUDAPP_CSRF_HEADER_NAME,
  getCloudAppCsrfTokenFromCookie,
};

export const getCloudAppApiUrl = () =>
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:80/cloudapp';

export const ensureCloudAppCsrfToken = (apiUrl = getCloudAppApiUrl()) =>
  ensureSharedCloudAppCsrfToken({ apiUrl });

export const getCloudAppCsrfHeaders = (apiUrl = getCloudAppApiUrl()) =>
  getSharedCloudAppCsrfHeaders({ apiUrl });
