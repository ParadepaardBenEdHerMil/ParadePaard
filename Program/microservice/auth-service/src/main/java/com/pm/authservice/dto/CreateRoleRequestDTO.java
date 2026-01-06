package com.pm.authservice.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public class CreateRoleRequestDTO {
    @NotBlank(message = "Role name is required")
    private String name;

    @NotEmpty(message = "At least one permission is required")
    private List<String> permissions;

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public List<String> getPermissions() { return permissions; }
    public void setPermissions(List<String> permissions) { this.permissions = permissions; }
}
