import React, { useState } from 'react';
import {
  Button, TextField, Box, Container,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';
import { DataGrid, GridColDef } from "@mui/x-data-grid";

const Room = ({ onCreateRoom, onEnterRoom, userRooms }) => {
  const [showCreate, setShowCreate] = useState(false);
  const [showEnter, setShowEnter] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [selectedRoom, setSelectedRoom] = useState({code: 0});

  const handleRoomClick = (room) => {
    setSelectedRoom(room);
  };

  const toggleCreate = () => {
    setShowCreate(!showCreate);
    setShowEnter(false);
    setRoomName('');
    setRoomCode('');
  };

  const toggleEnter = () => {
    setShowEnter(!showEnter);
    setShowCreate(false);
    setRoomName('');
    setRoomCode('');
  };

  const handleCreateRoom = () => {
    if (roomName.trim() !== '') {
      onCreateRoom(roomName);
      toggleCreate();
    }
  };

  const handleEnterRoom = () => {
    if (roomCode.trim() !== '') {
      onEnterRoom(roomCode);
      toggleEnter();
    }
  };

  const columnsCustomers: GridColDef[] = [
    {field: "name", headerName: "Name", width: 320},
    {
      field: "enter",
      headerName: "Enter Room",
        width: 100,
      sortable: false,
      renderCell: ({row}) =>
          <>
            <button className="submitbutton"
                    onClick={() => onEnterRoom(row.code)}
            > Enter
            </button>
          </>
    },
    {
      field: "copy",
      headerName: "Copy Room Code",
      sortable: false,
      renderCell: ({row}) =>
          <>
            <button className="submitbutton"
                    onClick={() => {
                        navigator.clipboard.writeText(row.code);
                    }}
            > Copy
            </button>
          </>
    }
  ];

  return (
    <Container maxWidth="sm">
      <Box mt={4} display="flex" flexDirection="column" alignItems="center">
        {(!showEnter && !showCreate) && (
          <Button  onClick={toggleCreate}>
            Create room
          </Button>
        )}
        {showCreate && (
          <Box mt={2} display="flex" flexDirection="column" alignItems="center">
            <TextField
              label="Enter room name"
              style={{ background: 'white'}}
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
            />
            <Button  onClick={handleCreateRoom} style={{ marginTop: '10px' }}>
              Create
            </Button>
          </Box>
        )}
      </Box>

      <Box mt={4} display="flex" flexDirection="column" alignItems="center">
        {(!showEnter && !showCreate) && (
          <Button  onClick={toggleEnter}>
            Enter room
          </Button>
        )}
        {showEnter && (
          <Box mt={2} display="flex" flexDirection="column" alignItems="center">
            <TextField
              label="Enter room code"
              variant="outlined"
              style={{ background: 'white'}}
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
            />
            <Button  onClick={handleEnterRoom} style={{ marginTop: '10px' }}>
              Enter
            </Button>
          </Box>
        )}
      </Box>
      <br/>
          {userRooms?.length > 0 ?
              <>
              <h2>Your Rooms:</h2>
              <DataGrid
                  rows={userRooms}
                  columns={columnsCustomers}
                  getRowId={(row: any) =>  row.code}
                  className="text-black dark:text-white h-auto"
                  slotProps={{
                      row: {
                          className: "text-black dark:text-white"
                      },
                      cell: {
                          className: "text-black dark:text-white",
                      },
                      pagination: {
                          className: "text-black dark:text-white",
                      },
                  }}
              />
              </>
           : null}
    </Container>
  );
};

export default Room;
