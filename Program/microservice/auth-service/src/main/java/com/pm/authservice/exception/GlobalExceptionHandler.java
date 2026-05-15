package com.pm.authservice.exception;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;

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

    @ExceptionHandler(UsernameAlreadyExistsException.class)
    public ResponseEntity<Map<String, String>> handleUsernameAlreadyExistsException(Exception ex){
        log.warn("Username already exists {}!",  ex.getMessage());
        Map<String, String> errors = new HashMap<>();
        errors.put("message", "Username Already Exists");
        return ResponseEntity.badRequest().body(errors);
    }

    @ExceptionHandler(RoleDoesNotExistException.class)
    public ResponseEntity<Map<String, String>> handleRoleDoesNotExistException(RoleDoesNotExistException ex) {
        log.warn("Role does not exist: {}", ex.getMessage());
        Map<String, String> errors = new HashMap<>();
        errors.put("message", "Role does not exist");
        return ResponseEntity.badRequest().body(errors);
    }

    @ExceptionHandler(RoleAlreadyExistsException.class)
    public ResponseEntity<Map<String, String>> handleRoleAlreadyExistsException(RoleAlreadyExistsException ex) {
        log.warn("Role already exists: {}", ex.getMessage());
        Map<String, String> errors = new HashMap<>();
        errors.put("message", "Role already exists");
        return ResponseEntity.badRequest().body(errors);
    }

    @ExceptionHandler(PermissionDoesNotExistException.class)
    public ResponseEntity<Map<String, String>> handlePermissionDoesNotExistException(PermissionDoesNotExistException ex) {
        log.warn("Permission does not exist: {}", ex.getMessage());
        Map<String, String> errors = new HashMap<>();
        errors.put("message", "Permission does not exist");
        return ResponseEntity.badRequest().body(errors);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleIllegalArgumentException(IllegalArgumentException ex) {
        log.warn("Invalid request: {}", ex.getMessage());
        Map<String, String> errors = new HashMap<>();
        errors.put("message", ex.getMessage());
        return ResponseEntity.badRequest().body(errors);
    }

    @ExceptionHandler(UserNotFoundException.class)
    public ResponseEntity<Map<String, String>> handleUserNotFoundException(UserNotFoundException ex) {
        log.warn("User not found: {}", ex.getMessage());
        Map<String, String> errors = new HashMap<>();
        errors.put("message", "User not found");
        return ResponseEntity.status(404).body(errors);
    }

}
