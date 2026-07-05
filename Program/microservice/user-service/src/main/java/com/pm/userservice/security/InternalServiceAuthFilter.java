package com.pm.userservice.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * S1: when a request to an internal endpoint carries a valid
 * {@code X-Internal-Service-Token}, authenticate it as a trusted service with the
 * {@code INTERNAL_SERVICE} authority. Requests without the header (or with an invalid
 * one) are left untouched, so normal user-JWT authentication still applies.
 *
 * <p>Constructed by {@link com.pm.userservice.config.SecurityConfig} and inserted into
 * the security filter chain (not a component), so it stays self-contained and doesn't
 * force every {@code @WebMvcTest} slice that imports SecurityConfig to declare extra beans.
 */
public class InternalServiceAuthFilter extends OncePerRequestFilter {

    private final InternalServiceTokenService tokenService;

    public InternalServiceAuthFilter(InternalServiceTokenService tokenService) {
        this.tokenService = tokenService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String presented = request.getHeader(InternalServiceTokenService.HEADER);
        if (presented != null
                && tokenService.matches(presented)
                && SecurityContextHolder.getContext().getAuthentication() == null) {
            var authentication = new UsernamePasswordAuthenticationToken(
                    "internal-service",
                    null,
                    List.of(new SimpleGrantedAuthority(InternalServiceTokenService.INTERNAL_SERVICE_AUTHORITY)));
            SecurityContextHolder.getContext().setAuthentication(authentication);
        }
        filterChain.doFilter(request, response);
    }
}
