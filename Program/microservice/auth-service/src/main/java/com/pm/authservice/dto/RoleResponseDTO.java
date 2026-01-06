package com.pm.authservice.dto;

import java.util.List;

public class RoleResponseDTO {
    private String id;
    private String name;
    private List<String> permissions;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public List<String> getPermissions() { return permissions; }
    public void setPermissions(List<String> permissions) { this.permissions = permissions; }
}
