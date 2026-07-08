package com.pm.contractservice.exception;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void mapsIllegalArgumentToBadRequestWithMessage() {
        ResponseEntity<Map<String, String>> response = handler.handleIllegalArgument(
                new IllegalArgumentException(
                        "The gross hourly wage €14.71 is below the Dutch minimum wage €14.99 for a contract starting 2026-07-08."
                )
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody())
                .containsEntry(
                        "message",
                        "The gross hourly wage €14.71 is below the Dutch minimum wage €14.99 for a contract starting 2026-07-08."
                );
    }
}
