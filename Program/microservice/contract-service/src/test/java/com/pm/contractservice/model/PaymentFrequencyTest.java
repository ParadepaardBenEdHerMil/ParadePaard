package com.pm.contractservice.model;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Pins the PY-19 pay-frequency safety policy.
 *
 * <p>{@code EVERY_5_MINUTES} / {@code EVERY_10_MINUTES} exist only to watch the payroll
 * pipeline fire live during development. They must never be usable in production, where a
 * misconfigured contract would otherwise generate payslips every few minutes. This test
 * locks the policy so the dev-only set cannot silently grow or be marked production-safe.
 */
class PaymentFrequencyTest {

    @ParameterizedTest
    @EnumSource(value = PaymentFrequency.class, names = {"EVERY_5_MINUTES", "EVERY_10_MINUTES"})
    void devOnlyFrequencies_areNotProductionAllowed(PaymentFrequency frequency) {
        assertThat(frequency.isProductionAllowed()).isFalse();
    }

    @ParameterizedTest
    @EnumSource(value = PaymentFrequency.class, names = {"DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY"})
    void realFrequencies_areProductionAllowed(PaymentFrequency frequency) {
        assertThat(frequency.isProductionAllowed()).isTrue();
    }

    @Test
    void exactlyTwoDevOnlyFrequencies_exist() {
        long devOnly = java.util.Arrays.stream(PaymentFrequency.values())
                .filter(f -> !f.isProductionAllowed())
                .count();
        assertThat(devOnly).isEqualTo(2);
    }

    @Test
    void fromNullable_defaultsToWeeklyForNullOrBlank() {
        assertThat(PaymentFrequency.fromNullable(null)).isEqualTo(PaymentFrequency.WEEKLY);
        assertThat(PaymentFrequency.fromNullable("")).isEqualTo(PaymentFrequency.WEEKLY);
        assertThat(PaymentFrequency.fromNullable("   ")).isEqualTo(PaymentFrequency.WEEKLY);
    }

    @Test
    void fromNullable_trimsAndUppercases() {
        assertThat(PaymentFrequency.fromNullable("  monthly ")).isEqualTo(PaymentFrequency.MONTHLY);
        assertThat(PaymentFrequency.fromNullable("biweekly")).isEqualTo(PaymentFrequency.BIWEEKLY);
    }

    @Test
    void fromNullable_rejectsUnknownValue() {
        assertThatThrownBy(() -> PaymentFrequency.fromNullable("FORTNIGHTLY"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
