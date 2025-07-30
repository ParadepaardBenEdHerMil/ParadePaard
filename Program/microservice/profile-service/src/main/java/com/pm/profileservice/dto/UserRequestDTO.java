package com.pm.profileservice.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public class UserRequestDTO {
    @NotBlank(message = "Email is required")
    @Email(message = "Email should be valid")
    private String Email;

    @NotBlank(message = "UUID is required")
    private String UUID;

}
