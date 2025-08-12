//package com.pm.userservice.config;
//
//import io.jsonwebtoken.security.Keys;
//import org.springframework.beans.factory.annotation.Value;
//import org.springframework.context.annotation.Bean;
//import org.springframework.context.annotation.Configuration;
//import org.springframework.core.convert.converter.Converter;
//import org.springframework.http.HttpMethod;
//import org.springframework.security.authentication.AbstractAuthenticationToken;
//import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
//import org.springframework.security.config.annotation.web.builders.HttpSecurity;
//import org.springframework.security.oauth2.jwt.Jwt;
//import org.springframework.security.oauth2.jwt.JwtDecoder;
//import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
//import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
//import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
//import org.springframework.security.web.SecurityFilterChain;
//
//import javax.crypto.SecretKey;
//import java.nio.charset.StandardCharsets;
//import java.util.Base64;
//
//@Configuration
//@EnableMethodSecurity
//public class SecurityConfig {
//
//    @Bean
//    public SecurityFilterChain api(HttpSecurity http) throws Exception {
//        http.csrf(csrf -> csrf.disable());
//
//        http.authorizeHttpRequests(auth -> auth
//                .requestMatchers("/actuator/**").permitAll()
//                .requestMatchers(HttpMethod.POST, "/api/auth/**").permitAll()
//                .requestMatchers("/api/users/**").hasAnyAuthority("USER","ADMIN")
//                .anyRequest().authenticated()
//        );
//
//        http.oauth2ResourceServer(oauth -> oauth
//                .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthConverter()))
//        );
//
//        return http.build();
//    }
//
//    @Bean
//    public JwtDecoder jwtDecoder(@Value("${jwt.secret}") String secret) {
//        byte[] keyBytes = Base64.getDecoder().decode(secret.getBytes(StandardCharsets.UTF_8));
//        SecretKey key = Keys.hmacShaKeyFor(keyBytes);
//        return NimbusJwtDecoder.withSecretKey(key).build();
//    }
//
//    @Bean
//    public Converter<Jwt, ? extends AbstractAuthenticationToken> jwtAuthConverter() {
//        JwtGrantedAuthoritiesConverter roles = new JwtGrantedAuthoritiesConverter();
//        roles.setAuthoritiesClaimName("roles");
//        roles.setAuthorityPrefix("");
//
//        JwtAuthenticationConverter c = new JwtAuthenticationConverter();
//        c.setJwtGrantedAuthoritiesConverter(roles);
//        return c;
//    }
//}
