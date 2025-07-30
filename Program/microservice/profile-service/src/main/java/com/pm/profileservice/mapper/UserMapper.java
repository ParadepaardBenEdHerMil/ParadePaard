package com.pm.profileservice.mapper;

import com.pm.profileservice.dto.UserRequestDTO;
import com.pm.profileservice.model.User;
import user.events.UserRegisteredEvent;

import java.time.LocalDate;
import java.util.UUID;

public class UserMapper {
    public static User toModel(UserRequestDTO userRequestDTO){
        // Implementation to map from DTO to User can be added here
        return new User();
    }

    public static User toModel(UserRegisteredEvent event) {
        if (event == null) {
            return null;
        }

        User user = new User();
        user.setId(UUID.fromString(event.getUserId()));
        user.setEmail(event.getEmail());
        user.setRole(event.getRole());
        user.setRegisteredDate(LocalDate.now());

        return user;
    }
}