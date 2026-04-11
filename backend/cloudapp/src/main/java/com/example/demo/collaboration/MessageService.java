package com.example.demo.collaboration;

import com.example.demo.model.persistence.MessageEntity;
import com.example.demo.model.persistence.repositories.MessageRepository;
import com.example.demo.kafka.KafkaProducerService;
import com.example.demo.model.persistence.model.Message;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class MessageService implements IMessageService {

    private static final Logger LOGGER = LoggerFactory.getLogger(MessageService.class);

    @Value("${kafka.topic}")
    private String kafkaTopic;
    private final KafkaProducerService kafkaProducer;
    private final MessageRepository repo;

    public MessageService(KafkaProducerService kafkaProducer, MessageRepository repo) {
        this.kafkaProducer = kafkaProducer;
        this.repo = repo;
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
        List<String> ret;
        try {
            ret = repo.findRoomsByUser(username);
            if (ret == null) {
                return Collections.emptyList();
            }
        } catch (Exception ex) {
            LOGGER.error("Failed to look up rooms for username={}", username, ex);
            ret = Collections.emptyList();
        }
        return ret;
    }
}
