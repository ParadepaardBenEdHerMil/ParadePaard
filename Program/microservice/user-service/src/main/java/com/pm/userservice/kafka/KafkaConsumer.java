package com.pm.userservice.kafka;

import com.pm.userservice.mapper.UserMapper;
import com.pm.userservice.model.Company;
import com.pm.userservice.model.User;
import com.pm.userservice.repository.CompanyRepository;
import com.pm.userservice.repository.UserRepository;
import jakarta.transaction.Transactional;
import user.events.UserRegisteredEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.kafka.annotation.KafkaListener;
import com.google.protobuf.InvalidProtocolBufferException;

@Service
public class KafkaConsumer {
    
    private final UserRepository userRepository;
    private final CompanyRepository companyRepository;
    private static final Logger log = LoggerFactory.getLogger(KafkaConsumer.class);
    
    public KafkaConsumer(UserRepository userRepository, CompanyRepository companyRepository){
        this.userRepository = userRepository;
        this.companyRepository = companyRepository;
    }

    @Transactional
    @KafkaListener(topics = "user", groupId = "user-service")
    public void consumeEvent(byte[] event){
        try{
            UserRegisteredEvent userRegisteredEvent = UserRegisteredEvent.parseFrom(event);

            // Use the mapper to convert the event to a User entity
            User user = UserMapper.toModelUserRegisteredEvent(userRegisteredEvent);

            if (user != null) {
                if (userRepository.existsById(user.getUserId())) {
                    log.info("User already exists with ID: {}", user.getUserId());
                    return;
                }
                if (user.getCompanyId() != null && companyRepository.findById(user.getCompanyId()).isEmpty()) {
                    Company company = new Company();
                    company.setId(user.getCompanyId());
                    company.setName(uniqueCompanyName(userRegisteredEvent.getCompanyName(), user.getCompanyId()));
                    companyRepository.save(company);
                }
                User newUser = userRepository.save(user);
                log.info("Saved new user with ID: {}", newUser.getUserId());
            }

        } catch (InvalidProtocolBufferException e){
            log.error("Error deserializing event: {}", e.getMessage());
        }
    }

    /**
     * companies.name is UNIQUE and NOT NULL, so the company stub created for a newly
     * registered user must get a unique, non-null name. Previously every stub was named
     * the literal "Company", so the second distinct company to register a user hit a
     * duplicate-key violation that failed the event and broke user propagation for every
     * further company. Prefer the real company name carried on the event; if it is blank
     * or already taken, fall back to a name derived from the (unique) company id. The real
     * name is set later during company onboarding.
     */
    private String uniqueCompanyName(String desiredName, java.util.UUID companyId) {
        if (desiredName != null && !desiredName.isBlank()
                && companyRepository.findByName(desiredName).isEmpty()) {
            return desiredName;
        }
        return "company-" + companyId;
    }
}
