package com.pm.timesheetservice.dto;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Bean-validation tests for the manual timesheet input path (TS-8 / DV-1).
 *
 * <p>Manual timesheet entry is a direct pay input with no planning guardrail, so the
 * server must reject invalid data regardless of any client-side checks. These tests
 * exercise the constraint annotations directly so they are fast and deterministic.
 */
class TimesheetRequestDTOValidationTest {

    private static ValidatorFactory factory;
    private static Validator validator;

    @BeforeAll
    static void setUp() {
        factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }

    @AfterAll
    static void tearDown() {
        factory.close();
    }

    @Test
    void validRequest_hasNoViolations() {
        assertThat(validator.validate(valid())).isEmpty();
    }

    @Test
    void zeroHoursWithTravel_isValid() {
        // Travel-only period (PY-1): 0 hours is allowed, negative is not.
        TimesheetRequestDTO dto = valid();
        dto.setHoursWorked(new BigDecimal("0.00"));
        dto.setTravelExpenses(new BigDecimal("25.00"));

        assertThat(validator.validate(dto)).isEmpty();
    }

    @Test
    void negativeHours_isRejected() {
        TimesheetRequestDTO dto = valid();
        dto.setHoursWorked(new BigDecimal("-1.00"));

        assertThat(violationFields(dto)).contains("hoursWorked");
    }

    @Test
    void nullHours_isRejected() {
        TimesheetRequestDTO dto = valid();
        dto.setHoursWorked(null);

        assertThat(violationFields(dto)).contains("hoursWorked");
    }

    @Test
    void blankUserId_isRejected() {
        TimesheetRequestDTO dto = valid();
        dto.setUserId("   ");

        assertThat(violationFields(dto)).contains("userId");
    }

    @Test
    void malformedDate_isRejected() {
        TimesheetRequestDTO dto = valid();
        dto.setDateOfIssue("17-06-2026"); // not ISO yyyy-MM-dd

        assertThat(violationFields(dto)).contains("dateOfIssue");
    }

    @Test
    void negativeTravelExpenses_isRejected() {
        TimesheetRequestDTO dto = valid();
        dto.setTravelExpenses(new BigDecimal("-0.01"));

        assertThat(violationFields(dto)).contains("travelExpenses");
    }

    @Test
    void negativeBreakMinutes_isRejected() {
        TimesheetRequestDTO dto = valid();
        dto.setBreakMinutes(-5);

        assertThat(violationFields(dto)).contains("breakMinutes");
    }

    private Set<String> violationFields(TimesheetRequestDTO dto) {
        return validator.validate(dto).stream()
                .map(ConstraintViolation::getPropertyPath)
                .map(Object::toString)
                .collect(Collectors.toSet());
    }

    private TimesheetRequestDTO valid() {
        TimesheetRequestDTO dto = new TimesheetRequestDTO();
        dto.setUserId("11111111-1111-1111-1111-111111111111");
        dto.setName("Jan de Vries");
        dto.setDateOfIssue("2026-06-17");
        dto.setFunction("barmedewerker");
        dto.setHoursWorked(new BigDecimal("8.00"));
        return dto;
    }
}
