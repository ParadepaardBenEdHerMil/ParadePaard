package com.pm.profileservice.kafka;

import com.pm.profileservice.mapper.UserMapper;
import com.pm.profileservice.model.User;
import com.pm.profileservice.repository.UserRepository;
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
    private static final Logger log = LoggerFactory.getLogger(KafkaConsumer.class);
    
    public KafkaConsumer(UserRepository userRepository){
        this.userRepository = userRepository;
    }

    @Transactional
    @KafkaListener(topics = "user", groupId = "profile-service")
    public void consumeEvent(byte[] event){
        try{
            UserRegisteredEvent userRegisteredEvent = UserRegisteredEvent.parseFrom(event);

            // Use the mapper to convert the event to a User entity
            User user = UserMapper.toModel(userRegisteredEvent);

            if (user != null) {
                User newUser = userRepository.save(user);
                log.info("Saved new user with ID: {}", newUser.getId());
            }

        } catch (InvalidProtocolBufferException e){
            log.error("Error deserializing event: {}", e.getMessage());
        }
    }
}