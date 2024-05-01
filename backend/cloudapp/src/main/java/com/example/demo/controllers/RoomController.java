package com.example.demo.controllers;

import com.example.demo.model.persistence.RoomEntity;
import com.example.demo.model.persistence.User;
import com.example.demo.model.persistence.model.ApiResponse;
import com.example.demo.model.persistence.model.ECode;
import com.example.demo.model.persistence.model.Room;
import com.example.demo.model.requests.CreateRoomRequest;
import com.example.demo.model.service.inf.IMessageService;
import com.example.demo.model.service.inf.IRoomService;

import java.security.Principal;
import java.util.List;
import java.util.stream.Collectors;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.util.Pair;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;


@RestController
@RequestMapping(value = "/room")
public class RoomController {

    private static final Logger LOGGER = LoggerFactory.getLogger(RoomController.class);

    @Autowired
    private IRoomService roomService;

    @Autowired
    private IMessageService messageService;

    @Autowired
    private ApiResponse apiResp;

    @PostMapping
    public ApiResponse create(
            @RequestBody CreateRoomRequest room) {
        ApiResponse resp = apiResp.getApiResponse(ECode.SUCCESS);
        try {
            Pair<ECode, RoomEntity> ret = roomService.create(room.getName(), room.getUsername());
            if (ECode.isFailed(ret.getFirst())) {
                return apiResp.getApiResponse(ret.getFirst());
            }
            Room data = new Room();
            data.setName(ret.getSecond().getName());
            data.setCode(ret.getSecond().getCode());
            resp.setData(data);
        } catch (Exception ex) {
            LOGGER.error(ex.getMessage(), ex);
            resp = apiResp.getApiResponse(ECode.EXCEPTION);
        }
        return resp;
    }

    @GetMapping(value = "/{code}")
    public ApiResponse find(@PathVariable String code) {
        ApiResponse resp = apiResp.getApiResponse(ECode.SUCCESS);
        try {
            Pair<ECode, RoomEntity> ret = roomService.findByCode(code);
            if (ECode.isFailed(ret.getFirst())) {
                return apiResp.getApiResponse(ret.getFirst());
            }
            Room data = new Room();
            data.setName(ret.getSecond().getName());
            data.setCode(ret.getSecond().getCode());
            resp.setData(data);
        } catch (Exception ex) {
            LOGGER.error(ex.getMessage(), ex);
            resp = apiResp.getApiResponse(ECode.EXCEPTION);
        }
        return resp;
    }

    @GetMapping
    public ApiResponse findRoomByUsername(Authentication auth) {
        String username = ((User) auth.getPrincipal()).getUsername();
        ApiResponse resp = apiResp.getApiResponse(ECode.SUCCESS);
        try {
            List<String> ret = messageService.findRoomsByUser(username);
            if (ret ==  null) {
                return apiResp.getApiResponse(ECode.NOT_EXISTS_ROOM);
            }
            List<Room> data = ret.stream().map(item -> {
                Pair<ECode, RoomEntity> roomEntity = roomService.findByCode(item);
                Room room = new Room();
                room.setName(roomEntity.getSecond().getName());
                room.setCode(roomEntity.getSecond().getCode());
                return room;
            }).collect(Collectors.toList());
            resp.setData(data);
        } catch (Exception ex) {
            LOGGER.error(ex.getMessage(), ex);
            resp = apiResp.getApiResponse(ECode.EXCEPTION);
        }
        return resp;
    }
}
