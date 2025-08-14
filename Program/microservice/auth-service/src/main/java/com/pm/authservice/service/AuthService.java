// src/main/java/com/pm/authservice/service/AuthService.java
package com.pm.authservice.service;

import com.pm.authservice.dto.AuthResponseDTO;
import com.pm.authservice.dto.LoginRequestDTO;
import com.pm.authservice.dto.RegisterRequestDTO;
import com.pm.authservice.exception.EmailAlreadyExistsException;
import com.pm.authservice.exception.RoleDoesNotExistException;
import com.pm.authservice.exception.UserNotFoundException;
import com.pm.authservice.kafka.KafkaProducer;
import com.pm.authservice.mapper.RegisterMapper;
import com.pm.authservice.model.Role;
import com.pm.authservice.model.User;
import com.pm.authservice.repository.RoleRepository;
import com.pm.authservice.repository.UserRepository;
import com.pm.authservice.util.JwtUtil;
import io.jsonwebtoken.JwtException;
import jakarta.transaction.Transactional;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

@Service
public class AuthService {
    private final UserService userService;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final KafkaProducer kafkaProducer;

    public AuthService(UserService userService,
                       PasswordEncoder passwordEncoder,
                       JwtUtil jwtUtil,
                       UserRepository userRepository,
                       KafkaProducer kafkaProducer,
                       RoleRepository roleRepository) {
        this.roleRepository = roleRepository;
        this.userService = userService;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
        this.userRepository = userRepository;
        this.kafkaProducer = kafkaProducer;
    }

    @Transactional
    public AuthResponseDTO register(RegisterRequestDTO registerRequestDTO) {
        if (userRepository.existsByEmail(registerRequestDTO.getEmail())) {
            throw new EmailAlreadyExistsException(
                    "A user with this email already exists " + registerRequestDTO.getEmail()
            );
        }

        // map basics only
        User user = RegisterMapper.toModel(registerRequestDTO, passwordEncoder);

        // always assign USER role on registration
        Role userRole = roleRepository.findByName("USER")
                .orElseThrow(() -> new RoleDoesNotExistException("USER role is missing seed it first"));
        user.setRoles(List.of(userRole));

        // save and emit event
        User newUser = userRepository.save(user);
        kafkaProducer.sendEvent(newUser);

        // include userId claim
        String token = jwtUtil.generateToken(newUser.getEmail(), newUser.getId().toString(), newUser.getRoles());
        return new AuthResponseDTO(token);
    }

    public Optional<String> authenticate(LoginRequestDTO loginRequestDTO){
        return userService.findByEmail(loginRequestDTO.getEmail())
                .filter(user -> passwordEncoder.matches(loginRequestDTO.getPassword(), user.getPassword()))
                .map(user -> jwtUtil.generateToken(user.getEmail(), user.getId().toString(), user.getRoles()));
    }

    public boolean validateToken(String token){
        try {
            jwtUtil.validateToken(token);
            return true;
        } catch (JwtException e){
            return false;
        }
    }

    // admin only roles update
    @Transactional
    public void setUserRoles(UUID userId, List<String> names) {
        User u = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException("User not found"));

        List<Role> roles = names.stream()
                .map(s -> s == null ? "" : s.trim().toUpperCase(Locale.ROOT))
                .filter(s -> !s.isEmpty())
                .distinct()
                .map(n -> roleRepository.findByName(n)
                        .orElseThrow(() -> new RoleDoesNotExistException("Role not found " + n)))
                .toList();

        u.setRoles(roles);
        userRepository.save(u);
    }
}
