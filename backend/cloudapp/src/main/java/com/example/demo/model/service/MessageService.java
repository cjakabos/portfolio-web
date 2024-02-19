package com.example.demo.model.service;

import com.example.demo.model.persistence.MessageEntity;
import com.example.demo.model.persistence.repositories.MessageRepository;
import com.example.demo.kafka.KafkaProducerService;
import com.example.demo.model.persistence.model.Message;
import com.example.demo.model.service.inf.IMessageService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;


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
}
