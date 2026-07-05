package com.pm.apigateway.filter;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilter;
import org.springframework.cloud.gateway.filter.factory.AbstractGatewayFilterFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Mono;

import java.util.List;

@Component
public class JwtValidationGatewayFilterFactory extends AbstractGatewayFilterFactory<Object> {

    private final WebClient webClient;
    private final LocalJwtValidator localJwtValidator;
    private static final Logger log = LoggerFactory.getLogger(JwtValidationGatewayFilterFactory.class);

    public JwtValidationGatewayFilterFactory(
            WebClient.Builder webClientBuilder,
            @Value("${auth.service.url}") String authServiceUrl,
            LocalJwtValidator localJwtValidator
    ) {
        this.webClient = webClientBuilder.baseUrl(authServiceUrl).build();
        this.localJwtValidator = localJwtValidator;
    }

    @Override
    public GatewayFilter apply(Object config) {
        return (exchange, chain) -> {
            ServerHttpRequest request = exchange.getRequest();
            ServerHttpResponse response = exchange.getResponse();
            String path = request.getPath().toString();

            log.debug("JWT Validation filter processing request to: {}", path);

            String bearerAccessToken = extractBearerTokenFromAuthorizationHeader(request);
            if (bearerAccessToken != null && !bearerAccessToken.isBlank()) {
                log.debug("Authorization header bearer token present: true");
                return validateAccessToken(bearerAccessToken)
                        .flatMap(isValid -> {
                            if (isValid) {
                                log.debug("Authorization header access token is valid");
                                // Ensure downstream services always receive the token as Authorization header.
                                ServerHttpRequest mutated = request.mutate()
                                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + bearerAccessToken)
                                        .build();
                                return chain.filter(exchange.mutate().request(mutated).build());
                            }
                            log.debug("Authorization header access token is invalid");
                            response.setStatusCode(HttpStatus.UNAUTHORIZED);
                            return response.setComplete();
                        })
                        .onErrorResume(e -> {
                            log.error("Error during token validation", e);
                            response.setStatusCode(HttpStatus.INTERNAL_SERVER_ERROR);
                            return response.setComplete();
                        });
            }

            String accessToken = extractTokenFromCookies(request, "accessToken");
            String refreshToken = extractTokenFromCookies(request, "refreshToken");

            log.debug("Access token present: {}, Refresh token present: {}",
                    accessToken != null, refreshToken != null);

            // If access token exists, validate it
            if (accessToken != null && !accessToken.isBlank()) {
                return validateAccessToken(accessToken)
                        .flatMap(isValid -> {
                            if (isValid) {
                                log.debug("Access token is valid");
                                ServerHttpRequest mutated = request.mutate()
                                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                                        .build();
                                return chain.filter(exchange.mutate().request(mutated).build());
                            } else {
                                log.debug("Access token is invalid, attempting refresh");
                                if (refreshToken != null && !refreshToken.isBlank()) {
                                    return refreshTokenAndContinue(refreshToken, exchange, chain, response);
                                } else {
                                    log.debug("No valid tokens available");
                                    response.setStatusCode(HttpStatus.UNAUTHORIZED);
                                    return response.setComplete();
                                }
                            }
                        })
                        .onErrorResume(e -> {
                            log.error("Error during token validation", e);
                            response.setStatusCode(HttpStatus.INTERNAL_SERVER_ERROR);
                            return response.setComplete();
                        });
            }

            // No access token, try refresh token if available
            if (refreshToken != null && !refreshToken.isBlank()) {
                log.debug("No access token, attempting refresh");
                return refreshTokenAndContinue(refreshToken, exchange, chain, response);
            }

            log.debug("No tokens available for request to: {}", path);
            response.setStatusCode(HttpStatus.UNAUTHORIZED);
            return response.setComplete();
        };
    }

    private String extractTokenFromCookies(ServerHttpRequest request, String cookieName) {
        if (request.getCookies().containsKey(cookieName)) {
            return request.getCookies().getFirst(cookieName).getValue();
        }
        return null;
    }

    private String extractBearerTokenFromAuthorizationHeader(ServerHttpRequest request) {
        String auth = request.getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        if (auth == null) return null;
        if (!auth.startsWith("Bearer ")) return null;
        return auth.substring(7).trim();
    }

    private Mono<Boolean> validateAccessToken(String accessToken) {
        // S2: validate signature + expiry locally instead of calling auth-service /validate
        // on every request. Revocation is still enforced at the /refresh boundary below.
        return Mono.just(localJwtValidator.isValid(accessToken));
    }

    private Mono<Void> refreshTokenAndContinue(
            String refreshToken,
            org.springframework.web.server.ServerWebExchange exchange,
            org.springframework.cloud.gateway.filter.GatewayFilterChain chain,
            ServerHttpResponse response
    ) {
        log.debug("Attempting token refresh");
        return webClient.post()
                .uri("/refresh")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + refreshToken)
                .retrieve()
                .toEntity(String.class)
                .flatMap(refreshResponse -> {
                    // Extract Set-Cookie headers from the refresh response
                    List<String> setCookieHeaders = refreshResponse.getHeaders().get(HttpHeaders.SET_COOKIE);

                    if (setCookieHeaders != null && !setCookieHeaders.isEmpty()) {
                        String newAccessToken = null;

                        // Forward the cookies to the client
                        for (String setCookieHeader : setCookieHeaders) {
                            response.getHeaders().add(HttpHeaders.SET_COOKIE, setCookieHeader);

                            // Extract the new access token from the cookie for the Authorization header
                            if (setCookieHeader.startsWith("accessToken=")) {
                                String tokenValue = setCookieHeader.substring(12); // Remove "accessToken="
                                int semicolonIndex = tokenValue.indexOf(';');
                                if (semicolonIndex > 0) {
                                    newAccessToken = tokenValue.substring(0, semicolonIndex);
                                } else {
                                    newAccessToken = tokenValue;
                                }
                                log.debug("Successfully refreshed access token");
                            }
                        }

                        // Continue with the request, adding the new access token to the Authorization header
                        ServerHttpRequest mutated = exchange.getRequest().mutate()
                                .header(HttpHeaders.AUTHORIZATION, "Bearer " + (newAccessToken != null ? newAccessToken : ""))
                                .build();

                        return chain.filter(exchange.mutate().request(mutated).build());
                    } else {
                        // Refresh failed or did not return cookies
                        log.debug("Token refresh failed - no cookies returned");
                        response.setStatusCode(HttpStatus.UNAUTHORIZED);
                        return response.setComplete();
                    }
                })
                .onErrorResume(WebClientResponseException.Unauthorized.class, ex -> {
                    log.debug("Refresh token is invalid or expired");
                    response.setStatusCode(HttpStatus.UNAUTHORIZED);
                    return response.setComplete();
                })
                .onErrorResume(Exception.class, ex -> {
                    log.error("Error during token refresh", ex);
                    response.setStatusCode(HttpStatus.INTERNAL_SERVER_ERROR);
                    return response.setComplete();
                });
    }
}
