package com.pm.contractservice;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class DockerComposeConfigurationTest {

    private static final Map<String, String> HTTP_SERVICE_PORTS = Map.of(
            "auth-service", "4005",
            "user-service", "4006",
            "timesheet-service", "4001",
            "contract-service", "4002",
            "planning-service", "4010",
            "payroll-service", "4000",
            "api-gateway", "4004"
    );

    private static final List<String> DATABASE_SERVICES = List.of(
            "auth-service-db",
            "user-service-db",
            "payroll-service-db",
            "timesheet-service-db",
            "contract-service-db",
            "planning-service-db"
    );

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

    @Test
    void applicationConfigsDoNotDefaultSensitiveLoggingToDebug() throws Exception {
        Path servicesRoot = Path.of("..");

        for (String service : HTTP_SERVICE_PORTS.keySet()) {
            Path application = servicesRoot.resolve(service).resolve("src").resolve("main").resolve("resources").resolve("application.yml");
            String yaml = Files.readString(application);

            assertThat(yaml)
                    .as(service + " application.yml")
                    .doesNotContain(": DEBUG")
                    .contains("ROOT: ${ROOT_LOG_LEVEL:INFO}");
        }

        String authYaml = Files.readString(servicesRoot.resolve("auth-service").resolve("src/main/resources/application.yml"));
        String userYaml = Files.readString(servicesRoot.resolve("user-service").resolve("src/main/resources/application.yml"));
        String gatewayYaml = Files.readString(servicesRoot.resolve("api-gateway").resolve("src/main/resources/application.yml"));
        String gatewayProdYaml = Files.readString(servicesRoot.resolve("api-gateway").resolve("src/main/resources/application-prod.yml"));

        assertThat(authYaml).contains("org.springframework.security: ${SPRING_SECURITY_LOG_LEVEL:INFO}");
        assertThat(userYaml).contains("org.springframework.security: ${SPRING_SECURITY_LOG_LEVEL:INFO}");
        assertThat(gatewayYaml).contains("org.springframework.cloud.gateway: ${GATEWAY_LOG_LEVEL:INFO}");
        assertThat(gatewayProdYaml).contains("org.springframework.cloud.gateway: ${GATEWAY_LOG_LEVEL:INFO}");
    }

    @Test
    void allServicesExposeActuatorReadinessConfiguration() throws Exception {
        Path servicesRoot = Path.of("..");

        for (String service : HTTP_SERVICE_PORTS.keySet()) {
            String pom = Files.readString(servicesRoot.resolve(service).resolve("pom.xml"));
            String yaml = Files.readString(servicesRoot.resolve(service).resolve("src/main/resources/application.yml"));

            assertThat(pom)
                    .as(service + " pom.xml")
                    .contains("<artifactId>spring-boot-starter-actuator</artifactId>");
            assertThat(yaml)
                    .as(service + " application.yml")
                    .contains("management:")
                    .contains("exposure:")
                    .contains("include: health,info")
                    .contains("probes:")
                    .contains("enabled: true")
                    .contains("show-details: never");
        }
    }

    @Test
    void composeDefinesHealthchecksForDatabasesAndHttpServices() throws Exception {
        String compose = Files.readString(Path.of("..", "docker-compose.yml"));

        for (String database : DATABASE_SERVICES) {
            assertThat(serviceBlock(compose, database))
                    .as(database + " healthcheck")
                    .contains("healthcheck:")
                    .contains("pg_isready -U admin_user -d db");
        }

        for (Map.Entry<String, String> service : HTTP_SERVICE_PORTS.entrySet()) {
            assertThat(serviceBlock(compose, service.getKey()))
                    .as(service.getKey() + " healthcheck")
                    .contains("healthcheck:")
                    .contains("http://localhost:" + service.getValue() + "/actuator/health/readiness");
        }
    }

    @Test
    void composeProvidesTlsProxyAndDatabaseBackupRestorePath() throws Exception {
        Path servicesRoot = Path.of("..");
        String compose = Files.readString(servicesRoot.resolve("docker-compose.yml"));
        String nginx = Files.readString(servicesRoot.resolve("deploy").resolve("nginx").resolve("paradepaard.conf"));
        String backup = Files.readString(servicesRoot.resolve("deploy").resolve("postgres-backup").resolve("backup-all.sh"));
        String restore = Files.readString(servicesRoot.resolve("deploy").resolve("postgres-backup").resolve("restore-one.sh"));

        assertThat(compose)
                .contains("tls-proxy:")
                .contains("profiles: [\"tls\"]")
                .contains("${TLS_CERT_PATH:?TLS_CERT_PATH must be set}")
                .contains("${TLS_KEY_PATH:?TLS_KEY_PATH must be set}")
                .contains("postgres-backup:")
                .contains("profiles: [\"backup\"]")
                .contains("BACKUP_INTERVAL_SECONDS")
                .contains("postgres_backups:");

        assertThat(nginx)
                .contains("return 308 https://$host$request_uri;")
                .contains("Strict-Transport-Security")
                .contains("proxy_set_header X-Forwarded-Proto https;");

        assertThat(backup).contains("pg_dump");
        assertThat(restore).contains("pg_restore");
        for (String database : DATABASE_SERVICES) {
            assertThat(backup).contains(database);
            assertThat(restore).contains(database);
        }
    }

    private static String serviceBlock(String compose, String serviceName) {
        String serviceHeader = "  " + serviceName + ":";
        int serviceStart = compose.indexOf(serviceHeader);
        assertThat(serviceStart)
                .withFailMessage("Expected docker-compose.yml to contain service %s", serviceName)
                .isNotNegative();

        int serviceEnd = compose.length();
        for (int i = serviceStart + serviceHeader.length(); i < compose.length() - 3; i++) {
            if (compose.charAt(i) == '\n' && compose.startsWith("  ", i + 1) && !compose.startsWith("    ", i + 1)) {
                serviceEnd = i;
                break;
            }
        }

        return compose.substring(serviceStart, serviceEnd);
    }
}
