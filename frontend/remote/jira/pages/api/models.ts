const OLLAMA_ROOT = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_BASE = `${OLLAMA_ROOT.replace(/\/+$/, '')}/api`;

export const runtime = 'edge';

export default async function GET() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`${OLLAMA_BASE}/tags`, {
      method: 'GET',
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return Response.json(
        { error: 'connection_failed', models: [] },
        { status: 503 },
      );
    }

    return Response.json({ models: data.models ?? [] });
  } catch (error: any) {
    const errorCode =
      error?.name === 'AbortError' || error?.message?.includes('timeout')
        ? 'timeout'
        : 'connection_failed';

    return Response.json(
      { error: errorCode, models: [] },
      { status: 503 },
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
