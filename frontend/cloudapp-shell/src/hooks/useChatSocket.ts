'use client'
import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import SockJS from 'sockjs-client';
import Stomp from 'webstomp-client';
import { chatHttpApi } from './chatHttpApi';

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:80/cloudapp').replace(/\/+$/, '');
const CHAT_WS_API_URL = (
    process.env.NEXT_PUBLIC_CHAT_WS_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:80/cloudapp'
).replace(/\/+$/, '');
const SOCKET_URL = `${CHAT_WS_API_URL}/ws/`;
const AUTH_CHECK_URL = `${API_URL}/user/auth-check`;

export default function useChat() {
    // User & Room State
    const [username, setUsername] = useState('');
    const [enteredRoom, setEnteredRoom] = useState(false);
    const [roomCode, setRoomCode] = useState(null);
    const [userRooms, setUserRooms] = useState([]);
    
    // Socket & Message State
    const [messages, setMessages] = useState([]);
    const [connectedUsers, setConnectedUsers] = useState([]);
    const [connected, setConnected] = useState(false);
    
    // UI/Error State
    const [showErrorPopup, setShowErrorPopup] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [popupKey, setPopupKey] = useState(0);

    // Refs
    const clientRef = useRef(null);
    const initializedRef = useRef(false);

    // --- Helpers ---
    const handleError = useCallback((msg) => {
        setErrorMessage(msg);
        setShowErrorPopup(true);
        setPopupKey(prev => prev + 1);
    }, []);

    const onErrorInvalidSession = useCallback((errorCode) => {
        if (errorCode === 6) {
            setTimeout(() => {
                if (typeof window !== "undefined") window.location.reload();
            }, 1000);
        }
    }, []);

    // --- Socket Logic ---
    const onMessageReceived = useCallback((msg) => {
        if (msg.content === 'newUser') {
            setConnectedUsers((prev) => [...prev, msg.sender]);
        } else {
            setMessages((prev) => [...prev, msg]);
        }
    }, []);

    const sendNewUser = useCallback((user, code) => {
        if (clientRef.current) {
            const msg = { sender: user, content: 'newUser' };
            clientRef.current.send(`/app/newUser/${code}`, JSON.stringify(msg));
        }
    }, []);

    const onConnected = useCallback((user, code, isCreator = false) => {
        const client = clientRef.current;

        // Subscriptions
        client.subscribe(`/user/queue/load-history`, (message) => {
            onMessageReceived(JSON.parse(message.body));
        });

        client.subscribe(`/topic/group/${code}`, (message) => {
            onMessageReceived(JSON.parse(message.body));
        });

        client.subscribe(`/topic/newUser/${code}`, (message) => {
            const msg = JSON.parse(message.body);
            if (msg.sender !== user) {
                handleError(`User ${msg.sender} has entered room`);
            }
        });

        // Initial Actions
        sendNewUser(user, code);

        if (isCreator) {
            const msg = {
                sender: user,
                content: 'This is an automatic message, the room was created.',
            };
            client.send(`/app/sendMessage/${code}`, JSON.stringify(msg));
        }

        setConnected(true);
    }, [handleError, onMessageReceived, sendNewUser]);

    const connectSocket = useCallback((code, isCreator = false) => {
        const socket = new SockJS(SOCKET_URL);
        const client = Stomp.over(socket);
        client.debug = () => { }; // Disable debug logs
        clientRef.current = client;

        client.connect({}, 
            () => onConnected(username, code, isCreator), 
            (err) => console.error('WebSocket error', err)
        );
    }, [username, onConnected]);

    const disconnectSocket = useCallback(() => {
        if (clientRef.current) {
            clientRef.current.disconnect(() => {
                setConnected(false);
            });
        }
    }, []);

    const sendMessage = (msgText) => {
        if (clientRef.current && roomCode) {
            const msg = { sender: username, content: msgText };
            clientRef.current.send(`/app/sendMessage/${roomCode}`, JSON.stringify(msg));
        }
    };

    // --- API Interactions ---
    const handleCreateRoom = (roomName) => {
        chatHttpApi.createRoom(roomName, username).then(res => {
            if (res.data.err_code !== 0) {
                handleError(res.data.err_msg);
                return;
            }
            handleError("Create room success, Room code " + res.data.data.code);
            setEnteredRoom(true);
            setRoomCode(res.data.data.code);
            connectSocket(res.data.data.code, true); // true = created room
        });
        setShowErrorPopup(false);
    };

    const handleEnterRoom = (code) => {
        chatHttpApi.findRoom(code).then(res => {
            if (res.data.err_code !== 0) {
                handleError(res.data.err_msg);
                onErrorInvalidSession(res.data.err_code);
                return;
            }
            handleError("Enter room success, Room name " + res.data.data.name);
            setEnteredRoom(true);
            setRoomCode(res.data.data.code);
            connectSocket(res.data.data.code, false);
        });
        setShowErrorPopup(false);
    };

    const handleGetUserRooms = useCallback(() => {
        chatHttpApi.getRooms().then(res => {
            if (res.data.err_code !== 0) {
                handleError(res.data.err_msg);
                onErrorInvalidSession(res.data.err_code);
                return;
            }
            setUserRooms(res.data.data);
        });
        setShowErrorPopup(false);
    }, [handleError, onErrorInvalidSession]);

    // --- Initialization ---
    useEffect(() => {
        if (!initializedRef.current && typeof window !== "undefined") {
            initializedRef.current = true;
            void (async () => {
                try {
                    const response = await axios.get(AUTH_CHECK_URL, { withCredentials: true });
                    const authenticatedUser =
                        typeof response.data?.username === 'string' ? response.data.username : '';
                    setUsername(authenticatedUser);
                    if (authenticatedUser) {
                        handleGetUserRooms();
                    }
                } catch (error) {
                    console.error('Failed to initialize chat user', error);
                }
            })();
        }
        
        // Cleanup on unmount
        return () => {
            disconnectSocket();
        }
    }, [handleGetUserRooms, disconnectSocket]);

    return {
        username,
        messages,
        connected,
        connectedUsers,
        enteredRoom,
        userRooms,
        // Popup State
        showErrorPopup,
        errorMessage,
        popupKey,
        // Actions
        sendMessage,
        handleCreateRoom,
        handleEnterRoom
    };
}
