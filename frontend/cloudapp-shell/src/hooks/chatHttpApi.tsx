import axios from 'axios';
import { getCloudAppCsrfHeaders } from './cloudappCsrf';

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:80/cloudapp";

const authHeader = () => ({
    'Content-Type': 'application/json;charset=UTF-8'
});

export const chatHttpApi = {
  login: (username: string, password: string) =>
    axios.post(`${API_URL}/login`, { username, password }, { withCredentials: true }),

  createRoom: async (username: string, name: string) => {
    const csrfHeaders = await getCloudAppCsrfHeaders();
    return axios.post(
      `${API_URL}/room`,
      { name, username },
      { headers: { ...authHeader(), ...csrfHeaders }, withCredentials: true }
    );
  },

  findRoom: (code: string) =>
    axios.get(
      `${API_URL}/room/${code}`,
      { headers: authHeader(), withCredentials: true }
    ),

  getRooms: () =>
    axios.get(`${API_URL}/room`, { headers: authHeader(), withCredentials: true }),
};
