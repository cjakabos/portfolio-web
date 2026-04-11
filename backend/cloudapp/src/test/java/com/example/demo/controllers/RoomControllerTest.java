package com.example.demo.controllers;

import com.example.demo.collaboration.IRoomService;
import com.example.demo.collaboration.RoomDirectoryService;
import com.example.demo.model.persistence.RoomEntity;
import com.example.demo.model.persistence.model.ApiResponse;
import com.example.demo.model.persistence.model.ECode;
import com.example.demo.model.persistence.model.Room;
import com.example.demo.model.requests.CreateRoomRequest;
import com.example.demo.security.CloudappAccessPolicy;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.util.Pair;
import org.springframework.security.core.Authentication;

import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class RoomControllerTest {

    private RoomController roomController;
    private IRoomService roomService;
    private RoomDirectoryService roomDirectoryService;
    private CloudappAccessPolicy cloudappAccessPolicy;

    @BeforeEach
    void setup() {
        roomService = mock(IRoomService.class);
        roomDirectoryService = mock(RoomDirectoryService.class);
        cloudappAccessPolicy = mock(CloudappAccessPolicy.class);
        roomController = new RoomController(roomService, roomDirectoryService, new ApiResponse(), cloudappAccessPolicy);
    }

    @Test
    void create_happyPath() {
        CreateRoomRequest req = new CreateRoomRequest();
        req.setName("Team Room");
        req.setUsername("alice");
        RoomEntity room = new RoomEntity();
        room.setCode("ABC123");
        room.setName("Team Room");
        when(roomService.create("Team Room", "alice")).thenReturn(Pair.of(ECode.SUCCESS, room));

        ApiResponse resp = roomController.create(req);
        assertEquals(ECode.SUCCESS.getValue(), resp.getErr_code());
        assertNotNull(resp.getData());
        Room data = (Room) resp.getData();
        assertEquals("Team Room", data.getName());
        assertEquals("ABC123", data.getCode());
    }

    @Test
    void create_serviceFailure() {
        CreateRoomRequest req = new CreateRoomRequest();
        req.setName("Team Room");
        req.setUsername("alice");
        when(roomService.create("Team Room", "alice")).thenReturn(Pair.of(ECode.NOT_EXISTS_ROOM, new RoomEntity()));

        ApiResponse resp = roomController.create(req);
        assertEquals(ECode.NOT_EXISTS_ROOM.getValue(), resp.getErr_code());
    }

    @Test
    void find_happyPath() {
        RoomEntity room = new RoomEntity();
        room.setCode("ROOM1");
        room.setName("General");
        when(roomService.findByCode("ROOM1")).thenReturn(Pair.of(ECode.SUCCESS, room));

        ApiResponse resp = roomController.find("ROOM1");
        assertEquals(ECode.SUCCESS.getValue(), resp.getErr_code());
        Room data = (Room) resp.getData();
        assertEquals("ROOM1", data.getCode());
    }

    @Test
    void findRoomByUsername_happyPath() {
        Authentication auth = mock(Authentication.class);
        Room room = new Room();
        room.setName("General");
        room.setCode("ROOM1");
        List<Room> rooms = List.of(room);
        when(cloudappAccessPolicy.resolveAuthenticatedUsername(auth)).thenReturn(Optional.of("alice"));
        when(roomDirectoryService.findRoomsForUser("alice")).thenReturn(Pair.of(ECode.SUCCESS, rooms));

        ApiResponse resp = roomController.findRoomByUsername(auth);
        assertEquals(ECode.SUCCESS.getValue(), resp.getErr_code());
        assertNotNull(resp.getData());
        List<Room> roomResponse = (List<Room>) resp.getData();
        assertEquals(1, roomResponse.size());
        assertEquals("ROOM1", roomResponse.get(0).getCode());
    }

    @Test
    void findRoomByUsername_roomNotFound() {
        Authentication auth = mock(Authentication.class);
        when(cloudappAccessPolicy.resolveAuthenticatedUsername(auth)).thenReturn(Optional.of("alice"));
        when(roomDirectoryService.findRoomsForUser("alice")).thenReturn(Pair.of(ECode.NOT_EXISTS_ROOM, Collections.emptyList()));

        ApiResponse resp = roomController.findRoomByUsername(auth);
        assertEquals(ECode.NOT_EXISTS_ROOM.getValue(), resp.getErr_code());
    }
}
