package com.pm.authservice.config;

import com.pm.authservice.security.JwtRequestFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity(prePostEnabled = true)
public class SecurityConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
    List<String> allowedOrigins = List.of("http://localhost:5173");

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOriginPatterns(List.of("*"));
        configuration.setAllowedOrigins(allowedOrigins);
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }


    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http, JwtRequestFilter jwtRequestFilter) throws Exception {
        return http
                // Enable CORS
                .cors(Customizer.withDefaults())

                // Disable CSRF (required for stateless JWT)
                .csrf(AbstractHttpConfigurer::disable)

                // Disable form login
                .formLogin(AbstractHttpConfigurer::disable)

                // Disable HTTP Basic
                .httpBasic(AbstractHttpConfigurer::disable)

                // Stateless sessions
                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))

                // Authorization rules - ORDER MATTERS!
                .authorizeHttpRequests(auth -> auth
                        // Public endpoints - these are the actual paths after gateway routing
                        .requestMatchers(
                                "/register", "/register/",     // After StripPrefix=1 from /auth/register
                                "/login", "/login/",           // After StripPrefix=1 from /auth/login
                                "/forgot-password", "/forgot-password/",
                                "/reset-password", "/reset-password/",
                                "/validate", "/validate/",
                                "/refresh", "/refresh/",
                                "/actuator/**",
                                "/v3/api-docs/**",
                                "/swagger-ui/**",
                                "/swagger-resources/**",
                                "/error"
                        ).permitAll()

                        // Admin endpoints (after prefix stripping)
                        .requestMatchers("/admin/**").authenticated()

                        // Everything else requires authentication
                        .anyRequest().authenticated()
                )

                // Add JWT filter
                .addFilterBefore(jwtRequestFilter, UsernamePasswordAuthenticationFilter.class)

                .build();
    }
}
