package com.example.demo.controllers;

import com.example.demo.model.persistence.RoomEntity;
import com.example.demo.model.persistence.User;
import com.example.demo.model.persistence.model.ApiResponse;
import com.example.demo.model.persistence.model.ECode;
import com.example.demo.model.persistence.model.Room;
import com.example.demo.model.requests.CreateRoomRequest;
import com.example.demo.model.service.inf.IMessageService;
import com.example.demo.model.service.inf.IRoomService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.util.Pair;
import org.springframework.security.core.Authentication;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class RoomControllerTest {

    private RoomController roomController;
    private IRoomService roomService;
    private IMessageService messageService;

    @BeforeEach
    void setup() {
        roomController = new RoomController();
        roomService = mock(IRoomService.class);
        messageService = mock(IMessageService.class);
        ReflectionTestUtils.setField(roomController, "roomService", roomService);
        ReflectionTestUtils.setField(roomController, "messageService", messageService);
        ReflectionTestUtils.setField(roomController, "apiResp", new ApiResponse());
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
        User principal = new User();
        principal.setUsername("alice");
        Authentication auth = mock(Authentication.class);
        when(auth.getPrincipal()).thenReturn(principal);
        when(messageService.findRoomsByUser("alice")).thenReturn(List.of("ROOM1"));

        RoomEntity room = new RoomEntity();
        room.setCode("ROOM1");
        room.setName("General");
        when(roomService.findByCode("ROOM1")).thenReturn(Pair.of(ECode.SUCCESS, room));

        ApiResponse resp = roomController.findRoomByUsername(auth);
        assertEquals(ECode.SUCCESS.getValue(), resp.getErr_code());
        assertNotNull(resp.getData());
        List<Room> rooms = (List<Room>) resp.getData();
        assertEquals(1, rooms.size());
        assertEquals("ROOM1", rooms.get(0).getCode());
    }

    @Test
    void findRoomByUsername_roomNotFound() {
        User principal = new User();
        principal.setUsername("alice");
        Authentication auth = mock(Authentication.class);
        when(auth.getPrincipal()).thenReturn(principal);
        when(messageService.findRoomsByUser("alice")).thenReturn(null);

        ApiResponse resp = roomController.findRoomByUsername(auth);
        assertEquals(ECode.NOT_EXISTS_ROOM.getValue(), resp.getErr_code());
    }
}
