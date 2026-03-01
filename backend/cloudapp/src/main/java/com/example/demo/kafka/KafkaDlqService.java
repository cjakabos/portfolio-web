package com.example.demo.kafka;

import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.common.header.Header;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;

/**
 * Dead-letter topic consumer for observability.
 *
 * Listens on {@code <topic>.DLT} and logs failed records at WARN level
 * with key, value, original topic, and exception metadata extracted from
 * Spring Kafka's DLT headers.  This is a monitoring hook — no retry logic.
 */
@Service
public class KafkaDlqService {

    private static final Logger LOGGER = LoggerFactory.getLogger(KafkaDlqService.class);

    @KafkaListener(topics = "${kafka.topic}.DLT", groupId = "dlq-monitor")
    public void handleDeadLetter(ConsumerRecord<String, ?> record) {
        String originalTopic = headerValue(record, "kafka_dlt-original-topic");
        String exception = headerValue(record, "kafka_dlt-exception-fqcn");
        String exceptionMessage = headerValue(record, "kafka_dlt-exception-message");

        LOGGER.warn("Dead-lettered record — key=[{}] originalTopic=[{}] "
                        + "exception=[{}] message=[{}] value=[{}]",
                record.key(),
                originalTopic,
                exception,
                exceptionMessage,
                record.value());
    }

    private static String headerValue(ConsumerRecord<String, ?> record, String headerKey) {
        Header header = record.headers().lastHeader(headerKey);
        if (header == null) {
            return "N/A";
        }
        return new String(header.value(), StandardCharsets.UTF_8);
    }
}
