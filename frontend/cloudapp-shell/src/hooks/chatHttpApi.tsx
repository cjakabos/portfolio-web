import Axios from 'axios';
import { getCloudAppCsrfHeaders } from './cloudappCsrf';

const api = Axios.create({
  baseURL: 'http://localhost:80/cloudapp/',
  withCredentials: true,
});

const authHeader = () => ({
                                          'Content-Type': 'application/json;charset=UTF-8'
                                      });

export const chatHttpApi = {
  login: (username: string, password: string) =>
    api.post('login', { username, password }),

  createRoom: async (username: string, name: string) => {
    const csrfHeaders = await getCloudAppCsrfHeaders();
    return api.post(
      'room',
      { name, username },
      { headers: { ...authHeader(), ...csrfHeaders } }
    );
  },

  findRoom: (code: string) =>
    api.get(
      `room/${code}`,
      { headers: authHeader() }
    ),

  getRooms: () =>
    api.get(`room`, { headers: authHeader() }),

};
