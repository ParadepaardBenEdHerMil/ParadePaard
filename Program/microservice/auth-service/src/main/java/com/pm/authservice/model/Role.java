// src/main/java/com/pm/authservice/model/Role.java
package com.pm.authservice.model;

import jakarta.persistence.*;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "roles")
public class Role {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(nullable = false, unique = true)
    private String name; // examples: USER, ADMIN

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
            name = "role_permissions",
            joinColumns = @JoinColumn(name = "role_id"),
            inverseJoinColumns = @JoinColumn(name = "permission_id")
    )
    private List<Permission> permissions = new ArrayList<>();

    public Role() {}
    public Role(String name) { this.name = name; }
    public Role(String name, List<Permission> permissions) {
        this.name = name;
        this.permissions = permissions == null ? new ArrayList<>() : permissions;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public List<Permission> getPermissions() { return permissions; }
    public void setPermissions(List<Permission> permissions) {
        this.permissions = permissions == null ? new ArrayList<>() : permissions;
    }
}
