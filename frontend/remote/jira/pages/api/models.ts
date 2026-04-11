import { getOllamaBaseUrl, isAllowedOrigin, jsonResponse, preflightResponse } from '../../lib/aiApi';

const OLLAMA_BASE = getOllamaBaseUrl();

export const runtime = 'edge';

export default async function GET(req: Request) {
  if (req.method === 'OPTIONS') {
    return preflightResponse(req, 'GET, OPTIONS');
  }

  const origin = req.headers.get('origin');
  if (origin && !isAllowedOrigin(req, origin)) {
    return jsonResponse(req, 'GET, OPTIONS', { error: 'origin_not_allowed' }, { status: 403 });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`${OLLAMA_BASE}/tags`, {
      method: 'GET',
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return jsonResponse(
        req,
        'GET, OPTIONS',
        { error: 'connection_failed', models: [] },
        { status: 503 },
      );
    }

    return jsonResponse(req, 'GET, OPTIONS', { models: data.models ?? [] });
  } catch (error: any) {
    const errorCode =
      error?.name === 'AbortError' || error?.message?.includes('timeout')
        ? 'timeout'
        : 'connection_failed';

    return jsonResponse(
      req,
      'GET, OPTIONS',
      { error: errorCode, models: [] },
      { status: 503 },
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
