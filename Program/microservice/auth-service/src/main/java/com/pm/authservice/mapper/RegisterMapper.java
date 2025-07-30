package com.pm.authservice.mapper;

import com.pm.authservice.dto.AuthResponseDTO;
import com.pm.authservice.dto.RegisterRequestDTO;
import com.pm.authservice.model.User;
import org.springframework.security.crypto.password.PasswordEncoder;



public class RegisterMapper {

    public static User toModel(RegisterRequestDTO registerRequestDTO, PasswordEncoder encoder) {
        User user = new User();
        user.setEmail(registerRequestDTO.getEmail());
        user.setPassword(encoder.encode(registerRequestDTO.getPassword()));
        user.setRole(registerRequestDTO.getRole() == null ? "USER" : registerRequestDTO.getRole());
        return user;
    }
}
