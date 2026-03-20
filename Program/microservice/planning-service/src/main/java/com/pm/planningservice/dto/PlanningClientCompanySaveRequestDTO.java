package com.pm.planningservice.dto;

import jakarta.validation.constraints.NotBlank;

import java.util.List;

public class PlanningClientCompanySaveRequestDTO {
    @NotBlank
    private String name;
    private String address;
    private String companyLine;
    private String notes;
    private List<PlanningClientCompanyContactSaveRequestDTO> contacts;

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

    public List<PlanningClientCompanyContactSaveRequestDTO> getContacts() {
        return contacts;
    }

    public void setContacts(List<PlanningClientCompanyContactSaveRequestDTO> contacts) {
        this.contacts = contacts;
    }
}
