package com.pm.authservice.service;

import com.pm.authservice.dto.AdminEmailSendResponseDTO;
import com.pm.authservice.dto.AdminOnboardUserRequestDTO;
import com.pm.authservice.dto.AdminOnboardUserResponseDTO;
import com.pm.authservice.exception.EmailAlreadyExistsException;
import com.pm.authservice.exception.RoleDoesNotExistException;
import com.pm.authservice.exception.UserNotFoundException;
import com.pm.authservice.kafka.KafkaProducer;
import com.pm.authservice.model.Role;
import com.pm.authservice.model.User;
import com.pm.authservice.repository.RoleRepository;
import com.pm.authservice.repository.UserRepository;
import com.pm.authservice.security.AuthUserPrincipal;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
public class AdminOnboardingService {
    private static final Logger log = LoggerFactory.getLogger(AdminOnboardingService.class);

    private static final int TEMP_PASSWORD_LENGTH = 12;
    private static final String PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    private static final Pattern WHITESPACE = Pattern.compile("\\s+");

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final KafkaProducer kafkaProducer;
    private final PasswordResetService passwordResetService;
    private final EmailSender emailSender;

    public AdminOnboardingService(
            UserRepository userRepository,
            RoleRepository roleRepository,
            PasswordEncoder passwordEncoder,
            KafkaProducer kafkaProducer,
            PasswordResetService passwordResetService,
            EmailSender emailSender
    ) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
        this.kafkaProducer = kafkaProducer;
        this.passwordResetService = passwordResetService;
        this.emailSender = emailSender;
    }

    @Transactional
    public AdminOnboardUserResponseDTO onboardUser(AdminOnboardUserRequestDTO request, Authentication authentication) {
        String email = normalizeEmail(request.getEmail());
        UUID companyId = resolveCompanyId(authentication);

        Optional<User> existing = userRepository.findByEmailAndCompanyId(email, companyId);
        if (existing.isPresent()) {
            User existingUser = existing.get();
            // A user who has never completed setup (still forced to change their temporary
            // password) is safe to re-onboard. This makes onboarding idempotent so a
            // half-completed onboarding — e.g. the auth account was created but the caller's
            // transaction then rolled back — can be retried instead of being wedged forever
            // behind "Email Already Exists". A fully-activated account is a genuine conflict.
            if (!existingUser.isMustChangePassword()) {
                throw new EmailAlreadyExistsException("A user with this email already exists " + email);
            }
            return reonboardExistingUser(existingUser);
        }

        String firstName = request.getFirstName() == null ? "" : request.getFirstName().trim();
        String lastName = request.getLastName() == null ? "" : request.getLastName().trim();
        String usernameBase = normalizeUsername(firstName + "." + lastName);
        String username = ensureUniqueUsername(usernameBase);
        String tempPassword = generateTemporaryPassword();

        User user = new User();
        user.setFirstName(firstName.isBlank() ? "User" : firstName);
        user.setLastName(lastName.isBlank() ? "Unknown" : lastName);
        user.setEmail(email);
        user.setUsername(username);
        user.setPassword(passwordEncoder.encode(tempPassword));
        user.setMustChangePassword(true);

        user.setCompanyId(companyId);

        Role userRole = roleRepository.findByNameAndCompanyId("USER", companyId)
                .orElseThrow(() -> new RoleDoesNotExistException("USER role is missing seed it first"));
        user.setRoles(List.of(userRole));

        User saved = userRepository.save(user);
        kafkaProducer.sendEvent(saved);

        boolean onboardingEmailSent = passwordResetService.issueResetToken(saved).map(issued -> {
            try {
                emailSender.sendEmployeeOnboardingEmail(email, username, tempPassword, issued.getResetUrl(), issued.getTtl());
                return true;
            } catch (Exception e) {
                log.error("Failed to send onboarding email userId={} email={}", saved.getId(), email, e);
                return false;
            }
        }).orElseGet(() -> {
            log.error("Failed to issue password reset token for userId={}", saved.getId());
            return false;
        });

        AdminOnboardUserResponseDTO response = new AdminOnboardUserResponseDTO();
        response.setUserId(saved.getId().toString());
        response.setEmail(saved.getEmail());
        response.setUsername(saved.getUsername());
        response.setTemporaryPassword(tempPassword);
        response.setCompanyId(saved.getCompanyId() != null ? saved.getCompanyId().toString() : null);
        response.setOnboardingEmailSent(onboardingEmailSent);
        return response;
    }

    /**
     * Re-onboards an existing, not-yet-activated user: issues a fresh temporary password and
     * onboarding email while keeping the same user id, roles and company. Used to recover an
     * onboarding that previously half-completed. The user is already present in downstream
     * services from the first attempt, so no USER_CREATED event is re-published here.
     */
    private AdminOnboardUserResponseDTO reonboardExistingUser(User user) {
        String tempPassword = generateTemporaryPassword();
        user.setPassword(passwordEncoder.encode(tempPassword));
        user.setMustChangePassword(true);
        User saved = userRepository.save(user);

        boolean onboardingEmailSent = passwordResetService.issueResetToken(saved).map(issued -> {
            try {
                emailSender.sendEmployeeOnboardingEmail(saved.getEmail(), saved.getUsername(), tempPassword, issued.getResetUrl(), issued.getTtl());
                return true;
            } catch (Exception e) {
                log.error("Failed to send onboarding email userId={} email={}", saved.getId(), saved.getEmail(), e);
                return false;
            }
        }).orElseGet(() -> {
            log.error("Failed to issue password reset token for userId={}", saved.getId());
            return false;
        });

        AdminOnboardUserResponseDTO response = new AdminOnboardUserResponseDTO();
        response.setUserId(saved.getId().toString());
        response.setEmail(saved.getEmail());
        response.setUsername(saved.getUsername());
        response.setTemporaryPassword(tempPassword);
        response.setCompanyId(saved.getCompanyId() != null ? saved.getCompanyId().toString() : null);
        response.setOnboardingEmailSent(onboardingEmailSent);
        return response;
    }

    @Transactional
    public AdminEmailSendResponseDTO resendOnboardingEmail(UUID userId, Authentication authentication) {
        UUID companyId = resolveCompanyId(authentication);
        User user = userRepository.findById(userId)
                .filter(candidate -> companyId.equals(candidate.getCompanyId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        PasswordResetService.IssuedResetToken issued = passwordResetService.issueResetToken(user)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.INTERNAL_SERVER_ERROR,
                        "Could not issue password reset token"
                ));
        emailSender.sendEmployeeAccountSetupEmail(user.getEmail(), issued.getResetUrl(), issued.getTtl());

        return emailSendResponse(user);
    }

    /**
     * Emails the employee that their onboarding submission needs changes (the reviewer's note
     * plus per-field flags) with a fresh setup link so they can log back in and correct it.
     */
    @Transactional
    public AdminEmailSendResponseDTO sendOnboardingChangesEmail(UUID userId, String note, List<String> flags, Authentication authentication) {
        UUID companyId = resolveCompanyId(authentication);
        User user = userRepository.findById(userId)
                .filter(candidate -> companyId.equals(candidate.getCompanyId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        PasswordResetService.IssuedResetToken issued = passwordResetService.issueResetToken(user)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.INTERNAL_SERVER_ERROR,
                        "Could not issue password reset token"
                ));
        emailSender.sendOnboardingChangesRequestedEmail(user.getEmail(), note, flags, issued.getResetUrl(), issued.getTtl());

        return emailSendResponse(user);
    }

    /**
     * Emails the applicant that their onboarding was rejected, with the reviewer's reason. No
     * setup link: rejection is final unless an admin re-enables the account and re-invites.
     */
    @Transactional(readOnly = true)
    public AdminEmailSendResponseDTO sendOnboardingRejectedEmail(UUID userId, String reason, Authentication authentication) {
        UUID companyId = resolveCompanyId(authentication);
        User user = userRepository.findById(userId)
                .filter(candidate -> companyId.equals(candidate.getCompanyId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        emailSender.sendOnboardingRejectedEmail(user.getEmail(), reason);

        return emailSendResponse(user);
    }

    private static AdminEmailSendResponseDTO emailSendResponse(User user) {
        AdminEmailSendResponseDTO response = new AdminEmailSendResponseDTO();
        response.setUserId(user.getId().toString());
        response.setEmail(user.getEmail());
        response.setEmailSent(true);
        return response;
    }

    private UUID resolveCompanyId(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new IllegalArgumentException("Missing authentication");
        }
        AuthUserPrincipal principal = extractPrincipal(authentication);
        if (principal != null && principal.getCompanyId() != null) {
            return principal.getCompanyId();
        }
        if (principal != null && principal.getUserId() != null) {
            User user = userRepository.findById(principal.getUserId())
                    .orElseThrow(() -> new UserNotFoundException("User not found"));
            if (user.getCompanyId() == null) {
                throw new IllegalStateException("User is missing company assignment");
            }
            return user.getCompanyId();
        }

        String email = authentication.getName();
        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException("Missing user identity");
        }
        List<User> matches = userRepository.findAllByEmail(email);
        if (matches.isEmpty()) {
            throw new UserNotFoundException("User not found for " + email);
        }
        if (matches.size() > 1) {
            throw new IllegalStateException("Multiple users found for email");
        }
        User user = matches.get(0);
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

    private String ensureUniqueUsername(String base) {
        String normalized = normalizeUsername(base);
        if (!userRepository.existsByUsername(normalized)) {
            return normalized;
        }

        for (int i = 2; i <= 9999; i++) {
            String candidate = normalized + i;
            if (!userRepository.existsByUsername(candidate)) {
                return candidate;
            }
        }

        throw new IllegalStateException("Unable to generate a unique username for base=" + normalized);
    }

    private static String normalizeEmail(String rawEmail) {
        return rawEmail == null ? "" : rawEmail.trim().toLowerCase(Locale.ROOT);
    }

    private static String normalizeUsername(String rawUsername) {
        String s = rawUsername == null ? "" : rawUsername.trim();
        s = WHITESPACE.matcher(s).replaceAll(".");
        s = s.toLowerCase(Locale.ROOT);
        s = s.replaceAll("\\.+", ".");
        s = s.replaceAll("^\\.+|\\.+$", "");
        return s.isBlank() ? "user" : s;
    }

    private static String generateTemporaryPassword() {
        SecureRandom random = new SecureRandom();
        StringBuilder sb = new StringBuilder(TEMP_PASSWORD_LENGTH);
        for (int i = 0; i < TEMP_PASSWORD_LENGTH; i++) {
            sb.append(PASSWORD_CHARS.charAt(random.nextInt(PASSWORD_CHARS.length())));
        }
        return sb.toString();
    }
}

