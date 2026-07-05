package com.pm.userservice.security;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * S1: internal service-token matching and enforcement gating.
 */
class InternalServiceTokenServiceTest {

    @Test
    void blankToken_isNotConfigured_andNeverMatches() {
        InternalServiceTokenService svc = new InternalServiceTokenService("");
        assertThat(svc.isConfigured()).isFalse();
        assertThat(svc.matches("anything")).isFalse();
        assertThat(svc.matches("")).isFalse();
        assertThat(svc.matches(null)).isFalse();
    }

    @Test
    void configuredToken_matchesOnlyExactValue() {
        InternalServiceTokenService svc = new InternalServiceTokenService("s3cr3t-token");
        assertThat(svc.isConfigured()).isTrue();
        assertThat(svc.matches("s3cr3t-token")).isTrue();
        assertThat(svc.matches("  s3cr3t-token  ")).isTrue(); // trimmed
        assertThat(svc.matches("wrong")).isFalse();
        assertThat(svc.matches(null)).isFalse();
    }
}
