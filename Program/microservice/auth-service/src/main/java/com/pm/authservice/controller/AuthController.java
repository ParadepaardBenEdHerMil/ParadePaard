package com.pm.authservice.controller;

import com.pm.authservice.dto.*;
import com.pm.authservice.service.AuthService;
import com.pm.authservice.service.PasswordResetService;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;
import java.util.UUID;

@RestController
public class AuthController {
    private final AuthService authService;
    private final PasswordResetService passwordResetService;

    public AuthController(AuthService authService, PasswordResetService passwordResetService) {
        this.authService = authService;
        this.passwordResetService = passwordResetService;
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
    public ResponseEntity<AuthResponseDTO> refreshToken(@RequestHeader(HttpHeaders.AUTHORIZATION) String authorizationHeader) {
        if (authorizationHeader == null || !authorizationHeader.startsWith("Bearer ")) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        String refreshToken = authorizationHeader.substring(7);

        return authService.refreshToken(refreshToken);
    }

    @Operation(summary = "Switch the scoped company for a platform admin session")
    @PreAuthorize("hasAuthority('CAN_MANAGE_PLATFORM')")
    @PostMapping("/platform/company-scope")
    public ResponseEntity<AuthResponseDTO> switchPlatformCompanyScope(
            @RequestBody(required = false) PlatformCompanyScopeRequestDTO body,
            Authentication authentication
    ) {
        UUID requestedCompanyId = null;
        if (body != null && body.getCompanyId() != null && !body.getCompanyId().isBlank()) {
            requestedCompanyId = UUID.fromString(body.getCompanyId().trim());
        }
        return authService.switchPlatformCompanyScope(authentication, requestedCompanyId);
    }

    @Operation(summary = "Validate Token")
    @GetMapping({"/validate", "/validate/"})
    public ResponseEntity<Void> validateToken(@RequestHeader(HttpHeaders.AUTHORIZATION) String authorizationHeader) {
        if (authorizationHeader == null || !authorizationHeader.startsWith("Bearer ")) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        String token = authorizationHeader.substring(7);

        boolean valid = authService.validateToken(token);
        return valid
                ? ResponseEntity.ok().build()
                : ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
    }

    @Operation(summary = "Update User Roles")
    @PreAuthorize("hasAuthority('CAN_ASSIGN_ROLES') or hasAuthority('CAN_REMOVE_ROLES')")
    @PutMapping("/admin/users/{id}/roles")
    public ResponseEntity<Void> setUserRoles(@PathVariable("id") UUID userId,
                                             @Valid @RequestBody UpdateUserRequestDTO body,
                                             Authentication authentication) {
        authService.setUserRoles(userId, body.getRoles(), authentication);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Disable user login")
    @PreAuthorize("hasAuthority('CAN_REVIEW_ONBOARDING') or hasAuthority('CAN_MANAGE_USERS')")
    @PutMapping("/admin/users/{id}/disable")
    public ResponseEntity<Void> disableUser(@PathVariable("id") UUID userId) {
        authService.setUserDisabled(userId, true);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Enable user login")
    @PreAuthorize("hasAuthority('CAN_MANAGE_USERS')")
    @PutMapping("/admin/users/{id}/enable")
    public ResponseEntity<Void> enableUser(@PathVariable("id") UUID userId) {
        authService.setUserDisabled(userId, false);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Delete user login credentials")
    @PreAuthorize("hasAuthority('CAN_DELETE_USERS')")
    @DeleteMapping("/admin/users/{id}")
    public ResponseEntity<Void> deleteUserAccount(@PathVariable("id") UUID userId, Authentication authentication) {
        authService.deleteUserAccount(userId, authentication);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Update existing role")
    @PreAuthorize("hasAuthority('CAN_EDIT_ROLES')")
    @PutMapping("/admin/roles/{id}")
    public ResponseEntity<RoleResponseDTO> updateRole(@PathVariable("id") UUID roleId,
                                                      @Valid @RequestBody UpdateRoleRequestDTO body,
                                                      Authentication authentication) {
        return ResponseEntity.ok(authService.updateRole(roleId, body, authentication));
    }

    @Operation(summary = "Delete existing role")
    @PreAuthorize("hasAuthority('CAN_DELETE_ROLES')")
    @DeleteMapping("/admin/roles/{id}")
    public ResponseEntity<Void> deleteRole(@PathVariable("id") UUID roleId, Authentication authentication) {
        authService.deleteRole(roleId, authentication);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Create new role with permissions")
    @PreAuthorize("hasAuthority('CAN_CREATE_ROLE')")
    @PostMapping("/admin/roles")
    public ResponseEntity<RoleResponseDTO> createRole(
            @Valid @RequestBody CreateRoleRequestDTO body,
            Authentication authentication) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.createRole(body, authentication));
    }

    @Operation(summary = "List roles with permissions")
    @PreAuthorize("hasAuthority('CAN_ASSIGN_ROLES') or hasAuthority('CAN_CREATE_ROLE') or hasAuthority('CAN_EDIT_ROLES') or hasAuthority('CAN_REMOVE_ROLES') or hasAuthority('CAN_DELETE_ROLES')")
    @GetMapping("/admin/roles")
    public ResponseEntity<List<RoleResponseDTO>> getRoles(Authentication authentication) {
        return ResponseEntity.ok(authService.getRoles(authentication));
    }

    @Operation(summary = "List user roles")
    @PreAuthorize("hasAuthority('CAN_VIEW_USERS') or hasAuthority('CAN_ASSIGN_ROLES')")
    @GetMapping("/admin/users/roles")
    public ResponseEntity<List<UserRolesResponseDTO>> getUserRoles(
            @RequestParam(value = "ids", required = false) List<UUID> ids,
            Authentication authentication
    ) {
        return ResponseEntity.ok(authService.getUserRoles(ids, authentication));
    }

    @Operation(summary = "List available permissions")
    @PreAuthorize("hasAuthority('CAN_CREATE_ROLE') or hasAuthority('CAN_EDIT_ROLES')")
    @GetMapping("/admin/permissions")
    public ResponseEntity<List<String>> getAllPermissions() {
        return ResponseEntity.ok(authService.getAllPermissionNames());
    }

    @Operation(summary = "Get current user permissions")
    @GetMapping("/permissions")
    public ResponseEntity<List<String>> getMyPermissions(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        List<String> permissions = authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .filter(value -> value != null && !value.isBlank())
                .distinct()
                .sorted(Comparator.comparing(String::toString, String.CASE_INSENSITIVE_ORDER))
                .collect(Collectors.toList());

        return ResponseEntity.ok(permissions);
    }

    @Operation(summary = "Logout user by clearing tokens and revoking refresh tokens server-side")
    @PostMapping(value = {"/logout", "/logout/"})
    public ResponseEntity<Void> logout(
            Authentication authentication,
            @CookieValue(value = "refreshToken", required = false) String refreshToken) {
        return authService.logout(authentication, refreshToken);
    }

    @Operation(summary = "Request a password reset email (always returns 204)")
    @PostMapping(value = {"/forgot-password", "/forgot-password/"})
    public ResponseEntity<Void> forgotPassword(@Valid @RequestBody ForgotPasswordRequestDTO body) {
        return passwordResetService.requestPasswordReset(body.getEmail());
    }

    @Operation(summary = "Reset password using a one-time token")
    @PostMapping(value = {"/reset-password", "/reset-password/"})
    public ResponseEntity<?> resetPassword(@Valid @RequestBody ResetPasswordRequestDTO body) {
        return passwordResetService.resetPassword(body.getToken(), body.getNewPassword());
    }

    @Operation(summary = "Check if user can access admin features")
    @GetMapping("/is-admin")
    public ResponseEntity<Boolean> isAdmin() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        boolean isAdmin = authentication.getAuthorities().stream()
                .anyMatch(grantedAuthority -> grantedAuthority.getAuthority().equals("CAN_ACCESS_ADMIN_DASHBOARD"));

        return ResponseEntity.ok(isAdmin);
    }

}

