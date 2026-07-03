package com.pm.contractservice;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class DockerComposeConfigurationTest {

    @Test
    void contractServiceUsesUserServiceGrpcAddressInDocker() throws Exception {
        String compose = Files.readString(Path.of("..", "docker-compose.yml"));
        String contractService = compose.substring(
                compose.indexOf("  contract-service:"),
                compose.indexOf("  planning-service:")
        );

        assertThat(contractService).contains("USER_SERVICE_ADDRESS: \"user-service\"");
        assertThat(contractService).contains("USER_SERVICE_GRPC_PORT: \"9006\"");
        assertThat(contractService).contains("depends_on: [contract-service-db, user-service, kafka]");
    }

    @Test
    void composeRequiresRuntimeSecretsAndDoesNotCommitKnownSecretValues() throws Exception {
        String compose = Files.readString(Path.of("..", "docker-compose.yml"));

        assertThat(compose).contains("JWT_SECRET: \"${JWT_SECRET:?JWT_SECRET must be set}\"");
        assertThat(compose).contains("PASSWORD_RESET_HMAC_SECRET: \"${PASSWORD_RESET_HMAC_SECRET:?PASSWORD_RESET_HMAC_SECRET must be set}\"");
        assertThat(compose).contains("POSTGRES_PASSWORD: \"${AUTH_SERVICE_DB_PASSWORD:?AUTH_SERVICE_DB_PASSWORD must be set}\"");
        assertThat(compose).contains("SPRING_DATASOURCE_PASSWORD: \"${AUTH_SERVICE_DB_PASSWORD:?AUTH_SERVICE_DB_PASSWORD must be set}\"");
        assertThat(compose).doesNotMatch("(?s).*JWT_SECRET: \"[0-9a-f]{64}\".*");
        assertThat(compose).doesNotMatch("(?s).*PASSWORD_RESET_HMAC_SECRET: \"\\$\\{PASSWORD_RESET_HMAC_SECRET:-.*");
        assertThat(compose).doesNotMatch("(?s).*POSTGRES_PASSWORD:\\s+password.*");
        assertThat(compose).doesNotMatch("(?s).*SPRING_DATASOURCE_PASSWORD:\\s+\"password\".*");
    }

    @Test
    void composeLetsFlywayOwnEveryServiceSchema() throws Exception {
        String compose = Files.readString(Path.of("..", "docker-compose.yml"));

        assertThat(compose).doesNotContain("SPRING_JPA_HIBERNATE_DDL_AUTO: \"update\"");
        assertThat(compose).doesNotContain("SPRING_SQL_INIT_MODE: \"always\"");
        assertThat(compose).contains("SPRING_JPA_HIBERNATE_DDL_AUTO: \"validate\"");
        assertThat(compose).contains("SPRING_SQL_INIT_MODE: \"never\"");
    }

    @Test
    void nonPlanningServicesUseVersionedMigrationsInsteadOfDataSql() {
        Path servicesRoot = Path.of("..");
        for (String service : List.of("auth-service", "user-service", "contract-service", "payroll-service", "timesheet-service")) {
            Path resources = servicesRoot.resolve(service).resolve("src").resolve("main").resolve("resources");

            assertThat(resources.resolve("data.sql"))
                    .as(service + " data.sql")
                    .doesNotExist();
            assertThat(resources.resolve("db").resolve("migration").resolve("V1__init_schema.sql"))
                    .as(service + " first Flyway migration")
                    .exists();
        }
    }
}
