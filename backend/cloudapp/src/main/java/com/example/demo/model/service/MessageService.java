package com.example.demo.model.service;

import com.example.demo.model.persistence.MessageEntity;
import com.example.demo.model.persistence.User;
import com.example.demo.model.persistence.model.ECode;
import com.example.demo.model.persistence.repositories.MessageRepository;
import com.example.demo.kafka.KafkaProducerService;
import com.example.demo.model.persistence.model.Message;
import com.example.demo.model.service.inf.IMessageService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.util.Pair;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@Service
public class MessageService implements IMessageService {

    @Value("${kafka.topic}")
    private String kafkaTopic;
    private final KafkaProducerService kafkaProducer;

    @Autowired
    private MessageRepository repo;

    @Autowired
    public MessageService(KafkaProducerService kafkaProducer) {
        this.kafkaProducer = kafkaProducer;
    }

    @Override
    public void sendMessage(String roomCode, Message msg) {
        kafkaProducer.sendMessage(kafkaTopic, roomCode, msg);
        MessageEntity entity = new MessageEntity();
        entity.setRoomCode(roomCode);
        entity.setSender(msg.getSender());
        entity.setContent(msg.getContent());
        entity.setTimestamp(msg.getTimestamp());
        repo.save(entity);
    }

    @Override
    public List<String> findRoomsByUser(String username) {
        List<String>  ret;
        try {
            ret = repo.findRoomsByUser(username);
            if (ret == null) {
                return Collections.singletonList(ECode.NOT_EXISTS_ROOM.toString());
            }
        } catch (Exception ex) {
            ret = Collections.singletonList(ECode.EXCEPTION.toString());
        }
        return ret;
    }
}
