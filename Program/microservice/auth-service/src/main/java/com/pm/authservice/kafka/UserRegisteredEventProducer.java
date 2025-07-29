package com.pm.authservice.kafka;

import com.pm.events.user.UserRegisteredEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

@Service
public class UserRegisteredEventProducer{

    private static final Logger LOGGER = LoggerFactory.getLogger(UserRegisteredEventProducer.class);
    private final KafkaTemplate<String, Object> kafkaTemplate;

    public UserRegisteredEventProducer(KafkaTemplate<String, Object> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
    }

    public void sendMessage(UserRegisteredEvent event) {
        LOGGER.info(String.format("Producing message -> %s", event));
        this.kafkaTemplate.send("user-registered-topic", event.getUserId(), event);
    }
}