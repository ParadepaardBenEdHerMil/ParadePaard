package com.pm.authservice.kafka;

import com.pm.authservice.model.User;
import com.pm.authservice.repository.CompanyRepository;
import user.events.UserRegisteredEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

@Service
public class KafkaProducer {
    private static final Logger log = LoggerFactory.getLogger(KafkaProducer.class);
    private final KafkaTemplate<String, byte[]> kafkaTemplate;
    private final CompanyRepository companyRepository;
    public KafkaProducer(KafkaTemplate<String, byte[]> kafkaTemplate, CompanyRepository companyRepository) {
        this.kafkaTemplate = kafkaTemplate;
        this.companyRepository = companyRepository;
    }

    public void sendEvent(User user){
        // Carry the company name so the consumer (user-service) can create the company
        // stub with its real, unique name. Company names are unique in auth-service, so
        // this also stops two different companies from colliding on the consumer side.
        String companyName = "";
        if (user.getCompanyId() != null) {
            companyName = companyRepository.findById(user.getCompanyId())
                    .map(com.pm.authservice.model.Company::getName)
                    .orElse("");
        }
        UserRegisteredEvent event = UserRegisteredEvent.newBuilder()
                .setUserId(user.getId().toString())
                .setEmail(user.getEmail())
                .setCompanyId(user.getCompanyId() != null ? user.getCompanyId().toString() : "")
                .setCompanyName(companyName != null ? companyName : "")
                //.setRole(user.getRoles())
                .setEventType("USER_CREATED")
                .build();
        try{
            kafkaTemplate.send("user", event.toByteArray());
        } catch (Exception e){
            log.error("Error sending USER_CREATED event to kafka: {}", e.getMessage());
        }
    }
}
