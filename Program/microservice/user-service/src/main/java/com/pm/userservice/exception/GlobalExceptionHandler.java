package com.pm.userservice.exception;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientResponseException;

import java.util.HashMap;
import java.util.Map;

@ControllerAdvice
public class GlobalExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleValidationException(MethodArgumentNotValidException ex){
        Map<String, String> errors = new HashMap<>();
        ex.getBindingResult().getFieldErrors().forEach((error)-> errors.put(error.getField(), error.getDefaultMessage()));

        return ResponseEntity.badRequest().body(errors);
    }

    @ExceptionHandler(EmailAlreadyExistsException.class)
    public ResponseEntity<Map<String, String>> handleEmailAlreadyExistsException(Exception ex){
        log.warn("Email already exists {}!",  ex.getMessage());
        Map<String, String> errors = new HashMap<>();
        errors.put("message", "Email Already Exists");
        return ResponseEntity.badRequest().body(errors);
    }

    @ExceptionHandler(UserNotFoundException.class)
    public ResponseEntity<Map<String, String>> handleUserNotFoundException(Exception ex){
        log.warn("User not found {}!",  ex.getMessage());
        Map<String, String> errors = new HashMap<>();
        errors.put("message", "User Not Found");
        return ResponseEntity.badRequest().body(errors);
    }

    @ExceptionHandler(InvalidIdentifierException.class)
    public ResponseEntity<Map<String, String>> handleInvalidIdentifier(InvalidIdentifierException ex){
        log.warn("Invalid identifier: {}", ex.getMessage());
        Map<String, String> errors = new HashMap<>();
        errors.put("message", ex.getMessage());
        return ResponseEntity.badRequest().body(errors);
    }

    @ExceptionHandler(BankAccountNumberAlreadyExistsException.class)
    public ResponseEntity<Map<String, String>> handleBankAccountNumberAlreadyExistsException(Exception ex){
        log.warn("Bank account number already exists {}!",  ex.getMessage());
        Map<String, String> errors = new HashMap<>();
        errors.put("message", "Bank Account Number Already Exists");
        return ResponseEntity.badRequest().body(errors);
    }

    @ExceptionHandler(PhoneNumberAlreadyExistsException.class)
    public ResponseEntity<Map<String, String>> handlePhoneNumberAlreadyExistsException(Exception ex){
        log.warn("Phone number already exists {}!",  ex.getMessage());
        Map<String, String> errors = new HashMap<>();
        errors.put("message", "Phone Number Already Exists");
        return ResponseEntity.badRequest().body(errors);
    }

    @ExceptionHandler(LeaveRequestNotFoundException.class)
    public ResponseEntity<Map<String, String>> LeaveRequestNotFoundException(Exception ex){
        log.warn("Leave Request not found {}!",  ex.getMessage());
        Map<String, String> errors = new HashMap<>();
        errors.put("message", "Leave Request Not Found");
        return ResponseEntity.badRequest().body(errors);
    }

    @ExceptionHandler(InvalidLeaveRequestStateException.class)
    public ResponseEntity<Map<String, String>> handleInvalidLeaveRequestState(InvalidLeaveRequestStateException ex){
        log.warn("Invalid leave-request state transition: {}", ex.getMessage());
        Map<String, String> errors = new HashMap<>();
        errors.put("message", ex.getMessage());
        return ResponseEntity.status(409).body(errors);
    }

    @ExceptionHandler(RestClientResponseException.class)
    public ResponseEntity<Map<String, String>> handleRestClientResponseException(RestClientResponseException ex) {
        log.warn("Upstream service returned {}: {}", ex.getRawStatusCode(), ex.getMessage());
        Map<String, String> errors = new HashMap<>();
        String body = ex.getResponseBodyAsString();
        errors.put("message", resolveUpstreamMessage(body));
        return ResponseEntity.status(ex.getRawStatusCode()).body(errors);
    }

    @ExceptionHandler(ResourceAccessException.class)
    public ResponseEntity<Map<String, String>> handleResourceAccessException(ResourceAccessException ex) {
        log.warn("Upstream service is unreachable: {}", ex.getMessage());
        Map<String, String> errors = new HashMap<>();
        errors.put("message", "Upstream service is unreachable");
        return ResponseEntity.status(502).body(errors);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, String>> handleDataIntegrityViolation(DataIntegrityViolationException ex) {
        log.warn("Data integrity violation: {}", ex.getMessage());
        Map<String, String> errors = new HashMap<>();
        String detail = ex.getMostSpecificCause() != null ? ex.getMostSpecificCause().getMessage() : ex.getMessage();
        if (detail != null && detail.contains("users_company_email_key")) {
            errors.put("message", "Email Already Exists");
        } else {
            errors.put("message", "Data integrity violation");
        }
        return ResponseEntity.badRequest().body(errors);
    }

    private String resolveUpstreamMessage(String body) {
        if (body == null || body.isBlank()) {
            return "Upstream service error";
        }
        try {
            ObjectMapper mapper = new ObjectMapper();
            JsonNode node = mapper.readTree(body);
            if (node.hasNonNull("message")) {
                String message = node.get("message").asText();
                return isSafeUpstreamMessage(message) ? message : "Upstream service error";
            }
        } catch (Exception ignored) {
        }
        return "Upstream service error";
    }

    private boolean isSafeUpstreamMessage(String message) {
        if (message == null || message.isBlank()) {
            return false;
        }
        if (message.contains("\n") || message.contains("\r") || message.contains("<") || message.contains(">")) {
            return false;
        }

        String normalized = message.toLowerCase();
        return !normalized.contains("exception")
                && !normalized.contains("stack trace")
                && !normalized.contains("org.")
                && !normalized.contains("jdbc:")
                && !normalized.contains("sql")
                && !normalized.contains(" at ");
    }
}
