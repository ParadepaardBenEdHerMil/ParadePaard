package com.pm.userservice;

import com.pm.userservice.model.ApplicationStatus;
import com.pm.userservice.model.UserStatus;
import org.h2.tools.RunScript;
import org.junit.jupiter.api.Test;

import java.io.FileReader;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

class UserStatusConstraintSqlTest {

    @Test
    void dataSqlKeepsUsersStatusCheckAlignedWithUserStatusEnum() throws Exception {
        String sql = Files.readString(Path.of("src/main/resources/data.sql"));

        assertThat(sql)
                .contains("ALTER TABLE IF EXISTS users DROP CONSTRAINT IF EXISTS users_status_check;");

        var matcher = Pattern
                .compile(
                        "ALTER TABLE IF EXISTS users ADD CONSTRAINT users_status_check CHECK \\(status IN \\((?<values>[^;]+)\\)\\);",
                        Pattern.CASE_INSENSITIVE | Pattern.DOTALL
                )
                .matcher(sql);

        assertThat(matcher.find()).isTrue();

        String constraintValues = matcher.group("values");
        String[] expectedStatuses = Arrays.stream(UserStatus.values())
                .map(status -> "'" + status.name() + "'")
                .toArray(String[]::new);

        assertThat(constraintValues).contains(expectedStatuses);
    }

    @Test
    void dataSqlCreatesJobApplicationsTable() throws Exception {
        String sql = Files.readString(Path.of("src/main/resources/data.sql"));

        assertThat(sql)
                .contains("ALTER TABLE IF EXISTS job_applications DROP CONSTRAINT IF EXISTS job_applications_status_check;");

        var matcher = Pattern
                .compile(
                        "ALTER TABLE IF EXISTS job_applications ADD CONSTRAINT job_applications_status_check CHECK \\(status IN \\((?<values>[^;]+)\\)\\);",
                        Pattern.CASE_INSENSITIVE | Pattern.DOTALL
                )
                .matcher(sql);

        assertThat(matcher.find()).isTrue();

        String constraintValues = matcher.group("values");
        String[] expectedStatuses = Arrays.stream(ApplicationStatus.values())
                .map(status -> "'" + status.name() + "'")
                .toArray(String[]::new);

        assertThat(constraintValues).contains(expectedStatuses);

        try (Connection connection = DriverManager.getConnection("jdbc:h2:mem:application_schema;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE", "sa", "");
             Statement statement = connection.createStatement()) {
            statement.execute("""
                    CREATE TABLE users (
                        user_id UUID PRIMARY KEY,
                        email VARCHAR(255),
                        preferred_name VARCHAR(255),
                        first_names VARCHAR(255),
                        middle_name_prefix VARCHAR(255),
                        last_name VARCHAR(255),
                        gender VARCHAR(255),
                        date_of_birth DATE,
                        mobile_number VARCHAR(255),
                        street VARCHAR(255),
                        house_number VARCHAR(255),
                        house_number_suffix VARCHAR(255),
                        postal_code VARCHAR(255),
                        city VARCHAR(255),
                        country VARCHAR(255),
                        iban VARCHAR(255)
                    )
                    """);
            statement.execute("""
                    CREATE TABLE leave_requests (
                        request_id UUID PRIMARY KEY,
                        user_id UUID,
                        type VARCHAR(255),
                        start_date DATE,
                        end_date DATE,
                        hours INTEGER,
                        reason VARCHAR(255),
                        status VARCHAR(255),
                        created_at TIMESTAMP WITH TIME ZONE,
                        updated_at TIMESTAMP WITH TIME ZONE
                    )
                    """);

            RunScript.execute(connection, new FileReader("src/main/resources/data.sql"));

            try (ResultSet columns = connection.getMetaData().getColumns(null, null, "job_applications", "status")) {
                assertThat(columns.next()).isTrue();
            }
            try (ResultSet columns = connection.getMetaData().getColumns(null, null, "job_applications", "note")) {
                assertThat(columns.next()).isTrue();
            }
            try (ResultSet columns = connection.getMetaData().getColumns(null, null, "job_applications", "availability_notes")) {
                assertThat(columns.next()).isFalse();
            }
            try (ResultSet columns = connection.getMetaData().getColumns(null, null, "job_applications", "experience")) {
                assertThat(columns.next()).isFalse();
            }
            try (ResultSet columns = connection.getMetaData().getColumns(null, null, "job_applications", "languages")) {
                assertThat(columns.next()).isFalse();
            }
            try (ResultSet columns = connection.getMetaData().getColumns(null, null, "job_applications", "certificates")) {
                assertThat(columns.next()).isFalse();
            }
            try (ResultSet columns = connection.getMetaData().getColumns(null, null, "job_applications", "motivation")) {
                assertThat(columns.next()).isFalse();
            }
        }
    }

    @Test
    void dataSqlRunsWhenJobApplicationsAlreadyDroppedLegacyAvailabilityNotes() throws Exception {
        try (Connection connection = DriverManager.getConnection("jdbc:h2:mem:application_existing_schema;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE", "sa", "");
             Statement statement = connection.createStatement()) {
            statement.execute("""
                    CREATE TABLE users (
                        user_id UUID PRIMARY KEY,
                        email VARCHAR(255),
                        preferred_name VARCHAR(255),
                        first_names VARCHAR(255),
                        middle_name_prefix VARCHAR(255),
                        last_name VARCHAR(255),
                        gender VARCHAR(255),
                        date_of_birth DATE,
                        mobile_number VARCHAR(255),
                        street VARCHAR(255),
                        house_number VARCHAR(255),
                        house_number_suffix VARCHAR(255),
                        postal_code VARCHAR(255),
                        city VARCHAR(255),
                        country VARCHAR(255),
                        iban VARCHAR(255)
                    )
                    """);
            statement.execute("""
                    CREATE TABLE leave_requests (
                        request_id UUID PRIMARY KEY,
                        user_id UUID,
                        type VARCHAR(255),
                        start_date DATE,
                        end_date DATE,
                        hours INTEGER,
                        reason VARCHAR(255),
                        status VARCHAR(255),
                        created_at TIMESTAMP WITH TIME ZONE,
                        updated_at TIMESTAMP WITH TIME ZONE
                    )
                    """);
            statement.execute("""
                    CREATE TABLE job_applications (
                        application_id UUID PRIMARY KEY,
                        first_names VARCHAR(255) NOT NULL,
                        last_name VARCHAR(255) NOT NULL,
                        email VARCHAR(255) NOT NULL,
                        phone_number VARCHAR(255) NOT NULL,
                        date_of_birth DATE NOT NULL,
                        note VARCHAR(2000),
                        worked_for_us_before BOOLEAN NOT NULL DEFAULT FALSE,
                        contact_consent BOOLEAN NOT NULL DEFAULT FALSE,
                        information_accurate BOOLEAN NOT NULL DEFAULT FALSE,
                        status VARCHAR(64) NOT NULL DEFAULT 'APPLICATION_SUBMITTED',
                        submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
                    )
                    """);

            RunScript.execute(connection, new FileReader("src/main/resources/data.sql"));

            try (ResultSet columns = connection.getMetaData().getColumns(null, null, "job_applications", "availability_notes")) {
                assertThat(columns.next()).isFalse();
            }
        }
    }
}
