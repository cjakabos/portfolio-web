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
import org.springframework.kafka.listener.ConcurrentMessageListenerContainer;

import java.io.IOException;
import java.io.InputStream;
import java.util.Properties;

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
            return new DefaultKafkaConsumerFactory(props);
        } catch (IOException ex) {
            LOGGER.error(ex.getMessage(), ex);
        }
        return null;
    }

    @Bean
    public KafkaListenerContainerFactory<ConcurrentMessageListenerContainer<String, String>>
            kafkaListenerContainerFactory() {
        ConcurrentKafkaListenerContainerFactory<String, String> factory
                = new ConcurrentKafkaListenerContainerFactory<>();
        factory.setConsumerFactory(consumerFactory());
        return factory;
    }
}
