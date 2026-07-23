package com.pm.apigateway;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ApiGatewayRouteConfigurationTest {

    @Test
    void publicApplicationSubmissionRouteIsForwardedToUserServiceWithoutJwt() throws IOException {
        String route = routeBlock("user-service-public-applications");

        assertThat(route).contains("uri: ${USER_SERVICE_URL:http://user-service:4006}");
        assertThat(route).contains("- Path=/api/applications");
        assertThat(route).contains("- StripPrefix=1");
        assertThat(route).doesNotContain("JwtValidation");
    }

    @Test
    void platformCompanyScopeRouteIsForwardedToAuthServiceWithJwtValidation() throws IOException {
        String route = routeBlock("auth-service-protected");

        assertThat(route).contains("uri: ${AUTH_SERVICE_URL:http://auth-service:4005}");
        assertThat(route).contains("/auth/platform/company-scope");
        assertThat(route).contains("- StripPrefix=1");
        assertThat(route).contains("- JwtValidation");
    }

    @Test
    void productionProfileRoutesToCurrentServicesAndDoesNotExposePatientRoutes() throws IOException {
        String prodYaml = readApplicationYaml("application-prod.yml");

        assertThat(prodYaml).doesNotContain("patient-service");
        assertThat(prodYaml).doesNotContain("/api/patients");
        assertThat(prodYaml).contains("uri: ${AUTH_SERVICE_URL:http://auth-service:4005}");
        assertThat(prodYaml).contains("uri: ${USER_SERVICE_URL:http://user-service:4006}");
        assertThat(prodYaml).contains("uri: ${CONTRACT_SERVICE_URL:http://contract-service:4002}");
        assertThat(prodYaml).contains("uri: ${PAYROLL_SERVICE_URL:http://payroll-service:4000}");
        assertThat(prodYaml).contains("uri: ${PLANNING_SERVICE_URL:http://planning-service:4010}");
        assertThat(prodYaml).contains("uri: ${TIMESHEET_SERVICE_URL:http://timesheet-service:4001}");
        assertThat(prodYaml).contains("${FRONTEND_ORIGIN}");
        assertThat(prodYaml).contains("forward-headers-strategy: framework");
        assertThat(prodYaml).contains("require-https: ${GATEWAY_REQUIRE_HTTPS:true}");
        assertThat(prodYaml).contains("hsts-enabled: ${GATEWAY_HSTS_ENABLED:true}");
    }

    private static String routeBlock(String routeId) throws IOException {
        List<String> lines = readApplicationYaml("application.yml").lines().toList();
        int routeStart = -1;
        for (int i = 0; i < lines.size(); i++) {
            if (lines.get(i).trim().equals("- id: " + routeId)) {
                routeStart = i;
                break;
            }
        }

        assertThat(routeStart)
                .withFailMessage("Expected application.yml to contain route id %s", routeId)
                .isNotNegative();

        int routeEnd = lines.size();
        for (int i = routeStart + 1; i < lines.size(); i++) {
            if (lines.get(i).trim().startsWith("- id: ")) {
                routeEnd = i;
                break;
            }
        }
        return String.join("\n", lines.subList(routeStart, routeEnd));
    }

    private static String readApplicationYaml(String resourceName) throws IOException {
        try (InputStream stream = ApiGatewayRouteConfigurationTest.class
                .getClassLoader()
                .getResourceAsStream(resourceName)) {
            assertThat(stream).as(resourceName + " test resource").isNotNull();
            return new String(stream.readAllBytes(), StandardCharsets.UTF_8);
        }
    }
}
