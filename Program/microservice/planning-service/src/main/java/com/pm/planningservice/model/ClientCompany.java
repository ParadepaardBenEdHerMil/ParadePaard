package com.pm.planningservice.model;

import jakarta.persistence.Column;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "planning_client_companies", indexes = {
        @Index(name = "idx_planning_client_owner", columnList = "owner_company_id"),
        @Index(name = "idx_planning_client_name", columnList = "name")
})
public class ClientCompany {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    @Column(nullable = false)
    private UUID clientCompanyId;

    @Column(name = "owner_company_id", nullable = false)
    private UUID ownerCompanyId;

    @Column(nullable = false)
    private String name;

    private String address;

    private String companyLine;

    @Column(length = 4000)
    private String notes;

    // The Flyway schema stores this column as plain TEXT (a URL or remote
    // reference, not a binary blob). Annotating it with @Lob made Hibernate
    // think it should be a PostgreSQL `oid` (large object) and try to alter
    // the column on every startup under update/create ddl-auto. columnDefinition
    // pins it to TEXT so the entity matches the Flyway-owned schema.
    @Column(columnDefinition = "text")
    private String profilePictureUrl;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(
            name = "planning_client_company_contacts",
            joinColumns = @JoinColumn(name = "client_company_id")
    )
    @OrderColumn(name = "contact_order")
    private List<ClientCompanyContact> contacts = new ArrayList<>();

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public UUID getClientCompanyId() {
        return clientCompanyId;
    }

    public void setClientCompanyId(UUID clientCompanyId) {
        this.clientCompanyId = clientCompanyId;
    }

    public UUID getOwnerCompanyId() {
        return ownerCompanyId;
    }

    public void setOwnerCompanyId(UUID ownerCompanyId) {
        this.ownerCompanyId = ownerCompanyId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public String getCompanyLine() {
        return companyLine;
    }

    public void setCompanyLine(String companyLine) {
        this.companyLine = companyLine;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public String getProfilePictureUrl() {
        return profilePictureUrl;
    }

    public void setProfilePictureUrl(String profilePictureUrl) {
        this.profilePictureUrl = profilePictureUrl;
    }

    public List<ClientCompanyContact> getContacts() {
        return contacts;
    }

    public void setContacts(List<ClientCompanyContact> contacts) {
        this.contacts = contacts == null ? new ArrayList<>() : new ArrayList<>(contacts);
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
