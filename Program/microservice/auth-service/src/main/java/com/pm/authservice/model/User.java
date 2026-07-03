package com.pm.authservice.model;

import jakarta.persistence.*;
import org.hibernate.annotations.ColumnDefault;
import java.time.Instant;
import java.util.*;

@Entity
@Table(
        name = "users",
        uniqueConstraints = {
                @UniqueConstraint(name = "users_company_email_key", columnNames = {"company_id", "email"})
        }
)
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(nullable = false)
    private String firstName;

    @Column(nullable = false)
    private String lastName;

    @Column(unique = true, nullable = false)
    private String username;

    @Column(nullable = false)
    private String email;

    @Column(nullable = false)
    private String password;

    @Column(nullable = false)
    private boolean mustChangePassword = false;

    @Column(nullable = false)
    @ColumnDefault("false")
    private boolean disabled = false;

    @Column(name = "company_id", nullable = false)
    @ColumnDefault("'00000000-0000-0000-0000-000000000001'")
    private UUID companyId;

    /**
     * Monotonic token generation counter (B3). Every access/refresh token embeds the
     * value that was current when it was issued (the {@code tv} claim). Incrementing
     * this immediately invalidates every outstanding refresh token for the user, which
     * is how logout, disable, and password-reset revoke sessions server-side.
     */
    @Column(name = "token_version", nullable = false)
    @ColumnDefault("0")
    private int tokenVersion = 0;

    /**
     * Consecutive failed login attempts since the last successful login (B8).
     * Reset to 0 on a successful authentication.
     */
    @Column(name = "failed_login_attempts", nullable = false)
    @ColumnDefault("0")
    private int failedLoginAttempts = 0;

    /**
     * When set and in the future, the account is temporarily locked out from logging
     * in because of too many failed attempts (B8). Null means not locked.
     */
    @Column(name = "locked_until")
    private Instant lockedUntil;

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
            name = "auth_user_roles",
            joinColumns = @JoinColumn(name = "user_id"),
            inverseJoinColumns = @JoinColumn(name = "role_id")
    )
    private List<Role> roles = new ArrayList<>();

    // Getters and Setters
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getFirstName() { return firstName; }
    public void setFirstName(String firstName) { this.firstName = firstName; }

    public String getLastName() { return lastName; }
    public void setLastName(String lastName) { this.lastName = lastName; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public boolean isMustChangePassword() { return mustChangePassword; }
    public void setMustChangePassword(boolean mustChangePassword) { this.mustChangePassword = mustChangePassword; }

    public boolean isDisabled() { return disabled; }
    public void setDisabled(boolean disabled) { this.disabled = disabled; }

    public UUID getCompanyId() { return companyId; }
    public void setCompanyId(UUID companyId) { this.companyId = companyId; }

    public int getTokenVersion() { return tokenVersion; }
    public void setTokenVersion(int tokenVersion) { this.tokenVersion = tokenVersion; }

    public int getFailedLoginAttempts() { return failedLoginAttempts; }
    public void setFailedLoginAttempts(int failedLoginAttempts) { this.failedLoginAttempts = failedLoginAttempts; }

    public Instant getLockedUntil() { return lockedUntil; }
    public void setLockedUntil(Instant lockedUntil) { this.lockedUntil = lockedUntil; }

    public List<Role> getRoles() { return roles; }
    public void setRoles(List<Role> roles) { this.roles = roles; }
}
