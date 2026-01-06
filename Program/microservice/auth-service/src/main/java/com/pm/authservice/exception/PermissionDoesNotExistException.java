package com.pm.authservice.exception;

public class PermissionDoesNotExistException extends RuntimeException {
    public PermissionDoesNotExistException(String message) {
        super(message);
    }
}
