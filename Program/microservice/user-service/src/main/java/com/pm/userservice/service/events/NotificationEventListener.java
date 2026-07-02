package com.pm.userservice.service.events;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

@Service
public class NotificationEventListener {

    private static final Logger log = LoggerFactory.getLogger(NotificationEventListener.class);
    private final ObjectMapper objectMapper;

    public NotificationEventListener(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @KafkaListener(topics = "notification-events", groupId = "notification-service")
    public void handleNotificationEvent(byte[] event) {
        if (event == null || event.length == 0) {
            log.info("Stub email delivery received empty notification event");
            return;
        }

        try {
            JsonNode payload = objectMapper.readTree(new String(event, StandardCharsets.UTF_8));
            String eventType = payload.path("eventType").asText("UNKNOWN");
            String userId = payload.path("userId").asText("UNKNOWN");
            log.info("Stub email delivery for notification event type={} userId={}", eventType, userId);
        } catch (IOException ex) {
            log.warn("Stub email delivery received unreadable notification event");
        }
    }
}
