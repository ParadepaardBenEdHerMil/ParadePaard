package com.pm.apigateway.filter;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import reactor.core.publisher.Mono;

import java.net.URI;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;

class SecurityHeadersGlobalFilterTest {

    @Test
    void redirectsPlainHttpWhenHttpsIsRequired() {
        GatewaySecurityProperties properties = new GatewaySecurityProperties();
        properties.setRequireHttps(true);
        properties.setHstsEnabled(true);

        SecurityHeadersGlobalFilter filter = new SecurityHeadersGlobalFilter(properties);
        // Build from a URI directly: MockServerHttpRequest.get(String) runs .encode() on the
        // template, which would double-encode the already-encoded %2F (-> %252F). The URI
        // overload takes the value verbatim, so the request carries a genuine ?next=%2Fdashboard.
        MockServerWebExchange exchange = MockServerWebExchange.from(
                MockServerHttpRequest.method(
                        HttpMethod.GET,
                        URI.create("http://api.example.test/auth/login?next=%2Fdashboard")).build()
        );
        AtomicBoolean chainCalled = new AtomicBoolean(false);

        filter.filter(exchange, next -> {
            chainCalled.set(true);
            return Mono.empty();
        }).block();

        assertThat(chainCalled).isFalse();
        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.PERMANENT_REDIRECT);
        assertThat(exchange.getResponse().getHeaders().getLocation())
                .hasToString("https://api.example.test/auth/login?next=%2Fdashboard");
    }

    @Test
    void addsSecurityHeadersForForwardedHttpsRequests() {
        GatewaySecurityProperties properties = new GatewaySecurityProperties();
        properties.setRequireHttps(true);
        properties.setHstsEnabled(true);
        properties.setHstsMaxAge(Duration.ofDays(365));

        SecurityHeadersGlobalFilter filter = new SecurityHeadersGlobalFilter(properties);
        MockServerWebExchange exchange = MockServerWebExchange.from(
                MockServerHttpRequest.get("http://api-gateway:4004/api/users/me")
                        .header("X-Forwarded-Proto", "https")
                        .build()
        );
        AtomicBoolean chainCalled = new AtomicBoolean(false);

        filter.filter(exchange, next -> {
            chainCalled.set(true);
            return Mono.empty();
        }).block();

        HttpHeaders headers = exchange.getResponse().getHeaders();
        assertThat(chainCalled).isTrue();
        assertThat(exchange.getResponse().getStatusCode()).isNull();
        assertThat(headers.getFirst("Strict-Transport-Security"))
                .isEqualTo("max-age=31536000; includeSubDomains");
        assertThat(headers.getFirst("X-Content-Type-Options")).isEqualTo("nosniff");
        assertThat(headers.getFirst("X-Frame-Options")).isEqualTo("DENY");
        assertThat(headers.getFirst("Referrer-Policy")).isEqualTo("no-referrer");
    }
}
