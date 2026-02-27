import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { chatHttpApi } from '../../../hooks/chatHttpApi';
import { Send, ArrowLeft } from 'lucide-react';
import SockJS from 'sockjs-client';
import Stomp from 'webstomp-client';
import { useAuth } from '../../../hooks/useAuth';

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:80/cloudapp').replace(/\/+$/, '');
const CHAT_WS_API_URL = (
  process.env.NEXT_PUBLIC_CHAT_WS_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:80/cloudapp'
).replace(/\/+$/, '');
const SOCKET_URL = `${CHAT_WS_API_URL}/ws/`;
let client;

interface RoomMessage {
  id: string;
  sender: string;
  content: string;
  timestamp: string;
}

const CloudChat: React.FC = () => {
  const router = useRouter();
  const { roomId, created } = router.query;
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { username } = useAuth();

  const onMessageReceived = (msg: any) => {
    if (msg.content === 'newUser') {
      setConnectedUsers((users) => [...users, msg.sender]);
      console.log('New user joined:', msg.sender);
    } else {
      const newMessage: RoomMessage = {
        id: msg.id || Date.now().toString(),
        sender: msg.sender,
        content: msg.content,
        timestamp: msg.timestamp || new Date().toISOString(),
      };
      setMessages((messages) => [...messages, newMessage]);
    }
  };

  const onConnected = (username: string, roomCode: string) => {
    console.log('Connected to room:', roomCode);

    // Subscribe to load message history
    client.subscribe(`/user/queue/load-history`, (message) => {
      onMessageReceived(JSON.parse(message.body));
    });

    // Subscribe to room messages
    client.subscribe(`/topic/group/${roomCode}`, (message) => {
      onMessageReceived(JSON.parse(message.body));
    });

    // Subscribe to new user notifications
    client.subscribe(`/topic/newUser/${roomCode}`, (message) => {
      const msg = JSON.parse(message.body);
      if (msg.sender !== username) {
        console.log(`User ${msg.sender} has entered room`);
      }
    });

    // Send new user message
    sendNewUser(username, roomCode);
    setConnected(true);

    // Send automatic welcome message if room was just created
    if (created === 'true') {
      const welcomeMsg = {
        sender: username,
        content: 'This is an automatic message, the room was created.',
      };
      client.send(`/app/sendMessage/${roomCode}`, JSON.stringify(welcomeMsg));
      // Clean up the query param
      router.replace(`/chat/rooms/${roomCode}`, undefined, { shallow: true });
    }

    // Fetch message history after connection is established
    fetchMessages(roomCode);
  };

  const fetchMessages = (roomCode: string) => {
    client.send(`/app/loadHistory/${roomCode}`, JSON.stringify({}));
    setLoading(false);
  };

  const onError = (error: any) => {
    console.log('Failed to connect to WebSocket server', error);
    setConnected(false);
  };

  const onDisconnected = () => {
    console.log('Disconnected from WebSocket');
    setConnected(false);
  };

  const connectSocket = (roomCode: string, username: string) => {
    const socket = new SockJS(SOCKET_URL);
    client = Stomp.over(socket);
    client.debug = () => {};
    client.connect({}, () => onConnected(username, roomCode), onError);
    client.disconnect = onDisconnected;
  };

  const sendNewUser = (username: string, roomCode: string) => {
    const msg = {
      sender: username,
      content: 'newUser',
    };
    client.send(`/app/newUser/${roomCode}`, JSON.stringify(msg));
  };


  useEffect(() => {
    if (roomId && username) {
      // Connect to WebSocket (fetchMessages will be called after connection)
      connectSocket(roomId as string, username);

      // Cleanup on unmount
      return () => {
        if (client && client.connected) {
          client.disconnect();
        }
      };
    }
  }, [roomId, username]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !roomId || !connected) return;

    const text = input;
    setInput('');

    try {
      const msg = {
        sender: username,
        content: text,
      };

      // Send via WebSocket
      client.send(`/app/sendMessage/${roomId}`, JSON.stringify(msg));
    } catch (err) {
      console.error('Failed to send message', err);
    }
  };

  return (
    <div>
      <div className="flex flex-col h-[calc(100vh-10rem)] max-w-5xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden my-4">
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center gap-4 shrink-0">
          <Link href="/chat" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition text-gray-500 dark:text-gray-400">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h2 className="font-bold text-gray-900 dark:text-white text-lg flex items-center gap-2">
              {(roomId as string)?.split('-')[0] || 'Room'}
              <span className="text-xs font-normal font-mono bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-gray-500 dark:text-gray-400">{roomId}</span>
            </h2>
            <p className={`text-xs flex items-center gap-1 ${connected ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
              {connected ? 'Live Connection' : 'Disconnected'}
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50 dark:bg-gray-900/50">
          {loading ? (
            <div className="text-center py-10 text-gray-400">
              <p>Messages are loading...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.sender === username;
              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-center gap-2 mb-1 px-1">
                    {!isMe && <span className="text-xs font-bold text-gray-600 dark:text-gray-300">{msg.sender}</span>}
                    <span className="text-[10px] text-gray-400 flex items-center gap-1">
                      {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  </div>
                  <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm shadow-sm break-words ${
                    isMe
                    ? 'bg-blue-600 text-white rounded-br-none'
                    : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-600 rounded-bl-none'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shrink-0">
          <form onSubmit={handleSend} className="flex gap-2">
            <input
              type="text"
              className="flex-1 border border-gray-300 dark:border-gray-600 rounded-full px-5 py-3 focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500"
              placeholder="Type your message..."
              value={input}
              onChange={e => setInput(e.target.value)}
            />
            <button
              type="submit"
              disabled={!input.trim() || !connected}
              className="bg-blue-600 text-white p-3 rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition shadow-sm"
            >
              <Send size={20} />
            </button>
          </form>
          {!connected && (
            <p className="text-xs text-red-500 mt-2 text-center">Reconnecting to chat...</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default CloudChat;
