package com.pm.userservice;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

import java.nio.charset.StandardCharsets;
import java.util.Locale;

import static org.assertj.core.api.Assertions.assertThat;

class SeedDataScriptTest {

    @Test
    void seedDataDoesNotDeletePersistentUserServiceRows() throws Exception {
        String sql = normalizedDataSql();

        assertThat(sql)
                .doesNotContain("delete from message_entries")
                .doesNotContain("delete from message_conversations")
                .doesNotContain("delete from leave_requests")
                .doesNotContain("delete from users")
                .doesNotContain("delete from companies");
    }

    private static String normalizedDataSql() throws Exception {
        ClassPathResource resource = new ClassPathResource("db/migration/V1__init_schema.sql");
        String sql = new String(resource.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        return sql.toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
    }
}
