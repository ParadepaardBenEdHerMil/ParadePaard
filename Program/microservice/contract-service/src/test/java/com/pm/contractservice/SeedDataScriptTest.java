package com.pm.contractservice;

import com.pm.contractservice.model.ContractStatus;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

import java.nio.charset.StandardCharsets;
import java.util.Locale;

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

        assertThat(sql).contains("contracts_status_check");
        for (ContractStatus status : ContractStatus.values()) {
            assertThat(sql).contains(status.name());
        }
    }

    private static String rawDataSql() throws Exception {
        ClassPathResource resource = new ClassPathResource("db/migration/V1__init_schema.sql");
        return new String(resource.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
    }

    private static String normalizedDataSql() throws Exception {
        return rawDataSql().toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
    }
}
