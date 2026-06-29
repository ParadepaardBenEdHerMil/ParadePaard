import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.notNullValue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import io.restassured.RestAssured;
import io.restassured.response.Response;
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
    public void shouldReturnOKWithValidToken() {
        String loginPayload = """
                  {
                    "email": "testuser@test.com",
                    "password": "password123"
                  }
                """;

        Response response = given()
                .contentType("application/json")
                .body(loginPayload)
                .when()
                .post("/auth/login")
                .then()
                .statusCode(200)
                .body("token", notNullValue())
                .extract()
                .response();

        System.out.println("Generated Token: " + response.jsonPath().getString("token"));
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
