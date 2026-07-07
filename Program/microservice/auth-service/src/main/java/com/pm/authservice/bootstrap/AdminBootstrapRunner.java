package com.pm.authservice.bootstrap;

import com.pm.authservice.kafka.KafkaProducer;
import com.pm.authservice.model.Role;
import com.pm.authservice.model.User;
import com.pm.authservice.repository.RoleRepository;
import com.pm.authservice.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * B7: bootstrap the first platform admin from configuration instead of shipping a
 * committed default account.
 *
 * <p>On startup, when {@code bootstrap.admin.username} and {@code bootstrap.admin.password}
 * are provided (via env: BOOTSTRAP_ADMIN_USERNAME / BOOTSTRAP_ADMIN_PASSWORD) and no user
 * with that username exists yet, a single {@code SUPER_ADMIN} user is created with the
 * password bcrypt-hashed and {@code mustChangePassword = true} so it must be rotated on
 * first login. The runner is idempotent (skips if the user already exists) and a no-op
 * when unconfigured, so it never seeds credentials by default.
 */
@Component
public class AdminBootstrapRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminBootstrapRunner.class);
    private static final String SUPER_ADMIN_ROLE = "SUPER_ADMIN";
    private static final UUID DEFAULT_PLATFORM_COMPANY_ID =
            UUID.fromString("00000000-0000-0000-0000-000000000001");

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final KafkaProducer kafkaProducer;

    private final String username;
    private final String email;
    private final String password;
    private final String firstName;
    private final String lastName;
    private final UUID companyId;

    public AdminBootstrapRunner(
            UserRepository userRepository,
            RoleRepository roleRepository,
            PasswordEncoder passwordEncoder,
            KafkaProducer kafkaProducer,
            @Value("${bootstrap.admin.username:}") String username,
            @Value("${bootstrap.admin.email:}") String email,
            @Value("${bootstrap.admin.password:}") String password,
            @Value("${bootstrap.admin.first-name:Platform}") String firstName,
            @Value("${bootstrap.admin.last-name:Administrator}") String lastName,
            @Value("${bootstrap.admin.company-id:00000000-0000-0000-0000-000000000001}") String companyId) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
        this.kafkaProducer = kafkaProducer;
        this.username = username == null ? "" : username.trim();
        this.email = email == null ? "" : email.trim();
        this.password = password == null ? "" : password;
        this.firstName = firstName;
        this.lastName = lastName;
        this.companyId = parseCompanyId(companyId);
    }

    private static UUID parseCompanyId(String raw) {
        try {
            return (raw == null || raw.isBlank())
                    ? DEFAULT_PLATFORM_COMPANY_ID
                    : UUID.fromString(raw.trim());
        } catch (IllegalArgumentException ex) {
            return DEFAULT_PLATFORM_COMPANY_ID;
        }
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (username.isEmpty() || password.isEmpty()) {
            log.info("Admin bootstrap not configured (BOOTSTRAP_ADMIN_USERNAME/PASSWORD unset); skipping.");
            return;
        }
        if (userRepository.existsByUsername(username)) {
            // The admin already exists in auth-service. Re-publish the USER_CREATED event so a
            // user-service that never received the original event (e.g. a fresh deployment where
            // the admin was bootstrapped before user-service had consumed it) still gets the
            // profile that GET /api/users/me requires. The consumer is idempotent — it skips when
            // the profile already exists — so this is a safe no-op once everything is in sync.
            userRepository.findByUsername(username).ifPresent(existing -> {
                kafkaProducer.sendEvent(existing);
                log.info("Admin bootstrap: user '{}' already exists; re-published USER_CREATED "
                        + "to sync downstream services.", username);
            });
            return;
        }

        Role superAdmin = roleRepository.findByNameAndCompanyId(SUPER_ADMIN_ROLE, companyId).orElse(null);
        if (superAdmin == null) {
            log.error("Admin bootstrap: {} role not found for company {}; cannot create admin. "
                    + "Ensure the auth-service migrations have run.", SUPER_ADMIN_ROLE, companyId);
            return;
        }

        User admin = new User();
        admin.setUsername(username);
        admin.setEmail(email.isEmpty() ? username + "@localhost" : email);
        admin.setFirstName(firstName);
        admin.setLastName(lastName);
        admin.setPassword(passwordEncoder.encode(password));
        admin.setMustChangePassword(true);
        admin.setDisabled(false);
        admin.setCompanyId(companyId);
        admin.setRoles(List.of(superAdmin));

        User saved = userRepository.save(admin);
        // Propagate to the other services. user-service consumes USER_CREATED to create the
        // profile that GET /api/users/me needs; without this the admin can authenticate but has
        // no profile, so the app fails to load right after login.
        kafkaProducer.sendEvent(saved);
        log.warn("Admin bootstrap: created {} user '{}' and published USER_CREATED. "
                + "It must change its password on first login.", SUPER_ADMIN_ROLE, username);
    }
}
