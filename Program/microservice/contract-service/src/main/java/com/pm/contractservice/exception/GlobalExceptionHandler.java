package com.pm.contractservice.exception;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

@ControllerAdvice
public class GlobalExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    private static final Map<Class<? extends RuntimeException>, String> EXCEPTION_MESSAGES = Map.of(
            ContractAlreadyExistsException.class, "Contract Already Exists",
            ContractNotFoundException.class, "Contract Not Found"
    );

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleValidationException(MethodArgumentNotValidException ex) {
        Map<String, String> errors = new HashMap<>();
        ex.getBindingResult().getFieldErrors().forEach((error) -> errors.put(error.getField(), error.getDefaultMessage()));
        return ResponseEntity.badRequest().body(errors);
    }

    /**
     * Business-rule rejections (e.g. an entered wage below the statutory minimum, or a
     * missing date of birth) surface as IllegalArgumentException. Without this handler they
     * bubble up as an opaque HTTP 500 stack trace; instead return a clean 400 whose message
     * the frontend can show to the admin verbatim.
     */
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleIllegalArgument(IllegalArgumentException ex) {
        log.warn("Rejected contract request: {}", ex.getMessage());
        return ResponseEntity.badRequest().body(Collections.singletonMap("message", ex.getMessage()));
    }

    @ExceptionHandler(ContractAlreadyExistsException.class)
    public ResponseEntity<Map<String, String>> handleContractAlreadyExists(ContractAlreadyExistsException ex) {
        log.warn("Data integrity violation: {}", ex.getMessage());
        String message = EXCEPTION_MESSAGES.getOrDefault(ex.getClass(), ex.getMessage());
        return ResponseEntity.badRequest().body(Collections.singletonMap("message", message));
    }

    @ExceptionHandler({
            ContractNotFoundException.class,
            FunctionNotFoundException.class
    })
    public ResponseEntity<Map<String, String>> handleNotFound(RuntimeException ex) {
        log.warn("Requested data not found: {}", ex.getMessage());
        String message = EXCEPTION_MESSAGES.getOrDefault(ex.getClass(), ex.getMessage());
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Collections.singletonMap("message", message));
    }

    @ExceptionHandler(ContractEmailDeliveryException.class)
    public ResponseEntity<Map<String, String>> handleContractEmailDelivery(ContractEmailDeliveryException ex) {
        log.warn("Contract email delivery failed: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                .body(Collections.singletonMap("message", ex.getMessage()));
    }
}
