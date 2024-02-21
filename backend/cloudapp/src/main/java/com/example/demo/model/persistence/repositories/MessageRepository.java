package com.example.demo.model.persistence.repositories;

import java.util.List;

import com.example.demo.model.persistence.MessageEntity;
import org.springframework.data.mongodb.repository.Aggregation;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;


@Repository
public interface MessageRepository extends MongoRepository<MessageEntity, String> {

    List<MessageEntity> findByRoomCode(String roomCode);

    @Aggregation(pipeline= {
            "{\"$match\": { \"sender\" : ?0}}",
            "{\"$group\": { \"_id\": \"$roomCode\"}}"
    })
    List<String> findRoomsByUser(String sender);
}
