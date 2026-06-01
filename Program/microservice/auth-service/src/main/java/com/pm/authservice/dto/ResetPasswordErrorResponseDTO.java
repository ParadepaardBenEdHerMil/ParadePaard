package com.pm.authservice.dto;

/**
 * Error body returned by POST /reset-password when the request cannot be fulfilled.
 * The {@code code} field is a stable machine-readable identifier; {@code message}
 * is a human-readable fallback intended for display to end users.
 */
public class ResetPasswordErrorResponseDTO {
    private String code;
    private String message;

    public ResetPasswordErrorResponseDTO() {
    }

    public ResetPasswordErrorResponseDTO(String code, String message) {
        this.code = code;
        this.message = message;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }
}
