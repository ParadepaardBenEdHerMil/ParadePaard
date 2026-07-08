package com.pm.authservice.service;

import com.pm.authservice.dto.AuditLogCreateRequestDTO;
import com.pm.authservice.dto.AuditLogMessagePartDTO;
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
import com.pm.authservice.integration.AuditLogClient;
import com.pm.authservice.kafka.KafkaProducer;
import com.pm.authservice.mapper.RegisterMapper;
import com.pm.authservice.model.Company;
import com.pm.authservice.model.Permission;
import com.pm.authservice.model.Role;
import com.pm.authservice.model.User;
import com.pm.authservice.repository.CompanyRepository;
import com.pm.authservice.repository.PasswordResetTokenRepository;
import com.pm.authservice.repository.PermissionRepository;
import com.pm.authservice.repository.RoleRepository;
import com.pm.authservice.repository.UserRepository;
import com.pm.authservice.security.AuthUserPrincipal;
import com.pm.authservice.util.JwtUtil;
import io.jsonwebtoken.JwtException;
import jakarta.transaction.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import com.pm.authservice.exception.UserNotFoundException;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.Stream;

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
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final EmailSender emailSender;

    // Audit logging is best-effort and lives in user-service. Inject it optionally so the
    // many unit tests that build AuthService by hand keep working (client is null there and
    // recordAudit simply no-ops).
    @Autowired(required = false)
    private AuditLogClient auditLogClient;
    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

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
            "CAN_DELETE_USERS",
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
            "CAN_MANAGE_PAYSLIPS",
            "CAN_MANAGE_MESSAGES",
            "CAN_MANAGE_PLANNING",
            "CAN_VIEW_BILLING_RATES",
            "CAN_MANAGE_BILLING_RATES",
            "CAN_VIEW_PAYROLL_FINANCE",
            "CAN_MANAGE_PAYROLL_FINANCE",
            "CAN_VIEW_EMPLOYEE_IDENTIFICATION"
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

    // B8: brute-force lockout policy. After this many consecutive failed logins the
    // account is locked for the duration below; a successful login clears the counter.
    private static final int MAX_FAILED_LOGIN_ATTEMPTS = 5;
    private static final Duration LOGIN_LOCKOUT_DURATION = Duration.ofMinutes(15);

    public AuthService(UserService userService,
                       PasswordEncoder passwordEncoder,
                       JwtUtil jwtUtil,
                       UserRepository userRepository,
                       KafkaProducer kafkaProducer,
                       RoleRepository roleRepository,
                       PermissionRepository permissionRepository,
                       CompanyRepository companyRepository,
                       PasswordResetService passwordResetService,
                       PasswordResetTokenRepository passwordResetTokenRepository,
                       EmailSender emailSender) {
        this.roleRepository = roleRepository;
        this.permissionRepository = permissionRepository;
        this.userService = userService;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
        this.userRepository = userRepository;
        this.kafkaProducer = kafkaProducer;
        this.companyRepository = companyRepository;
        this.passwordResetService = passwordResetService;
        this.passwordResetTokenRepository = passwordResetTokenRepository;
        this.emailSender = emailSender;
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
        user.setMustChangePassword(registerRequestDTO.isMustChangePassword());
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

        if (registerRequestDTO.isMustChangePassword()) {
            passwordResetService.issueResetToken(newUser).ifPresent(issued ->
                    emailSender.sendEmployeeOnboardingEmail(
                            newUser.getEmail(),
                            newUser.getUsername(),
                            registerRequestDTO.getPassword(),
                            issued.getResetUrl(),
                            issued.getTtl()
                    )
            );
        }

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
        authResponseDTO.setMustChangePassword(newUser.isMustChangePassword());

        ResponseCookie responseRefreshCookie = responseRefreshCookie(refreshToken);
        ResponseCookie responseAccessCookie = responseAccessCookie(accessToken);

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, responseRefreshCookie.toString())
                .header(HttpHeaders.SET_COOKIE, responseAccessCookie.toString())
                .body(authResponseDTO);
    }

    public ResponseEntity<AuthResponseDTO> authenticate(LoginRequestDTO loginRequestDTO) {
        // Update: findByUsername instead of findByEmail
        Optional<User> userOpt = userService.findByUsername(loginRequestDTO.getUsername());
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        User authUser = userOpt.get();

        // B8: while the account is inside a lockout window, reject every attempt without
        // touching the password hash. A generic 401 (not 423/429) avoids revealing to an
        // attacker that they have tripped the lockout.
        Instant now = Instant.now();
        if (authUser.getLockedUntil() != null && authUser.getLockedUntil().isAfter(now)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        // B8: on a wrong password, count the failure and lock the account once the
        // threshold is reached, throttling online brute-force / credential stuffing.
        if (!passwordEncoder.matches(loginRequestDTO.getPassword(), authUser.getPassword())) {
            registerFailedLogin(authUser, now);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        // Correct credentials: clear any accumulated failure / lockout state.
        if (authUser.getFailedLoginAttempts() != 0 || authUser.getLockedUntil() != null) {
            authUser.setFailedLoginAttempts(0);
            authUser.setLockedUntil(null);
            authUser = userRepository.save(authUser);
        }

        return Optional.of(authUser)
                .map(user -> {
                    User normalizedUser = normalizeBuiltInUserRoles(user);
                    if (normalizedUser.isDisabled()) {
                        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).<AuthResponseDTO>build();
                    }
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

    /**
     * B8: record a failed login and lock the account once the failure threshold is hit.
     * The counter is reset when the lock is applied so the lockout window itself is the
     * deterrent, and a later successful login clears everything.
     */
    private void registerFailedLogin(User user, Instant now) {
        int attempts = user.getFailedLoginAttempts() + 1;
        if (attempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
            user.setLockedUntil(now.plus(LOGIN_LOCKOUT_DURATION));
            user.setFailedLoginAttempts(0);
        } else {
            user.setFailedLoginAttempts(attempts);
        }
        userRepository.save(user);
    }

    public void setUserDisabled(UUID id, boolean disabled) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new UserNotFoundException("User not found"));
        user.setDisabled(disabled);
        // B3: disabling a user must immediately kill their outstanding refresh tokens,
        // otherwise the account stays reachable for up to the refresh-token lifetime.
        if (disabled) {
            user.setTokenVersion(user.getTokenVersion() + 1);
        }
        userRepository.save(user);
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

    public ResponseEntity<AuthResponseDTO> refreshToken(String refreshToken) {
        try {
            jwtUtil.validateToken(refreshToken);

            var claims = jwtUtil.extractClaims(refreshToken);
            String userId = claims.get("userId", String.class);
            User user = userRepository.findById(UUID.fromString(userId))
                    .map(this::normalizeBuiltInUserRoles)
                    .orElseThrow(() -> new UserNotFoundException("User not found"));

            // B2: a disabled account must not be able to mint fresh access tokens from a
            // still-valid refresh cookie — mirror the isDisabled() guard used at login.
            if (user.isDisabled()) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
            }

            // B3: reject refresh tokens whose version is older than the user's current
            // token version. Logout, disable, and password-reset all bump the version,
            // which immediately invalidates every outstanding refresh token.
            int presentedVersion = jwtUtil.extractTokenVersion(refreshToken);
            if (presentedVersion != user.getTokenVersion()) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
            }

            UUID scopedCompanyId = resolveRefreshScopeCompanyId(user, claims.get("companyId", String.class));
            return scopedAuthResponse(user, scopedCompanyId);
        } catch (JwtException | IllegalArgumentException | UserNotFoundException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
    }

    public ResponseEntity<AuthResponseDTO> switchPlatformCompanyScope(Authentication authentication, UUID requestedCompanyId) {
        User user = requireAuthenticatedUser(authentication);
        if (!hasPermission(authentication, "CAN_MANAGE_PLATFORM") && !hasPermission(user, "CAN_MANAGE_PLATFORM")) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        UUID scopedCompanyId = user.getCompanyId();
        if (requestedCompanyId != null) {
            companyRepository.findById(requestedCompanyId)
                    .orElseThrow(() -> new IllegalArgumentException("Company not found"));
            scopedCompanyId = requestedCompanyId;
        }

        if (scopedCompanyId == null) {
            throw new IllegalStateException("User is missing company assignment");
        }
        return scopedAuthResponse(user, scopedCompanyId);
    }

    public ResponseEntity<Void> logout(Authentication authentication, String refreshToken) {
        // B3: revoke server-side, not just in the browser. Bumping the token version
        // invalidates every outstanding refresh token for this user so a stolen or
        // off-boarded cookie can no longer be exchanged for new access tokens.
        UUID userId = resolveLogoutUserId(authentication, refreshToken);
        if (userId != null) {
            userRepository.findById(userId).ifPresent(user -> {
                user.setTokenVersion(user.getTokenVersion() + 1);
                userRepository.save(user);
            });
        }
        return clearAuthCookies();
    }

    private UUID resolveLogoutUserId(Authentication authentication, String refreshToken) {
        AuthUserPrincipal principal = extractPrincipal(authentication);
        if (principal != null && principal.getUserId() != null) {
            return principal.getUserId();
        }
        // Fall back to the refresh cookie so logout still revokes even if the access
        // token has already expired.
        if (refreshToken != null && !refreshToken.isBlank()) {
            try {
                jwtUtil.validateToken(refreshToken);
                String userId = jwtUtil.extractClaims(refreshToken).get("userId", String.class);
                return userId == null ? null : UUID.fromString(userId);
            } catch (JwtException | IllegalArgumentException ignored) {
                return null;
            }
        }
        return null;
    }

    private ResponseEntity<Void> clearAuthCookies() {
        // The delete cookie must use the same path the refresh cookie was issued with
        // (responseRefreshCookie -> "/"), otherwise the browser keeps the "/"-scoped cookie
        // and logout fails to clear it client-side.
        ResponseCookie refreshTokenCookie = ResponseCookie.from("refreshToken", "")
                .httpOnly(true)
                .secure(true)
                .sameSite("Strict")
                .path("/")
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
        return jwtUtil.generateAccessToken(user.getEmail(), user.getId().toString(), user.getRoles(), companyId, user.getTokenVersion());
    }

    public String accessToken(User user, UUID scopedCompanyId) {
        String companyId = scopedCompanyId != null ? scopedCompanyId.toString() : null;
        return jwtUtil.generateAccessToken(user.getEmail(), user.getId().toString(), user.getRoles(), companyId, user.getTokenVersion());
    }

    public String refreshToken(User user){
        String companyId = user.getCompanyId() != null ? user.getCompanyId().toString() : null;
        return jwtUtil.generateRefreshToken(user.getEmail(), user.getId().toString(), user.getRoles(), companyId, user.getTokenVersion());
    }

    public String refreshToken(User user, UUID scopedCompanyId) {
        String companyId = scopedCompanyId != null ? scopedCompanyId.toString() : null;
        return jwtUtil.generateRefreshToken(user.getEmail(), user.getId().toString(), user.getRoles(), companyId, user.getTokenVersion());
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
    public void setUserRoles(UUID userId, List<String> names, Authentication authentication, String accessToken) {
        UUID companyId = requireCompanyId(authentication);
        User u = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException("User not found"));
        if (u.getCompanyId() == null || !u.getCompanyId().equals(companyId)) {
            throw new UserNotFoundException("User not found");
        }

        List<String> previousRoleNames = roleNames(u.getRoles());

        List<Role> roles = names.stream()
                .map(s -> s == null ? "" : s.trim().toUpperCase(Locale.ROOT))
                .filter(s -> !s.isEmpty())
                .distinct()
                .map(n -> roleRepository.findByNameAndCompanyId(n, companyId)
                        .orElseThrow(() -> new RoleDoesNotExistException("Role not found " + n)))
                .collect(java.util.stream.Collectors.toCollection(java.util.ArrayList::new));

        u.setRoles(roles);
        userRepository.save(u);

        List<String> newRoleNames = roleNames(roles);
        recordAudit(accessToken, "ROLES", "UPDATED", "USER", userId.toString(), List.of(
                textPart(" changed roles for "),
                userLink(userId),
                textPart(" from [" + String.join(", ", previousRoleNames)
                        + "] to [" + String.join(", ", newRoleNames) + "]")
        ));
    }

    @Transactional
    public void deleteUserAccount(UUID userId, Authentication authentication) {
        UUID companyId = requireCompanyId(authentication);
        AuthUserPrincipal principal = extractPrincipal(authentication);
        if (principal != null && principal.getUserId() != null && principal.getUserId().equals(userId)) {
            throw new IllegalArgumentException("You cannot delete your own account");
        }

        User user = userRepository.findByIdAndCompanyId(userId, companyId)
                .orElseThrow(() -> new UserNotFoundException("User not found"));

        passwordResetTokenRepository.deleteAllByUserId(userId);
        userRepository.delete(user);
    }

    @Transactional
    public RoleResponseDTO createRole(CreateRoleRequestDTO request, Authentication authentication, String accessToken) {
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

        recordAudit(accessToken, "ROLES", "CREATED", "ROLE",
                saved.getId() == null ? null : saved.getId().toString(),
                roleDetailParts(" created role ", saved, permissionNames));

        RoleResponseDTO response = new RoleResponseDTO();
        response.setId(saved.getId() != null ? saved.getId().toString() : null);
        response.setName(saved.getName());
        response.setColor(saved.getColor());
        response.setPermissions(permissions.stream().map(Permission::getName).toList());
        return response;
    }

    @Transactional
    public RoleResponseDTO updateRole(UUID roleId, UpdateRoleRequestDTO request, Authentication authentication, String accessToken) {
        UUID companyId = requireCompanyId(authentication);
        Role role = roleRepository.findByIdAndCompanyId(roleId, companyId)
                .orElseThrow(() -> new RoleDoesNotExistException("Role not found " + roleId));

        String previousName = role.getName();
        String previousColor = normalizeColor(role.getColor());
        List<String> previousPermissions = rolePermissionNames(role);

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

        recordAudit(accessToken, "ROLES", "UPDATED", "ROLE", roleId.toString(),
                roleChangeParts(saved, previousName, previousColor, previousPermissions));

        return toRoleResponse(saved);
    }

    @Transactional
    public void deleteRole(UUID roleId, Authentication authentication, String accessToken) {
        UUID companyId = requireCompanyId(authentication);
        Role role = roleRepository.findByIdAndCompanyId(roleId, companyId)
                .orElseThrow(() -> new RoleDoesNotExistException("Role not found " + roleId));
        roleRepository.delete(role);

        recordAudit(accessToken, "ROLES", "DELETED", "ROLE", roleId.toString(), List.of(
                textPart(" deleted role "),
                roleLink(role)
        ));
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

    // ---- Audit logging helpers -------------------------------------------------
    // These forward the acting admin's own access token to user-service, which owns the
    // central audit log and resolves the actor from that token. Everything here is
    // best-effort: a failure to log must never break the role change itself.

    private void recordAudit(
            String accessToken,
            String category,
            String action,
            String entityType,
            String entityId,
            List<AuditLogMessagePartDTO> messageParts
    ) {
        if (auditLogClient == null || accessToken == null || accessToken.isBlank()) {
            return;
        }
        AuditLogCreateRequestDTO request = new AuditLogCreateRequestDTO();
        request.setCategory(category);
        request.setAction(action);
        request.setEntityType(entityType);
        request.setEntityId(entityId);
        request.setMessageParts(messageParts);
        try {
            auditLogClient.record(accessToken, request);
        } catch (RuntimeException ex) {
            log.warn("Failed to record auth audit event {} for {} {}", action, entityType, entityId, ex);
        }
    }

    private List<AuditLogMessagePartDTO> roleDetailParts(String prefix, Role role, Set<String> permissionNames) {
        List<AuditLogMessagePartDTO> parts = new ArrayList<>();
        parts.add(textPart(prefix));
        parts.add(roleLink(role));
        List<String> permissions = permissionNames == null
                ? List.of()
                : permissionNames.stream().filter(Objects::nonNull).sorted().toList();
        String detail = roleDetail(role.getColor(), permissions);
        if (detail != null) {
            parts.add(textPart(detail));
        }
        return parts;
    }

    private List<AuditLogMessagePartDTO> roleChangeParts(
            Role saved,
            String previousName,
            String previousColor,
            List<String> previousPermissions
    ) {
        List<AuditLogMessagePartDTO> parts = new ArrayList<>();
        parts.add(textPart(" updated role "));
        parts.add(roleLink(saved));

        List<String> changes = new ArrayList<>();
        if (!Objects.equals(previousName, saved.getName())) {
            changes.add("renamed from " + previousName + " to " + saved.getName());
        }
        String newColor = normalizeColor(saved.getColor());
        if (!Objects.equals(previousColor, newColor)) {
            changes.add("colour " + colorLabel(previousColor) + " -> " + colorLabel(newColor));
        }
        List<String> newPermissions = rolePermissionNames(saved);
        if (!previousPermissions.equals(newPermissions)) {
            changes.add("permissions -> " + String.join(", ", newPermissions));
        }
        if (!changes.isEmpty()) {
            parts.add(textPart(" (" + String.join("; ", changes) + ")"));
        }
        return parts;
    }

    private static String roleDetail(String color, List<String> permissions) {
        List<String> bits = new ArrayList<>();
        String normalizedColor = normalizeColor(color);
        if (normalizedColor != null) {
            bits.add("colour " + normalizedColor);
        }
        if (permissions != null && !permissions.isEmpty()) {
            bits.add("permissions: " + String.join(", ", permissions));
        }
        return bits.isEmpty() ? null : " (" + String.join("; ", bits) + ")";
    }

    private static String colorLabel(String color) {
        return color == null ? "none" : color;
    }

    private static List<String> rolePermissionNames(Role role) {
        if (role == null || role.getPermissions() == null) {
            return List.of();
        }
        return role.getPermissions().stream()
                .map(Permission::getName)
                .filter(name -> name != null && !name.isBlank())
                .sorted()
                .toList();
    }

    private static List<String> roleNames(List<Role> roles) {
        if (roles == null) {
            return List.of();
        }
        return roles.stream()
                .map(Role::getName)
                .filter(name -> name != null && !name.isBlank())
                .sorted()
                .toList();
    }

    private static AuditLogMessagePartDTO textPart(String text) {
        AuditLogMessagePartDTO part = new AuditLogMessagePartDTO();
        part.setType("TEXT");
        part.setText(text);
        return part;
    }

    private static AuditLogMessagePartDTO roleLink(Role role) {
        AuditLogMessagePartDTO part = new AuditLogMessagePartDTO();
        part.setType("LINK");
        part.setEntityType("ROLE");
        part.setEntityId(role == null || role.getId() == null ? null : role.getId().toString());
        part.setLabel(role == null ? "role" : role.getName());
        return part;
    }

    private static AuditLogMessagePartDTO userLink(UUID userId) {
        AuditLogMessagePartDTO part = new AuditLogMessagePartDTO();
        part.setType("LINK");
        part.setEntityType("USER");
        part.setEntityId(userId == null ? null : userId.toString());
        part.setRoute(userId == null ? null : "/management/users/" + userId);
        return part;
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

    private ResponseEntity<AuthResponseDTO> scopedAuthResponse(User user, UUID scopedCompanyId) {
        String companyId = scopedCompanyId != null ? scopedCompanyId.toString() : null;
        String newAccessToken = accessToken(user, scopedCompanyId);
        String newRefreshToken = refreshToken(user, scopedCompanyId);

        AuthResponseDTO authResponseDTO = authResponseDTO(user.getId().toString(), user.getEmail(), companyId);
        authResponseDTO.setUsername(user.getUsername());

        ResponseCookie refreshTokenCookie = responseRefreshCookie(newRefreshToken);
        ResponseCookie accessTokenCookie = responseAccessCookie(newAccessToken);

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, refreshTokenCookie.toString())
                .header(HttpHeaders.SET_COOKIE, accessTokenCookie.toString())
                .body(authResponseDTO);
    }

    private UUID resolveRefreshScopeCompanyId(User user, String requestedCompanyId) {
        if (requestedCompanyId == null || requestedCompanyId.isBlank()) {
            return user.getCompanyId();
        }

        UUID parsedCompanyId = UUID.fromString(requestedCompanyId.trim());
        if (parsedCompanyId.equals(user.getCompanyId())) {
            return parsedCompanyId;
        }
        if (hasPermission(user, "CAN_MANAGE_PLATFORM") && companyRepository.findById(parsedCompanyId).isPresent()) {
            return parsedCompanyId;
        }
        return user.getCompanyId();
    }

    private static boolean hasPermission(Authentication authentication, String permissionName) {
        if (authentication == null || authentication.getAuthorities() == null) {
            return false;
        }
        return authentication.getAuthorities().stream()
                .map(grantedAuthority -> grantedAuthority == null ? null : grantedAuthority.getAuthority())
                .filter(name -> name != null && !name.isBlank())
                .anyMatch(permissionName::equalsIgnoreCase);
    }

    private static boolean hasPermission(User user, String permissionName) {
        if (user == null || user.getRoles() == null) {
            return false;
        }
        return user.getRoles().stream()
                .filter(role -> role != null && role.getPermissions() != null)
                .flatMap(role -> role.getPermissions().stream())
                .map(permission -> permission == null ? null : permission.getName())
                .filter(name -> name != null && !name.isBlank())
                .anyMatch(permissionName::equalsIgnoreCase);
    }
}
