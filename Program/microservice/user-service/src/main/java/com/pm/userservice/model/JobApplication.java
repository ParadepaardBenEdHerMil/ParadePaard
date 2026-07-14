package com.pm.userservice.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "job_applications")
public class JobApplication {
    @Id
    @GeneratedValue
    private UUID applicationId;

    @Column(nullable = false)
    private String firstNames;
    private String preferredName;
    private String middleNamePrefix;

    @Column(nullable = false)
    private String lastName;

    @Column(nullable = false)
    private String email;

    @Column(nullable = false)
    private String phoneNumber;

    @Column(nullable = false)
    private LocalDate dateOfBirth;

    private String gender;
    private String nationality;
    private String city;
    private String country;
    private String roleInterest;
    private String contractPreference;
    private LocalDate availableFrom;

    @Column(length = 2000)
    private String note;

    @Column(nullable = false)
    private boolean workedForUsBefore;

    @Column(nullable = false)
    private boolean contactConsent;

    @Column(nullable = false)
    private boolean informationAccurate;

    private String cvFileName;
    private String cvContentType;
    private byte[] cvBytes;
    private String profilePictureFileName;
    private String profilePictureContentType;
    private byte[] profilePictureBytes;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ApplicationStatus status = ApplicationStatus.APPLICATION_SUBMITTED;

    @Column(length = 4000)
    private String reviewNote;

    private OffsetDateTime reviewedAt;
    private String reviewedByUserId;
    private Boolean decisionEmailSent;
    private UUID acceptedUserId;

    // Per-applicant override: when true this person is barred from submitting a new application,
    // even if the company otherwise allows reapplications. Set from the application detail page.
    @Column(name = "reapplication_blocked", nullable = false)
    private boolean reapplicationBlocked = false;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private OffsetDateTime submittedAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private OffsetDateTime updatedAt;

    public UUID getApplicationId() {
        return applicationId;
    }

    public void setApplicationId(UUID applicationId) {
        this.applicationId = applicationId;
    }

    public String getFirstNames() {
        return firstNames;
    }

    public void setFirstNames(String firstNames) {
        this.firstNames = firstNames;
    }

    public String getPreferredName() {
        return preferredName;
    }

    public void setPreferredName(String preferredName) {
        this.preferredName = preferredName;
    }

    public String getMiddleNamePrefix() {
        return middleNamePrefix;
    }

    public void setMiddleNamePrefix(String middleNamePrefix) {
        this.middleNamePrefix = middleNamePrefix;
    }

    public String getLastName() {
        return lastName;
    }

    public void setLastName(String lastName) {
        this.lastName = lastName;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPhoneNumber() {
        return phoneNumber;
    }

    public void setPhoneNumber(String phoneNumber) {
        this.phoneNumber = phoneNumber;
    }

    public LocalDate getDateOfBirth() {
        return dateOfBirth;
    }

    public void setDateOfBirth(LocalDate dateOfBirth) {
        this.dateOfBirth = dateOfBirth;
    }

    public String getGender() {
        return gender;
    }

    public void setGender(String gender) {
        this.gender = gender;
    }

    public String getNationality() {
        return nationality;
    }

    public void setNationality(String nationality) {
        this.nationality = nationality;
    }

    public String getCity() {
        return city;
    }

    public void setCity(String city) {
        this.city = city;
    }

    public String getCountry() {
        return country;
    }

    public void setCountry(String country) {
        this.country = country;
    }

    public String getRoleInterest() {
        return roleInterest;
    }

    public void setRoleInterest(String roleInterest) {
        this.roleInterest = roleInterest;
    }

    public String getContractPreference() {
        return contractPreference;
    }

    public void setContractPreference(String contractPreference) {
        this.contractPreference = contractPreference;
    }

    public LocalDate getAvailableFrom() {
        return availableFrom;
    }

    public void setAvailableFrom(LocalDate availableFrom) {
        this.availableFrom = availableFrom;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }

    public boolean isWorkedForUsBefore() {
        return workedForUsBefore;
    }

    public void setWorkedForUsBefore(boolean workedForUsBefore) {
        this.workedForUsBefore = workedForUsBefore;
    }

    public boolean isContactConsent() {
        return contactConsent;
    }

    public void setContactConsent(boolean contactConsent) {
        this.contactConsent = contactConsent;
    }

    public boolean isInformationAccurate() {
        return informationAccurate;
    }

    public void setInformationAccurate(boolean informationAccurate) {
        this.informationAccurate = informationAccurate;
    }

    public String getCvFileName() {
        return cvFileName;
    }

    public void setCvFileName(String cvFileName) {
        this.cvFileName = cvFileName;
    }

    public String getCvContentType() {
        return cvContentType;
    }

    public void setCvContentType(String cvContentType) {
        this.cvContentType = cvContentType;
    }

    public byte[] getCvBytes() {
        return cvBytes;
    }

    public void setCvBytes(byte[] cvBytes) {
        this.cvBytes = cvBytes;
    }

    public String getProfilePictureFileName() {
        return profilePictureFileName;
    }

    public void setProfilePictureFileName(String profilePictureFileName) {
        this.profilePictureFileName = profilePictureFileName;
    }

    public String getProfilePictureContentType() {
        return profilePictureContentType;
    }

    public void setProfilePictureContentType(String profilePictureContentType) {
        this.profilePictureContentType = profilePictureContentType;
    }

    public byte[] getProfilePictureBytes() {
        return profilePictureBytes;
    }

    public void setProfilePictureBytes(byte[] profilePictureBytes) {
        this.profilePictureBytes = profilePictureBytes;
    }

    public ApplicationStatus getStatus() {
        return status;
    }

    public void setStatus(ApplicationStatus status) {
        this.status = status;
    }

    public String getReviewNote() {
        return reviewNote;
    }

    public void setReviewNote(String reviewNote) {
        this.reviewNote = reviewNote;
    }

    public OffsetDateTime getReviewedAt() {
        return reviewedAt;
    }

    public void setReviewedAt(OffsetDateTime reviewedAt) {
        this.reviewedAt = reviewedAt;
    }

    public String getReviewedByUserId() {
        return reviewedByUserId;
    }

    public void setReviewedByUserId(String reviewedByUserId) {
        this.reviewedByUserId = reviewedByUserId;
    }

    public Boolean getDecisionEmailSent() {
        return decisionEmailSent;
    }

    public void setDecisionEmailSent(Boolean decisionEmailSent) {
        this.decisionEmailSent = decisionEmailSent;
    }

    public UUID getAcceptedUserId() {
        return acceptedUserId;
    }

    public void setAcceptedUserId(UUID acceptedUserId) {
        this.acceptedUserId = acceptedUserId;
    }

    public boolean isReapplicationBlocked() {
        return reapplicationBlocked;
    }

    public void setReapplicationBlocked(boolean reapplicationBlocked) {
        this.reapplicationBlocked = reapplicationBlocked;
    }

    public OffsetDateTime getSubmittedAt() {
        return submittedAt;
    }

    public void setSubmittedAt(OffsetDateTime submittedAt) {
        this.submittedAt = submittedAt;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(OffsetDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
