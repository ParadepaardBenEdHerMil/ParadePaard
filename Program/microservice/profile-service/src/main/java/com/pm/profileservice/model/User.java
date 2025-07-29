package com.pm.profileservice.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "users")
public class User {
    @Id
    private UUID id;

    @NotNull
    @Email
    @Column(unique = true)
    private String email;

    @Column(nullable = false)
    private String role;

    // This field can be null and populated by the user later
    private String address;

    // This field can be null and populated by the user later
    private LocalDate dateOfBirth;

    // This should be set by the service upon profile creation
    @NotNull
    private LocalDate registeredDate;

    // This field can be null and populated by the user later
    @Column(unique = true)
    private String Iban;

    // This field can be null and populated by the user later
    @Column
    private String phoneNumber;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public LocalDate getDateOfBirth() {
        return dateOfBirth;
    }

    public void setDateOfBirth(LocalDate dateOfBirth) {
        this.dateOfBirth = dateOfBirth;
    }

    public LocalDate getRegisteredDate() {
        return registeredDate;
    }

    public void setRegisteredDate(LocalDate registeredDate) {
        this.registeredDate = registeredDate;
    }

    public String getIban() {
        return Iban;
    }

    public void setIban(String iban) {
        Iban = iban;
    }

    public String getPhoneNumber() {
        return phoneNumber;
    }

    public void setPhoneNumber(String phoneNumber) {
        this.phoneNumber = phoneNumber;
    }
}