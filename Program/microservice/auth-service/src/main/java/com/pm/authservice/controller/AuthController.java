// src/main/java/com/pm/authservice/controller/AuthController.java
package com.pm.authservice.controller;

import com.pm.authservice.dto.*;
import com.pm.authservice.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.Optional;
import java.util.UUID;

@RestController
//@RequestMapping("/auth")
//@CrossOrigin(origins = "*")
public class AuthController {
    private static final Logger log = LoggerFactory.getLogger(AuthController.class);
    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @Operation(summary = "Register new user and return access token")
    @PostMapping(value = {"/register", "/register/"})
    public ResponseEntity<AuthResponseDTO> register(@Valid @RequestBody RegisterRequestDTO registerRequestDTO) {
        return authService.register(registerRequestDTO);
    }

    @Operation(summary = "Generate access token on user login")
    @PostMapping(value = {"/login", "/login/"})
    public ResponseEntity<AuthResponseDTO> login(@RequestBody LoginRequestDTO loginRequestDTO) {
        return authService.authenticate(loginRequestDTO);
    }

    @Operation(summary = "Generate new access token using refresh token cookie")
    @PostMapping(value = {"/refresh", "/refresh/"})
    public ResponseEntity<AuthResponseDTO> refreshToken(HttpServletRequest request) {
        // Extract refresh token from cookie instead of request body
        String refreshToken = null;
        if (request.getCookies() != null) {
            Optional<Cookie> refreshTokenCookie = Arrays.stream(request.getCookies())
                    .filter(cookie -> "refreshToken".equals(cookie.getName()))
                    .findFirst();

            if (refreshTokenCookie.isPresent()) {
                refreshToken = refreshTokenCookie.get().getValue();
            }
        }

        if (refreshToken == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        return authService.refreshToken(refreshToken);
    }

    @Operation(summary = "Validate Token")
    @GetMapping(value = {"/validate", "/validate/"})
    public ResponseEntity<Void> validateToken(@CookieValue(name = "accessToken", required = false) String accessToken) {
        if (accessToken == null || accessToken.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return authService.validateToken(accessToken)
                ? ResponseEntity.ok().build()
                : ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
    }

    @Operation(summary = "Update User Roles")
    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/admin/users/{id}/roles")
    public ResponseEntity<Void> setUserRoles(@PathVariable("id") UUID userId,
                                             @Valid @RequestBody UpdateUserRequestDTO body) {
        authService.setUserRoles(userId, body.getRoles());
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Logout user by clearing tokens")
    @PostMapping(value = {"/logout", "/logout/"})
    public ResponseEntity<Void> logout() {
        return authService.logout();
    }
}