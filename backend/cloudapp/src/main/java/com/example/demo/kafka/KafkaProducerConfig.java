package com.example.demo.kafka;

import com.example.demo.model.persistence.model.Message;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.core.DefaultKafkaProducerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.core.ProducerFactory;

import java.io.IOException;
import java.io.InputStream;
import java.util.Properties;

@Configuration
public class KafkaProducerConfig {

    private static final Logger LOGGER = LoggerFactory.getLogger(KafkaProducerConfig.class);

    @Value("${kafka.config.producer}")
    private String producerConfigFilePath;

    @Value("${spring.kafka.producer.bootstrap-servers}")
    private String producerBootStrapServers;

    public KafkaTemplate<String, Message> kafkaTemplate() {
        try {
            Properties props = new Properties();
            try (InputStream input = getClass().getClassLoader()
                    .getResourceAsStream(producerConfigFilePath)) {
                props.load(input);
            }
            props.setProperty("bootstrap.servers", producerBootStrapServers);
            ProducerFactory<String, Message> producerFactory
                    = new DefaultKafkaProducerFactory(props);
            return new KafkaTemplate<>(producerFactory);
        } catch (IOException ex) {
            LOGGER.error(ex.getMessage(), ex);
        }
        return null;
    }
}
