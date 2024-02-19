package com.example.demo.kafka;

import com.example.demo.model.persistence.model.Message;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

@Service
public class KafkaProducerService {

    private static final org.slf4j.Logger LOGGER = LoggerFactory.getLogger(KafkaProducerService.class);
    private final KafkaTemplate<String, Message> kafkaTemplate;

    @Autowired
    public KafkaProducerService(KafkaProducerConfig kafkaConf) {
        this.kafkaTemplate = kafkaConf.kafkaTemplate();
    }

    public void sendMessage(String kafkaTopic, Message message) {
        try {
            kafkaTemplate.send(kafkaTopic, message).get();
        } catch (Exception ex) {
            LOGGER.error(ex.getMessage(), ex);
        }
    }

    public void sendMessage(String kafkaTopic, String key, Message message) {
        try {
            kafkaTemplate.send(kafkaTopic, key, message).get();
        } catch (Exception ex) {
            LOGGER.error(ex.getMessage(), ex);
        }
    }

}
