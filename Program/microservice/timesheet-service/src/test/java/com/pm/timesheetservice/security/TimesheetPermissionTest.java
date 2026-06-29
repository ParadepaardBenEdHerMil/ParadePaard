package com.pm.timesheetservice.security;

import com.pm.timesheetservice.model.Timesheet;
import com.pm.timesheetservice.repository.TimesheetRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Ownership check behind {@code GET /timesheet/{id}} for own-scope users (R-8 / R-10 / TS-4).
 *
 * <p>This is the server-side guard that stops an employee with only {@code CAN_VIEW_OWN_TIMESHEETS}
 * from reading a colleague's timesheet by guessing its id (IDOR). It must grant only when the
 * authenticated user is the record owner, and deny on every ambiguous or missing-identity case.
 */
@ExtendWith(MockitoExtension.class)
class TimesheetPermissionTest {

    @Mock
    private TimesheetRepository repo;

    @InjectMocks
    private TimesheetPermission permission;

    private final UUID ownerId = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private final UUID otherUserId = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private final UUID timesheetId = UUID.fromString("33333333-3333-3333-3333-333333333333");

    @Test
    void grantsWhenAuthenticatedUserOwnsTheTimesheet() {
        when(repo.findById(timesheetId)).thenReturn(Optional.of(timesheetOwnedBy(ownerId)));

        assertThat(permission.isOwner(timesheetId, jwtFor(ownerId))).isTrue();
    }

    @Test
    void deniesAccessToAnotherUsersTimesheet() {
        // IDOR: same valid token, but the record belongs to someone else.
        when(repo.findById(timesheetId)).thenReturn(Optional.of(timesheetOwnedBy(otherUserId)));

        assertThat(permission.isOwner(timesheetId, jwtFor(ownerId))).isFalse();
    }

    @Test
    void deniesWhenTimesheetDoesNotExist() {
        when(repo.findById(timesheetId)).thenReturn(Optional.empty());

        assertThat(permission.isOwner(timesheetId, jwtFor(ownerId))).isFalse();
    }

    @Test
    void deniesWhenAuthenticationIsNull() {
        assertThat(permission.isOwner(timesheetId, null)).isFalse();
        verify(repo, never()).findById(timesheetId);
    }

    @Test
    void deniesWhenPrincipalIsNotAJwt() {
        Authentication auth = new UsernamePasswordAuthenticationToken("someone", "secret");

        assertThat(permission.isOwner(timesheetId, auth)).isFalse();
        verify(repo, never()).findById(timesheetId);
    }

    @Test
    void deniesWhenTokenHasNoResolvableUserId() {
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "none")
                .subject("not-a-uuid")
                .build();

        assertThat(permission.isOwner(timesheetId, new JwtAuthenticationToken(jwt))).isFalse();
        verify(repo, never()).findById(timesheetId);
    }

    private Timesheet timesheetOwnedBy(UUID userId) {
        Timesheet t = new Timesheet();
        t.setTimesheetId(timesheetId);
        t.setUserId(userId);
        return t;
    }

    private JwtAuthenticationToken jwtFor(UUID userId) {
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "none")
                .claim("userId", userId.toString())
                .build();
        return new JwtAuthenticationToken(jwt);
    }
}
