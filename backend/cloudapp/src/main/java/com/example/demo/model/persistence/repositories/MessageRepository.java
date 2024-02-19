package com.example.demo.model.persistence.repositories;

import java.util.List;

import com.example.demo.model.persistence.MessageEntity;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;


@Repository
public interface MessageRepository extends MongoRepository<MessageEntity, String> {

    List<MessageEntity> findByRoomCode(String roomCode);
}
