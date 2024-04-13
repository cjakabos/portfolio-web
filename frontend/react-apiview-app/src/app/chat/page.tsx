'use client'
import React, {useState, useEffect, useRef} from 'react';
import './components/page.css';
import Input from './components/Input';
import Messages from './components/Messages';
import SockJS from 'sockjs-client';
import Stomp from 'webstomp-client';
import chatHttpApi from '../../hooks/chatHttpApi';
import Popup from './components/Popup'
import Room from "./components/Room";

const SOCKET_URL = 'http://localhost:8099/ws/';
let client;
export default function Chat() {

    let [username, setUsername] = useState('hello');
    //Make sure useEffect only runs once
    const effectRan = useRef(false);
    // @ts-ignore
    useEffect(() => {
        if (!effectRan.current) {
            try {
                console.log('username', username)
                setUsername(localStorage.getItem("NEXT_PUBLIC_MY_USERNAME") || '')
                console.log('username changed', username)
            } catch (error) {
                console.log(error)
            }
        }
        handleGetUserRooms()
        return () => effectRan.current = true;
    }, []);

    const [messages, setMessages] = useState([])
    const [user, setUser] = useState(username)
    const [connectedUsers, setConnectedUsers] = useState([]);
    const [showErrorPopup, setShowErrorPopup] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [enteredRoom, setEnteredRoom] = useState(false);
    const [roomCode, setRoomCode] = useState(null);
    const [popupKey, setPopupKey] = useState(0);
    const [userRooms, setUserRooms] = useState([]);


    let onConnected = (username, roomCode) => {
        console.log("Connected!!")

        client.subscribe(`/user/queue/load-history`, (message) => {
            onMessageReceived(JSON.parse(message.body));
        });

        client.subscribe(`/topic/group/${roomCode}`, (message) => {
            onMessageReceived(JSON.parse(message.body));
        });

        sendNewUser(username, roomCode);

        client.subscribe(`/topic/newUser/${roomCode}`, (message) => {
            const msg = JSON.parse(message.body);
            if (msg.sender !== username) {
                setErrorMessage(`User ${msg.sender} has enter room`);
                setPopupKey((prevKey) => prevKey + 1);
            }
        });
    }

    let onDisconnected = () => {
        console.log("Disconnected!!")
    }

    let onMessageReceived = (msg) => {
        if (msg.content === 'newUser') {
            // @ts-ignore
            setConnectedUsers((users) => [...users, msg.sender]);
        } else {
            setMessages((messages) => messages.concat(msg));
        }
    }

    let onSendMessage = (msgText) => {
        let msg = {
            sender: username,
            content: msgText
        }
        console.log('Trying to send message to', roomCode, ' ', JSON.stringify(msg));
        client.send(`/app/sendMessage/${roomCode}`, JSON.stringify(msg));
    }

    let onError = (error) => {
        console.log('Failed to connect to WebSocket server', error);
    }

    let onErrorInvalidSession = (error) => {
        if (error === 6) {
            setTimeout(() => {
                if (typeof window !== "undefined") {
                    window.location.reload()
                }
            }, 1000);
        }
    }

    let connectSocket = (roomCode) => {
        const socket = new SockJS(SOCKET_URL);
        client = Stomp.over(socket);
        client.debug = () => { };
        client.connect({}, () => onConnected(username, roomCode), onError);
        client.disconnect = onDisconnected;
        console.log(`Sucribe /topic/group/${roomCode}`);
    }

    let sendNewUser = (username, roomCode) => {
        const msg = {
            sender: username,
            content: 'newUser',
        };
        client.send(`/app/newUser/${roomCode}`, JSON.stringify(msg));
    };

    const handleCreateRoom = (roomName) => {
        console.log(`Creating room: ${roomName}`);
        chatHttpApi.createRoom(roomName, username).then(res => {
            if (res.data.err_code !== 0) {
                setErrorMessage(res.data.err_msg);
                setShowErrorPopup(true);
                return;
            }
            setErrorMessage("Create room success, Room code " + res.data.data.code);
            setShowErrorPopup(true);
            setEnteredRoom(true);
            setRoomCode(res.data.data.code);
            connectSocket(res.data.data.code);
        });
        setShowErrorPopup(false);
    };

    const handleEnterRoom = (roomCode) => {
        chatHttpApi.findRoom(roomCode, username).then(res => {
            console.log(res.data);
            if (res.data.err_code !== 0) {
                setErrorMessage(res.data.err_msg);
                setShowErrorPopup(true);
                onErrorInvalidSession(res.data.err_code);
                return;
            }
            setErrorMessage("Enter room success, Room name " + res.data.data.name);
            setShowErrorPopup(true);
            setEnteredRoom(true);
            setRoomCode(res.data.data.code);
            connectSocket(res.data.data.code);
        });
        setShowErrorPopup(false);
    };

    const handleGetUserRooms = () => {
        chatHttpApi.getRoom().then(res => {
            console.log(res.data);
            if (res.data.err_code !== 0) {
                setErrorMessage(res.data.err_msg);
                setShowErrorPopup(true);
                onErrorInvalidSession(res.data.err_code);
                return;
            }
            setUserRooms(res.data.data);
        });
        setShowErrorPopup(false);
    };

    useEffect(() => {
        console.log('connectedUsers', connectedUsers);
    }, [connectedUsers]);


    if (effectRan.current) {
        return (
            <div className="Chat">
                Hi {username} {username}
                {!!user && !enteredRoom ? (
                    <Room onCreateRoom={handleCreateRoom} onEnterRoom={handleEnterRoom} userRooms={userRooms}/>
                ) : null}

                {!!user && enteredRoom ? (
                    <>
                        <Messages messages={messages} currentUser={user}/>
                        <Input onSendMessage={onSendMessage}/>
                    </>
                ) : null}

                {showErrorPopup && (
                    <Popup message={errorMessage} key={popupKey}/>
                )}
            </div>
        )
    }
}
