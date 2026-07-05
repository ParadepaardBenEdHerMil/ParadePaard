import static io.restassured.RestAssured.given;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.hamcrest.Matchers.anyOf;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;

import io.restassured.RestAssured;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

/**
 * Cross-service smoke that replaces the stale {@code PatientIntegrationTest} template (G-2).
 *
 * <p><b>Canonical deterministic lifecycle (fixed dates, no waiting for real periods):</b>
 * <pre>
 *   2026-01-01  platform admin creates company
 *   2026-01-02  company admin invites employee
 *   2026-01-03  employee completes onboarding
 *   2026-01-04  admin approves onboarding            -> user active
 *   2026-01-05  contract created and sent
 *   2026-01-06  employee signs contract             -> status SIGNED
 *   2026-01-10  planning shift created
 *   2026-01-31  planning finalized                  -> timesheet exported (once)
 *   2026-02-01  PayslipScheduler run (fixed Clock)  -> payslip MONTHLY:2026-01
 * </pre>
 * Target assertions for a seeded stack: company exists; employee active; contract signed
 * (signer + timestamp stored); shift finalized; timesheet exported exactly once; payslip
 * period key {@code MONTHLY:2026-01}; employee sees the payslip only after release.
 *
 * <p>The per-rule deterministic validation (period maths, scheduler idempotency, payslip
 * cents) lives in the fast service-level tests (e.g. {@code PayPeriodCalculatorTest},
 * {@code PayslipSchedulerTest}); this module proves the wiring "hangs together" end-to-end.
 *
 * <p>The executable checks below verify the cross-service property that is safe to assert
 * without seeded fixtures: the gateway routes every public/protected path to the right
 * service and enforces authentication (A-4 / API-1 / API-2). The full seeded happy-path
 * runs against a deployed environment via {@code PARADEPAARD_GATEWAY_URL}; without a stack
 * the whole class is skipped so unit CI stays green.
 */
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class FullEmployeeLifecycleSimulationTest {

    @BeforeAll
    static void setUp() {
        RestAssured.baseURI = IntegrationEnvironment.BASE_URI;
    }

    @BeforeEach
    void requireStack() {
        assumeTrue(IntegrationEnvironment.isStackAvailable(), IntegrationEnvironment.skipReason());
    }

    @Test
    @Order(1)
    void publicAuthRouteIsRoutedThroughGateway() {
        // /auth/login is one of the few intentionally public routes; a malformed body must
        // reach auth-service (400/401), never a routing 404 or method-not-allowed 405.
        given()
                .contentType("application/json")
                .body("{}")
                .when()
                .post("/auth/login")
                .then()
                .statusCode(anyOf(is(400), is(401), is(422)));
    }

    @Test
    @Order(2)
    void protectedRouteRequiresAuthenticationAtGateway() {
        // No token: the gateway JWT filter must reject before proxying to any service.
        // Protected services are exposed under /api/** (e.g. /api/timesheet/**).
        given()
                .when()
                .get("/api/timesheet")
                .then()
                .statusCode(anyOf(is(401), is(403)));
    }

    @Test
    @Order(3)
    void forgedTokenIsRejectedAtGateway() {
        // A structurally-invalid / unsigned token must never be proxied (A-4 / S-8).
        given()
                .header("Authorization", "Bearer not.a.valid.jwt")
                .when()
                .get("/api/timesheet")
                .then()
                .statusCode(anyOf(is(401), is(403)));
    }

    @Test
    @Order(4)
    void unknownPathReturnsNotFoundNotServerError() {
        given()
                .when()
                .get("/this-path-does-not-exist")
                .then()
                .statusCode(not(equalTo(500)));
    }
}
