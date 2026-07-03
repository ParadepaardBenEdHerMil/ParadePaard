package com.pm.contractservice;

import com.pm.contractservice.model.ContractStatus;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Locale;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

class SeedDataScriptTest {

    @Test
    void seedDataDoesNotDeletePersistentContractRows() throws Exception {
        String sql = normalizedDataSql();

        assertThat(sql)
                .doesNotContain("delete from contracts")
                .doesNotContain("delete from functions");
    }

    @Test
    void seedDataKeepsContractsStatusCheckAlignedWithContractStatusEnum() throws Exception {
        String sql = rawDataSql();

        assertThat(sql)
                .contains("ALTER TABLE IF EXISTS contracts DROP CONSTRAINT IF EXISTS contracts_status_check;");

        var matcher = Pattern
                .compile(
                        "ALTER TABLE IF EXISTS contracts ADD CONSTRAINT contracts_status_check CHECK \\(status IN \\((?<values>[^;]+)\\)\\);",
                        Pattern.CASE_INSENSITIVE | Pattern.DOTALL
                )
                .matcher(sql);

        assertThat(matcher.find()).isTrue();

        String constraintValues = matcher.group("values");
        String[] expectedStatuses = Arrays.stream(ContractStatus.values())
                .map(status -> "'" + status.name() + "'")
                .toArray(String[]::new);

        assertThat(constraintValues).contains(expectedStatuses);
    }

    private static String rawDataSql() throws Exception {
        ClassPathResource resource = new ClassPathResource("db/migration/V1__init_schema.sql");
        return new String(resource.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
    }

    private static String normalizedDataSql() throws Exception {
        return rawDataSql().toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
    }
}
