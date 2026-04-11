import { getCloudAppBrowserClient, getCloudAppSessionClient } from './cloudappClient';

type ChatApiEnvelope<T> = {
  err_code: number;
  err_msg: string;
  data: T;
};

export const chatHttpApi = {
  login: async (username: string, password: string) => {
    const data = await getCloudAppBrowserClient().requestJson<ChatApiEnvelope<unknown>>('/login', {
      method: 'POST',
      body: { username, password },
    });
    return { data };
  },

  createRoom: async (username: string, name: string) => {
    const data = await getCloudAppSessionClient().requestJson<ChatApiEnvelope<{ code: string; name?: string }>>('/room', {
      method: 'POST',
      body: { name, username },
    });
    return { data };
  },

  findRoom: async (code: string) => {
    const data = await getCloudAppSessionClient().requestJson<ChatApiEnvelope<{ code: string; name: string }>>(`/room/${code}`);
    return { data };
  },

  getRooms: async () => {
    const data = await getCloudAppSessionClient().requestJson<ChatApiEnvelope<Array<{ code: string; name: string }>>>('/room');
    return { data };
  },
};
