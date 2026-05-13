package com.pm.userservice;

import com.pm.userservice.model.UserStatus;
import org.junit.jupiter.api.Test;

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
}
