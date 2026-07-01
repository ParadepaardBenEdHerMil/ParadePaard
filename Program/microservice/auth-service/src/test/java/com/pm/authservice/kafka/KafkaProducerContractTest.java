package com.pm.authservice.kafka;

import com.pm.authservice.model.User;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.kafka.core.KafkaTemplate;
import user.events.UserRegisteredEvent;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class KafkaProducerContractTest {

    @SuppressWarnings("unchecked")
    private final KafkaTemplate<String, byte[]> kafkaTemplate = mock(KafkaTemplate.class);

    @Test
    void sendEventPublishesExpectedUserRegisteredEventContract() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID companyId = UUID.randomUUID();

        User user = new User();
        user.setId(userId);
        user.setEmail("alex@example.com");
        user.setCompanyId(companyId);

        KafkaProducer producer = new KafkaProducer(kafkaTemplate);

        producer.sendEvent(user);

        ArgumentCaptor<byte[]> payloadCaptor = ArgumentCaptor.forClass(byte[].class);
        verify(kafkaTemplate).send(org.mockito.ArgumentMatchers.eq("user"), payloadCaptor.capture());

        UserRegisteredEvent event = UserRegisteredEvent.parseFrom(payloadCaptor.getValue());
        assertThat(event.getUserId()).isEqualTo(userId.toString());
        assertThat(event.getEmail()).isEqualTo("alex@example.com");
        assertThat(event.getCompanyId()).isEqualTo(companyId.toString());
        assertThat(event.getEventType()).isEqualTo("USER_CREATED");
    }
}
