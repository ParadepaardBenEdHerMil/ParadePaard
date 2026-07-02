package com.pm.timesheetservice.exception;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
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

    @ExceptionHandler(TimesheetNotFoundException.class)
    public ResponseEntity<Map<String, String>> handleTimesheetNotFoundException(Exception ex){
        log.warn("Timesheet Not Found {}!",  ex.getMessage());
        Map<String, String> errors = new HashMap<>();
        errors.put("message", "Timesheet Not Found");
        return ResponseEntity.badRequest().body(errors);
    }

    @ExceptionHandler(InvalidTimesheetStateException.class)
    public ResponseEntity<Map<String, String>> handleInvalidTimesheetState(InvalidTimesheetStateException ex){
        log.warn("Invalid timesheet state transition: {}", ex.getMessage());
        Map<String, String> errors = new HashMap<>();
        errors.put("message", ex.getMessage());
        return ResponseEntity.status(HttpStatus.CONFLICT).body(errors);
    }
}
