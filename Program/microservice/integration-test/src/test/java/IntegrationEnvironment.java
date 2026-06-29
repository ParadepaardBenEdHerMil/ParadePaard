import java.io.IOException;
import java.net.URI;
import java.net.HttpURLConnection;

/**
 * Shared helper for the black-box integration suite.
 *
 * <p>These tests drive a running stack through the api-gateway. When no stack is up
 * (the normal case in unit CI), the tests must be <em>skipped</em>, not failed — so the
 * integration-test module stays green on every PR (G-1). Point the suite at a deployed
 * environment with {@code PARADEPAARD_GATEWAY_URL}.
 */
final class IntegrationEnvironment {

    /** api-gateway base URL; override per environment. */
    static final String BASE_URI =
            System.getenv().getOrDefault("PARADEPAARD_GATEWAY_URL", "http://localhost:4004");

    private static Boolean cachedAvailable;

    private IntegrationEnvironment() {
    }

    static synchronized boolean isStackAvailable() {
        if (cachedAvailable == null) {
            cachedAvailable = probe();
        }
        return cachedAvailable;
    }

    static String skipReason() {
        return "Gateway not reachable at " + BASE_URI
                + " — skipping live integration smoke (set PARADEPAARD_GATEWAY_URL to run).";
    }

    private static boolean probe() {
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) URI.create(BASE_URI + "/auth/login").toURL().openConnection();
            connection.setConnectTimeout(1500);
            connection.setReadTimeout(1500);
            connection.setRequestMethod("OPTIONS");
            connection.connect();
            connection.getResponseCode();
            return true;
        } catch (IOException | RuntimeException e) {
            return false;
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }
    }
}
