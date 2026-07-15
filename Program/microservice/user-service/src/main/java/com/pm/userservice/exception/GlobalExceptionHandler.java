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
import org.springframework.web.context.request.async.AsyncRequestNotUsableException;
import org.springframework.web.context.request.async.AsyncRequestTimeoutException;

import java.time.format.DateTimeParseException;
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

    @ExceptionHandler(ReapplicationNotAllowedException.class)
    public ResponseEntity<Map<String, String>> handleReapplicationNotAllowed(ReapplicationNotAllowedException ex){
        log.warn("Reapplication refused: {}", ex.getMessage());
        Map<String, String> errors = new HashMap<>();
        errors.put("message", ex.getMessage());
        return ResponseEntity.status(org.springframework.http.HttpStatus.CONFLICT).body(errors);
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

    @ExceptionHandler(InsufficientLeaveBalanceException.class)
    public ResponseEntity<Map<String, String>> handleInsufficientLeaveBalance(InsufficientLeaveBalanceException ex){
        log.warn("Insufficient leave balance: {}", ex.getMessage());
        Map<String, String> errors = new HashMap<>();
        errors.put("message", ex.getMessage());
        return ResponseEntity.status(409).body(errors);
    }

    @ExceptionHandler(InvalidFileUploadException.class)
    public ResponseEntity<Map<String, String>> handleInvalidFileUpload(InvalidFileUploadException ex){
        log.warn("Invalid file upload: {}", ex.getMessage());
        Map<String, String> errors = new HashMap<>();
        errors.put("message", ex.getMessage());
        return ResponseEntity.badRequest().body(errors);
    }

    /**
     * A malformed date (e.g. an applicant typing "11/30/2004") must not become a 500. Return a
     * clean 400 with the caller-supplied friendly message; sanitise the raw JDK text
     * ("Text '...' could not be parsed") so we never leak internals to the user.
     */
    @ExceptionHandler(DateTimeParseException.class)
    public ResponseEntity<Map<String, String>> handleDateTimeParse(DateTimeParseException ex) {
        log.warn("Invalid date input: {}", ex.getMessage());
        String message = ex.getMessage();
        if (message == null || message.contains("could not be parsed") || message.startsWith("Text ")) {
            message = "One of the dates you entered is not valid. Please use the day/month/year format.";
        }
        Map<String, String> errors = new HashMap<>();
        errors.put("message", message);
        return ResponseEntity.badRequest().body(errors);
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

    @ExceptionHandler(org.springframework.web.multipart.MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, String>> handleMaxUploadSize(org.springframework.web.multipart.MaxUploadSizeExceededException ex) {
        log.warn("Upload exceeds the size limit: {}", ex.getMessage());
        Map<String, String> errors = new HashMap<>();
        errors.put("message", "Uploaded file is too large");
        return ResponseEntity.status(413).body(errors);
    }

    /**
     * A client that disconnects mid-response (typically the /me/stream SSE endpoint) makes the
     * flush throw AsyncRequestNotUsableException ("Broken pipe"). The response is already
     * committed as text/event-stream, so we cannot render our JSON error body — doing so throws
     * HttpMessageNotWritableException ("No converter ... for text/event-stream") and spams two
     * ERROR stack traces per disconnect. This is a benign, expected event: log it at debug and
     * return void so Spring ends the already-committed stream quietly.
     *
     * Note this is separate from the AsyncRequestTimeoutException guard in
     * handleUnexpectedException: that type is a RuntimeException and can be rethrown, whereas
     * AsyncRequestNotUsableException extends IOException and would fail the (RuntimeException) cast.
     */
    @ExceptionHandler(AsyncRequestNotUsableException.class)
    public void handleAsyncRequestNotUsable(AsyncRequestNotUsableException ex) {
        log.debug("Client disconnected during async/SSE response: {}", ex.getMessage());
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handleUnexpectedException(Exception ex) {
        // Framework exceptions that carry their own HTTP status (security 401/403, and
        // ResponseStatusException like the 400/413 the upload validation throws) must NOT be
        // turned into a blanket 500 here; rethrow them (all unchecked) so the framework
        // produces the intended status.
        //
        // AsyncRequestTimeoutException is the normal end of an idle SSE stream
        // (MessageController /me/stream, text/event-stream). If we try to render our JSON
        // error body for it, Jackson has no converter for the SSE content type and throws
        // HttpMessageNotWritableException, spamming ERROR logs. Rethrow so Spring's default
        // resolver ends the already-committed stream quietly.
        if (ex instanceof org.springframework.security.access.AccessDeniedException
                || ex instanceof org.springframework.security.core.AuthenticationException
                || ex instanceof org.springframework.web.server.ResponseStatusException
                || ex instanceof org.springframework.web.multipart.MaxUploadSizeExceededException
                || ex instanceof AsyncRequestTimeoutException) {
            throw (RuntimeException) ex;
        }
        log.error("Unexpected exception", ex);
        Map<String, String> errors = new HashMap<>();
        errors.put("message", "Internal server error");
        return ResponseEntity.status(500).body(errors);
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
