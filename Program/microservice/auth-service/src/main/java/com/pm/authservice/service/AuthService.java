package com.pm.authservice.service;

import com.pm.authservice.dto.AuthResponseDTO;
import com.pm.authservice.dto.CreateRoleRequestDTO;
import com.pm.authservice.dto.LoginRequestDTO;
import com.pm.authservice.dto.RegisterRequestDTO;
import com.pm.authservice.dto.RoleResponseDTO;
import com.pm.authservice.exception.EmailAlreadyExistsException;
// You might want to create a UsernameAlreadyExistsException or reuse a generic one
import com.pm.authservice.exception.PermissionDoesNotExistException;
import com.pm.authservice.exception.RoleAlreadyExistsException;
import com.pm.authservice.exception.RoleDoesNotExistException;
import com.pm.authservice.kafka.KafkaProducer;
import com.pm.authservice.mapper.RegisterMapper;
import com.pm.authservice.model.Permission;
import com.pm.authservice.model.Role;
import com.pm.authservice.model.User;
import com.pm.authservice.repository.PermissionRepository;
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
import com.pm.authservice.exception.UserNotFoundException;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
public class AuthService {
    private final UserService userService;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PermissionRepository permissionRepository;
    private final KafkaProducer kafkaProducer;
    private final PasswordResetService passwordResetService;

    private static final Pattern WHITESPACE = Pattern.compile("\\s+");

    public AuthService(UserService userService,
                       PasswordEncoder passwordEncoder,
                       JwtUtil jwtUtil,
                       UserRepository userRepository,
                       KafkaProducer kafkaProducer,
                       RoleRepository roleRepository,
                       PermissionRepository permissionRepository,
                       PasswordResetService passwordResetService) {
        this.roleRepository = roleRepository;
        this.permissionRepository = permissionRepository;
        this.userService = userService;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
        this.userRepository = userRepository;
        this.kafkaProducer = kafkaProducer;
        this.passwordResetService = passwordResetService;
    }

    @Transactional
    public ResponseEntity<AuthResponseDTO> register(RegisterRequestDTO registerRequestDTO) {
        // Check Email
        if (userRepository.existsByEmail(registerRequestDTO.getEmail())) {
            throw new EmailAlreadyExistsException(
                    "A user with this email already exists " + registerRequestDTO.getEmail()
            );
        }

        User user = RegisterMapper.toModel(registerRequestDTO, passwordEncoder);

        // --- GENERATE USERNAME LOGIC ---
        // Prefer first/last if provided, otherwise fall back to email local-part.
        String firstName = registerRequestDTO.getFirstName();
        String lastName = registerRequestDTO.getLastName();
        boolean hasFirst = firstName != null && !firstName.trim().isEmpty();
        boolean hasLast = lastName != null && !lastName.trim().isEmpty();
        String rawName;
        if (hasFirst || hasLast) {
            String safeFirst = hasFirst ? firstName.trim() : "user";
            String safeLast = hasLast ? lastName.trim() : "unknown";
            rawName = safeFirst + "." + safeLast;
        } else {
            String email = registerRequestDTO.getEmail();
            int at = email == null ? -1 : email.indexOf('@');
            rawName = at > 0 ? email.substring(0, at) : "user";
        }
        String generatedUsernameBase = normalizeUsername(rawName);
        String generatedUsername = ensureUniqueUsername(generatedUsernameBase);
        user.setUsername(generatedUsername);
        // -------------------------------

        Role userRole = roleRepository.findByName("USER")
                .orElseThrow(() -> new RoleDoesNotExistException("USER role is missing seed it first"));
        user.setRoles(List.of(userRole));

        User newUser = userRepository.save(user);
        kafkaProducer.sendEvent(newUser);

        String accessToken = accessToken(newUser);
        String refreshToken = refreshToken(newUser);

        // NOTE: We return the generated username in the response message or DTO so the user knows what it is
        AuthResponseDTO authResponseDTO = authResponseDTO(newUser.getId().toString(), newUser.getEmail());
        authResponseDTO.setUsername(newUser.getUsername());
        authResponseDTO.setMessage("Registration successful. Your username is: " + newUser.getUsername());

        ResponseCookie responseRefreshCookie = responseRefreshCookie(refreshToken);
        ResponseCookie responseAccessCookie = responseAccessCookie(accessToken);

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, responseRefreshCookie.toString())
                .header(HttpHeaders.SET_COOKIE, responseAccessCookie.toString())
                .body(authResponseDTO);
    }

    public ResponseEntity<AuthResponseDTO> authenticate(LoginRequestDTO loginRequestDTO) {
        // Update: findByUsername instead of findByEmail
        return userService.findByUsername(loginRequestDTO.getUsername())
                .filter(user -> passwordEncoder.matches(loginRequestDTO.getPassword(), user.getPassword()))
                .map(user -> {
                    String accessToken = accessToken(user);
                    String refreshToken = refreshToken(user);

                    AuthResponseDTO authResponseDTO = authResponseDTO(user.getId().toString(), user.getEmail());
                    authResponseDTO.setUsername(user.getUsername());

                    if (user.isMustChangePassword()) {
                        authResponseDTO.setMustChangePassword(true);
                        passwordResetService.issueResetToken(user).ifPresent(issued -> {
                            authResponseDTO.setPasswordResetToken(issued.getToken());
                        });
                    } else {
                        authResponseDTO.setMustChangePassword(false);
                    }

                    ResponseCookie responseRefreshCookie = responseRefreshCookie(refreshToken);
                    ResponseCookie responseAccessCookie = responseAccessCookie(accessToken);

                    return ResponseEntity.ok()
                            .header(HttpHeaders.SET_COOKIE, responseRefreshCookie.toString())
                            .header(HttpHeaders.SET_COOKIE, responseAccessCookie.toString())
                            .body(authResponseDTO);
                })
                .orElseGet(() -> ResponseEntity.status(HttpStatus.UNAUTHORIZED).build());
    }

    private String ensureUniqueUsername(String baseUsername) {
        String base = normalizeUsername(baseUsername);
        if (!userRepository.existsByUsername(base)) {
            return base;
        }

        for (int i = 2; i <= 9999; i++) {
            String candidate = base + i;
            if (!userRepository.existsByUsername(candidate)) {
                return candidate;
            }
        }

        throw new IllegalStateException("Unable to generate a unique username for base=" + base);
    }

    private static String normalizeUsername(String raw) {
        String s = raw == null ? "" : raw.trim();
        s = WHITESPACE.matcher(s).replaceAll(".");
        s = s.toLowerCase(Locale.ROOT);
        s = s.replaceAll("\\.+", ".");
        s = s.replaceAll("^\\.+|\\.+$", "");
        return s.isBlank() ? "user" : s;
    }

    // ... [Rest of the file remains unchanged: refreshToken, logout, cookies, helper methods] ...
    
    public ResponseEntity<AuthResponseDTO> refreshToken(String refreshToken) {
        try {
            jwtUtil.validateToken(refreshToken);

            String email = jwtUtil.extractEmail(refreshToken);
            String userId = jwtUtil.extractClaims(refreshToken).get("userId", String.class);
            List<Role> roles = jwtUtil.extractRoles(refreshToken);
            List<String> permissions = jwtUtil.extractPermissions(refreshToken);

            String newAccessToken = jwtUtil.generateAccessToken(email, userId, roles, permissions);
            String newRefreshToken = jwtUtil.generateRefreshToken(email, userId, roles, permissions);

            AuthResponseDTO authResponseDTO = authResponseDTO(userId, email);

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

    public AuthResponseDTO authResponseDTO(String userId, String email) {
        AuthResponseDTO authResponseDTO = new AuthResponseDTO();
        authResponseDTO.setMessage("Login successful");
        authResponseDTO.setUserId(userId);
        authResponseDTO.setEmail(email);

        return authResponseDTO;
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

    @Transactional
    public RoleResponseDTO createRole(CreateRoleRequestDTO request) {
        String rawName = request.getName() == null ? "" : request.getName().trim();
        String name = rawName.toUpperCase(Locale.ROOT);
        if (name.isEmpty()) {
            throw new IllegalArgumentException("Role name is required");
        }
        if (roleRepository.findByName(name).isPresent()) {
            throw new RoleAlreadyExistsException("Role already exists " + name);
        }

        Set<String> permissionNames = new LinkedHashSet<>();
        if (request.getPermissions() != null) {
            for (String permission : request.getPermissions()) {
                String normalized = permission == null ? "" : permission.trim().toUpperCase(Locale.ROOT);
                if (!normalized.isEmpty()) {
                    permissionNames.add(normalized);
                }
            }
        }

        if (permissionNames.isEmpty()) {
            throw new PermissionDoesNotExistException("Role must include at least one permission");
        }

        List<Permission> permissions = new ArrayList<>();
        for (String permissionName : permissionNames) {
            Permission permission = permissionRepository.findByName(permissionName)
                    .orElseThrow(() -> new PermissionDoesNotExistException("Permission not found " + permissionName));
            permissions.add(permission);
        }

        Role role = new Role(name, permissions);
        Role saved = roleRepository.save(role);

        RoleResponseDTO response = new RoleResponseDTO();
        response.setId(saved.getId() != null ? saved.getId().toString() : null);
        response.setName(saved.getName());
        response.setPermissions(permissions.stream().map(Permission::getName).toList());
        return response;
    }

    public List<RoleResponseDTO> getRoles() {
        return roleRepository.findAll().stream()
                .map(this::toRoleResponse)
                .sorted(Comparator.comparing(RoleResponseDTO::getName, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    public List<String> getAllPermissionNames() {
        return permissionRepository.findAll().stream()
                .map(Permission::getName)
                .filter(name -> name != null && !name.isBlank())
                .sorted(String.CASE_INSENSITIVE_ORDER)
                .toList();
    }

    private RoleResponseDTO toRoleResponse(Role role) {
        RoleResponseDTO response = new RoleResponseDTO();
        response.setId(role.getId() != null ? role.getId().toString() : null);
        response.setName(role.getName());
        response.setPermissions(role.getPermissions() == null
                ? List.of()
                : role.getPermissions().stream()
                        .map(Permission::getName)
                        .filter(name -> name != null && !name.isBlank())
                        .sorted(String.CASE_INSENSITIVE_ORDER)
                        .toList());
        return response;
    }

    public boolean hasAdminRole(String token) {
        try {
            jwtUtil.validateToken(token);
            return jwtUtil.extractPermissions(token)
                    .stream()
                    .anyMatch(p -> "CAN_ACCESS_ADMIN_DASHBOARD".equalsIgnoreCase(p));
        } catch (JwtException e) {
            return false;
        }
    }
}
