package com.pm.authservice.service;

import com.pm.authservice.dto.AuthResponseDTO;
import com.pm.authservice.dto.CreateRoleRequestDTO;
import com.pm.authservice.dto.LoginRequestDTO;
import com.pm.authservice.dto.RegisterRequestDTO;
import com.pm.authservice.dto.RoleResponseDTO;
import com.pm.authservice.dto.UpdateRoleRequestDTO;
import com.pm.authservice.dto.UserRolesResponseDTO;
import com.pm.authservice.exception.EmailAlreadyExistsException;
// You might want to create a UsernameAlreadyExistsException or reuse a generic one
import com.pm.authservice.exception.PermissionDoesNotExistException;
import com.pm.authservice.exception.RoleAlreadyExistsException;
import com.pm.authservice.exception.RoleDoesNotExistException;
import com.pm.authservice.kafka.KafkaProducer;
import com.pm.authservice.mapper.RegisterMapper;
import com.pm.authservice.model.Company;
import com.pm.authservice.model.Permission;
import com.pm.authservice.model.Role;
import com.pm.authservice.model.User;
import com.pm.authservice.repository.CompanyRepository;
import com.pm.authservice.repository.PermissionRepository;
import com.pm.authservice.repository.RoleRepository;
import com.pm.authservice.repository.UserRepository;
import com.pm.authservice.security.AuthUserPrincipal;
import com.pm.authservice.util.JwtUtil;
import io.jsonwebtoken.JwtException;
import jakarta.transaction.Transactional;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
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
    private final CompanyRepository companyRepository;
    private final KafkaProducer kafkaProducer;
    private final PasswordResetService passwordResetService;

    private static final Pattern WHITESPACE = Pattern.compile("\\s+");
    private static final String ADMIN_ROLE_NAME = "ADMIN";
    private static final String USER_ROLE_NAME = "USER";
    private static final List<String> DEFAULT_ADMIN_PERMISSIONS = List.of(
            "CAN_ACCESS_ADMIN_DASHBOARD",
            "CAN_CREATE_ROLE",
            "CAN_ASSIGN_ROLES",
            "CAN_EDIT_ROLES",
            "CAN_REMOVE_ROLES",
            "CAN_DELETE_ROLES",
            "CAN_VIEW_USERS",
            "CAN_MANAGE_USERS",
            "CAN_MANAGE_COMPANY",
            "CAN_ONBOARD_USERS",
            "CAN_VIEW_ALL_LEAVE_REQUESTS",
            "CAN_MANAGE_LEAVE_REQUESTS",
            "CAN_APPROVE_LEAVE_REQUESTS",
            "CAN_REJECT_LEAVE_REQUESTS",
            "CAN_VIEW_CONTRACTS",
            "CAN_VIEW_ONBOARDING_QUEUE",
            "CAN_REVIEW_ONBOARDING",
            "CAN_VIEW_OWN_CONTRACTS",
            "CAN_SIGN_OWN_CONTRACTS",
            "CAN_VIEW_ALL_CONTRACTS",
            "CAN_MANAGE_CONTRACTS",
            "CAN_REVIEW_CONTRACTS",
            "CAN_FINALIZE_CONTRACT",
            "CAN_VIEW_FUNCTIONS",
            "CAN_MANAGE_FUNCTIONS",
            "CAN_VIEW_ALL_TIMESHEETS",
            "CAN_MANAGE_TIMESHEETS",
            "CAN_VIEW_ALL_PAYSLIPS",
            "CAN_REVIEW_PAYSLIPS",
            "CAN_MANAGE_PAYSLIPS"
    );
    private static final List<String> DEFAULT_USER_PERMISSIONS = List.of(
            "CAN_COMPLETE_ONBOARDING",
            "CAN_VIEW_OWN_CONTRACTS",
            "CAN_SIGN_OWN_CONTRACTS",
            "CAN_VIEW_PAYSLIPS",
            "CAN_REPORT_PAYSLIP_ERRORS",
            "CAN_VIEW_OWN_TIMESHEETS"
    );
    private static final Set<String> DEFAULT_USER_PERMISSION_SET = Set.copyOf(DEFAULT_USER_PERMISSIONS);

    public AuthService(UserService userService,
                       PasswordEncoder passwordEncoder,
                       JwtUtil jwtUtil,
                       UserRepository userRepository,
                       KafkaProducer kafkaProducer,
                       RoleRepository roleRepository,
                       PermissionRepository permissionRepository,
                       CompanyRepository companyRepository,
                       PasswordResetService passwordResetService) {
        this.roleRepository = roleRepository;
        this.permissionRepository = permissionRepository;
        this.userService = userService;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
        this.userRepository = userRepository;
        this.kafkaProducer = kafkaProducer;
        this.companyRepository = companyRepository;
        this.passwordResetService = passwordResetService;
    }

    @Transactional
    public ResponseEntity<AuthResponseDTO> register(RegisterRequestDTO registerRequestDTO) {
        Company company = resolveOrCreateCompany(registerRequestDTO);

        // Check Email within the company scope
        if (userRepository.existsByEmailAndCompanyId(registerRequestDTO.getEmail(), company.getId())) {
            throw new EmailAlreadyExistsException(
                    "A user with this email already exists " + registerRequestDTO.getEmail()
            );
        }

        User user = RegisterMapper.toModel(registerRequestDTO, passwordEncoder);
        user.setCompanyId(company.getId());
        ensureDefaultRoles(company.getId());

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

        Role userRole = ensureDefaultUserRole(company.getId());
        user.setRoles(List.of(userRole));

        User newUser = userRepository.save(user);
        kafkaProducer.sendEvent(newUser);

        String accessToken = accessToken(newUser);
        String refreshToken = refreshToken(newUser);

        // NOTE: We return the generated username in the response message or DTO so the user knows what it is
        AuthResponseDTO authResponseDTO = authResponseDTO(
                newUser.getId().toString(),
                newUser.getEmail(),
                newUser.getCompanyId() != null ? newUser.getCompanyId().toString() : null
        );
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
                    User normalizedUser = normalizeBuiltInUserRoles(user);
                    String accessToken = accessToken(normalizedUser);
                    String refreshToken = refreshToken(normalizedUser);

                    AuthResponseDTO authResponseDTO = authResponseDTO(
                            normalizedUser.getId().toString(),
                            normalizedUser.getEmail(),
                            normalizedUser.getCompanyId() != null ? normalizedUser.getCompanyId().toString() : null
                    );
                    authResponseDTO.setUsername(normalizedUser.getUsername());

                    if (normalizedUser.isMustChangePassword()) {
                        authResponseDTO.setMustChangePassword(true);
                        passwordResetService.issueResetToken(normalizedUser).ifPresent(issued -> {
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

    private Company resolveOrCreateCompany(RegisterRequestDTO request) {
        String requestedCompanyId = request.getCompanyId();
        if (requestedCompanyId != null && !requestedCompanyId.isBlank()) {
            UUID companyId = UUID.fromString(requestedCompanyId.trim());
            return companyRepository.findById(companyId)
                    .orElseThrow(() -> new IllegalArgumentException("Company not found"));
        }

        String name = normalizeCompanyName(request);
        return companyRepository.findByName(name)
                .orElseGet(() -> {
                    Company company = new Company();
                    company.setId(UUID.randomUUID());
                    company.setName(name);
                    Company saved = companyRepository.save(company);
                    ensureDefaultRoles(saved.getId());
                    return saved;
                });
    }

    private static String normalizeCompanyName(RegisterRequestDTO request) {
        String raw = request.getCompanyName();
        if (raw != null && !raw.trim().isEmpty()) {
            return raw.trim();
        }
        String email = request.getEmail();
        if (email != null) {
            int at = email.indexOf('@');
            if (at > -1 && at < email.length() - 1) {
                return email.substring(at + 1).trim();
            }
        }
        return "Company";
    }

    private void ensureDefaultRoles(UUID companyId) {
        createRoleIfMissing(companyId, ADMIN_ROLE_NAME, DEFAULT_ADMIN_PERMISSIONS);
        ensureDefaultUserRole(companyId);
    }

    private Role createRoleIfMissing(UUID companyId, String name, List<String> permissions) {
        if (roleRepository.existsByNameAndCompanyId(name, companyId)) {
            return roleRepository.findByNameAndCompanyId(name, companyId).orElse(null);
        }
        List<Permission> permissionEntities = permissions.stream()
                .map(permissionName -> permissionRepository.findByName(permissionName)
                        .orElseThrow(() -> new PermissionDoesNotExistException("Permission not found " + permissionName)))
                .toList();
        Role role = new Role(name, permissionEntities);
        role.setCompanyId(companyId);
        return roleRepository.save(role);
    }

    private Role ensureDefaultUserRole(UUID companyId) {
        Role role = roleRepository.findByNameAndCompanyId(USER_ROLE_NAME, companyId)
                .orElseGet(() -> {
                    Role newRole = new Role(USER_ROLE_NAME, loadPermissions(DEFAULT_USER_PERMISSIONS));
                    newRole.setCompanyId(companyId);
                    return roleRepository.save(newRole);
                });

        if (!hasExactPermissions(role, DEFAULT_USER_PERMISSION_SET)) {
            role.setPermissions(loadPermissions(DEFAULT_USER_PERMISSIONS));
            return roleRepository.save(role);
        }
        return role;
    }

    private User normalizeBuiltInUserRoles(User user) {
        if (user.getRoles() == null || user.getRoles().isEmpty()) {
            return user;
        }

        List<Role> normalizedRoles = new ArrayList<>();
        boolean changed = false;
        for (Role role : user.getRoles()) {
            if (role != null && USER_ROLE_NAME.equalsIgnoreCase(role.getName())) {
                UUID companyId = role.getCompanyId() != null ? role.getCompanyId() : user.getCompanyId();
                Role normalizedRole = ensureDefaultUserRole(companyId);
                normalizedRoles.add(normalizedRole);
                changed = changed || role.getId() == null || !role.getId().equals(normalizedRole.getId());
            } else {
                normalizedRoles.add(role);
            }
        }

        if (!changed) {
            return user;
        }
        user.setRoles(normalizedRoles);
        return userRepository.save(user);
    }

    private List<Permission> loadPermissions(List<String> permissionNames) {
        return permissionNames.stream()
                .map(permissionName -> permissionRepository.findByName(permissionName)
                        .orElseThrow(() -> new PermissionDoesNotExistException("Permission not found " + permissionName)))
                .toList();
    }

    private static boolean hasExactPermissions(Role role, Set<String> expectedPermissions) {
        if (role.getPermissions() == null) {
            return expectedPermissions.isEmpty();
        }
        Set<String> actual = role.getPermissions().stream()
                .map(Permission::getName)
                .filter(name -> name != null && !name.isBlank())
                .collect(java.util.stream.Collectors.toSet());
        return actual.equals(expectedPermissions);
    }

    private static void validateBuiltInRolePermissions(String roleName, Set<String> permissionNames) {
        if (!USER_ROLE_NAME.equalsIgnoreCase(roleName)) {
            return;
        }
        if (!permissionNames.equals(DEFAULT_USER_PERMISSION_SET)) {
            throw new IllegalArgumentException(
                    "The USER role is reserved for employee self-service permissions."
            );
        }
    }

    private User requireAuthenticatedUser(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new IllegalArgumentException("Missing authentication");
        }
        AuthUserPrincipal principal = extractPrincipal(authentication);
        if (principal != null && principal.getUserId() != null) {
            return userRepository.findById(principal.getUserId())
                    .orElseThrow(() -> new UserNotFoundException("User not found"));
        }
        String email = authentication.getName();
        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException("Missing user identity");
        }
        if (principal != null && principal.getCompanyId() != null) {
            return userRepository.findByEmailAndCompanyId(email, principal.getCompanyId())
                    .orElseThrow(() -> new UserNotFoundException("User not found"));
        }
        return userRepository.findAllByEmail(email).stream()
                .findFirst()
                .orElseThrow(() -> new UserNotFoundException("User not found"));
    }

    private UUID requireCompanyId(Authentication authentication) {
        AuthUserPrincipal principal = extractPrincipal(authentication);
        if (principal != null && principal.getCompanyId() != null) {
            return principal.getCompanyId();
        }
        User user = requireAuthenticatedUser(authentication);
        if (user.getCompanyId() == null) {
            throw new IllegalStateException("User is missing company assignment");
        }
        return user.getCompanyId();
    }

    private static AuthUserPrincipal extractPrincipal(Authentication authentication) {
        if (authentication == null) {
            return null;
        }
        Object principal = authentication.getPrincipal();
        if (principal instanceof AuthUserPrincipal authUserPrincipal) {
            return authUserPrincipal;
        }
        return null;
    }

    // ... [Rest of the file remains unchanged: refreshToken, logout, cookies, helper methods] ...
    
    public ResponseEntity<AuthResponseDTO> refreshToken(String refreshToken) {
        try {
            jwtUtil.validateToken(refreshToken);

            String userId = jwtUtil.extractClaims(refreshToken).get("userId", String.class);
            User user = userRepository.findById(UUID.fromString(userId))
                    .map(this::normalizeBuiltInUserRoles)
                    .orElseThrow(() -> new UserNotFoundException("User not found"));

            String companyId = user.getCompanyId() != null ? user.getCompanyId().toString() : null;
            String newAccessToken = accessToken(user);
            String newRefreshToken = refreshToken(user);

            AuthResponseDTO authResponseDTO = authResponseDTO(user.getId().toString(), user.getEmail(), companyId);

            ResponseCookie refreshTokenCookie = responseRefreshCookie(newRefreshToken);
            ResponseCookie accessTokenCookie = responseAccessCookie(newAccessToken);

            return ResponseEntity.ok()
                    .header(HttpHeaders.SET_COOKIE, refreshTokenCookie.toString())
                    .header(HttpHeaders.SET_COOKIE, accessTokenCookie.toString())
                    .body(authResponseDTO);
        } catch (JwtException | IllegalArgumentException | UserNotFoundException e) {
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

    public AuthResponseDTO authResponseDTO(String userId, String email, String companyId) {
        AuthResponseDTO authResponseDTO = new AuthResponseDTO();
        authResponseDTO.setMessage("Login successful");
        authResponseDTO.setUserId(userId);
        authResponseDTO.setEmail(email);
        authResponseDTO.setCompanyId(companyId);

        return authResponseDTO;
    }

    public String accessToken(User user){
        String companyId = user.getCompanyId() != null ? user.getCompanyId().toString() : null;
        return jwtUtil.generateAccessToken(user.getEmail(), user.getId().toString(), user.getRoles(), companyId);
    }

    public String refreshToken(User user){
        String companyId = user.getCompanyId() != null ? user.getCompanyId().toString() : null;
        return jwtUtil.generateRefreshToken(user.getEmail(), user.getId().toString(), user.getRoles(), companyId);
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
    public void setUserRoles(UUID userId, List<String> names, Authentication authentication) {
        UUID companyId = requireCompanyId(authentication);
        User u = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException("User not found"));
        if (u.getCompanyId() == null || !u.getCompanyId().equals(companyId)) {
            throw new UserNotFoundException("User not found");
        }

        List<Role> roles = names.stream()
                .map(s -> s == null ? "" : s.trim().toUpperCase(Locale.ROOT))
                .filter(s -> !s.isEmpty())
                .distinct()
                .map(n -> roleRepository.findByNameAndCompanyId(n, companyId)
                        .orElseThrow(() -> new RoleDoesNotExistException("Role not found " + n)))
                .collect(java.util.stream.Collectors.toCollection(java.util.ArrayList::new));

        u.setRoles(roles);
        userRepository.save(u);
    }

    @Transactional
    public RoleResponseDTO createRole(CreateRoleRequestDTO request, Authentication authentication) {
        UUID companyId = requireCompanyId(authentication);
        String rawName = request.getName() == null ? "" : request.getName().trim();
        String name = rawName.toUpperCase(Locale.ROOT);
        if (name.isEmpty()) {
            throw new IllegalArgumentException("Role name is required");
        }
        if (roleRepository.findByNameAndCompanyId(name, companyId).isPresent()) {
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
        validateBuiltInRolePermissions(name, permissionNames);

        List<Permission> permissions = new ArrayList<>();
        for (String permissionName : permissionNames) {
            Permission permission = permissionRepository.findByName(permissionName)
                    .orElseThrow(() -> new PermissionDoesNotExistException("Permission not found " + permissionName));
            permissions.add(permission);
        }

        Role role = new Role(name, permissions);
        role.setCompanyId(companyId);
        role.setColor(normalizeColor(request.getColor()));
        Role saved = roleRepository.save(role);

        RoleResponseDTO response = new RoleResponseDTO();
        response.setId(saved.getId() != null ? saved.getId().toString() : null);
        response.setName(saved.getName());
        response.setColor(saved.getColor());
        response.setPermissions(permissions.stream().map(Permission::getName).toList());
        return response;
    }

    @Transactional
    public RoleResponseDTO updateRole(UUID roleId, UpdateRoleRequestDTO request, Authentication authentication) {
        UUID companyId = requireCompanyId(authentication);
        Role role = roleRepository.findByIdAndCompanyId(roleId, companyId)
                .orElseThrow(() -> new RoleDoesNotExistException("Role not found " + roleId));

        String rawName = request.getName() == null ? "" : request.getName().trim();
        String name = rawName.toUpperCase(Locale.ROOT);
        if (name.isEmpty()) {
            throw new IllegalArgumentException("Role name is required");
        }

        boolean nameChanged = !name.equalsIgnoreCase(role.getName());
        if (nameChanged && roleRepository.findByNameAndCompanyId(name, companyId).isPresent()) {
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
        validateBuiltInRolePermissions(name, permissionNames);

        List<Permission> permissions = new ArrayList<>();
        for (String permissionName : permissionNames) {
            Permission permission = permissionRepository.findByName(permissionName)
                    .orElseThrow(() -> new PermissionDoesNotExistException("Permission not found " + permissionName));
            permissions.add(permission);
        }

        role.setName(name);
        role.setPermissions(permissions);
        if (request.getColor() != null) {
            role.setColor(normalizeColor(request.getColor()));
        }
        Role saved = roleRepository.save(role);
        return toRoleResponse(saved);
    }

    @Transactional
    public void deleteRole(UUID roleId, Authentication authentication) {
        UUID companyId = requireCompanyId(authentication);
        Role role = roleRepository.findByIdAndCompanyId(roleId, companyId)
                .orElseThrow(() -> new RoleDoesNotExistException("Role not found " + roleId));
        roleRepository.delete(role);
    }

    public List<RoleResponseDTO> getRoles(Authentication authentication) {
        UUID companyId = requireCompanyId(authentication);
        return roleRepository.findAllByCompanyId(companyId).stream()
                .map(this::toRoleResponse)
                .sorted(Comparator.comparing(RoleResponseDTO::getName, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    public List<UserRolesResponseDTO> getUserRoles(List<UUID> ids, Authentication authentication) {
        UUID companyId = requireCompanyId(authentication);
        if (ids == null || ids.isEmpty()) {
            return List.of();
        }

        List<User> users = userRepository.findByIdInAndCompanyId(ids, companyId);
        java.util.Map<UUID, User> byId = users.stream()
                .collect(java.util.stream.Collectors.toMap(User::getId, u -> u));

        return ids.stream()
                .distinct()
                .map(id -> {
                    UserRolesResponseDTO dto = new UserRolesResponseDTO();
                    dto.setUserId(id.toString());
                    User user = byId.get(id);
                    List<String> roles = user == null || user.getRoles() == null
                            ? List.of()
                            : user.getRoles().stream()
                                .map(Role::getName)
                                .filter(name -> name != null && !name.isBlank())
                                .sorted(String.CASE_INSENSITIVE_ORDER)
                                .toList();
                    dto.setRoles(roles);
                    return dto;
                })
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
        response.setColor(role.getColor());
        response.setPermissions(role.getPermissions() == null
                ? List.of()
                : role.getPermissions().stream()
                        .map(Permission::getName)
                        .filter(name -> name != null && !name.isBlank())
                        .sorted(String.CASE_INSENSITIVE_ORDER)
                        .toList());
        return response;
    }

    private static String normalizeColor(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
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
