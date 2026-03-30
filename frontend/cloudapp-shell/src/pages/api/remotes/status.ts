import type { NextApiRequest, NextApiResponse } from 'next';
import {
  buildInitialRemoteModuleStatus,
  getRemoteModuleHealthUrl,
  type RemoteModuleKey,
} from '../../../lib/remoteModules';

const REQUEST_TIMEOUT_MS = 2500;

const withTimeout = async (url: string, method: 'HEAD' | 'GET') => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      method,
      cache: 'no-store',
      redirect: 'follow',
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
};

const isRemoteAvailable = async (healthUrl: string) => {
  try {
    const headResponse = await withTimeout(healthUrl, 'HEAD');
    if (headResponse.ok) {
      return true;
    }

    if (headResponse.status !== 405) {
      return false;
    }
  } catch {
    return false;
  }

  try {
    const getResponse = await withTimeout(healthUrl, 'GET');
    return getResponse.ok;
  } catch {
    return false;
  }
};

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  const initialStatus = buildInitialRemoteModuleStatus();
  const entries = await Promise.all(
    (Object.keys(initialStatus) as RemoteModuleKey[]).map(async (key) => {
      const currentStatus = initialStatus[key];

      if (!currentStatus.enabled) {
        return [key, currentStatus] as const;
      }

      return [
        key,
        {
          ...currentStatus,
          available: await isRemoteAvailable(getRemoteModuleHealthUrl(key, process.env)),
        },
      ] as const;
    }),
  );

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.status(200).json({
    checkedAt: new Date().toISOString(),
    remotes: Object.fromEntries(entries),
  });
}
