import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.notNullValue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import io.restassured.RestAssured;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

public class AuthIntegrationTest {

    @BeforeAll
    static void setUp() {
        RestAssured.baseURI = IntegrationEnvironment.BASE_URI;
    }

    @BeforeEach
    void requireStack() {
        // Skip (don't fail) when no stack is running so the module stays green in unit CI.
        assumeTrue(IntegrationEnvironment.isStackAvailable(), IntegrationEnvironment.skipReason());
    }

    @Test
    public void shouldLogInWithValidCredentialsAndSetSessionCookie() {
        // Self-contained: register a fresh user, then log in. The current auth API is
        // username-based (the generated username is returned by /auth/register) and issues
        // the session as httpOnly cookies (accessToken/refreshToken), not a token in the body.
        String unique = "it-" + System.currentTimeMillis();
        String email = unique + "@test.com";
        String password = "Passw0rd!123";

        String registerPayload = "{"
                + "\"firstName\":\"Int\",\"lastName\":\"Test\","
                + "\"email\":\"" + email + "\","
                + "\"password\":\"" + password + "\","
                + "\"companyName\":\"IntegrationTestCo-" + unique + "\","
                + "\"mustChangePassword\":false}";

        String username = given()
                .contentType("application/json")
                .body(registerPayload)
                .when()
                .post("/auth/register")
                .then()
                .statusCode(200)
                .body("username", notNullValue())
                .extract()
                .jsonPath()
                .getString("username");

        String loginPayload = "{\"username\":\"" + username + "\",\"password\":\"" + password + "\"}";

        given()
                .contentType("application/json")
                .body(loginPayload)
                .when()
                .post("/auth/login")
                .then()
                .statusCode(200)
                .cookie("accessToken", notNullValue());
    }

    @Test
    public void shouldReturnUnauthorizedOnInvalidLogin() {
        String loginPayload = """
          {
            "email": "invalid_user@test.com",
            "password": "wrongpassword"
          }
        """;

        given()
                .contentType("application/json")
                .body(loginPayload)
                .when()
                .post("/auth/login")
                .then()
                .statusCode(401);
    }
}
