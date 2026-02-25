import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { chatHttpApi } from '../../hooks/chatHttpApi';
import { MessageSquare, Users, Plus, LogIn } from 'lucide-react';
import SockJS from 'sockjs-client';
import Stomp from 'webstomp-client';

const SOCKET_URL = 'http://localhost:80/cloudapp/ws/';
let client;

interface Room {
  code: string;
  name: string;
  createdBy: string;
}

const Chat: React.FC = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [username, setUsername] = useState('');
  const effectRan = useRef(false);
  const router = useRouter();

  useEffect(() => {
    if (!effectRan.current) {
      if (typeof window !== 'undefined') {
        const storedUsername = localStorage.getItem('NEXT_PUBLIC_MY_USERNAME') || '';
        setUsername(storedUsername);
        if (storedUsername) {
          fetchRooms(storedUsername);
        }
        effectRan.current = true;
      }
    }
  }, []);

  const fetchRooms = async (user: string) => {
    if (!user) return;
    try {
      const res = await chatHttpApi.getRooms();
      setRooms(res.data.data || []);
      console.log(res.data.data)
    } catch (err) {
      console.error('Failed to fetch rooms', err);
    }
  };

  const connectSocket = (roomCode: string, username: string, createRoom?: boolean) => {
    const socket = new SockJS(SOCKET_URL);
    client = Stomp.over(socket);
    client.debug = () => {};

    const onConnected = () => {
      console.log('Connected to WebSocket');

      client.subscribe(`/topic/group/${roomCode}`, (message) => {
        console.log('Message received:', message.body);
      });

      const msg = {
        sender: username,
        content: createRoom ? 'Room created' : 'newUser',
      };

      client.send(`/app/newUser/${roomCode}`, JSON.stringify(msg));

      if (createRoom) {
        const welcomeMsg = {
          sender: username,
          content: 'This is an automatic message, the room was created.',
        };
        client.send(`/app/sendMessage/${roomCode}`, JSON.stringify(welcomeMsg));
      }
    };

    const onError = (error: any) => {
      console.log('Failed to connect to WebSocket server', error);
    };

    client.connect({}, onConnected, onError);
  };

  const createRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;

    try {
      const res = await chatHttpApi.createRoom(username, newRoomName);

      if (res.data.err_code !== 0) {
        setError(res.data.err_msg);
        return;
      }

      setNewRoomName('');

      // Navigate to the new room — the room page handles its own WebSocket connection
      if (res.data.data.code) {
        router.push(`/chat/rooms/${res.data.data.code}`);
      }
    } catch (err) {
      setError('Failed to create room');
    }
  };

  const joinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!joinCode.trim()) return;

    try {
    console.log("res2")
      const res = await chatHttpApi.findRoom(joinCode);
      if (res.data.err_code !== 0) {
        setError(res.data.err_msg);
        return;
      }

      // Connect to WebSocket for the joined room
      connectSocket(joinCode, username);

      router.push(`/chat/rooms/${joinCode}`)
      setJoinCode('');
    } catch (err) {
      setError('Room not found or already joined.');
    }
  };

  if (!effectRan.current) {
    return <div>Loading...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center py-8">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Community Rooms</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">Join a topic or create your own space</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Create Room */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <h3 className="font-bold text-gray-900 dark:text-white mb-4">Create Room</h3>
          <form onSubmit={createRoom} className="flex gap-3">
            <input
              type="text"
              placeholder="Room Name..."
              className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500"
              value={newRoomName}
              onChange={e => setNewRoomName(e.target.value)}
            />
            <button type="submit" className="bg-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-purple-700 flex items-center gap-2">
              <Plus size={18} /> Create
            </button>
          </form>
        </div>

        {/* Join Room */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <h3 className="font-bold text-gray-900 dark:text-white mb-4">Join by Code</h3>
          <form onSubmit={joinRoom} className="flex gap-3">
            <input
              type="text"
              placeholder="Enter Room Code..."
              className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value)}
            />
            <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 flex items-center gap-2">
              <LogIn size={18} /> Join
            </button>
          </form>
          {error && <p className={`text-sm mt-2 ${error.includes('success') || error.includes('Code:') ? 'text-green-500' : 'text-red-500'}`}>{error}</p>}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider text-sm">Your Rooms</h3>
        {rooms.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 text-gray-400">
            You haven't joined any rooms yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rooms.map((room, idx) => (
              <Link
                key={idx}
                href={`/chat/rooms/${room.code}`}
                className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-500 transition cursor-pointer group"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-lg group-hover:bg-purple-100 dark:group-hover:bg-purple-900/40 transition">
                    <MessageSquare size={24} />
                  </div>
                  <span className="text-xs font-mono text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">{room.code}</span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{room.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                   {/* TODO: <Users size={14} /> Created by {room.createdBy} */}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat;