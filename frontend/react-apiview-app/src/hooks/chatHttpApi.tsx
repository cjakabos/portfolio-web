import Axios from "axios";
import {useState} from "react";

const api = Axios.create({
    baseURL: 'http://localhost:80/cloudapp/',
});

let userToken;

if (typeof window !== "undefined") {
    userToken = (localStorage.getItem("NEXT_PUBLIC_MY_TOKEN") || '')
}

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
        console.log('trying to find room', userToken)
        return api.get(`room/${code}`, {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Authorization': localStorage.getItem("NEXT_PUBLIC_MY_TOKEN")
            }
        });
    },

    getRoom: () => {
        console.log('trying to get rooms', userToken)
        return api.get(`room`, {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Authorization': localStorage.getItem("NEXT_PUBLIC_MY_TOKEN")
            }
        });
    }
}


export default chatHttpApi;
