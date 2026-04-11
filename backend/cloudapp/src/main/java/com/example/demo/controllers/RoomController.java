package com.example.demo.controllers;

import com.example.demo.collaboration.IRoomService;
import com.example.demo.collaboration.RoomDirectoryService;
import com.example.demo.model.persistence.RoomEntity;
import com.example.demo.model.persistence.model.ApiResponse;
import com.example.demo.model.persistence.model.ECode;
import com.example.demo.model.persistence.model.Room;
import com.example.demo.model.requests.CreateRoomRequest;
import com.example.demo.security.CloudappAccessPolicy;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.util.Pair;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;


@RestController
@RequestMapping(value = "/room")
public class RoomController {

    private static final Logger LOGGER = LoggerFactory.getLogger(RoomController.class);

    private final IRoomService roomService;
    private final RoomDirectoryService roomDirectoryService;
    private final ApiResponse apiResp;
    private final CloudappAccessPolicy cloudappAccessPolicy;

    public RoomController(
            IRoomService roomService,
            RoomDirectoryService roomDirectoryService,
            ApiResponse apiResp,
            CloudappAccessPolicy cloudappAccessPolicy
    ) {
        this.roomService = roomService;
        this.roomDirectoryService = roomDirectoryService;
        this.apiResp = apiResp;
        this.cloudappAccessPolicy = cloudappAccessPolicy;
    }

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
        String username = cloudappAccessPolicy.resolveAuthenticatedUsername(auth).orElse(null);
        if (username == null || username.isBlank()) {
            return apiResp.getApiResponse(ECode.INVALID_SESSION);
        }
        ApiResponse resp = apiResp.getApiResponse(ECode.SUCCESS);
        try {
            Pair<ECode, List<Room>> ret = roomDirectoryService.findRoomsForUser(username);
            if (ECode.isFailed(ret.getFirst())) {
                return apiResp.getApiResponse(ret.getFirst());
            }
            resp.setData(ret.getSecond());
        } catch (Exception ex) {
            LOGGER.error(ex.getMessage(), ex);
            resp = apiResp.getApiResponse(ECode.EXCEPTION);
        }
        return resp;
    }
}
