import Axios from 'axios';

const api = Axios.create({
  baseURL: 'http://localhost:80/cloudapp/',
});

const authHeader = () => ({
                                          'Content-Type': 'application/json;charset=UTF-8',
                                          'Authorization': `Bearer ${localStorage.getItem("NEXT_PUBLIC_MY_TOKEN")}`
                                      });

export const chatHttpApi = {
  login: (username: string, password: string) =>
    api.post('login', { username, password }),

  createRoom: (username: string, name: string) =>
    api.post(
      'room',
      { name, username },
      { headers: authHeader() }
    ),

  findRoom: (code: string) =>
    api.get(
      `room/${code}`,
      { headers: authHeader() }
    ),

  getRooms: () =>
    api.get(`room`, { headers: authHeader() }),

};
