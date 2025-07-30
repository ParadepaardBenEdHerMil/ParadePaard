package com.pm.authservice.kafka;

import com.pm.authservice.model.User;
import user.events.UserRegisteredEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

@Service
public class KafkaProducer {
    private static final Logger log = LoggerFactory.getLogger(KafkaProducer.class);
    private final KafkaTemplate<String, byte[]> kafkaTemplate;
    public KafkaProducer(KafkaTemplate<String, byte[]> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
    }

    public void sendEvent(User user){
        UserRegisteredEvent event = UserRegisteredEvent.newBuilder()
                .setUserId(user.getId().toString())
                .setEmail(user.getEmail())
                .setRole(user.getRole())
                .setEventType("USER_CREATED")
                .build();
        try{
            kafkaTemplate.send("user", event.toByteArray());
        } catch (Exception e){
            log.error("Error sending USER_CREATED event to kafka: {}", e.getMessage());
        }
    }
}
