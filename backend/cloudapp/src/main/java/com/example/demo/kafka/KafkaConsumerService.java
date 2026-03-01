package com.example.demo.kafka;

import com.example.demo.model.persistence.model.Message;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.support.Acknowledgment;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

/**
 * Added manual acknowledgment — records are only committed after
 * successful WebSocket forwarding.  Failures are handled by the
 * {@link org.springframework.kafka.listener.DefaultErrorHandler} configured
 * in {@link KafkaConsumerConfig}, which retries and then dead-letters.
 */
@Service
public class KafkaConsumerService {

    private static final Logger LOGGER = LoggerFactory.getLogger(KafkaConsumerService.class);

    @Autowired
    SimpMessagingTemplate template;

    @KafkaListener(topics = "${kafka.topic}", groupId = "${kafka.group.id}")
    public void receive(ConsumerRecord<String, Message> record, Acknowledgment ack) {
        LOGGER.info("Received key[{}] msg[{}]", record.key(), record.value());
        try {
            template.convertAndSend(
                    String.format("/topic/group/%s", record.key()),
                    record.value());
            ack.acknowledge();
        } catch (Exception ex) {
            LOGGER.error("Failed to forward message key[{}] to WebSocket: {}",
                    record.key(), ex.getMessage(), ex);
            // Do NOT acknowledge — DefaultErrorHandler will retry, then dead-letter
            throw ex;
        }
    }
}
