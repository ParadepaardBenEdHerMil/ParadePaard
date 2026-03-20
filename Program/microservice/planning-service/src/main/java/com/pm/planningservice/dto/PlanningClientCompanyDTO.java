package com.pm.planningservice.dto;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public class PlanningClientCompanyDTO {
    private UUID clientCompanyId;
    private String name;
    private String address;
    private String companyLine;
    private String notes;
    private List<PlanningClientCompanyContactDTO> contacts;
    private LocalDateTime createdAt;

    public UUID getClientCompanyId() {
        return clientCompanyId;
    }

    public void setClientCompanyId(UUID clientCompanyId) {
        this.clientCompanyId = clientCompanyId;
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

    public List<PlanningClientCompanyContactDTO> getContacts() {
        return contacts;
    }

    public void setContacts(List<PlanningClientCompanyContactDTO> contacts) {
        this.contacts = contacts;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
