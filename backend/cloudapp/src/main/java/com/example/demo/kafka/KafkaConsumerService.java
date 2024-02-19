package com.example.demo.kafka;

import com.example.demo.model.persistence.model.Message;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

@Service
public class KafkaConsumerService {

    private static final Logger LOGGER = LoggerFactory.getLogger(KafkaConsumerService.class);

    @Autowired
    SimpMessagingTemplate template;

    @KafkaListener(topics = "${kafka.topic}", groupId = "${kafka.group.id}")
    public void receive(ConsumerRecord<String, Message> record) {
        LOGGER.info(String.format("received key[%s] msg[%s]",
                record.key(),
                record.value()));
        template.convertAndSend(
                String.format("/topic/group/%s",
                record.key()),
                record.value());
    }
}
