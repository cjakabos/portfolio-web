package com.example.demo.model.service;

import com.example.demo.model.persistence.RoomEntity;
import com.example.demo.model.persistence.repositories.RoomRepository;
import com.example.demo.model.persistence.model.ECode;
import com.example.demo.model.service.inf.IRoomService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.util.Pair;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;


@Service
public class RoomService implements IRoomService {

    private static final Logger LOGGER = LoggerFactory.getLogger(RoomService.class);

    @Autowired
    private RoomRepository repo;

    @Override
    public Pair<ECode, RoomEntity> create(String name, String username) {
        Pair<ECode, RoomEntity> ret;
        try {
            RoomEntity data = new RoomEntity();
            data.setName(name);
            data.setCode(UUID.randomUUID().toString());
            data.setCreatedBy(username);
            data.setCreatedAt(System.currentTimeMillis());
            ret = Pair.of(ECode.SUCCESS, repo.save(data));
        } catch (Exception ex) {
            LOGGER.error(ex.getMessage(), ex);
            ret = Pair.of(ECode.EXCEPTION, new RoomEntity());
        }
        return ret;
    }

    @Override
    public Pair<ECode, RoomEntity> findByCode(String code) {
        Pair<ECode, RoomEntity> ret;
        try {
            RoomEntity data = repo.findByCode(code);
            if (data == null) {
                return Pair.of(ECode.NOT_EXISTS_ROOM, new RoomEntity());
            }
            ret = Pair.of(ECode.SUCCESS, data);
        } catch (Exception ex) {
            LOGGER.error(ex.getMessage(), ex);
            ret = Pair.of(ECode.EXCEPTION, new RoomEntity());
        }
        return ret;
    }

    @Override
    public Pair<ECode, List<RoomEntity>> findByCreatedBy(String createdBy) {
        Pair<ECode, List<RoomEntity>> ret;
        try {
            List<RoomEntity> data = repo.findByCreatedBy(createdBy);
            if (data == null) {
                return Pair.of(ECode.NOT_EXISTS_ROOM, new ArrayList<>());
            }
            ret = Pair.of(ECode.SUCCESS, data);
        } catch (Exception ex) {
            LOGGER.error(ex.getMessage(), ex);
            ret = Pair.of(ECode.EXCEPTION, new ArrayList<>());
        }
        return ret;
    }
}
