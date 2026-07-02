package com.pm.userservice.service.events;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.kafka.core.KafkaTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

@ExtendWith(OutputCaptureExtension.class)
class NotificationEventPublisherTest {

    @Test
    void publishUserCreatedSendsMinimalPayloadWithoutSensitiveFields(CapturedOutput output) {
        @SuppressWarnings("unchecked")
        KafkaTemplate<String, String> kafkaTemplate = mock(KafkaTemplate.class);
        NotificationEventPublisher publisher =
                new NotificationEventPublisher(kafkaTemplate, new ObjectMapper(), "notification-events");

        UserCreatedEvent event = new UserCreatedEvent();
        event.setUserId("user-123");
        event.setEmail("alex@example.com");
        event.setUsername("alex");
        event.setTemporaryPassword("Temp123!");

        publisher.publishUserCreated(event);

        ArgumentCaptor<String> payloadCaptor = ArgumentCaptor.forClass(String.class);
        verify(kafkaTemplate).send(org.mockito.ArgumentMatchers.eq("notification-events"),
                org.mockito.ArgumentMatchers.eq("user-123"),
                payloadCaptor.capture());

        assertThat(payloadCaptor.getValue())
                .contains("\"eventType\":\"USER_CREATED\"")
                .contains("\"userId\":\"user-123\"")
                .doesNotContain("alex@example.com")
                .doesNotContain("alex")
                .doesNotContain("Temp123!");
        assertThat(output.getOut())
                .contains("Published notification event type=USER_CREATED userId=user-123")
                .doesNotContain("alex@example.com")
                .doesNotContain("Temp123!");
    }
}
