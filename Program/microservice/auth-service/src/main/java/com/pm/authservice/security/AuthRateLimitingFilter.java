package com.pm.authservice.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * B8: coarse per-IP rate limiting on the unauthenticated auth endpoints, as a first
 * line of defence against credential-stuffing, refresh abuse, and password-reset spam
 * (which would otherwise burn SES quota / cost). It complements the per-account lockout
 * in {@code AuthService}: the lockout protects a single account, this protects the
 * endpoints as a whole and slows account enumeration.
 *
 * <p>Uses a fixed-window counter kept in memory, so limits are enforced per service
 * instance. That is sufficient for a single-instance deployment; a horizontally scaled
 * deployment should move this to a shared store (e.g. Redis / Spring Cloud Gateway
 * RequestRateLimiter) — tracked as a follow-up to B8.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class AuthRateLimitingFilter extends OncePerRequestFilter {

    /** Login and refresh: moderately generous so real users retyping a password are fine. */
    private static final Set<String> STANDARD_PATHS = Set.of("/login", "/refresh");

    /** Password-reset request/confirm: stricter, these trigger emails. */
    private static final Set<String> SENSITIVE_PATHS = Set.of("/forgot-password", "/reset-password");

    private final int standardLimit;
    private final int sensitiveLimit;
    private final long windowSeconds;
    private final int maxTrackedKeys;

    private final Map<String, Window> windows = new ConcurrentHashMap<>();

    public AuthRateLimitingFilter(
            @Value("${auth.rate-limit.standard-per-window:20}") int standardLimit,
            @Value("${auth.rate-limit.sensitive-per-window:5}") int sensitiveLimit,
            @Value("${auth.rate-limit.window-seconds:60}") long windowSeconds,
            @Value("${auth.rate-limit.max-tracked-keys:100000}") int maxTrackedKeys) {
        this.standardLimit = standardLimit;
        this.sensitiveLimit = sensitiveLimit;
        this.windowSeconds = windowSeconds;
        this.maxTrackedKeys = maxTrackedKeys;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return limitFor(normalizePath(request)) <= 0;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String path = normalizePath(request);
        int limit = limitFor(path);

        long nowSeconds = Instant.now().getEpochSecond();
        long windowStart = nowSeconds - (nowSeconds % windowSeconds);
        String key = clientIp(request) + "|" + path + "|" + windowStart;

        if (windows.size() > maxTrackedKeys) {
            windows.entrySet().removeIf(e -> e.getValue().windowStart < windowStart);
        }

        Window window = windows.compute(key, (k, existing) ->
                existing != null ? existing : new Window(windowStart));
        int count = window.count.incrementAndGet();

        if (count > limit) {
            long retryAfter = (windowStart + windowSeconds) - nowSeconds;
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setHeader(HttpHeaders.RETRY_AFTER, String.valueOf(Math.max(retryAfter, 1)));
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.getWriter().write("{\"error\":\"TOO_MANY_REQUESTS\",\"message\":\"Too many requests. Please try again later.\"}");
            return;
        }

        chain.doFilter(request, response);
    }

    private int limitFor(String path) {
        if (SENSITIVE_PATHS.contains(path)) {
            return sensitiveLimit;
        }
        if (STANDARD_PATHS.contains(path)) {
            return standardLimit;
        }
        return 0; // not a rate-limited endpoint
    }

    private static String normalizePath(HttpServletRequest request) {
        String path = request.getServletPath();
        if (path == null) {
            return "";
        }
        if (path.length() > 1 && path.endsWith("/")) {
            path = path.substring(0, path.length() - 1);
        }
        return path;
    }

    /** Prefer the first X-Forwarded-For hop (set by the gateway) over the socket address. */
    private static String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            int comma = forwarded.indexOf(',');
            String first = comma > 0 ? forwarded.substring(0, comma) : forwarded;
            if (!first.isBlank()) {
                return first.trim();
            }
        }
        String remote = request.getRemoteAddr();
        return remote == null ? "unknown" : remote;
    }

    private static final class Window {
        private final long windowStart;
        private final AtomicInteger count = new AtomicInteger(0);

        private Window(long windowStart) {
            this.windowStart = windowStart;
        }
    }
}
