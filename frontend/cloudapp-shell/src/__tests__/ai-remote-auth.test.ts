/** @jest-environment node */
import chatModels from '../../../remote/chatllm/pages/api/models';
import jiraModels from '../../../remote/jira/pages/api/models';
import chat from '../../../remote/chatllm/pages/api/chat';
import { readChatBody } from '@portfolio/api-clients/ai-server';

let calls: Array<{ url: string; headers: Headers }>;
beforeEach(() => {
  calls = [];
  global.fetch = jest.fn(async (url: any, options: any = {}) => {
    const headers = new Headers(options.headers);
    calls.push({ url: String(url), headers });
    if (String(url).endsWith('/auth-check')) {
      const admin = headers.get('Authorization') === 'Bearer administrator';
      const code = String(url).includes('/admin/') && !admin ? 403 : 200;
      return new Response(JSON.stringify({ username: admin ? 'administrator' : 'user', roles: [admin ? 'ROLE_ADMIN' : 'ROLE_USER'] }), { status: code });
    }
    return new Response(JSON.stringify({ models: [{ name: 'qwen3:1.7b' }] }), { status: 200 });
  }) as any;
});

const request = (headers: Record<string, string> = {}) => new Request('http://remote/api/models', { headers });

test('Anonymous AI model discovery is denied even without Origin or with forged role headers', async () => {
  for (const handler of [chatModels, jiraModels]) {
    const response = await handler(request({ 'X-Auth-Roles': 'ROLE_ADMIN', 'X-Internal-Service-Token': 'forged' }));
    expect(response.status).toBe(401);
  }
  expect(calls).toHaveLength(0);
});

test('Jira AI denies regular users and allows a verified administrator', async () => {
  expect((await jiraModels(request({ Authorization: 'Bearer user' }))).status).toBe(403);
  expect(calls).toHaveLength(1);
  expect(calls[0].url).toContain('/user/admin/auth-check');
  expect((await jiraModels(request({ Authorization: 'Bearer administrator' }))).status).toBe(200);
  expect(calls.at(-1)?.url).toMatch(/\/tags$/);
});

test('ChatLLM model discovery accepts verified signed-in users and strips forged service identity', async () => {
  const response = await chatModels(request({ Authorization: 'Bearer user', 'X-Internal-Service-Token': 'forged', 'X-Auth-User': 'administrator' }));
  expect(response.status).toBe(200);
  expect(calls[0].url).toContain('/user/auth-check');
  expect(calls[0].headers.has('X-Internal-Service-Token')).toBe(false);
  expect(calls[0].headers.has('X-Auth-User')).toBe(false);
});

test('Untrusted origins and failed identity verification cannot reach the model provider', async () => {
  expect((await chatModels(request({ Authorization: 'Bearer user', Origin: 'http://untrusted.invalid' }))).status).toBe(403);
  expect(calls).toHaveLength(0);
  global.fetch = jest.fn(async () => new Response('{}', { status: 302 })) as any;
  expect((await chatModels(request({ Authorization: 'Bearer user' }))).status).toBe(503);
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test('Chat API rejects oversized malformed and unavailable-model requests before generation', async () => {
  const post = (body: string) => new Request('http://remote/api/chat', { method: 'POST', headers: { Authorization: 'Bearer user' }, body });
  expect((await chat(post('{broken'))).status).toBe(400);
  expect((await chat(post('x'.repeat(65537)))).status).toBe(413);
  expect((await chat(post(JSON.stringify({ model: 'missing-model', messages: [{ role: 'user', content: 'hello' }] })))).status).toBe(400);
  expect(calls.every(call => !call.url.endsWith('/chat'))).toBe(true);
});

test('Model provider failures return a bounded unavailable response', async () => {
  const original = global.fetch;
  global.fetch = jest.fn(async (url: any, init: any) => {
    if (String(url).endsWith('/tags')) throw new Error('fixture unavailable');
    return original(url, init);
  }) as any;
  const response = await chatModels(request({ Authorization: 'Bearer user' }));
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: 'connection_failed', models: [] });
});

test('An unfinished request body times out and releases its reader', async () => {
  jest.useFakeTimers();
  const cancel = jest.fn();
  const body = new ReadableStream({ cancel });
  const req = new Request('http://test/api/chat', { method: 'POST', body, duplex: 'half' } as any);
  const result = expect(readChatBody(req)).rejects.toThrow('request_timeout');
  await jest.advanceTimersByTimeAsync(5000);
  await result;
  expect(cancel).toHaveBeenCalled();
  jest.useRealTimers();
});
