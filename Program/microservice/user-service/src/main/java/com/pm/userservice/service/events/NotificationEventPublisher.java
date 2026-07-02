package com.pm.userservice.service.events;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

@Component
public class NotificationEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(NotificationEventPublisher.class);

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;
    private final String topic;

    public NotificationEventPublisher(
            KafkaTemplate<String, String> kafkaTemplate,
            ObjectMapper objectMapper,
            @Value("${notification.events.topic:notification-events}") String topic) {
        this.kafkaTemplate = kafkaTemplate;
        this.objectMapper = objectMapper;
        this.topic = topic;
    }

    public void publishUserCreated(UserCreatedEvent event) {
        try {
            String payload = objectMapper.writeValueAsString(new NotificationEventPayload("USER_CREATED", event.getUserId()));
            kafkaTemplate.send(topic, event.getUserId(), payload);
            log.info("Published notification event type=USER_CREATED userId={}", event.getUserId());
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to serialize UserCreatedEvent", e);
        }
    }

    private record NotificationEventPayload(String eventType, String userId) {
    }
}
