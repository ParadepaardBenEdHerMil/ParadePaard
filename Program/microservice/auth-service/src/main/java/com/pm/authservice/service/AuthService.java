package com.pm.authservice.service;

import com.pm.authservice.dto.AuthResponseDTO;
import com.pm.authservice.dto.LoginRequestDTO;
import com.pm.authservice.dto.RegisterRequestDTO;
import com.pm.authservice.kafka.UserRegisteredEventProducer;

import com.pm.authservice.model.User;
import com.pm.authservice.util.JwtUtil;
import com.pm.events.user.UserRegisteredEvent;
import io.jsonwebtoken.JwtException;
import jakarta.transaction.Transactional;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Optional;
import java.util.UUID;

@Service
public class AuthService {
    private final UserService userService;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final UserRegisteredEventProducer userRegisteredEventProducer;

    public AuthService(UserService userService, PasswordEncoder passwordEncoder, JwtUtil jwtUtil, UserRegisteredEventProducer userRegisteredEventProducer){
        this.userService = userService;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
        this.userRegisteredEventProducer = userRegisteredEventProducer;
    }

    @Transactional
    public AuthResponseDTO register(RegisterRequestDTO registerRequestDTO) {

        if (userService.findByEmail(registerRequestDTO.getEmail()).isPresent()) {
            throw new IllegalStateException("email already taken");
        }

        User user = new User();
        user.setEmail(registerRequestDTO.getEmail());
        user.setPassword(passwordEncoder.encode(registerRequestDTO.getPassword()));
        user.setRole(registerRequestDTO.getRole() == null ? "USER" : registerRequestDTO.getRole());

        userService.save(user);
        UserRegisteredEvent event = UserRegisteredEvent.newBuilder()
                .setUserId(user.getId().toString())
                .setEmail(user.getEmail())
                .build();
        userRegisteredEventProducer.sendMessage(event);


        String token = jwtUtil.generateToken(user.getEmail(), user.getRole());
        return new AuthResponseDTO(token);
    }

    public Optional<String> authenticate (LoginRequestDTO loginRequestDTO){
        Optional<String> token = userService.findByEmail(loginRequestDTO.getEmail())
                .filter(u -> passwordEncoder.matches(loginRequestDTO.getPassword(), u.getPassword()))
                .map(u -> jwtUtil.generateToken(u.getEmail(), u.getRole()));
        return token;
    }

    public boolean validateToken(String token){
        try {
            jwtUtil.validateToken(token);
            return true;
        } catch (JwtException e){
            return false;
        }
    }
}