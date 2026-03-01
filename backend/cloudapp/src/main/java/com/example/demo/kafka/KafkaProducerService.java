package com.example.demo.kafka;

import com.example.demo.model.persistence.model.Message;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

/**
 * Replaced blocking {@code .get()} with async {@code .whenComplete()}
 * callback.  Failures are logged at ERROR level with partition/offset context
 * instead of silently swallowed.
 */
@Service
public class KafkaProducerService {

    private static final Logger LOGGER = LoggerFactory.getLogger(KafkaProducerService.class);
    private final KafkaTemplate<String, Message> kafkaTemplate;

    @Autowired
    public KafkaProducerService(KafkaTemplate<String, Message> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
    }

    public void sendMessage(String kafkaTopic, Message message) {
        kafkaTemplate.send(kafkaTopic, message)
                .whenComplete((result, ex) -> {
                    if (ex != null) {
                        LOGGER.error("Failed to send message to topic [{}]: {}",
                                kafkaTopic, ex.getMessage(), ex);
                    } else {
                        LOGGER.debug("Sent message to topic [{}] partition [{}] offset [{}]",
                                kafkaTopic,
                                result.getRecordMetadata().partition(),
                                result.getRecordMetadata().offset());
                    }
                });
    }

    public void sendMessage(String kafkaTopic, String key, Message message) {
        kafkaTemplate.send(kafkaTopic, key, message)
                .whenComplete((result, ex) -> {
                    if (ex != null) {
                        LOGGER.error("Failed to send message key [{}] to topic [{}]: {}",
                                key, kafkaTopic, ex.getMessage(), ex);
                    } else {
                        LOGGER.debug("Sent message key [{}] to topic [{}] partition [{}] offset [{}]",
                                key, kafkaTopic,
                                result.getRecordMetadata().partition(),
                                result.getRecordMetadata().offset());
                    }
                });
    }
}
