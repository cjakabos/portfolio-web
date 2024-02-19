package com.example.demo.model.service.inf;

import com.example.demo.model.persistence.RoomEntity;
import com.example.demo.model.persistence.model.ECode;
import org.springframework.data.util.Pair;

import java.util.List;


public interface IRoomService {

    public Pair<ECode, RoomEntity> create(String name, String username);

    public Pair<ECode, RoomEntity> findByCode(String code);
    
    public Pair<ECode, List<RoomEntity>> findByCreatedBy(String createdBy);
}
