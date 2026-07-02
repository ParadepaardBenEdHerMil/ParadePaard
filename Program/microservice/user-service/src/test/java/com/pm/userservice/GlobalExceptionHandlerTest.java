package com.pm.userservice;

import com.pm.userservice.exception.GlobalExceptionHandler;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;

import java.nio.charset.StandardCharsets;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void upstreamRawStackTraceBodyIsSanitizedToGenericMessage() {
        HttpServerErrorException ex = HttpServerErrorException.create(
                HttpStatus.BAD_GATEWAY,
                "Bad Gateway",
                HttpHeaders.EMPTY,
                """
                java.lang.RuntimeException: boom
                at com.pm.userservice.SomeClass.method(SomeClass.java:42)
                Caused by: org.postgresql.util.PSQLException: connection refused
                """.getBytes(StandardCharsets.UTF_8),
                StandardCharsets.UTF_8
        );

        ResponseEntity<Map<String, String>> response = handler.handleRestClientResponseException(ex);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_GATEWAY);
        assertThat(response.getBody()).containsEntry("message", "Upstream service error");
    }

    @Test
    void upstreamJsonMessageIsPreservedWhenSafe() {
        HttpClientErrorException ex = HttpClientErrorException.create(
                HttpStatus.CONFLICT,
                "Conflict",
                HttpHeaders.EMPTY,
                """
                {"message":"Contract already signed"}
                """.getBytes(StandardCharsets.UTF_8),
                StandardCharsets.UTF_8
        );

        ResponseEntity<Map<String, String>> response = handler.handleRestClientResponseException(ex);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody()).containsEntry("message", "Contract already signed");
    }

    @Test
    void upstreamHtmlBodyIsSanitizedToGenericMessage() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.TEXT_HTML);
        HttpServerErrorException ex = HttpServerErrorException.create(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "Internal Server Error",
                headers,
                """
                <html><body><h1>500</h1><pre>stack trace</pre></body></html>
                """.getBytes(StandardCharsets.UTF_8),
                StandardCharsets.UTF_8
        );

        ResponseEntity<Map<String, String>> response = handler.handleRestClientResponseException(ex);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(response.getBody()).containsEntry("message", "Upstream service error");
    }

    @Test
    void unexpectedRuntimeExceptionIsSanitizedToGenericMessage() {
        RuntimeException ex = new RuntimeException(
                "java.lang.IllegalStateException: boom at com.pm.userservice.SecretThing.run(SecretThing.java:42)"
        );

        ResponseEntity<Map<String, String>> response = handler.handleUnexpectedException(ex);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(response.getBody()).containsEntry("message", "Internal server error");
    }
}
