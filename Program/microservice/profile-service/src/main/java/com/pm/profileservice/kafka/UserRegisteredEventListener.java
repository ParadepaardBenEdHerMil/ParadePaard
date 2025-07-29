package com.pm.profileservice.kafka;

import com.pm.events.user.UserRegisteredEvent;
import com.pm.profileservice.model.User;
import com.pm.profileservice.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.UUID;

@Service
public class UserRegisteredEventListener {

    private static final Logger LOGGER = LoggerFactory.getLogger(UserRegisteredEventListener.class);
    
    private final UserRepository userRepository;

    public UserRegisteredEventListener(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @KafkaListener(topics = "user-registered-topic", groupId = "${spring.kafka.consumer.group-id}")
    public void consume(UserRegisteredEvent event) {
        LOGGER.info(String.format("Consumed message -> %s", event));

        // Create a new User profile from the event data
        User userProfile = new User();
        userProfile.setId(UUID.fromString(event.getUserId()));
        userProfile.setEmail(event.getEmail());
        userProfile.setRegisteredDate(LocalDate.now());
        // Set a default role or handle it as needed
        userProfile.setRole("USER");
        
        // Save the new user profile to the profile-service database
        userRepository.save(userProfile);
        LOGGER.info(String.format("Created new user profile for ID: %s", userProfile.getId()));
    }
}