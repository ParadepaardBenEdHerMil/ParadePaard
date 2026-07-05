package com.pm.userservice;

import com.pm.userservice.model.ApplicationStatus;
import com.pm.userservice.model.UserStatus;
import com.pm.userservice.testsupport.PostgresTestContainerConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.Arrays;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = {
        "spring.sql.init.mode=never",
        "jwt.secret=MTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI=",
        "grpc.server.port=0"
})
@Import(PostgresTestContainerConfig.class)
class UserStatusConstraintSqlTest {
    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void migrationKeepsUsersStatusCheckAlignedWithUserStatusEnum() {
        String constraint = checkConstraintDefinition("users", "users_status_check");

        assertThat(constraint).contains(statusNames(UserStatus.values()));
    }

    @Test
    void migrationCreatesCurrentJobApplicationsTable() {
        assertThat(checkConstraintDefinition("job_applications", "job_applications_status_check"))
                .contains(statusNames(ApplicationStatus.values()));

        assertThat(columnExists("job_applications", "status")).isTrue();
        assertThat(columnExists("job_applications", "note")).isTrue();
        assertThat(columnExists("job_applications", "availability_notes")).isFalse();
        assertThat(columnExists("job_applications", "experience")).isFalse();
        assertThat(columnExists("job_applications", "languages")).isFalse();
        assertThat(columnExists("job_applications", "certificates")).isFalse();
        assertThat(columnExists("job_applications", "motivation")).isFalse();
        assertThat(columnExists("users", "id_document_back_image")).isTrue();
        assertThat(columnExists("users", "id_document_back_image_content_type")).isTrue();
    }

    @Test
    void migrationDoesNotReintroduceLegacyJobApplicationColumns() {
        assertThat(columnExists("job_applications", "availability_notes")).isFalse();
    }

    private String checkConstraintDefinition(String tableName, String constraintName) {
        return jdbcTemplate.queryForObject("""
                SELECT pg_get_constraintdef(c.oid)
                FROM pg_constraint c
                JOIN pg_class t ON t.oid = c.conrelid
                JOIN pg_namespace n ON n.oid = t.relnamespace
                WHERE n.nspname = 'public'
                  AND t.relname = ?
                  AND c.conname = ?
                """, String.class, tableName, constraintName);
    }

    private boolean columnExists(String tableName, String columnName) {
        Boolean exists = jdbcTemplate.queryForObject("""
                SELECT EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = ?
                      AND column_name = ?
                )
                """, Boolean.class, tableName, columnName);
        return Boolean.TRUE.equals(exists);
    }

    private static String[] statusNames(Enum<?>[] values) {
        return Arrays.stream(values)
                .map(Enum::name)
                .toArray(String[]::new);
    }
}
