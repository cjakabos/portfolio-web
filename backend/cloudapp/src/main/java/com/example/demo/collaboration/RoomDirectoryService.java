package com.example.demo.collaboration;

import com.example.demo.model.persistence.RoomEntity;
import com.example.demo.model.persistence.model.ECode;
import com.example.demo.model.persistence.model.Room;
import org.springframework.data.util.Pair;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class RoomDirectoryService {

    private final IRoomService roomService;
    private final IMessageService messageService;

    public RoomDirectoryService(IRoomService roomService, IMessageService messageService) {
        this.roomService = roomService;
        this.messageService = messageService;
    }

    public Pair<ECode, List<Room>> findRoomsForUser(String username) {
        List<String> roomCodes = messageService.findRoomsByUser(username);
        if (roomCodes == null || roomCodes.isEmpty()) {
            return Pair.of(ECode.NOT_EXISTS_ROOM, List.of());
        }

        List<Room> rooms = new ArrayList<>();
        for (String roomCode : roomCodes) {
            Pair<ECode, RoomEntity> roomEntity = roomService.findByCode(roomCode);
            if (ECode.isFailed(roomEntity.getFirst())) {
                continue;
            }
            Room room = new Room();
            room.setName(roomEntity.getSecond().getName());
            room.setCode(roomEntity.getSecond().getCode());
            rooms.add(room);
        }

        if (rooms.isEmpty()) {
            return Pair.of(ECode.NOT_EXISTS_ROOM, List.of());
        }

        return Pair.of(ECode.SUCCESS, rooms);
    }
}
