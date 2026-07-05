package com.pm.authservice;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

import java.nio.charset.StandardCharsets;
import java.util.Locale;

import static org.assertj.core.api.Assertions.assertThat;

class SeedDataScriptTest {

    @Test
    void seedDataDoesNotDeletePersistentAuthRows() throws Exception {
        String sql = normalizedDataSql();

        assertThat(sql)
                .doesNotContain("drop table if exists user_roles")
                .doesNotContain("drop table if exists auth_user_roles")
                .doesNotContain("delete from role_permissions")
                .doesNotContain("delete from \"users\"")
                .doesNotContain("delete from companies");
    }

    private static String normalizedDataSql() throws Exception {
        ClassPathResource resource = new ClassPathResource("db/migration/V2__seed_platform_reference_data.sql");
        String sql = new String(resource.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        return sql.toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
    }
}
