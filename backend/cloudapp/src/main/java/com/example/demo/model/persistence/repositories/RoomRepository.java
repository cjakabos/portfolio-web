package com.example.demo.model.persistence.repositories;

import java.util.List;

import com.example.demo.model.persistence.RoomEntity;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface RoomRepository extends MongoRepository<RoomEntity, String> {

    RoomEntity findByCode(String code);

    List<RoomEntity> findByCreatedBy(String createdBy);
}
