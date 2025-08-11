// src/main/java/com/pm/payrollservice/exception/GrpcExceptionHandler.java
package com.pm.payrollservice.exception;

import io.grpc.Status;
import io.grpc.StatusRuntimeException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GrpcExceptionHandler {

    @ExceptionHandler(StatusRuntimeException.class)
    public ResponseEntity<String> handle(StatusRuntimeException ex) {
        HttpStatus http = map(ex.getStatus().getCode());
        String body = ex.getStatus().getDescription() == null ? "grpc error" : ex.getStatus().getDescription();
        return ResponseEntity.status(http).body(body);
    }

    private HttpStatus map(Status.Code code) {
        return switch (code) {
            case INVALID_ARGUMENT -> HttpStatus.BAD_REQUEST;
            case NOT_FOUND -> HttpStatus.NOT_FOUND;
            case PERMISSION_DENIED -> HttpStatus.FORBIDDEN;
            case UNAUTHENTICATED -> HttpStatus.UNAUTHORIZED;
            case ALREADY_EXISTS -> HttpStatus.CONFLICT;
            case FAILED_PRECONDITION -> HttpStatus.PRECONDITION_FAILED;
            case RESOURCE_EXHAUSTED -> HttpStatus.TOO_MANY_REQUESTS;
            case UNAVAILABLE -> HttpStatus.SERVICE_UNAVAILABLE;
            case DEADLINE_EXCEEDED -> HttpStatus.GATEWAY_TIMEOUT;
            case UNIMPLEMENTED -> HttpStatus.NOT_IMPLEMENTED;
            case INTERNAL -> HttpStatus.BAD_GATEWAY;
            default -> HttpStatus.BAD_GATEWAY;
        };
    }
}
