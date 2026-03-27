import { sleep } from 'k6';

export function aiBaseUrl() {
  return (__ENV.AI_BASE_URL || 'http://localhost:8700').replace(/\/+$/, '');
}

export function internalToken() {
  return __ENV.INTERNAL_TOKEN || 'test-internal-token';
}

export function jsonParams(extraHeaders = {}) {
  return {
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Auth': internalToken(),
      ...extraHeaders,
    },
  };
}

export function formParams(extraHeaders = {}) {
  return {
    headers: {
      'X-Internal-Auth': internalToken(),
      ...extraHeaders,
    },
  };
}

export function buildUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${aiBaseUrl()}${normalizedPath}`;
}

export function uniqueId(prefix) {
  return `${prefix}-${Date.now()}-${__VU}-${__ITER}`;
}

export function pollIntervalSeconds() {
  return Number(__ENV.POLL_INTERVAL_SECONDS || '2');
}

export function maxPollAttempts() {
  return Number(__ENV.MAX_POLL_ATTEMPTS || '30');
}

export function pollSleep() {
  sleep(pollIntervalSeconds());
}

export function maybeJson(response) {
  try {
    return response.json();
  } catch {
    return null;
  }
}
