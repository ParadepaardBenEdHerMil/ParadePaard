package com.pm.contractservice.service;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * CF-1 / PY-9: the CAO wage table decides the contract wage, to the exact cent, and the
 * statutory minimum wage (WML) applies when no CAO covers the case.
 *
 * <p>Figures asserted here are the official KHN Horeca cao-loontabel per 1 januari 2026
 * (vakkrachten, function groups 1/2–11, age bands 18 / 19 / 20+). Source:
 * khn.nl/kennis/loontabellen-per-1-januari-2026. WML fallback figures come from the
 * existing {@link DutchMinimumWageSchedule}.
 */
class CaoWageResolverTest {

    private final CaoWageResolver resolver = new CaoWageResolver();

    private static LocalDate bornToBeAge(int age, LocalDate on) {
        return on.minusYears(age).minusDays(1); // just had their birthday -> exactly `age`
    }

    @Test
    void horecaGroup5AdultUsesExactCaoWage() {
        LocalDate start = LocalDate.of(2026, 3, 1);
        BigDecimal wage = resolver.resolveHourlyWage(
                CaoWageResolver.HORECA, 5, start, bornToBeAge(25, start));
        assertThat(wage).isEqualByComparingTo("15.21");
    }

    @Test
    void horecaGroup1Age18UsesExactCaoWage() {
        LocalDate start = LocalDate.of(2026, 6, 1);
        BigDecimal wage = resolver.resolveHourlyWage(
                CaoWageResolver.HORECA, 1, start, bornToBeAge(18, start));
        assertThat(wage).isEqualByComparingTo("11.77");
    }

    @Test
    void horecaGroup2SharesTheOnePlusTwoColumn() {
        LocalDate start = LocalDate.of(2026, 6, 1);
        BigDecimal group1 = resolver.resolveHourlyWage(CaoWageResolver.HORECA, 1, start, bornToBeAge(18, start));
        BigDecimal group2 = resolver.resolveHourlyWage(CaoWageResolver.HORECA, 2, start, bornToBeAge(18, start));
        assertThat(group2).isEqualByComparingTo(group1).isEqualByComparingTo("11.77");
    }

    @Test
    void horecaTopGroupAge19UsesExactCaoWage() {
        LocalDate start = LocalDate.of(2026, 4, 1);
        BigDecimal wage = resolver.resolveHourlyWage(
                CaoWageResolver.HORECA, 11, start, bornToBeAge(19, start));
        assertThat(wage).isEqualByComparingTo("22.48");
    }

    @Test
    void adultAt20GetsTheTwentyPlusBandNotYouthMinimum() {
        // A 20-year-old vakkracht in group 1+2 earns the CAO 20+ rate (14.71), above the WML for 20 (12.50).
        LocalDate start = LocalDate.of(2026, 1, 15);
        BigDecimal wage = resolver.resolveHourlyWage(
                CaoWageResolver.HORECA, 1, start, bornToBeAge(20, start));
        assertThat(wage).isEqualByComparingTo("14.71");
    }

    @Test
    void unknownCaoFallsBackToStatutoryMinimum() {
        LocalDate start = LocalDate.of(2026, 1, 15);
        BigDecimal wage = resolver.resolveHourlyWage(
                "RETAIL", 3, start, bornToBeAge(25, start));
        // WML adult per 1 Jan 2026.
        assertThat(wage).isEqualByComparingTo("14.71");
    }

    @Test
    void noCaoGivenFallsBackToStatutoryMinimum() {
        LocalDate start = LocalDate.of(2026, 1, 15);
        BigDecimal wage = resolver.resolveHourlyWage(
                null, null, start, bornToBeAge(25, start));
        assertThat(wage).isEqualByComparingTo("14.71");
    }

    @Test
    void horecaAgeBelowVakkrachtBandsFallsBackToStatutoryMinimum() {
        // A 17-year-old is not in the vakkracht table -> WML for age 17 per 1 Jan 2026.
        LocalDate start = LocalDate.of(2026, 1, 15);
        BigDecimal wage = resolver.resolveHourlyWage(
                CaoWageResolver.HORECA, 3, start, bornToBeAge(17, start));
        assertThat(wage).isEqualByComparingTo("6.18");
    }

    @Test
    void dateBeforeAnyHorecaTableFallsBackToStatutoryMinimum() {
        // No CAO table before 2026-01-01 -> WML effective 2025-07-01 (adult 14.40).
        LocalDate start = LocalDate.of(2025, 12, 1);
        BigDecimal wage = resolver.resolveHourlyWage(
                CaoWageResolver.HORECA, 5, start, bornToBeAge(30, start));
        assertThat(wage).isEqualByComparingTo("14.40");
    }

    @Test
    void resolvedWageIsNeverBelowTheStatutoryMinimum() {
        LocalDate start = LocalDate.of(2026, 6, 1);
        for (int group : new int[]{1, 3, 5, 8, 11}) {
            for (int age : new int[]{18, 19, 25}) {
                BigDecimal wage = resolver.resolveHourlyWage(
                        CaoWageResolver.HORECA, group, start, bornToBeAge(age, start));
                BigDecimal wml = DutchMinimumWageSchedule
                        .minimumHourlyWage(start, bornToBeAge(age, start))
                        .orElseThrow();
                assertThat(wage).isGreaterThanOrEqualTo(wml);
            }
        }
    }

    @Test
    void missingDatesAreRejected() {
        assertThatThrownBy(() -> resolver.resolveHourlyWage(CaoWageResolver.HORECA, 5, null,
                LocalDate.of(2000, 1, 1)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> resolver.resolveHourlyWage(CaoWageResolver.HORECA, 5,
                LocalDate.of(2026, 1, 1), null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void canonicalCodeRecognisesConfiguredCaos() {
        assertThat(CaoWageResolver.canonicalCode("horeca")).contains("HORECA");
        assertThat(CaoWageResolver.canonicalCode("retail")).isEmpty();
        assertThat(CaoWageResolver.canonicalCode(null)).isEmpty();
    }
}
