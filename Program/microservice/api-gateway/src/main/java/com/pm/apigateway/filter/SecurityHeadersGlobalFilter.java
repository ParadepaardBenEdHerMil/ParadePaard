package com.pm.apigateway.filter;

import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.util.UriComponentsBuilder;
import reactor.core.publisher.Mono;

import java.net.URI;

@Component
public class SecurityHeadersGlobalFilter implements GlobalFilter, Ordered {

    private static final String HSTS = "Strict-Transport-Security";
    private static final String FORWARDED_PROTO = "X-Forwarded-Proto";

    private final GatewaySecurityProperties properties;

    public SecurityHeadersGlobalFilter(GatewaySecurityProperties properties) {
        this.properties = properties;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        ServerHttpResponse response = exchange.getResponse();

        if (properties.isRequireHttps() && !isHttps(request)) {
            response.setStatusCode(HttpStatus.PERMANENT_REDIRECT);
            response.getHeaders().setLocation(httpsRedirectUri(request.getURI()));
            addBaselineSecurityHeaders(response.getHeaders());
            return response.setComplete();
        }

        addBaselineSecurityHeaders(response.getHeaders());
        if (properties.isHstsEnabled() && isHttps(request)) {
            response.getHeaders().set(HSTS, "max-age=" + properties.getHstsMaxAge().toSeconds() + "; includeSubDomains");
        }

        return chain.filter(exchange);
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE;
    }

    private static boolean isHttps(ServerHttpRequest request) {
        String forwardedProto = request.getHeaders().getFirst(FORWARDED_PROTO);
        if (forwardedProto != null) {
            return "https".equalsIgnoreCase(forwardedProto.split(",")[0].trim());
        }
        return "https".equalsIgnoreCase(request.getURI().getScheme());
    }

    private static URI httpsRedirectUri(URI uri) {
        // build(true) treats the existing components as already-encoded, so the raw query
        // (e.g. ?next=%2Fdashboard) is preserved verbatim rather than re-encoded.
        return UriComponentsBuilder.fromUri(uri)
                .scheme("https")
                .port(-1)
                .build(true)
                .toUri();
    }

    private static void addBaselineSecurityHeaders(HttpHeaders headers) {
        headers.set("X-Content-Type-Options", "nosniff");
        headers.set("X-Frame-Options", "DENY");
        headers.set("Referrer-Policy", "no-referrer");
    }
}
