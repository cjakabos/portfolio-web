import Axios from "axios";

const api = Axios.create({
    baseURL: 'http://localhost:8099/api/',
});

const chatHttpApi = {

    login: (username, password) => {
        let msg = {
            username,
            password,
        }
        return api.post(`login`, msg);
    },

    createRoom: (name, username) => {
        let msg = {
            name,
            username,
        }
        return api.post(`room`, msg, {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Authorization': localStorage.getItem("NEXT_PUBLIC_MY_TOKEN")
            }
        });
    },

    findRoom: (code, session) => {
        return api.get(`room/${code}`, {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Authorization': localStorage.getItem("NEXT_PUBLIC_MY_TOKEN")
            }
        });
    },

    getRoom: () => {
        console.log('trying to get rooms')
        return api.get(`rooms`, {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Authorization': localStorage.getItem("NEXT_PUBLIC_MY_TOKEN")
            }
        });
    }
}


export default chatHttpApi;
