package com.example.demo.kafka;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.config.KafkaListenerContainerFactory;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.kafka.core.DefaultKafkaConsumerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.listener.CommonErrorHandler;
import org.springframework.kafka.listener.ConcurrentMessageListenerContainer;
import org.springframework.kafka.listener.ContainerProperties;
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.util.backoff.FixedBackOff;

import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.Properties;

/**
 * Switched to manual acknowledgment (AckMode.RECORD) with a
 * {@link DefaultErrorHandler} that retries 3 times (1 s back-off) and
 * publishes failed records to the {@code <topic>.DLT} dead-letter topic.
 */
@Configuration
public class KafkaConsumerConfig {

    private static final Logger LOGGER = LoggerFactory.getLogger(KafkaConsumerConfig.class);

    @Value("${kafka.config.consumer}")
    private String consumerConfigFilePath;

    @Value("${spring.kafka.consumer.bootstrap-servers}")
    private String consumerBootStrapServers;

    @Bean
    public ConsumerFactory<String, String> consumerFactory() {
        try {
            Properties props = new Properties();
            try (InputStream input = getClass().getClassLoader()
                    .getResourceAsStream(consumerConfigFilePath)) {
                props.load(input);
            }
            props.setProperty("bootstrap.servers", consumerBootStrapServers);
            Map<String, Object> configMap = new HashMap<>();
            props.forEach((k, v) -> configMap.put(k.toString(), v));
            return new DefaultKafkaConsumerFactory<>(configMap);
        } catch (IOException ex) {
            LOGGER.error("Failed to create ConsumerFactory: {}", ex.getMessage(), ex);
            throw new IllegalStateException("Cannot initialize Kafka consumer", ex);
        }
    }

    @Bean
    public KafkaListenerContainerFactory<ConcurrentMessageListenerContainer<String, String>>
            kafkaListenerContainerFactory(KafkaTemplate<?, ?> kafkaTemplate) {

        ConcurrentKafkaListenerContainerFactory<String, String> factory
                = new ConcurrentKafkaListenerContainerFactory<>();
        factory.setConsumerFactory(consumerFactory());

        // Manual acknowledgment — commit after each successfully processed record
        factory.getContainerProperties().setAckMode(ContainerProperties.AckMode.RECORD);

        // Dead-letter recoverer: failed records go to <topic>.DLT after retries
        DeadLetterPublishingRecoverer recoverer =
                new DeadLetterPublishingRecoverer(kafkaTemplate);
        // Retry 3 times with 1-second fixed back-off, then dead-letter
        CommonErrorHandler errorHandler = new DefaultErrorHandler(recoverer,
                new FixedBackOff(1000L, 3L));
        factory.setCommonErrorHandler(errorHandler);

        return factory;
    }
}
