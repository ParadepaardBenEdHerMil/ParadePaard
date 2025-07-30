package com.pm.authservice.service;

import com.pm.authservice.dto.AuthResponseDTO;
import com.pm.authservice.dto.LoginRequestDTO;
import com.pm.authservice.dto.RegisterRequestDTO;
import com.pm.authservice.exception.EmailAlreadyExistsException;
import com.pm.authservice.kafka.KafkaProducer;

import com.pm.authservice.mapper.RegisterMapper;
import com.pm.authservice.model.User;
import com.pm.authservice.repository.UserRepository;
import com.pm.authservice.util.JwtUtil;
import user.events.UserRegisteredEvent;
import io.jsonwebtoken.JwtException;
import jakarta.transaction.Transactional;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class AuthService {
    private final UserService userService;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final UserRepository userRepository;
    private final KafkaProducer kafkaProducer;

    public AuthService(UserService userService, PasswordEncoder passwordEncoder,
                       JwtUtil jwtUtil, UserRepository userRepository, KafkaProducer kafkaProducer){
        this.userService = userService;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
        this.userRepository = userRepository;
        this.kafkaProducer = kafkaProducer;
    }

    @Transactional
    public AuthResponseDTO register(RegisterRequestDTO registerRequestDTO) {
        if (userRepository.existsByEmail(registerRequestDTO.getEmail())) {
            throw new EmailAlreadyExistsException("A patient with this email already exists" + registerRequestDTO.getEmail());
        }

        User newUser = userRepository.save(RegisterMapper.toModel(registerRequestDTO, passwordEncoder));

        kafkaProducer.sendEvent(newUser);

        String token = jwtUtil.generateToken(newUser.getEmail(), newUser.getRole());
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