package com.pm.authservice;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

class AuthSeedPermissionsTest {
    @Test
    void seedCreatesPayrollFinancePermissions() throws IOException {
        String sql = readSeedSql();

        assertThat(sql).contains("CAN_VIEW_PAYROLL_FINANCE");
        assertThat(sql).contains("CAN_MANAGE_PAYROLL_FINANCE");
    }

    @Test
    void adminSeedRoleIncludesPayrollFinancePermissions() throws IOException {
        String sql = readSeedSql();
        int adminAssignmentStart = sql.indexOf("-- assign permissions to ADMIN role");
        int userAssignmentStart = sql.indexOf("-- assign permissions to USER role");

        assertThat(adminAssignmentStart).isGreaterThanOrEqualTo(0);
        assertThat(userAssignmentStart).isGreaterThan(adminAssignmentStart);
        String adminAssignment = sql.substring(adminAssignmentStart, userAssignmentStart);

        assertThat(adminAssignment).contains("CAN_VIEW_PAYROLL_FINANCE");
        assertThat(adminAssignment).contains("CAN_MANAGE_PAYROLL_FINANCE");
    }

    @Test
    void seedCreatesBillingRatePermissionsAndAssignsThemToAdmin() throws IOException {
        String sql = readSeedSql();
        int adminAssignmentStart = sql.indexOf("-- assign permissions to ADMIN role");
        int userAssignmentStart = sql.indexOf("-- assign permissions to USER role");

        assertThat(sql).contains("CAN_VIEW_BILLING_RATES");
        assertThat(sql).contains("CAN_MANAGE_BILLING_RATES");
        assertThat(adminAssignmentStart).isGreaterThanOrEqualTo(0);
        assertThat(userAssignmentStart).isGreaterThan(adminAssignmentStart);

        String adminAssignment = sql.substring(adminAssignmentStart, userAssignmentStart);

        assertThat(adminAssignment).contains("CAN_VIEW_BILLING_RATES");
        assertThat(adminAssignment).contains("CAN_MANAGE_BILLING_RATES");
    }

    @Test
    void seedCreatesDeleteUserPermissionAndAssignsItToAdmin() throws IOException {
        String sql = readSeedSql();
        int adminAssignmentStart = sql.indexOf("-- assign permissions to ADMIN role");
        int userAssignmentStart = sql.indexOf("-- assign permissions to USER role");

        assertThat(sql).contains("CAN_DELETE_USERS");
        assertThat(adminAssignmentStart).isGreaterThanOrEqualTo(0);
        assertThat(userAssignmentStart).isGreaterThan(adminAssignmentStart);

        String adminAssignment = sql.substring(adminAssignmentStart, userAssignmentStart);
        String userAssignment = sql.substring(userAssignmentStart);

        assertThat(adminAssignment).contains("CAN_DELETE_USERS");
        assertThat(userAssignment).doesNotContain("CAN_DELETE_USERS");
    }

    @Test
    void seedCreatesPlatformAdminPermissionAndRoleWithoutDefaultAdminUser() throws IOException {
        String sql = readSeedSql();

        assertThat(sql).contains("CAN_MANAGE_PLATFORM");
        assertThat(sql).contains("SUPER_ADMIN");
        assertThat(sql).doesNotContain("INSERT INTO \"users\"");
        assertThat(sql).doesNotMatch("(?s).*ParadeAdmin\\d+!.*");
    }

    private static String readSeedSql() throws IOException {
        try (InputStream input = AuthSeedPermissionsTest.class.getClassLoader()
                .getResourceAsStream("db/migration/V2__seed_platform_reference_data.sql")) {
            assertThat(input).isNotNull();
            return new String(input.readAllBytes(), StandardCharsets.UTF_8);
        }
    }
}
