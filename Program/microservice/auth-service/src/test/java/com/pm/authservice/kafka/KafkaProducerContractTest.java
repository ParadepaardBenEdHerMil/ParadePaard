package com.pm.authservice.kafka;

import com.pm.authservice.model.Company;
import com.pm.authservice.model.User;
import com.pm.authservice.repository.CompanyRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.kafka.core.KafkaTemplate;
import user.events.UserRegisteredEvent;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class KafkaProducerContractTest {

    @SuppressWarnings("unchecked")
    private final KafkaTemplate<String, byte[]> kafkaTemplate = mock(KafkaTemplate.class);
    private final CompanyRepository companyRepository = mock(CompanyRepository.class);

    @Test
    void sendEventPublishesExpectedUserRegisteredEventContract() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID companyId = UUID.randomUUID();

        User user = new User();
        user.setId(userId);
        user.setEmail("alex@example.com");
        user.setCompanyId(companyId);

        Company company = new Company();
        company.setId(companyId);
        company.setName("Acme Bar");
        when(companyRepository.findById(companyId)).thenReturn(Optional.of(company));

        KafkaProducer producer = new KafkaProducer(kafkaTemplate, companyRepository);

        producer.sendEvent(user);

        ArgumentCaptor<byte[]> payloadCaptor = ArgumentCaptor.forClass(byte[].class);
        verify(kafkaTemplate).send(org.mockito.ArgumentMatchers.eq("user"), payloadCaptor.capture());

        UserRegisteredEvent event = UserRegisteredEvent.parseFrom(payloadCaptor.getValue());
        assertThat(event.getUserId()).isEqualTo(userId.toString());
        assertThat(event.getEmail()).isEqualTo("alex@example.com");
        assertThat(event.getCompanyId()).isEqualTo(companyId.toString());
        assertThat(event.getCompanyName()).isEqualTo("Acme Bar");
        assertThat(event.getEventType()).isEqualTo("USER_CREATED");
    }
}
