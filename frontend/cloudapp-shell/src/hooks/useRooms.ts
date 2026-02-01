import { useState, useCallback } from 'react';
import { chatHttpApi } from './chatHttpApi';

export const useRooms = (username: string) => {
  const [userRooms, setUserRooms] = useState([]);
  const [error, setError] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);

  // Handle session errors (error code 6 triggers page reload)
  const handleSessionError = useCallback((errorCode: number) => {
    if (errorCode === 6) {
      console.log('Session expired, reloading page...');
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      }, 1000);
    }
  }, []);

  const getRooms = useCallback(() => {
    if (!username) return;

    chatHttpApi.getRooms()
      .then((res: any) => {
        if (res.data.err_code !== 0) {
          setError(res.data.err_msg);
          handleSessionError(res.data.err_code);
        } else {
            console.log(res.data.data)
          setUserRooms(res.data.data);
          setError(null);
        }
      })
      .catch((err) => {
        setError('Network Error: Unable to fetch rooms');
        console.error('Get rooms error:', err);
      });
  }, [username, handleSessionError]);

  const createRoom = async (roomName: string) => {
    setError(null);

    if (!roomName.trim()) {
      setError('Room name cannot be empty');
      return null;
    }

    try {
      const res = await chatHttpApi.createRoom(roomName, username);

      if (res.data.err_code !== 0) {
        setError(res.data.err_msg);
        handleSessionError(res.data.err_code);
        return null;
      }

      setRoomCode(res.data.data.code);
      return {
        code: res.data.data.code,
        name: res.data.data.name || roomName,
        isCreator: true
      };
    } catch (e) {
      setError('Network Error: Unable to create room');
      console.error('Create room error:', e);
      return null;
    }
  };

  const enterRoom = async (code: string) => {
    setError(null);

    if (!code.trim()) {
      setError('Room code cannot be empty');
      return null;
    }

    try {
      console.log("trying to enter room")
      const res = await chatHttpApi.findRoom(code);

      if (res.data.err_code !== 0) {
        setError(res.data.err_msg);
        handleSessionError(res.data.err_code);
        return null;
      }

      setRoomCode(res.data.data.code);
      return {
        code: res.data.data.code,
        name: res.data.data.name,
        isCreator: false
      };
    } catch (e) {
      setError('Network Error: Unable to join room');
      console.error('Enter room error:', e);
      return null;
    }
  };

  return {
    userRooms,
    roomCode,
    error,
    setError,
    getRooms,
    createRoom,
    enterRoom
  };
};