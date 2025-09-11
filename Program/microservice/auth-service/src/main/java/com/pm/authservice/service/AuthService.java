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
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
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
    public ResponseEntity<AuthResponseDTO> register(RegisterRequestDTO registerRequestDTO) {
        if (userRepository.existsByEmail(registerRequestDTO.getEmail())) {
            throw new EmailAlreadyExistsException(
                    "A user with this email already exists " + registerRequestDTO.getEmail()
            );
        }
        User user = RegisterMapper.toModel(registerRequestDTO, passwordEncoder);
        Role userRole = roleRepository.findByName("USER")
                .orElseThrow(() -> new RoleDoesNotExistException("USER role is missing seed it first"));
        user.setRoles(List.of(userRole));

        User newUser = userRepository.save(user);
        kafkaProducer.sendEvent(newUser);

        String accessToken = jwtUtil.generateAccessToken(newUser.getEmail(), newUser.getId().toString(), newUser.getRoles());
        String refreshToken = jwtUtil.generateRefreshToken(newUser.getEmail(), newUser.getId().toString(), newUser.getRoles());

        // Create response with user info instead of tokens
        AuthResponseDTO authResponseDTO = new AuthResponseDTO();
        authResponseDTO.setMessage("Registration successful");
        authResponseDTO.setUserId(newUser.getId().toString());
        authResponseDTO.setEmail(newUser.getEmail());

        ResponseCookie responseRefreshCookie = responseRefreshCookie(refreshToken);
        ResponseCookie responseAccessCookie = responseAccessCookie(accessToken);

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, responseRefreshCookie.toString())
                .header(HttpHeaders.SET_COOKIE, responseAccessCookie.toString())
                .body(authResponseDTO);
    }

    public ResponseEntity<AuthResponseDTO> authenticate(LoginRequestDTO loginRequestDTO) {
        return userService.findByEmail(loginRequestDTO.getEmail())
                .filter(user -> passwordEncoder.matches(loginRequestDTO.getPassword(), user.getPassword()))
                .map(user -> {
                    String accessToken = accessToken(user);
                    String refreshToken = refreshToken(user);

                    // Create response with user info instead of tokens
                    AuthResponseDTO authResponseDTO = new AuthResponseDTO();
                    authResponseDTO.setMessage("Login successful");
                    authResponseDTO.setUserId(user.getId().toString());
                    authResponseDTO.setEmail(user.getEmail());

                    ResponseCookie responseRefreshCookie = responseRefreshCookie(refreshToken);
                    ResponseCookie responseAccessCookie = responseAccessCookie(accessToken);

                    return ResponseEntity.ok()
                            .header(HttpHeaders.SET_COOKIE, responseRefreshCookie.toString())
                            .header(HttpHeaders.SET_COOKIE, responseAccessCookie.toString())
                            .body(authResponseDTO);
                })
                .orElseGet(() -> ResponseEntity.status(HttpStatus.UNAUTHORIZED).build());
    }

    public ResponseEntity<AuthResponseDTO> refreshToken(String refreshToken) {
        try {
            jwtUtil.validateToken(refreshToken);

            String email = jwtUtil.extractEmail(refreshToken);
            String userId = jwtUtil.extractClaims(refreshToken).get("userId", String.class);
            List<Role> roles = jwtUtil.extractRoles(refreshToken);

            String newAccessToken = jwtUtil.generateAccessToken(email, userId, roles);
            String newRefreshToken = jwtUtil.generateRefreshToken(email, userId, roles);

            // Create response with user info
            AuthResponseDTO authResponseDTO = new AuthResponseDTO();
            authResponseDTO.setMessage("Token refreshed successfully");
            authResponseDTO.setUserId(userId);
            authResponseDTO.setEmail(email);

            ResponseCookie refreshTokenCookie = responseRefreshCookie(newRefreshToken);
            ResponseCookie accessTokenCookie = responseAccessCookie(newAccessToken);

            return ResponseEntity.ok()
                    .header(HttpHeaders.SET_COOKIE, refreshTokenCookie.toString())
                    .header(HttpHeaders.SET_COOKIE, accessTokenCookie.toString())
                    .body(authResponseDTO);
        } catch (JwtException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
    }

    public ResponseEntity<Void> logout() {
        ResponseCookie refreshTokenCookie = ResponseCookie.from("refreshToken", "")
                .httpOnly(true)
                .secure(true)
                .sameSite("Strict")
                .path("/auth/refresh")
                .maxAge(0)
                .build();

        ResponseCookie accessTokenCookie = ResponseCookie.from("accessToken", "")
                .httpOnly(true)
                .secure(true)
                .sameSite("Strict")
                .path("/")
                .maxAge(0)
                .build();

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, refreshTokenCookie.toString())
                .header(HttpHeaders.SET_COOKIE, accessTokenCookie.toString())
                .build();
    }

    public ResponseCookie responseRefreshCookie(String refreshToken) {
        return ResponseCookie.from("refreshToken", refreshToken)
                .httpOnly(true)
                .secure(true)
                .sameSite("Strict")
                .path("/")
                .maxAge(7 * 24 * 60 * 60)
                .build();
    }

    public ResponseCookie responseAccessCookie(String accessToken) {
        return ResponseCookie.from("accessToken", accessToken)
                .httpOnly(true)
                .secure(true)
                .sameSite("Strict")
                .path("/")
                .maxAge(15 * 60)
                .build();
    }

    public String accessToken(User user){
        return jwtUtil.generateAccessToken(user.getEmail(), user.getId().toString(), user.getRoles());
    }

    public String refreshToken(User user){
        return jwtUtil.generateRefreshToken(user.getEmail(), user.getId().toString(), user.getRoles());
    }

    public boolean validateToken(String token){
        try {
            jwtUtil.validateToken(token);
            return true;
        } catch (JwtException e){
            return false;
        }
    }

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
