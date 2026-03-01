package com.example.demo.kafka;

import com.example.demo.model.persistence.model.Message;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.core.DefaultKafkaProducerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.core.ProducerFactory;

import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.Properties;

@Configuration
public class KafkaProducerConfig {

    private static final Logger LOGGER = LoggerFactory.getLogger(KafkaProducerConfig.class);

    @Value("${kafka.config.producer}")
    private String producerConfigFilePath;

    @Value("${spring.kafka.producer.bootstrap-servers}")
    private String producerBootStrapServers;

    /**
     * Exposed as a @Bean so that it can be injected into
     * {@link KafkaProducerService} and the DLQ
     * {@link org.springframework.kafka.listener.DeadLetterPublishingRecoverer}.
     */
    @Bean
    public KafkaTemplate<String, Message> kafkaTemplate() {
        try {
            Properties props = new Properties();
            try (InputStream input = getClass().getClassLoader()
                    .getResourceAsStream(producerConfigFilePath)) {
                props.load(input);
            }
            props.setProperty("bootstrap.servers", producerBootStrapServers);
            Map<String, Object> configMap = new HashMap<>();
            props.forEach((k, v) -> configMap.put(k.toString(), v));
            ProducerFactory<String, Message> producerFactory
                    = new DefaultKafkaProducerFactory<>(configMap);
            return new KafkaTemplate<>(producerFactory);
        } catch (IOException ex) {
            LOGGER.error("Failed to create KafkaTemplate: {}", ex.getMessage(), ex);
            throw new IllegalStateException("Cannot initialize Kafka producer", ex);
        }
    }
}
